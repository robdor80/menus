import { escapeHtml, SHIFT_OPTIONS } from "../utils/normalize.js";

function renderCasaModeSegment(fieldName, currentMode) {
  const isText = currentMode === "text";
  const isFuera = currentMode === "fuera";

  return `
    <div class="segmented-control" role="radiogroup" aria-label="${escapeHtml(fieldName)}">
      <label class="segmented-option ${isText ? "is-active" : ""}">
        <input type="radio" name="${fieldName}_mode" value="text" ${isText ? "checked" : ""} />
        <span>Texto</span>
      </label>
      <label class="segmented-option ${isFuera ? "is-active" : ""}">
        <input type="radio" name="${fieldName}_mode" value="fuera" ${isFuera ? "checked" : ""} />
        <span>Fuera</span>
      </label>
    </div>
  `;
}

function renderShiftOptions(selectedShift) {
  return SHIFT_OPTIONS.map((shiftValue) => {
    const selected = selectedShift === shiftValue ? "selected" : "";
    return `<option value="${escapeHtml(shiftValue)}" ${selected}>${escapeHtml(shiftValue)}</option>`;
  }).join("");
}

export function renderEditForm({ dayLabel, dateLabel, draft, autoShift }) {
  const comidaMode = draft.casa.comida.mode;
  const cenaMode = draft.casa.cena.mode;

  return `
    <section class="editor-panel">
      <header class="editor-header">
        <h2>${escapeHtml(dayLabel)} ${escapeHtml(dateLabel)}</h2>
        <p>Turno auto 6x6: <strong>${escapeHtml(autoShift)}</strong></p>
      </header>
      <form id="day-edit-form" class="edit-form">
        <div class="form-row">
          <label for="shift">Turno</label>
          <select id="shift" name="shift" required>
            ${renderShiftOptions(draft.shift)}
          </select>
        </div>

        <fieldset class="group-fieldset">
          <legend>Roberto (trabajo)</legend>
          <p class="helper-text">En turno de tarde suele usarse Roberto para comida y/o cena en trabajo.</p>
          <div class="form-row">
            <label for="roberto_comida">Comida</label>
            <input id="roberto_comida" name="roberto_comida" type="text" value="${escapeHtml(draft.roberto.comida)}" />
          </div>
          <div class="form-row">
            <label for="roberto_cena">Cena</label>
            <input id="roberto_cena" name="roberto_cena" type="text" value="${escapeHtml(draft.roberto.cena)}" />
          </div>
        </fieldset>

        <fieldset class="group-fieldset">
          <legend>Casa</legend>

          <div class="casa-meal">
            <p class="meal-title">Comida</p>
            ${renderCasaModeSegment("casa_comida", comidaMode)}
            <div class="form-row casa-text-row ${comidaMode === "fuera" ? "is-hidden" : ""}" data-text-row="casa_comida">
              <label for="casa_comida_text">Texto</label>
              <input
                id="casa_comida_text"
                name="casa_comida_text"
                type="text"
                value="${escapeHtml(draft.casa.comida.text)}"
              />
            </div>
          </div>

          <div class="casa-meal">
            <p class="meal-title">Cena</p>
            ${renderCasaModeSegment("casa_cena", cenaMode)}
            <div class="form-row casa-text-row ${cenaMode === "fuera" ? "is-hidden" : ""}" data-text-row="casa_cena">
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

        <div class="form-row">
          <label for="note">Nota</label>
          <textarea id="note" name="note" rows="3">${escapeHtml(draft.note)}</textarea>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary">Guardar día</button>
        </div>
      </form>
    </section>
  `;
}
