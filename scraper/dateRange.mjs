// Computes the UTC instant range [start, end) that corresponds to a given
// calendar date in Europe/London, so we can filter tweets by "UK day"
// regardless of BST/GMT.
const londonFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function londonOffsetMinutes(utcInstant) {
  const parts = londonFormatter.formatToParts(utcInstant).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asIfUtc - utcInstant.getTime()) / 60000;
}

export function londonDateRangeUtc(dateStr) {
  const approx = new Date(`${dateStr}T00:00:00Z`);
  const offsetMin = londonOffsetMinutes(approx);
  const start = new Date(approx.getTime() - offsetMin * 60000);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end };
}

export function addDaysToDateStr(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function enumerateDates(sinceStr, untilStr) {
  const dates = [];
  let cur = sinceStr;
  while (cur <= untilStr) {
    dates.push(cur);
    cur = addDaysToDateStr(cur, 1);
  }
  return dates;
}

export function londonDateStrOf(instant) {
  const parts = londonFormatter.formatToParts(instant).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function yesterdayLondonDateStr() {
  const now = new Date();
  const parts = londonFormatter.formatToParts(now).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const todayUtcNoon = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12),
  );
  const yesterday = new Date(todayUtcNoon.getTime() - 24 * 3600 * 1000);
  return yesterday.toISOString().slice(0, 10);
}
