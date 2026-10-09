pub mod embedded_assets;
pub mod routes;

pub use embedded_assets::static_handler;
pub use routes::{create_api_router, AppState};
