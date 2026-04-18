export const SHIFT_VALUES = ["Libre", "Mañana", "Tarde", "Noche"];
export const CASA_TEXT = "text";
export const CASA_FUERA = "fuera";

export function cleanText(value) {
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

function normalizeCasaMeal(meal) {
  const mode = meal?.mode === CASA_FUERA ? CASA_FUERA : CASA_TEXT;
  const text = cleanText(meal?.text ?? "");
  return { mode, text };
}

export function createEmptyStoredDay() {
  return {
    shift: { mode: "auto" },
    roberto: {
      comida: "",
      cena: ""
    },
    casa: {
      comida: { mode: CASA_TEXT, text: "" },
      cena: { mode: CASA_TEXT, text: "" }
    },
    note: ""
  };
}

export function normalizeStoredDay(rawDay) {
  if (!rawDay || typeof rawDay !== "object") {
    return createEmptyStoredDay();
  }

  return {
    shift: {
      mode: rawDay?.shift?.mode === "manual" ? "manual" : "auto",
      value: SHIFT_VALUES.includes(rawDay?.shift?.value) ? rawDay.shift.value : undefined
    },
    roberto: {
      comida: cleanText(rawDay?.roberto?.comida ?? ""),
      cena: cleanText(rawDay?.roberto?.cena ?? "")
    },
    casa: {
      comida: normalizeCasaMeal(rawDay?.casa?.comida),
      cena: normalizeCasaMeal(rawDay?.casa?.cena)
    },
    note: cleanText(rawDay?.note ?? "")
  };
}

export function normalizeDraftDay(draftDay) {
  return {
    shift: SHIFT_VALUES.includes(draftDay?.shift) ? draftDay.shift : "",
    roberto: {
      comida: cleanText(draftDay?.roberto?.comida ?? ""),
      cena: cleanText(draftDay?.roberto?.cena ?? "")
    },
    casa: {
      comida: normalizeCasaMeal(draftDay?.casa?.comida),
      cena: normalizeCasaMeal(draftDay?.casa?.cena)
    },
    note: cleanText(draftDay?.note ?? "")
  };
}

export function hasRealContent(draftDay) {
  const day = normalizeDraftDay(draftDay);

  const hasShift = Boolean(day.shift);
  const hasRoberto = Boolean(day.roberto.comida) || Boolean(day.roberto.cena);
  const hasCasaText =
    (day.casa.comida.mode === CASA_TEXT && Boolean(day.casa.comida.text)) ||
    (day.casa.cena.mode === CASA_TEXT && Boolean(day.casa.cena.text));
  const hasCasaFuera = day.casa.comida.mode === CASA_FUERA || day.casa.cena.mode === CASA_FUERA;
  const hasNote = Boolean(day.note);

  return hasShift || hasRoberto || hasCasaText || hasCasaFuera || hasNote;
}

