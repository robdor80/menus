import { renderDayCard } from "../components/dayCard.js";
import { fromISODate, formatDateLabel, formatDayLabel } from "../utils/date.js";
import { CASA_MODE_FUERA, normalizePersistedDay, sanitizeText } from "../utils/normalize.js";
import { resolveShiftValue } from "../services/shiftEngine.js";
import { hasStoredDataForDay } from "../services/weekService.js";

function buildCasaMealsForCard(dayData) {
  const meals = [];
  const comidaMode = dayData.casa.comida.mode;
  const cenaMode = dayData.casa.cena.mode;
  const comidaText = sanitizeText(dayData.casa.comida.text);
  const cenaText = sanitizeText(dayData.casa.cena.text);

  if (comidaMode === CASA_MODE_FUERA) {
    meals.push({ label: "Comida", value: "Fuera" });
  } else if (comidaText) {
    meals.push({ label: "Comida", value: comidaText });
  }

  if (cenaMode === CASA_MODE_FUERA) {
    meals.push({ label: "Cena", value: "Fuera" });
  } else if (cenaText) {
    meals.push({ label: "Cena", value: cenaText });
  }

  return meals;
}

export function renderHomeView({ weekDates, weekData, shiftSettings }) {
  const cards = weekDates.map((date) => {
    const dateIso = date.iso;
    const storedDay = weekData.days[dateIso] ? normalizePersistedDay(weekData.days[dateIso]) : normalizePersistedDay();
    const shift = resolveShiftValue(storedDay, dateIso, shiftSettings);
    const robertoComida = sanitizeText(storedDay.roberto.comida);
    const robertoCena = sanitizeText(storedDay.roberto.cena);

    return renderDayCard({
      dateIso,
      dayLabel: formatDayLabel(fromISODate(dateIso)),
      dateLabel: formatDateLabel(fromISODate(dateIso)),
      shift,
      roberto: {
        comida: robertoComida,
        cena: robertoCena,
        show: Boolean(robertoComida || robertoCena)
      },
      casaMeals: buildCasaMealsForCard(storedDay),
      note: sanitizeText(storedDay.note),
      hasStoredData: hasStoredDataForDay(weekData, dateIso)
    });
  });

  return `
    <section class="home-grid">
      ${cards.join("")}
    </section>
  `;
}
