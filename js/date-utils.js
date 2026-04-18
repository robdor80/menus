const DAY_MS = 24 * 60 * 60 * 1000;

const dayLabelFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long" });
const dayShortFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "short" });
const monthShortFormatter = new Intl.DateTimeFormat("es-ES", { month: "short" });

export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromISODate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfWeekMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

export function addDays(date, amount) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + amount);
  return d;
}

export function addWeeks(date, amount) {
  return addDays(date, amount * 7);
}

export function getWeekDates(weekStartDate) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
}

export function dayDistance(baseIsoDate, targetIsoDate) {
  const base = fromISODate(baseIsoDate);
  const target = fromISODate(targetIsoDate);
  const baseUtc = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
  const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetUtc - baseUtc) / DAY_MS);
}

export function getTodayISO() {
  return toISODate(new Date());
}

export function getWeekId(weekStartDate) {
  const utcDate = new Date(
    Date.UTC(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate())
  );
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const year = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / DAY_MS) + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function formatDayLabel(date) {
  const text = dayLabelFormatter.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDayShort(date) {
  const text = dayShortFormatter.format(date).replace(".", "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDateLabel(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export function formatWeekRange(weekStartDate) {
  const weekEnd = addDays(weekStartDate, 6);
  const startDay = weekStartDate.getDate();
  const endDay = weekEnd.getDate();
  const startMonth = monthShortFormatter.format(weekStartDate);
  const endMonth = monthShortFormatter.format(weekEnd);
  const year = weekEnd.getFullYear();

  if (startMonth === endMonth) {
    return `${startDay} - ${endDay} ${startMonth} ${year}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
}

