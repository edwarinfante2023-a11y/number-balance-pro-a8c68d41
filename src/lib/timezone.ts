export const APP_TIME_ZONE = "America/Santo_Domingo";
export const APP_LOCALE = "es-DO";

function getDateParts(date: Date, timeZone: string = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

export function formatDateInTimeZone(date: Date = new Date(), timeZone: string = APP_TIME_ZONE) {
  const { year, month, day } = getDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function getTimePartsInTimeZone(date: Date = new Date(), timeZone: string = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { hour: hour === 24 ? 0 : hour, minute };
}

export function minutesSinceMidnightInTimeZone(
  date: Date = new Date(),
  timeZone: string = APP_TIME_ZONE,
) {
  const { hour, minute } = getTimePartsInTimeZone(date, timeZone);
  return hour * 60 + minute;
}

export function daysAgoDateInTimeZone(
  days: number,
  date: Date = new Date(),
  timeZone: string = APP_TIME_ZONE,
) {
  return formatDateInTimeZone(new Date(date.getTime() - days * 24 * 60 * 60 * 1000), timeZone);
}

export function formatDateTimeInAppTimeZone(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Date(date).toLocaleString(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

export function dateOnlyToNoonUtc(fecha: string) {
  return new Date(`${fecha}T12:00:00Z`);
}

export function appDateTimeToInstant(fecha: string, hora: string) {
  const [year, month, day] = fecha.split("-").map(Number);
  const [hour, minute] = hora.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 4, minute, 0, 0));
}
