import { getWeekDocument, upsertWeekDay } from "../firebase/firestore.js";
import { addDays, getWeekId, toISODate } from "../utils/date.js";
import {
  CASA_MODE_FUERA,
  CASA_MODE_TEXT,
  createEmptyPersistedDay,
  normalizeDraftDay,
  normalizePersistedDay
} from "../utils/normalize.js";
import { buildShiftPersistence, calculateAutoShift, resolveShiftValue } from "./shiftEngine.js";

export async function loadWeekData(weekStartDate) {
  const weekId = getWeekId(weekStartDate);
  const startDate = toISODate(weekStartDate);
  const endDate = toISODate(addDays(weekStartDate, 6));
  const snapshot = await getWeekDocument(weekId);

  if (!snapshot.exists()) {
    return {
      weekId,
      startDate,
      endDate,
      existsInDb: false,
      days: {}
    };
  }

  const rawData = snapshot.data();
  const rawDays = rawData?.days ?? {};
  const normalizedDays = Object.entries(rawDays).reduce((acc, [dateIso, rawDay]) => {
    acc[dateIso] = normalizePersistedDay(rawDay);
    return acc;
  }, {});

  return {
    weekId,
    startDate: rawData?.startDate || startDate,
    endDate: rawData?.endDate || endDate,
    existsInDb: true,
    days: normalizedDays
  };
}

export function buildDraftDay(weekData, dateIso, shiftSettings) {
  const storedDay = weekData.days[dateIso] ? normalizePersistedDay(weekData.days[dateIso]) : createEmptyPersistedDay();
  return {
    shift: resolveShiftValue(storedDay, dateIso, shiftSettings),
    roberto: {
      comida: storedDay.roberto.comida,
      cena: storedDay.roberto.cena
    },
    casa: {
      comida: { ...storedDay.casa.comida },
      cena: { ...storedDay.casa.cena }
    },
    note: storedDay.note
  };
}

export function hasRealContent(draftDay) {
  const normalized = normalizeDraftDay(draftDay);
  const hasShift = Boolean(normalized.shift);
  const hasRoberto = Boolean(normalized.roberto.comida) || Boolean(normalized.roberto.cena);
  const hasCasaText =
    (normalized.casa.comida.mode === CASA_MODE_TEXT && Boolean(normalized.casa.comida.text)) ||
    (normalized.casa.cena.mode === CASA_MODE_TEXT && Boolean(normalized.casa.cena.text));
  const hasCasaFuera =
    normalized.casa.comida.mode === CASA_MODE_FUERA || normalized.casa.cena.mode === CASA_MODE_FUERA;
  const hasNote = Boolean(normalized.note);

  return hasShift || hasRoberto || hasCasaText || hasCasaFuera || hasNote;
}

export function toPersistedDay(draftDay, dateIso, shiftSettings) {
  const normalized = normalizeDraftDay(draftDay);
  return {
    shift: buildShiftPersistence(normalized.shift, dateIso, shiftSettings),
    roberto: {
      comida: normalized.roberto.comida,
      cena: normalized.roberto.cena
    },
    casa: {
      comida: {
        mode: normalized.casa.comida.mode,
        text: normalized.casa.comida.mode === CASA_MODE_TEXT ? normalized.casa.comida.text : ""
      },
      cena: {
        mode: normalized.casa.cena.mode,
        text: normalized.casa.cena.mode === CASA_MODE_TEXT ? normalized.casa.cena.text : ""
      }
    },
    note: normalized.note
  };
}

export function hasStoredDataForDay(weekData, dateIso) {
  return Boolean(weekData.days[dateIso]);
}

export async function saveDay({
  weekData,
  dateIso,
  draftDay,
  shiftSettings
}) {
  const contentExists = hasRealContent(draftDay);

  if (!contentExists && !weekData.existsInDb) {
    return {
      weekData,
      skipped: true
    };
  }

  const persistedDay = toPersistedDay(draftDay, dateIso, shiftSettings);
  const nextWeek = {
    ...weekData,
    existsInDb: true,
    days: {
      ...weekData.days,
      [dateIso]: persistedDay
    }
  };

  await upsertWeekDay({
    weekId: weekData.weekId,
    startDate: weekData.startDate,
    endDate: weekData.endDate,
    dateIso,
    dayData: persistedDay,
    createIfMissing: !weekData.existsInDb
  });

  return {
    weekData: nextWeek,
    skipped: false,
    created: !weekData.existsInDb
  };
}

export function getAutoShiftHint(dateIso, shiftSettings) {
  return calculateAutoShift(dateIso, shiftSettings);
}
