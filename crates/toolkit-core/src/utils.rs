use crate::types::MacAddress;

/// Formats a MAC address stored in the lower 48 bits of a `u64` as `aa:bb:cc:dd:ee:ff`.
pub fn mac_address_human_name(mac_address: MacAddress) -> String {
    format!(
        "{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        (mac_address >> 40) & 0xFF,
        (mac_address >> 32) & 0xFF,
        (mac_address >> 24) & 0xFF,
        (mac_address >> 16) & 0xFF,
        (mac_address >> 8) & 0xFF,
        mac_address & 0xFF
    )
}
