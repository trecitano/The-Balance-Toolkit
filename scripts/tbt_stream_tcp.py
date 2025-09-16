#!/usr/bin/env python3
r"""
The Balance Toolkit - TCP Stream Inspector

Python tool for inspecting and monitoring data streams via TCP connection.

## Prerequisites - The Balance Toolkit Setup

Before running this script, you need to start The Balance Toolkit application and configure it:

1. Launch The Balance Toolkit application
2. Go to "Devices" menu and add a board/device
3. Go to "Session" menu and add the configured board to your session
4. Toggle TCP streaming ON in the session configuration
5. Start recording to begin streaming data via TCP
6. Run this script to monitor the TCP streams

## Quick Start

1. Setup virtual environment:

   Windows:
   python -m venv venv
   venv\Scripts\activate

   macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate

2. Run:

   Windows:
   python tcp_inspector.py

   macOS/Linux:
   python3 tcp_inspector.py

3. Usage:
   - Script connects to TCP endpoint at localhost:11223
   - Receives binary data packets (40 bytes each)
   - Displays real-time force sensor and CoP data
   - Press Ctrl+C to stop streaming

## Binary Data Format (40 bytes per sample)

Bytes 0-7:   timestamp (microseconds, big-endian i64)
Bytes 8-15:  mac_address (big-endian u64)
Bytes 16-19: top_right force (big-endian f32)
Bytes 20-23: bottom_right force (big-endian f32)
Bytes 24-27: top_left force (big-endian f32)
Bytes 28-31: bottom_left force (big-endian f32)
Bytes 32-35: cop_x (big-endian f32)
Bytes 36-39: cop_y (big-endian f32)

## Example Output

Sample   Time     time_diff  timestamp       mac_address          top_right     bottom_right  top_left      bottom_left   cop_x         cop_y
------------------------------------------------------------------------------------------------------------------------------------------
1        0.1      15.3       14:30:25.123456 AA:BB:CC:DD:EE:FF    53.863        51.088        20.774        19.704        0.443         0.026
2        0.2      14.8       14:30:25.133789 AA:BB:CC:DD:EE:FF    53.970        51.029        20.844        19.708        0.443         0.028
"""

import time
import socket
import struct
import math
from datetime import datetime

# TCP connection settings
TCP_HOST = '::1'
TCP_PORT = 11223

# Binary packet size (40 bytes)
PACKET_SIZE = 40


class Stats:
    """Statistics calculator using Welford's online algorithm"""

    def __init__(self):
        self.count = 0
        self.mean = 0.0
        self.m2 = 0.0  # helper for variance
        self.min_val = float('inf')
        self.max_val = float('-inf')

    def update(self, value):
        """Update statistics with a new value"""
        self.count += 1

        # Online mean and variance calculation (Welford's algorithm)
        delta = value - self.mean
        self.mean += delta / self.count
        delta2 = value - self.mean
        self.m2 += delta * delta2

        if value < self.min_val:
            self.min_val = value
        if value > self.max_val:
            self.max_val = value

    def get_variance(self):
        """Get sample variance"""
        if self.count < 2:
            return None
        return self.m2 / (self.count - 1.0)

    def get_std_dev(self):
        """Get standard deviation"""
        variance = self.get_variance()
        return math.sqrt(variance) if variance is not None else None

    def get_confidence_interval_95(self):
        """Get 95% confidence interval"""
        if self.count < 2:
            return None

        std_dev = self.get_std_dev()
        if std_dev is None:
            return None

        se = std_dev / math.sqrt(self.count)
        margin = 1.96 * se  # z-value for 95% confidence

        return (self.mean - margin, self.mean + margin)

    def print_stats(self):
        """Print comprehensive statistics summary"""
        ci = self.get_confidence_interval_95()
        std_dev = self.get_std_dev()

        if ci and std_dev:
            print(f"Count={self.count}, Mean={self.mean:.2f}ms, StdDev={std_dev:.2f}ms, "
                  f"Min={self.min_val:.2f}ms, Max={self.max_val:.2f}ms, "
                  f"95% CI=({ci[0]:.2f}ms, {ci[1]:.2f}ms)")
        else:
            print(f"Count={self.count}, Mean={self.mean:.2f}ms, "
                  f"Min={self.min_val:.2f}ms, Max={self.max_val:.2f}ms "
                  f"(insufficient data for CI)")


