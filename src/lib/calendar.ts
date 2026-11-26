/** Calendar helpers: Google Calendar link + RFC 5545 .ics (UTC times). */

type CalEvent = { id: string; title: string; description: string; startsAt: Date; endsAt: Date | null; location: string };

const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(e: CalEvent): string {
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + DEFAULT_DURATION_MS);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${utcStamp(e.startsAt)}/${utcStamp(end)}`,
    details: e.description,
    location: e.location,
    ctz: "Asia/Phnom_Penh",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(events: CalEvent[], host: string, now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sila & Kimsour Wedding//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    const end = e.endsAt ?? new Date(e.startsAt.getTime() + DEFAULT_DURATION_MS);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@${host}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(e.startsAt)}`,
      `DTEND:${utcStamp(end)}`,
      `SUMMARY:${escapeIcs(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${escapeIcs(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${escapeIcs(e.location)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
