#!/usr/bin/env python3
r"""
The Balance Toolkit - LSL Stream Inspector

Simple Python tool for inspecting and monitoring Lab Streaming Layer (LSL) streams in real-time.

## Prerequisites - The Balance Toolkit Setup

Before running this script, you need to start The Balance Toolkit application and configure it:

1. Launch The Balance Toolkit application
2. Go to "Devices" menu and add a board/device
3. Go to "Session" menu and add the configured board to your session
4. Toggle LSL streaming ON in the session configuration
5. Start recording to begin streaming data via LSL
6. Run this script to monitor the LSL streams

## Quick Start

1. Setup virtual environment:

   Windows:
   python -m venv venv
   venv\Scripts\activate
   pip install pylsl

   macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate
   pip install pylsl

2. Run:

   Windows:
   python lsl_inspector.py

   macOS/Linux:
   python3 lsl_inspector.py

3. Usage:
   - Script shows metadata for all available streams
   - Choose a stream number to monitor real-time data
   - Press Ctrl+C to stop streaming

## Balance Toolkit Streams

the-balance-toolkit_basic (100 Hz, 8 channels)
- timestamp - Sample timestamp
- mac_address - Device MAC address
- top_right, bottom_right, top_left, bottom_left - Force sensor readings
- cop_x, cop_y - Center of pressure coordinates

the-balance-toolkit_complex (100 Hz, 9 channels)
- timestamp - Sample timestamp
- mac_address - Device MAC address
- v_cop_x, v_cop_y - Mean absolute CoP velocity (mm/s)
- stability_index - RMS radial CoP distance from the window mean (mm)
- dpsi_mlsi - Medio-lateral stability index
- dpsi_apsi - Anterior-posterior stability index
- dpsi_vsi - Vertical stability index
- dpsi_overall - Combined stability measure
"""

import pylsl
from datetime import datetime
import time


def get_available_streams():
    """Get all available LSL streams with deduplication"""
    streams = pylsl.resolve_streams()

    # Deduplicate streams based on name and source_id
    unique_streams = {}
    for s in streams:
        key = (s.name(), s.source_id())
        if key not in unique_streams:
            unique_streams[key] = s

    return list(unique_streams.keys())


def find_stream_info(stream_name, stream_id):
    """Find specific stream info"""
    streams = pylsl.resolve_streams()

    for s in streams:
        if s.name() == stream_name and s.source_id() == stream_id:
            return s

    return None


def show_metadata(stream_name, stream_id):
    """Display stream metadata"""
    try:
        stream_info = find_stream_info(stream_name, stream_id)

        if not stream_info:
            print(f"Stream '{stream_name}' not found")
            return False

        inlet = pylsl.StreamInlet(stream_info)
        full_info = inlet.info(timeout=3.0)

        # Display basic information
        print(f"Name: {full_info.name()}")
        print(f"Channels: {full_info.channel_count()}")
        print(f"Sample Rate: {full_info.nominal_srate()} Hz")

        # Get channel labels if available
        xml_desc = full_info.desc()
        channels = xml_desc.child("channels")

        if not channels.empty():
            print("Channels:", end=" ")
            channel = channels.first_child()
            labels = []
            while not channel.empty():
                label = channel.child_value("label")
                labels.append(label if label else f"Ch{len(labels)}")
                channel = channel.next_sibling()
            print(", ".join(labels[:10]) + ("..." if len(labels) > 10 else ""))

        return True

    except Exception as e:
        print(f"Error: {e}")
        return False


def format_value(value, label):
    """Format values based on their type and label"""
    if label == "timestamp":
        timestamp_seconds = value / 1000000
        dt = datetime.fromtimestamp(timestamp_seconds)
        return dt.strftime("%H:%M:%S.%f")[:-3]
    elif label == "mac_address":
        # Format MAC as hex or show last 4 digits
        mac_int = int(value) & 0xFFFFFFFFFFFF
        mac_hex = f"{mac_int:012X}"
        return ":".join(mac_hex[i:i+2] for i in range(0, 12, 2))
    elif "dpsi" in label.lower() and value > 1:
        # DPSI values are often larger
        return f"{value:.2f}"
    else:
        # Default formatting for most values
        return f"{value:.3f}"