def connect_tcp_socket():
    """Create TCP socket connection to endpoint"""
    try:
        sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        sock.settimeout(5.0)
        sock.connect((TCP_HOST, TCP_PORT))
        return sock
    except Exception as e:
        print(f"Failed to connect to {TCP_HOST}:{TCP_PORT} - {e}")
        return None


def parse_binary_packet(data):
    """Parse 40-byte binary packet from Rust code"""
    if len(data) < PACKET_SIZE:
        return None

    try:
        # Unpack binary data (all big-endian)
        # 8 bytes: timestamp (i64)
        # 8 bytes: mac_address (u64)
        # 4 bytes: top_right (f32)
        # 4 bytes: bottom_right (f32)
        # 4 bytes: top_left (f32)
        # 4 bytes: bottom_left (f32)
        # 4 bytes: cop_x (f32)
        # 4 bytes: cop_y (f32)

        unpacked = struct.unpack('>qqffffff', data[:PACKET_SIZE])

        timestamp_micros = unpacked[0]
        mac_address = unpacked[1]
        top_right = unpacked[2]
        bottom_right = unpacked[3]
        top_left = unpacked[4]
        bottom_left = unpacked[5]
        cop_x = unpacked[6]
        cop_y = unpacked[7]

        return {
            'timestamp': timestamp_micros,
            'mac_address': mac_address,
            'top_right': top_right,
            'bottom_right': bottom_right,
            'top_left': top_left,
            'bottom_left': bottom_left,
            'cop_x': cop_x,
            'cop_y': cop_y
        }

    except struct.error as e:
        print(f"Error parsing binary packet: {e}")
        return None


def format_timestamp(timestamp_micros):
    """Format timestamp from microseconds to readable format"""
    try:
        timestamp_seconds = timestamp_micros / 1_000_000
        dt = datetime.fromtimestamp(timestamp_seconds)
        return dt.strftime("%H:%M:%S.%f")[:-3]  # Remove last 3 digits of microseconds
    except (ValueError, OSError):
        return f"Invalid({timestamp_micros})"


def format_mac_address(mac_int):
    """Format MAC address from integer to hex string"""
    try:
        mac_hex = f"{mac_int & 0xFFFFFFFFFFFF:012X}"
        return ":".join(mac_hex[i:i+2] for i in range(0, 12, 2))
    except:
        return f"Invalid({mac_int})"


