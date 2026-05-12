type TodoDefaultTime = 'morning' | 'end';

type DatePart =
  | 'year'
  | 'month'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second';

type ZonedParts = Record<DatePart, number>;

const zonedPartsFormatOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
};

export function getEffectiveTimeZone(timezone?: string | null): string {
  if (timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone }).format(new Date());
      return timezone;
    } catch {
      // Fall through to the device timezone.
    }
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function parseTodoDateInTimeZone(iso: string | null | undefined, timezone?: string | null): Date | null {
  if (!iso) return null;

  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;

  const parts = getZonedParts(instant, getEffectiveTimeZone(timezone));
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    instant.getUTCMilliseconds()
  );
}

export function serializeTodoDateInTimeZone(
  date: Date,
  hasTime: boolean,
  defaultTime: TodoDefaultTime,
  timezone?: string | null
): string {
  const localWallClock = new Date(date);

  if (!hasTime) {
    if (defaultTime === 'end') {
      localWallClock.setHours(23, 59, 0, 0);
    } else {
      localWallClock.setHours(9, 0, 0, 0);
    }
  }

  return wallClockDateToUtcInstant(localWallClock, getEffectiveTimeZone(timezone)).toISOString();
}

export function hasMeaningfulTodoTime(
  iso: string | null | undefined,
  defaultTime: TodoDefaultTime,
  timezone?: string | null
): boolean {
  const localDate = parseTodoDateInTimeZone(iso, timezone);
  if (!localDate) return false;

  const hours = localDate.getHours();
  const minutes = localDate.getMinutes();

  if (defaultTime === 'morning') {
    return !(hours === 9 && minutes === 0);
  }

  return !(hours === 23 && minutes === 59);
}

export function formatDateTimeInTimeZone(
  value: string | Date,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(undefined, {
    ...options,
    timeZone: getEffectiveTimeZone(timezone),
  }).format(date);
}

function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    ...zonedPartsFormatOptions,
    timeZone: timezone,
  }).formatToParts(date);

  const parts = Object.fromEntries(
    formatted
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  ) as Partial<ZonedParts>;

  return {
    year: parts.year ?? date.getUTCFullYear(),
    month: parts.month ?? date.getUTCMonth() + 1,
    day: parts.day ?? date.getUTCDate(),
    hour: parts.hour ?? date.getUTCHours(),
    minute: parts.minute ?? date.getUTCMinutes(),
    second: parts.second ?? date.getUTCSeconds(),
  };
}

function wallClockDateToUtcInstant(date: Date, timezone: string): Date {
  const utcGuess = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );

  let offset = getTimeZoneOffsetMs(new Date(utcGuess), timezone);
  let result = utcGuess - offset;

  const refinedOffset = getTimeZoneOffsetMs(new Date(result), timezone);
  if (refinedOffset !== offset) {
    offset = refinedOffset;
    result = utcGuess - offset;
  }

  return new Date(result);
}

function getTimeZoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds()
  );

  return zonedAsUtc - date.getTime();
}