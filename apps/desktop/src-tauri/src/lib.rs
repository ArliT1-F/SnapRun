use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

fn behavior(app: &tauri::AppHandle, key: &str) -> bool {
    let path = match app.path().app_config_dir() { Ok(p) => p.join("preferences.json"), Err(_) => return true };
    let text = match std::fs::read_to_string(path) { Ok(t) => t, Err(_) => return true };
    let value: serde_json::Value = match serde_json::from_str(&text) { Ok(v) => v, Err(_) => return true };
    value["settings"]["desktop"][key].as_bool().unwrap_or(true)
}
fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize(); let _ = window.show(); let _ = window.set_focus();
    }
}
#[tauri::command]
fn open_official_snapchat(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|_| "Invalid URL".to_string())?;
    if parsed.scheme() != "https" || !matches!(parsed.host_str(), Some("web.snapchat.com" | "help.snapchat.com" | "accounts.snapchat.com" | "snapchat.com")) {
        return Err("Only official Snapchat HTTPS destinations are allowed".into());
    }
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(url, None::<&str>).map_err(|_| "Could not open the system browser".to_string())
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_official_snapchat])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Open SnapRun", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit SnapRun", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let mut tray = TrayIconBuilder::with_id("snaprun-tray").menu(&menu).show_menu_on_left_click(false).tooltip("SnapRun — your space, in sync");
            if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
            tray.on_menu_event(|app, event| match event.id.as_ref() { "show" => show_window(app), "quit" => app.exit(0), _ => {} })
                .on_tray_icon_event(|tray, event| { if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event { show_window(tray.app_handle()); } })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" { return; }
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    if behavior(window.app_handle(), "closeToTray") { api.prevent_close(); let _ = window.hide(); }
                }
                WindowEvent::Resized(_) => {
                    if window.is_minimized().unwrap_or(false) && behavior(window.app_handle(), "minimizeToTray") { let _ = window.hide(); }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("SnapRun could not start");
}
