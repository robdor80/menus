import { escapeHtml } from "../utils/normalize.js";

const SHIFT_CLASS_MAP = {
  Libre: "shift-libre",
  "Ma\u00f1ana": "shift-manana",
  Tarde: "shift-tarde",
  Noche: "shift-noche"
};

function renderMealLine(label, value) {
  return `<p class="meal-line"><span>${escapeHtml(label)}:</span> ${escapeHtml(value)}</p>`;
}

export function renderDayCard({
  dateIso,
  dayLabel,
  dateLabel,
  shift,
  roberto,
  casaMeals,
  note,
  hasStoredData
}) {
  const shiftClass = SHIFT_CLASS_MAP[shift] ?? SHIFT_CLASS_MAP.Libre;
  const robertoLines = [];
  if (roberto.comida) {
    robertoLines.push(renderMealLine("Comida", roberto.comida));
  }
  if (roberto.cena) {
    robertoLines.push(renderMealLine("Cena", roberto.cena));
  }

  const casaLines = casaMeals.map((meal) => renderMealLine(meal.label, meal.value));
  const casaFallback =
    casaLines.length === 0
      ? `<p class="card-muted-line"><span>Casa:</span> sin plan</p>`
      : "";

  const noteHtml = note ? `<p class="note-line">Nota: ${escapeHtml(note)}</p>` : "";
  const robertoBlock = roberto.show
    ? `
      <section class="card-block">
        <h3>Roberto <span aria-hidden="true">🥡</span></h3>
        ${robertoLines.join("")}
      </section>
    `
    : "";

  return `
    <article class="day-card ${shiftClass}">
      <header class="day-card-header">
        <div>
          <p class="day-title">${escapeHtml(dayLabel)}</p>
          <p class="day-date">${escapeHtml(dateLabel)}</p>
        </div>
        <div class="day-header-right">
          <span class="shift-pill">${escapeHtml(shift)}</span>
          ${hasStoredData ? '<span class="saved-dot" title="Datos guardados"></span>' : ""}
        </div>
      </header>
      ${robertoBlock}
      <section class="card-block">
        <h3>Casa</h3>
        ${casaLines.join("")}
        ${casaFallback}
      </section>
      ${noteHtml}
      <footer class="card-footer">
        <button type="button" class="btn-link" data-open-edit="${escapeHtml(dateIso)}">Editar día</button>
      </footer>
    </article>
  `;
}
