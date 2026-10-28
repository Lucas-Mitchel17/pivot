//! Pivot's core: storage, timers, reminders, summaries and terminal commands.
//! No UI here, so everything can be tested with `cargo test -p pivot-core`.

pub mod cli;
pub mod db;
pub mod engine;
pub mod i18n;
pub mod stats;
