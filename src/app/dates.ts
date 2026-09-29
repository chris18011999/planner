const DAY_MS = 86_400_000;

// Note dates are calendar days. The code parses and formats them in UTC to exclude the server time zone.
function utcTime(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}

function format(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(utcTime(date)).toLocaleDateString("en-GB", { timeZone: "UTC", ...options });
}

export function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function relativeDay(date: string, today: string) {
  const days = Math.round((utcTime(today) - utcTime(date)) / DAY_MS);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days === -1) return "Tomorrow";
  return days > 0 ? `${days} days ago` : `In ${-days} days`;
}

export function fullDate(date: string) {
  return format(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function shortDate(date: string) {
  return format(date, { weekday: "short", day: "numeric", month: "short" });
}

export function monthLabel(date: string) {
  return format(date, { month: "long", year: "numeric" });
}
