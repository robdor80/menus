import { dayDistance, getTodayISO } from "./date-utils.js";
import { SHIFT_VALUES } from "./normalize.js";

const SHIFT_CYCLE_6X6 = [
  "Mañana",
  "Mañana",
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

export function getShiftSettings(baseDate) {
  return {
    baseDate: typeof baseDate === "string" && baseDate.trim() ? baseDate.trim() : getTodayISO(),
    cycle: SHIFT_CYCLE_6X6
  };
}

export function calculateAutoShift(dateIso, settings) {
  const baseDate = settings?.baseDate || getTodayISO();
  const cycle = Array.isArray(settings?.cycle) && settings.cycle.length > 0 ? settings.cycle : SHIFT_CYCLE_6X6;
  const delta = dayDistance(baseDate, dateIso);
  const index = ((delta % cycle.length) + cycle.length) % cycle.length;
  return cycle[index];
}

export function resolveShift(dayData, dateIso, settings) {
  if (dayData?.shift?.mode === "manual" && SHIFT_VALUES.includes(dayData?.shift?.value)) {
    return dayData.shift.value;
  }
  return calculateAutoShift(dateIso, settings);
}

export function buildShiftStorage(selectedShift, dateIso, settings) {
  const autoShift = calculateAutoShift(dateIso, settings);
  const safeShift = SHIFT_VALUES.includes(selectedShift) ? selectedShift : autoShift;

  // Arquitectura preparada para override manual futuro.
  if (safeShift === autoShift) {
    return { mode: "auto" };
  }
  return { mode: "manual", value: safeShift };
}

