pub mod file_writer;
pub mod lsl_writer;
pub mod data_processor;
pub mod tcp_writer;
#[cfg(not(feature = "mock"))]
pub mod board_hid_reader;
#[cfg(feature = "mock")]
pub mod board_hid_reader_mock;