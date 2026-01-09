use crate::types::MacAddress;

// In our system, we represent MacAddresses by a u64.
// The MacAddress is stored in little endian, meaning the lower 48 bits.
pub fn u64_to_u8_mac_address(n: u64) -> [u8; 6] {
    let mut mac_address = [0u8; 6];

    for i in 0..6 {
        mac_address[5 - i] = ((n >> (8 * i)) & 0xFF) as u8;
    }

    mac_address
}

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
