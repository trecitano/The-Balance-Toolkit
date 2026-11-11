import { NintendoDevice } from "@/types";

/** Connected boards first, then the rest by name. Used wherever boards are listed. */
export function sortDevices(devices: NintendoDevice[]): NintendoDevice[] {
  const connected = devices.filter((d) => d.isConnected);
  const disconnected = devices.filter((d) => !d.isConnected);

  // A board that has never been seen disconnected has no timestamp; sort it first.
  const lastConnected = (d: NintendoDevice) => (d.lastConnected ? new Date(d.lastConnected).getTime() : 0);
  connected.sort((a, b) => lastConnected(a) - lastConnected(b));
  disconnected.sort((a, b) => a.name.localeCompare(b.name));

  return [...connected, ...disconnected];
}
