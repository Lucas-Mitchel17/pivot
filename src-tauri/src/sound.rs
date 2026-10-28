//! Alert sound, played with each platform's own player and alarm sound so the
//! app ships no audio file and the webview's autoplay rules don't apply.

use std::process::{Command, Stdio};

/// Plays the alarm twice in a background thread; failures are silent.
pub fn play_alarm() {
    std::thread::spawn(|| {
        for _ in 0..2 {
            if !play_once() {
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(400));
        }
    });
}

fn run(cmd: &str, args: &[&str]) -> bool {
    Command::new(cmd)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn play_once() -> bool {
    const FILES: [&str; 2] = [
        "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga",
        "/usr/share/sounds/freedesktop/stereo/complete.oga",
    ];
    if run("canberra-gtk-play", &["-i", "alarm-clock-elapsed"]) {
        return true;
    }
    for file in FILES.iter().filter(|f| std::path::Path::new(f).exists()) {
        for player in ["pw-play", "paplay", "ogg123"] {
            if run(player, &[file]) {
                return true;
            }
        }
    }
    false
}

#[cfg(target_os = "macos")]
fn play_once() -> bool {
    run("afplay", &["/System/Library/Sounds/Glass.aiff"])
}

#[cfg(target_os = "windows")]
fn play_once() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(New-Object Media.SoundPlayer 'C:\\Windows\\Media\\Alarm01.wav').PlaySync()",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}
