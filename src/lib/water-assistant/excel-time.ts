const excelEpoch = 25569;

// Excel serial values and local strings both represent Beijing wall-clock time.
export function parseExcelChinaTime(value: unknown): Date | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const date = new Date((value - excelEpoch) * 86400000 - 8 * 3600000);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(text);
  if (match) {
    const [, year, month, day, hour, minute] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, hour - 8, minute));
    const roundTrip = new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16);
    return roundTrip === `${text.slice(0, 10)}T${text.slice(11, 16)}` ? date : null;
  }
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}
