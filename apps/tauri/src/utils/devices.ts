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

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * "Today 14:30", "Yesterday 09:05", "3 days ago"… Worded by calendar day, so 23:30 yesterday is
 * "Yesterday" even at 00:30.
 */
export function formatRelativeDay(value: Date | string | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Invalid Date";
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
  const diffWeeks = Math.floor(diffDays / 7);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (diffDays <= 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return `1 week ago`;
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;

  return date.toLocaleDateString();
}