def stream_data_tcp():
    """Stream binary data via TCP connection"""
    sock = connect_tcp_socket()
    if not sock:
        return

    try:
        # Initialize timing statistics
        timing_stats = Stats()

        print(f"\nStreaming binary data from TCP ({TCP_HOST}:{TCP_PORT})")
        print("Expecting 40-byte binary packets")
        print("Press Ctrl+C to stop\n")

        # Define column labels
        channel_labels = ['timestamp', 'mac_address', 'top_right', 'bottom_right',
                         'top_left', 'bottom_left', 'cop_x', 'cop_y']

        # Print table header with time_diff column
        header = f"{'Sample':<8} {'Time':<8} {'time_diff':<10}"
        for label in channel_labels:
            if label == 'timestamp':
                header += f" {label:<15}"
            elif label == 'mac_address':
                header += f" {label:<20}"
            else:
                header += f" {label:<13}"
        print(header)
        print("-" * len(header))

        sample_count = 0
        start_time = time.time()
        buffer = b''

        try:
            while True:
                # Receive data from socket
                try:
                    data = sock.recv(4096)
                    if not data:
                        print("Connection closed by server")
                        break

                    buffer += data

                    # Process complete packets
                    while len(buffer) >= PACKET_SIZE:
                        # Extract one packet
                        packet_data = buffer[:PACKET_SIZE]
                        buffer = buffer[PACKET_SIZE:]

                        # Parse the binary packet
                        parsed = parse_binary_packet(packet_data)
                        if parsed:
                            sample_count += 1
                            elapsed = time.time() - start_time

                            # Calculate timing difference
                            data_timestamp_ms = parsed['timestamp'] / 1000  # Convert microseconds to milliseconds
                            current_time_ms = time.time() * 1000
                            time_diff_ms = current_time_ms - data_timestamp_ms

                            # Update timing statistics
                            timing_stats.update(time_diff_ms)

                            # Print stats every 100 samples
                            if timing_stats.count % 100 == 0:
                              #  print(f"\n--- Timing Statistics (Sample {timing_stats.count}) ---")
                                timing_stats.print_stats()
                              #  print()

                            # Format values for display
                            formatted_timestamp = format_timestamp(parsed['timestamp'])
                            formatted_mac = format_mac_address(parsed['mac_address'])

                            # Print sample data with proper formatting
                            row = f"{sample_count:<8} {elapsed:<8.1f} {time_diff_ms:<10.1f}"
                            row += f" {formatted_timestamp:<15}"
                            row += f" {formatted_mac:<20}"
                            row += f" {parsed['top_right']:<13.3f}"
                            row += f" {parsed['bottom_right']:<13.3f}"
                            row += f" {parsed['top_left']:<13.3f}"
                            row += f" {parsed['bottom_left']:<13.3f}"
                            row += f" {parsed['cop_x']:<13.3f}"
                            row += f" {parsed['cop_y']:<13.3f}"
                            # print(row)

                            # Flush output for real-time display
                            import sys
                            sys.stdout.flush()

                except socket.timeout:
                    continue
                except socket.error as e:
                    print(f"Socket error: {e}")
                    break

        except KeyboardInterrupt:
            print(f"\nStopped after {sample_count} samples in {time.time() - start_time:.1f} seconds")

            # Print final timing statistics
            if timing_stats.count > 0:
                print("\n--- Final Timing Statistics ---")
                timing_stats.print_stats()

    finally:
        sock.close()


def test_tcp_connectivity():
    """Test TCP connectivity to endpoint"""
    try:
        sock = connect_tcp_socket()
        if sock:
            sock.close()
            print(f"✓ TCP connection to {TCP_HOST}:{TCP_PORT} successful")
            return True
        else:
            print(f"✗ TCP connection to {TCP_HOST}:{TCP_PORT} failed")
            return False
    except Exception as e:
        print(f"✗ TCP connectivity test failed: {e}")
        return False


def main():
    """Main application entry point"""
    print("The Balance Toolkit - TCP Stream Inspector (Binary Protocol)\n")
    print(f"Connecting to: {TCP_HOST}:{TCP_PORT}")
    print(f"Expected packet size: {PACKET_SIZE} bytes\n")

    # Test TCP connectivity first
    if not test_tcp_connectivity():
        print("\nTroubleshooting:")
        print("- Ensure The Balance Toolkit app is running")
        print("- A board is added in the 'Devices' menu")
        print("- The board is added to a session in 'Session' menu")
        print("- TCP streaming is toggled ON")
        print("- Recording is started")
        print("- Check network connectivity")
        print("- Verify firewall allows TCP connections")
        return

    # Start streaming
    try:
        choice = input("Start streaming? (y/n): ").lower()
        if choice in ['y', 'yes', '']:
            stream_data_tcp()
        else:
            print("Goodbye!")
    except (ValueError, KeyboardInterrupt):
        print("\nGoodbye!")


if __name__ == "__main__":
    main()