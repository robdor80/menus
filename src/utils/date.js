const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("es-ES", { weekday: "long" });
const DAY_SHORT_FORMATTER = new Intl.DateTimeFormat("es-ES", { weekday: "short" });
const MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat("es-ES", { month: "short" });

export function toISODate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromISODate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfWeekMonday(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = copy.getDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  copy.setDate(copy.getDate() + offset);
  return copy;
}

export function addDays(date, amount) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function addWeeks(date, amount) {
  return addDays(date, amount * 7);
}

export function getWeekDates(weekStartDate) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
}

export function formatDayLabel(date) {
  const dayName = DAY_LABEL_FORMATTER.format(date);
  return dayName.charAt(0).toUpperCase() + dayName.slice(1);
}

export function formatDayShort(date) {
  const shortName = DAY_SHORT_FORMATTER.format(date).replace(".", "");
  return shortName.charAt(0).toUpperCase() + shortName.slice(1);
}

export function formatDateLabel(date) {
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${day}/${month}`;
}

export function formatWeekRange(weekStartDate) {
  const weekEndDate = addDays(weekStartDate, 6);
  const startDay = weekStartDate.getDate();
  const endDay = weekEndDate.getDate();
  const startMonth = MONTH_SHORT_FORMATTER.format(weekStartDate);
  const endMonth = MONTH_SHORT_FORMATTER.format(weekEndDate);
  const year = weekEndDate.getFullYear();

  if (startMonth === endMonth) {
    return `${startDay} - ${endDay} ${startMonth} ${year}`;
  }

  return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
}

export function getWeekId(weekStartDate) {
  const utcDate = new Date(
    Date.UTC(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate())
  );
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const weekYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const weekNumber = Math.ceil(((utcDate - yearStart) / DAY_MS + 1) / 7);
  return `${weekYear}-W${`${weekNumber}`.padStart(2, "0")}`;
}

export function dayDistance(fromIsoDate, toIsoDate) {
  const fromDate = fromISODate(fromIsoDate);
  const toDate = fromISODate(toIsoDate);
  const utcFrom = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const utcTo = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((utcTo - utcFrom) / DAY_MS);
}

export function getTodayISO() {
  return toISODate(new Date());
}

export function isSameISODate(dateA, dateB) {
  return dateA === dateB;
}

export function getDayIndexInWeek(weekStartIsoDate, targetIsoDate) {
  const delta = dayDistance(weekStartIsoDate, targetIsoDate);
  if (delta < 0 || delta > 6) {
    return 0;
  }
  return delta;
}
