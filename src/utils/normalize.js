export const SHIFT_OPTIONS = ["Libre", "Ma\u00f1ana", "Tarde", "Noche"];
export const CASA_MODE_TEXT = "text";
export const CASA_MODE_FUERA = "fuera";

export function sanitizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeCasaMeal(rawMeal) {
  const mode =
    rawMeal?.mode === CASA_MODE_FUERA || rawMeal?.mode === CASA_MODE_TEXT
      ? rawMeal.mode
      : CASA_MODE_TEXT;

  return {
    mode,
    text: sanitizeText(rawMeal?.text ?? "")
  };
}

export function createEmptyPersistedDay() {
  return {
    shift: { mode: "auto" },
    roberto: {
      comida: "",
      cena: ""
    },
    casa: {
      comida: {
        mode: CASA_MODE_TEXT,
        text: ""
      },
      cena: {
        mode: CASA_MODE_TEXT,
        text: ""
      }
    },
    note: ""
  };
}

export function normalizePersistedDay(rawDay) {
  const base = createEmptyPersistedDay();
  if (!rawDay || typeof rawDay !== "object") {
    return base;
  }

  const shiftMode = rawDay?.shift?.mode === "manual" ? "manual" : "auto";
  const shiftValue = SHIFT_OPTIONS.includes(rawDay?.shift?.value) ? rawDay.shift.value : undefined;

  return {
    shift: shiftMode === "manual" && shiftValue ? { mode: "manual", value: shiftValue } : { mode: "auto" },
    roberto: {
      comida: sanitizeText(rawDay?.roberto?.comida ?? ""),
      cena: sanitizeText(rawDay?.roberto?.cena ?? "")
    },
    casa: {
      comida: normalizeCasaMeal(rawDay?.casa?.comida),
      cena: normalizeCasaMeal(rawDay?.casa?.cena)
    },
    note: sanitizeText(rawDay?.note ?? "")
  };
}

export function normalizeDraftDay(rawDraft) {
  return {
    shift: SHIFT_OPTIONS.includes(rawDraft?.shift) ? rawDraft.shift : "",
    roberto: {
      comida: sanitizeText(rawDraft?.roberto?.comida ?? ""),
      cena: sanitizeText(rawDraft?.roberto?.cena ?? "")
    },
    casa: {
      comida: normalizeCasaMeal(rawDraft?.casa?.comida),
      cena: normalizeCasaMeal(rawDraft?.casa?.cena)
    },
    note: sanitizeText(rawDraft?.note ?? "")
  };
}
