import { dayDistance, getTodayISO } from "../utils/date.js";
import { SHIFT_OPTIONS } from "../utils/normalize.js";

const SHIFT_CYCLE = [
  "Ma\u00f1ana",
  "Ma\u00f1ana",
  "Tarde",
  "Tarde",
  "Noche",
  "Noche",
  "Libre",
  "Libre",
  "Libre",
  "Libre",
  "Libre",
  "Libre"
];

export function getShiftSettingsFromEnv() {
  const fallbackToday = getTodayISO();
  const envBaseDate = import.meta.env.VITE_SHIFT_BASE_DATE;
  const baseDateIso = typeof envBaseDate === "string" && envBaseDate.trim() ? envBaseDate.trim() : fallbackToday;
  return {
    baseDateIso,
    cycle: SHIFT_CYCLE
  };
}

export function calculateAutoShift(dateIso, settings) {
  const baseDateIso = settings?.baseDateIso ?? getTodayISO();
  const cycle = Array.isArray(settings?.cycle) && settings.cycle.length > 0 ? settings.cycle : SHIFT_CYCLE;
  const daysSinceBase = dayDistance(baseDateIso, dateIso);
  const index = ((daysSinceBase % cycle.length) + cycle.length) % cycle.length;
  return cycle[index];
}

export function resolveShiftValue(dayData, dateIso, settings) {
  if (dayData?.shift?.mode === "manual" && SHIFT_OPTIONS.includes(dayData?.shift?.value)) {
    return dayData.shift.value;
  }
  return calculateAutoShift(dateIso, settings);
}

export function buildShiftPersistence(selectedShift, dateIso, settings) {
  const fallbackAuto = calculateAutoShift(dateIso, settings);
  const safeShift = SHIFT_OPTIONS.includes(selectedShift) ? selectedShift : fallbackAuto;
  if (safeShift === fallbackAuto) {
    return { mode: "auto" };
  }
  return {
    mode: "manual",
    value: safeShift
  };
}
