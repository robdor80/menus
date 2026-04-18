import { fromISODate, formatDateLabel, formatDayLabel, formatDayShort } from "./date-utils.js";
import { calculateAutoShift, resolveShift } from "./shift-engine.js";
import { CASA_FUERA, cleanText, createEmptyStoredDay, escapeHtml, normalizeStoredDay } from "./normalize.js";
import { getDayDraft, getRobertoVisibility, hasStoredData } from "./week-service.js";

function shiftClass(shift) {
  if (shift === "Mañana") {
    return "manana";
  }
  if (shift === "Tarde") {
    return "tarde";
  }
  if (shift === "Noche") {
    return "noche";
  }
  return "livre";
}

function renderCasaLines(day) {
  const lines = [];
  const comidaText = cleanText(day.casa.comida.text);
  const cenaText = cleanText(day.casa.cena.text);

  if (day.casa.comida.mode === CASA_FUERA) {
    lines.push('<p class="line"><span class="label">Comida:</span> Fuera</p>');
  } else if (comidaText) {
    lines.push(`<p class="line"><span class="label">Comida:</span> ${escapeHtml(comidaText)}</p>`);
  }

  if (day.casa.cena.mode === CASA_FUERA) {
    lines.push('<p class="line"><span class="label">Cena:</span> Fuera</p>');
  } else if (cenaText) {
    lines.push(`<p class="line"><span class="label">Cena:</span> ${escapeHtml(cenaText)}</p>`);
  }

  if (lines.length === 0) {
    lines.push('<p class="line"><span class="label">Casa:</span> sin plan</p>');
  }

  return lines.join("");
}

function renderHomeCard(dateIso, weekData, shiftSettings) {
  const stored = weekData.days[dateIso] ? normalizeStoredDay(weekData.days[dateIso]) : createEmptyStoredDay();
  const roberto = getRobertoVisibility(stored);
  const shift = resolveShift(stored, dateIso, shiftSettings);
  const canShowRoberto = shift === "Tarde" && roberto.show;
  const robertoBlock = canShowRoberto
    ? `
      <section class="card-block">
        <h3>Roberto 🥡</h3>
        ${roberto.comida ? `<p class="line"><span class="label">Comida:</span> ${escapeHtml(roberto.comida)}</p>` : ""}
        ${roberto.cena ? `<p class="line"><span class="label">Cena:</span> ${escapeHtml(roberto.cena)}</p>` : ""}
      </section>
    `
    : "";

  const note = cleanText(stored.note);
  const noteHtml = note ? `<p class="note">Nota: ${escapeHtml(note)}</p>` : "";
  const dateObj = fromISODate(dateIso);

  return `
    <article class="day-card ${shiftClass(shift)}">
      <header class="card-head">
        <div>
          <p class="card-day">${escapeHtml(formatDayLabel(dateObj))}</p>
          <p class="card-date">${escapeHtml(formatDateLabel(dateObj))}</p>
        </div>
        <div class="card-head-right">
          <span class="shift-pill">${escapeHtml(shift)}</span>
          ${hasStoredData(weekData, dateIso) ? '<span class="saved-dot" title="Datos guardados"></span>' : ""}
        </div>
      </header>
      ${robertoBlock}
      <section class="card-block">
        <h3>Casa</h3>
        ${renderCasaLines(stored)}
      </section>
      ${noteHtml}
      <footer class="card-footer">
        <button class="btn-card-edit" type="button" data-open-edit="${escapeHtml(dateIso)}">Editar dia</button>
      </footer>
    </article>
  `;
}

function renderWeekSelectorButton({ dateIso, weekData, shiftSettings, selected }) {
  const stored = weekData.days[dateIso] ? normalizeStoredDay(weekData.days[dateIso]) : createEmptyStoredDay();
  const shift = resolveShift(stored, dateIso, shiftSettings);
  const dateObj = fromISODate(dateIso);

  return `
    <button
      class="week-day-btn ${selected ? "is-selected" : ""} ${shiftClass(shift)}"
      type="button"
      data-select-day="${escapeHtml(dateIso)}"
      aria-pressed="${selected ? "true" : "false"}"
    >
      <span class="week-day-row">
        <span class="week-day-name">${escapeHtml(formatDayShort(dateObj))}</span>
        ${hasStoredData(weekData, dateIso) ? '<span class="saved-dot" title="Con datos guardados"></span>' : ""}
      </span>
      <span class="week-day-date">${escapeHtml(formatDateLabel(dateObj))}</span>
      <span class="week-day-shift">${escapeHtml(shift)}</span>
    </button>
  `;
}

function renderCasaMode(name, mode) {
  const isText = mode === "text";
  const isFuera = mode === "fuera";
  return `
    <div class="segmented" role="radiogroup" aria-label="${escapeHtml(name)}">
      <label class="${isText ? "active" : ""}">
        <input type="radio" name="${name}_mode" value="text" ${isText ? "checked" : ""} />
        Texto
      </label>
      <label class="${isFuera ? "active" : ""}">
        <input type="radio" name="${name}_mode" value="fuera" ${isFuera ? "checked" : ""} />
        Fuera
      </label>
    </div>
  `;
}