def get_column_widths(channel_labels):
    """Calculate optimal column widths based on labels and expected data"""
    widths = {}

    # Fixed widths for control columns
    widths['Sample'] = 8
    widths['Time'] = 8

    # Dynamic widths for data columns
    for label in channel_labels:
        if label == "timestamp":
            widths[label] = 15  # For formatted timestamp
        elif label == "mac_address":
            widths[label] = 20  # For MAC address
        elif "dpsi" in label.lower():
            widths[label] = 10  # DPSI values
        else:
            widths[label] = max(len(label), 13)  # At least as wide as label, minimum 8

    return widths


def stream_data(stream_name, stream_id):
    """Stream data in real-time with improved table format"""
    try:
        stream_info = find_stream_info(stream_name, stream_id)

        if not stream_info:
            print("Stream not found")
            return

        inlet = pylsl.StreamInlet(stream_info)
        full_info = inlet.info(timeout=3.0)

        # Get channel labels
        xml_desc = full_info.desc()
        channels = xml_desc.child("channels")
        channel_labels = []

        if not channels.empty():
            channel = channels.first_child()
            channel_idx = 0
            while not channel.empty():
                label = channel.child_value("label")
                if label:
                    channel_labels.append(label)
                else:
                    channel_labels.append(f"Ch{channel_idx}")
                channel = channel.next_sibling()
                channel_idx += 1
        else:
            channel_labels = [f"Ch{i}" for i in range(full_info.channel_count())]

        print(f"\nStreaming {stream_name}")
        print("Press Ctrl+C to stop\n")

        # Limit to first 9 channels for display
        display_labels = channel_labels[:9]
        show_more = len(channel_labels) > 9

        # Calculate column widths
        widths = get_column_widths(display_labels)

        # Print table header
        header = f"{'Sample':<{widths['Sample']}} {'Time':<{widths['Time']}}"
        for label in display_labels:
            header += f" {label:<{widths[label]}}"
        if show_more:
            header += " ..."
        print(header)

        # Print separator line
        separator = "-" * len(header)
        print(separator)

        sample_count = 0
        start_time = time.time()
        first_timestamp = None

        try:
            while True:
                sample, timestamp = inlet.pull_sample(timeout=1.0)
                if sample:
                    sample_count += 1
                    elapsed = time.time() - start_time

                    # Track first timestamp for relative timing
                    if first_timestamp is None:
                        first_timestamp = sample[0] if len(sample) > 0 else 0

                    # Print sample data with proper formatting
                    row = f"{sample_count:<{widths['Sample']}} {elapsed:<{widths['Time']}.1f}"

                    for i, (value, label) in enumerate(zip(sample[:9], display_labels)):
                        formatted_value = format_value(value, label)
                        row += f" {formatted_value:<{widths[label]}}"

                    if len(sample) > 9:
                        row += " ..."
                    print(row)

                    # Flush output for real-time display
                    import sys
                    sys.stdout.flush()

                time.sleep(0.1)  # Small delay to prevent overwhelming output

        except KeyboardInterrupt:
            print(f"\nStopped after {sample_count} samples in {time.time() - start_time:.1f} seconds")

    except Exception as e:
        print(f"Streaming error: {e}")


def main():
    """Main application entry point"""
    print("The Balance Toolkit - LSL Stream Inspector\n")

    # Get available streams
    streams = get_available_streams()

    if not streams:
        print("No LSL streams found")
        print("\nMake sure:")
        print("- The Balance Toolkit app is running")
        print("- A board is added in the 'Devices' menu")
        print("- The board is added to a session in 'Session' menu")
        print("- LSL streaming is toggled ON")
        print("- Recording is started")
        print("- Firewall allows LSL communication")
        return

    # Show metadata for all available streams
    print("Available streams:\n")
    for i, (name, stream_id) in enumerate(streams, 1):
        print(f"{i}. ", end="")
        show_metadata(name, stream_id)
        print()

    # User selection menu
    print("Choose stream to monitor:")
    for i, (name, _) in enumerate(streams, 1):
        print(f"  {i}. {name}")
    print(f"  {len(streams) + 1}. Quit")

    try:
        choice = int(input("\nChoice: "))
        if 1 <= choice <= len(streams):
            name, stream_id = streams[choice - 1]
            stream_data(name, stream_id)
        elif choice == len(streams) + 1:
            print("Goodbye!")
        else:
            print("Invalid choice")
    except (ValueError, KeyboardInterrupt):
        print("\nGoodbye!")


if __name__ == "__main__":
    main()