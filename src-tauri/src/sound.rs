//! Alert sound: a built-in chime synthesized at runtime, or a short audio file
//! the user picked. Played through rodio so volume works the same everywhere.

use rodio::buffer::SamplesBuffer;
use rodio::{Decoder, DeviceSinkBuilder, Player, Source};
use std::io::Cursor;
use std::num::NonZero;
use std::path::{Path, PathBuf};

/// Longest custom sound we accept, in seconds (a little slack for encoder padding).
pub const MAX_SECONDS: f64 = 5.0;
const SLACK_SECONDS: f64 = 0.25;
/// Largest file we accept; 5 s of uncompressed 48 kHz stereo is under 2 MB.
pub const MAX_BYTES: usize = 5 * 1024 * 1024;
pub const EXTENSIONS: [&str; 6] = ["wav", "mp3", "ogg", "flac", "m4a", "aac"];

/// Plays in a background thread so the caller never waits; errors are logged.
pub fn play(volume_pct: u8, file: Option<PathBuf>) {
    std::thread::spawn(move || {
        if let Err(e) = play_blocking(volume_pct, file.as_deref()) {
            eprintln!("pivot: could not play the alert sound: {e}");
        }
    });
}

fn play_blocking(volume_pct: u8, file: Option<&Path>) -> Result<(), String> {
    let sink = DeviceSinkBuilder::open_default_sink().map_err(|e| e.to_string())?;
    let player = Player::connect_new(sink.mixer());
    player.set_volume(volume_pct.min(100) as f32 / 100.0);
    match file.and_then(|f| std::fs::read(f).ok()) {
        Some(bytes) => player.append(Decoder::new(Cursor::new(bytes)).map_err(|e| e.to_string())?),
        None => player.append(chime()),
    }
    player.sleep_until_end();
    Ok(())
}

/// Three rising notes, played twice: E5, G5, C6 with a soft bell-like decay.
fn chime() -> SamplesBuffer {
    const RATE: u32 = 44_100;
    let notes = [659.25_f32, 783.99, 1046.5];
    let total = (RATE as f32 * 2.4) as usize;
    let mut samples = vec![0.0_f32; total];
    for rep in [0.0_f32, 1.2] {
        for (i, freq) in notes.iter().enumerate() {
            let start = ((rep + i as f32 * 0.18) * RATE as f32) as usize;
            let len = (RATE as f32 * 0.9) as usize;
            for n in 0..len {
                let Some(slot) = samples.get_mut(start + n) else { break };
                let t = n as f32 / RATE as f32;
                let attack = (t / 0.01).min(1.0);
                let decay = (-t * 5.0).exp();
                let tone = (2.0 * std::f32::consts::PI * freq * t).sin() + 0.3 * (4.0 * std::f32::consts::PI * freq * t).sin();
                *slot += 0.22 * attack * decay * tone;
            }
        }
    }
    SamplesBuffer::new(NonZero::new(1).unwrap(), NonZero::new(RATE).unwrap(), samples)
}

/// Checks that `bytes` decode as audio no longer than `MAX_SECONDS`; returns the length.
pub fn validate(bytes: Vec<u8>) -> Result<f64, String> {
    if bytes.len() > MAX_BYTES {
        return Err("too_big".into());
    }
    let decoder = Decoder::new(Cursor::new(bytes)).map_err(|_| "unsupported".to_string())?;
    let seconds = match decoder.total_duration() {
        Some(d) => d.as_secs_f64(),
        None => {
            let per_second = decoder.channels().get() as f64 * decoder.sample_rate().get() as f64;
            decoder.count() as f64 / per_second
        }
    };
    if seconds <= 0.0 {
        return Err("unsupported".into());
    }
    if seconds > MAX_SECONDS + SLACK_SECONDS {
        return Err(format!("too_long:{seconds:.1}"));
    }
    Ok(seconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A mono 16-bit WAV of `seconds` of silence.
    fn wav(seconds: f32) -> Vec<u8> {
        let rate = 8000u32;
        let n = (rate as f32 * seconds) as u32;
        let data_len = n * 2;
        let mut out = Vec::new();
        out.extend(b"RIFF");
        out.extend((36 + data_len).to_le_bytes());
        out.extend(b"WAVEfmt ");
        out.extend(16u32.to_le_bytes());
        out.extend(1u16.to_le_bytes()); // PCM
        out.extend(1u16.to_le_bytes()); // mono
        out.extend(rate.to_le_bytes());
        out.extend((rate * 2).to_le_bytes());
        out.extend(2u16.to_le_bytes());
        out.extend(16u16.to_le_bytes());
        out.extend(b"data");
        out.extend(data_len.to_le_bytes());
        out.extend(vec![0u8; data_len as usize]);
        out
    }

    #[test]
    fn accepts_short_audio_and_rejects_long_or_garbage() {
        let secs = validate(wav(3.0)).unwrap();
        assert!((secs - 3.0).abs() < 0.05);
        assert!(validate(wav(5.2)).is_ok(), "small encoder slack is fine");
        assert!(validate(wav(8.0)).unwrap_err().starts_with("too_long"));
        assert_eq!(validate(b"not audio at all".to_vec()).unwrap_err(), "unsupported");
    }

    #[test]
    fn chime_is_short_and_not_clipping() {
        let c = chime();
        let secs = c.total_duration().unwrap().as_secs_f32();
        assert!(secs > 2.0 && secs < 3.0);
        assert!(c.into_iter().all(|s| s.abs() <= 1.0));
    }
}