function renderEditorPanel(selectedDateIso, weekData, shiftSettings) {
  const dateObj = fromISODate(selectedDateIso);
  const draft = getDayDraft(weekData, selectedDateIso, shiftSettings);
  const autoShift = calculateAutoShift(selectedDateIso, shiftSettings);

  return `
    <section class="editor-panel">
      <header class="editor-head">
        <h2>${escapeHtml(formatDayLabel(dateObj))} ${escapeHtml(formatDateLabel(dateObj))}</h2>
        <p>Turno automatico 6x6: <strong>${escapeHtml(autoShift)}</strong></p>
      </header>
      <form id="day-form" class="form-grid">
        <div class="field">
          <label for="shift_readonly">Turno</label>
          <input id="shift_readonly" type="text" readonly value="${escapeHtml(draft.shift)}" />
          <input type="hidden" name="shift" value="${escapeHtml(draft.shift)}" />
        </div>

        <fieldset class="group">
          <legend>Roberto (trabajo)</legend>
          <p class="hint">En turno de tarde suele ser donde mas se usa Roberto.</p>
          <div class="field">
            <label for="roberto_comida">Comida</label>
            <input id="roberto_comida" name="roberto_comida" type="text" value="${escapeHtml(draft.roberto.comida)}" />
          </div>
          <div class="field">
            <label for="roberto_cena">Cena</label>
            <input id="roberto_cena" name="roberto_cena" type="text" value="${escapeHtml(draft.roberto.cena)}" />
          </div>
        </fieldset>

        <fieldset class="group">
          <legend>Casa</legend>

          <div class="meal-box">
            <p class="meal-title">Comida</p>
            ${renderCasaMode("casa_comida", draft.casa.comida.mode)}
            <div class="field ${draft.casa.comida.mode === "fuera" ? "hidden" : ""}" data-text-row="casa_comida">
              <label for="casa_comida_text">Texto</label>
              <input
                id="casa_comida_text"
                name="casa_comida_text"
                type="text"
                value="${escapeHtml(draft.casa.comida.text)}"
              />
            </div>
          </div>

          <div class="meal-box">
            <p class="meal-title">Cena</p>
            ${renderCasaMode("casa_cena", draft.casa.cena.mode)}
            <div class="field ${draft.casa.cena.mode === "fuera" ? "hidden" : ""}" data-text-row="casa_cena">
              <label for="casa_cena_text">Texto</label>
              <input
                id="casa_cena_text"
                name="casa_cena_text"
                type="text"
                value="${escapeHtml(draft.casa.cena.text)}"
              />
            </div>
          </div>
        </fieldset>

        <div class="field">
          <label for="note">Nota</label>
          <textarea id="note" name="note" rows="3">${escapeHtml(draft.note)}</textarea>
        </div>

        <div class="actions">
          <button class="btn-save" type="submit">Guardar dia</button>
        </div>
      </form>
    </section>
  `;
}

export function renderApp({
  state,
  weekData,
  weekDates,
  weekRangeLabel,
  isCurrentWeek,
  shiftSettings
}) {
  const header = `
    <header class="app-header">
      <div class="title-row">
        <h1 class="app-title">Menu Semanal</h1>
      </div>
      <p class="week-range">${escapeHtml(weekRangeLabel)}</p>

      <div class="toolbar">
        <button type="button" data-nav="prev">Semana anterior</button>
        <button type="button" data-nav="today" ${isCurrentWeek ? "disabled" : ""}>Hoy</button>
        <button type="button" data-nav="next">Semana siguiente</button>
      </div>

      <div class="view-tabs">
        <button type="button" data-view="home" class="${state.view === "home" ? "is-active" : ""}">Menu</button>
        <button type="button" data-view="edit" class="${state.view === "edit" ? "is-active" : ""}">Editar semana</button>
      </div>

      ${state.firebaseMessage ? `<div class="status ${state.firebaseReady ? "info" : "error"}">${escapeHtml(state.firebaseMessage)}</div>` : ""}
      ${state.infoMessage ? `<div class="status info">${escapeHtml(state.infoMessage)}</div>` : ""}
      ${state.errorMessage ? `<div class="status error">${escapeHtml(state.errorMessage)}</div>` : ""}
    </header>
  `;

  const loading = state.loading ? '<section class="loading">Cargando semana...</section>' : "";
  if (state.loading) {
    return `
      <main class="app-shell">
        ${header}
        <section class="app-content">${loading}</section>
      </main>
    `;
  }

  const homeHtml = `
    <section class="home-grid">
      ${weekDates.map((iso) => renderHomeCard(iso, weekData, shiftSettings)).join("")}
    </section>
  `;

  const selectorHtml = weekDates
    .map((iso) =>
      renderWeekSelectorButton({
        dateIso: iso,
        weekData,
        shiftSettings,
        selected: iso === state.selectedDateIso
      })
    )
    .join("");

  const editHtml = `
    <section class="edit-layout">
      <div class="week-selector">
        ${selectorHtml}
      </div>
      ${renderEditorPanel(state.selectedDateIso, weekData, shiftSettings)}
    </section>
  `;

  return `
    <main class="app-shell">
      ${header}
      <section class="app-content">
        ${state.view === "home" ? homeHtml : editHtml}
      </section>
    </main>
  `;
}
