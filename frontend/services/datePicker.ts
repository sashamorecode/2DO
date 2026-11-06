export function calendarDays(year: number, month: number): Array<Date | null> {
  const offset = new Date(year, month, 1, 12).getDay();
  const count = new Date(year, month + 1, 0, 12).getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day < 1 || day > count ? null : new Date(year, month, day, 12);
  });
}

export function applyTime(date: Date, hours: string, minutes: string): Date | null {
  if (!/^\d{1,2}$/.test(hours) || !/^\d{1,2}$/.test(minutes)) return null;
  if (+hours > 23 || +minutes > 59) return null;
  const result = new Date(date);
  result.setHours(+hours, +minutes, 0, 0);
  return result;
}
