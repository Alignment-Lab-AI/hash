#![feature(impl_trait_in_assoc_type, return_type_notation)]
#![expect(clippy::future_not_send)]

pub use self::subcommand::Subcommand;

mod subcommand;

use core::error::Error;

use clap::Parser as _;
use hash_tracing::{TracingConfig, init_tracing};
use tokio::runtime::Handle;

pub trait Command {
    async fn execute(self) -> Result<(), Box<dyn Error>>;
}

/// Arguments passed to the program.
#[derive(Debug, clap::Parser)]
#[clap(version, author, about, long_about = None)]
pub struct Entry {
    #[clap(flatten)]
    pub tracing_config: TracingConfig,
    /// Specify a subcommand to run.
    #[command(subcommand)]
    pub subcommand: Subcommand,
}

fn main() -> Result<(), Box<dyn Error>> {
    let entry = Entry::parse();

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(async {
            let handle = Handle::current();
            let _log_guard = init_tracing(entry.tracing_config, &handle)
                .expect("should be able to initialize tracing");

            entry.subcommand.execute().await
        })
}