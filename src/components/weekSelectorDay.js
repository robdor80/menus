import { escapeHtml } from "../utils/normalize.js";

const SHIFT_CLASS = {
  Libre: "shift-libre",
  "Ma\u00f1ana": "shift-manana",
  Tarde: "shift-tarde",
  Noche: "shift-noche"
};

export function renderWeekSelectorDay({
  dateIso,
  dayShort,
  dateLabel,
  shift,
  hasStoredData,
  isSelected
}) {
  const shiftClass = SHIFT_CLASS[shift] ?? SHIFT_CLASS.Libre;
  return `
    <button
      type="button"
      class="week-day-pill ${shiftClass} ${isSelected ? "is-selected" : ""}"
      data-select-day="${escapeHtml(dateIso)}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span class="week-day-header">
        <span class="week-day-name">${escapeHtml(dayShort)}</span>
        ${hasStoredData ? '<span class="saved-dot" title="Día con datos guardados"></span>' : ""}
      </span>
      <span class="week-day-date">${escapeHtml(dateLabel)}</span>
      <span class="week-day-shift">${escapeHtml(shift)}</span>
    </button>
  `;
}
