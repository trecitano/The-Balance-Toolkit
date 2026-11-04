---
title: The Balance Toolkit
description: Open-source software for the Wii Balance Board: a desktop app for Windows, macOS and Linux, an Android companion, and TCP and LSL streams. CHI PLAY 2026.
canonical: https://thebalancetoolkit.com/
---

# The Balance Toolkit

Open-source software for the Wii Balance Board.

Valente, Kothari, Ahmed-Mahmoud, Esteves and Billinghurst. CHI PLAY 2026, York, UK. Empathic Computing Laboratory, University of Auckland.

## Download

- [Windows](https://github.com/AndreiaValente/The-Balance-Toolkit-Apps/raw/main/windows/the-balance-toolkit.exe)
- [Android](https://github.com/AndreiaValente/The-Balance-Toolkit-Apps/raw/main/android/the-balance-toolkit.apk)
- macOS and Linux: the desktop app can be [compiled from the source code](https://github.com/trecitano/The-Balance-Toolkit/blob/main/INSTALL.md).

## Features

### Scan and press Sync (Windows, macOS, Linux, Android)

The toolkit finds and pairs the board for you. No Bluetooth settings needed.

### See balance as it happens (desktop app)

Sway, stability and frequency, plotted live as the person stands. Every session saves as CSV. Centre of pressure agrees with lab force plates at r = 0.99.

### Stream into your game (Unity, Python, LSL)

Forces and centre of pressure stream live to Unity, Python or any Lab Streaming Layer (LSL) tool, with under 0.5 ms of processing latency.

### Replay with new settings (after the session)

Reprocess any recording with different settings, and stream it as if it were live.

### Capture without a computer (Android app)

Run live sessions from a phone, with the same processing as the desktop app.

### Standard tests, ready to run (desktop app)

Single Leg Stance, Timed Up and Go and four more, each with an instruction screen for the participant.

### See it in action

[Walkthrough video](https://youtu.be/_8UwrUgqUao): from pairing to a finished recording, on a real board.

## What's next

- **Calibration** (in the works): multi-point calibration with known weights, and monitoring for sensor drift.
- **More than two boards** (in the works): sessions that connect and record more than two boards at once.
- **Documentation** (coming soon): guides to setting up, the metrics and the streams, in one place.

## Cite the paper

[Download the paper](https://andreia-valente.com/#pub/valente2026balance). DOI: 10.1145/3831299.

```bibtex
@article{10.1145/3831299,
author = {Valente, Andreia and Kothari, Nidhi and Ahmed-Mahmoud, Hana and Esteves, Augusto and Billinghurst, Mark},
title = {The Balance Toolkit: Democratizing Balance-Based Interaction Through Open-Source Software for Repurposed Wii Balance Boards},
year = {2026},
issue_date = {November 2026},
publisher = {Association for Computing Machinery},
address = {New York, NY, USA},
volume = {10},
number = {7},
url = {https://doi.org/10.1145/3831299},
doi = {10.1145/3831299},
journal = {Proc. ACM Hum.-Comput. Interact.},
month = nov,
articleno = {GAMES067},
numpages = {31},
keywords = {Wii Balance Board, Balance-based interaction, Posturography, Exergaming, Open-source software, Windows, macOS, Linux, Android, Unity}
}
```
