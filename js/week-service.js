import { addDays, getWeekId, toISODate } from "./date-utils.js";
import { buildShiftStorage, resolveShift } from "./shift-engine.js";
import {
  CASA_TEXT,
  cleanText,
  createEmptyStoredDay,
  hasRealContent,
  normalizeDraftDay,
  normalizeStoredDay
} from "./normalize.js";

export function buildEmptyWeek(weekStartDate) {
  return {
    weekId: getWeekId(weekStartDate),
    startDate: toISODate(weekStartDate),
    endDate: toISODate(addDays(weekStartDate, 6)),
    existsInDb: false,
    days: {}
  };
}

export async function loadWeek(weekStartDate, firestoreClient) {
  const emptyWeek = buildEmptyWeek(weekStartDate);
  if (!firestoreClient.status.ready) {
    return emptyWeek;
  }

  const snap = await firestoreClient.getWeekDoc(emptyWeek.weekId);
  if (!snap.exists || !snap.data) {
    return emptyWeek;
  }

  const rawDays = snap.data.days || {};
  const days = Object.entries(rawDays).reduce((acc, [dateIso, day]) => {
    acc[dateIso] = normalizeStoredDay(day);
    return acc;
  }, {});

  return {
    weekId: snap.data.weekId || emptyWeek.weekId,
    startDate: snap.data.startDate || emptyWeek.startDate,
    endDate: snap.data.endDate || emptyWeek.endDate,
    existsInDb: true,
    days
  };
}

export function getDayDraft(weekData, dateIso, shiftSettings) {
  const stored = weekData.days[dateIso]
    ? normalizeStoredDay(weekData.days[dateIso])
    : createEmptyStoredDay();

  return {
    shift: resolveShift(stored, dateIso, shiftSettings),
    roberto: {
      comida: stored.roberto.comida,
      cena: stored.roberto.cena
    },
    casa: {
      comida: { ...stored.casa.comida },
      cena: { ...stored.casa.cena }
    },
    note: stored.note
  };
}

export function toStoredDay(draftDay, dateIso, shiftSettings) {
  const day = normalizeDraftDay(draftDay);
  return {
    shift: buildShiftStorage(day.shift, dateIso, shiftSettings),
    roberto: {
      comida: day.roberto.comida,
      cena: day.roberto.cena
    },
    casa: {
      comida: {
        mode: day.casa.comida.mode,
        text: day.casa.comida.mode === CASA_TEXT ? day.casa.comida.text : ""
      },
      cena: {
        mode: day.casa.cena.mode,
        text: day.casa.cena.mode === CASA_TEXT ? day.casa.cena.text : ""
      }
    },
    note: day.note
  };
}

export async function saveDay({
  weekData,
  dateIso,
  draftDay,
  shiftSettings,
  firestoreClient
}) {
  const content = hasRealContent(draftDay);

  if (!content && !weekData.existsInDb) {
    return {
      weekData,
      skipped: true,
      persistedRemote: false
    };
  }

  const storedDay = toStoredDay(draftDay, dateIso, shiftSettings);
  const nextWeek = {
    ...weekData,
    existsInDb: weekData.existsInDb || firestoreClient.status.ready,
    days: {
      ...weekData.days,
      [dateIso]: storedDay
    }
  };

  if (firestoreClient.status.ready) {
    await firestoreClient.upsertWeekDay({
      weekId: weekData.weekId,
      startDate: weekData.startDate,
      endDate: weekData.endDate,
      dateIso,
      dayData: storedDay,
      createIfMissing: !weekData.existsInDb
    });
  }

  return {
    weekData: nextWeek,
    skipped: false,
    created: !weekData.existsInDb && firestoreClient.status.ready,
    persistedRemote: firestoreClient.status.ready
  };
}

export function hasStoredData(weekData, dateIso) {
  return Boolean(weekData.days[dateIso]);
}

export function getRobertoVisibility(dayData) {
  const comida = cleanText(dayData?.roberto?.comida ?? "");
  const cena = cleanText(dayData?.roberto?.cena ?? "");
  return {
    comida,
    cena,
    show: Boolean(comida || cena)
  };
}

