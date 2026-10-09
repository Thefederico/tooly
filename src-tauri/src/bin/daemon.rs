use axum::Router;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tooly_lib::server::{create_api_router, static_handler, AppState};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let state = AppState::default();
    let app = Router::new()
        .merge(create_api_router(state))
        .fallback(static_handler);

    let port: u16 = std::env::var("TOOLY_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8888);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("🎮 Tooly Daemon activo en http://{}", addr);

    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
