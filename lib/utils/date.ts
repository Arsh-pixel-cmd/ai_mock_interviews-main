/**
 * Lightweight date formatting utilities using native Intl.DateTimeFormat.
 * Replaces the `dayjs` dependency entirely.
 */

/**
 * Formats a date string as "Oct 23, 2026"
 */
export function formatDate(dateInput: string | number | Date): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Formats a date string as "Oct 23, 2026 2:30 PM"
 */
export function formatDateTime(dateInput: string | number | Date): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
