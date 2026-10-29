fn main() {
    // The macOS dev Dock icon is embedded by generate_context!. Recompile when
    // icon assets change, even when no Rust source or Tauri config has changed.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
