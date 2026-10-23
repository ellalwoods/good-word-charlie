const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD, so a "day" ends at the user's midnight. */
export function today(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return today(new Date(y, m - 1, d + n));
}

export function longDate(d = new Date()): string {
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function shortDate(date: string): string {
  return new Date(`${date}T00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
