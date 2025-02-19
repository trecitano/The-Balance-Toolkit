// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    print!("Lets go!")
    println!("{:?}", address_to_wii_pin());
    //balance_toolkit_app_lib::run()
}
