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

const mediumDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const fullDateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });

/** "Nov 11, 2026", in the user's locale. */
export const formatDate = (value: Date | string) => mediumDate.format(new Date(value));

/** "Wednesday, November 11, 2026 at 1:40 PM", for tooltips that show the exact time. */
export const formatDateTime = (value: Date | string) => fullDateTime.format(new Date(value));

/** "45 s", "2 min 05 s", "1 h 03 min". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  if (minutes > 0) return `${minutes} min ${String(rest).padStart(2, "0")} s`;
  return `${rest} s`;
}
