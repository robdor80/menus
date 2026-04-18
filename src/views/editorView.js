import { renderEditForm } from "../components/editForm.js";
import { renderWeekSelectorDay } from "../components/weekSelectorDay.js";
import { resolveShiftValue } from "../services/shiftEngine.js";
import { buildDraftDay, getAutoShiftHint, hasStoredDataForDay } from "../services/weekService.js";
import { formatDateLabel, formatDayLabel, formatDayShort, fromISODate } from "../utils/date.js";
import { normalizePersistedDay } from "../utils/normalize.js";

export function renderEditorView({ weekDates, weekData, selectedDateIso, shiftSettings }) {
  const safeSelectedDateIso = selectedDateIso && weekDates.some((date) => date.iso === selectedDateIso)
    ? selectedDateIso
    : weekDates[0].iso;

  const selectorHtml = weekDates
    .map((date) => {
      const storedDay = weekData.days[date.iso] ? normalizePersistedDay(weekData.days[date.iso]) : normalizePersistedDay();
      return renderWeekSelectorDay({
        dateIso: date.iso,
        dayShort: formatDayShort(fromISODate(date.iso)),
        dateLabel: formatDateLabel(fromISODate(date.iso)),
        shift: resolveShiftValue(storedDay, date.iso, shiftSettings),
        hasStoredData: hasStoredDataForDay(weekData, date.iso),
        isSelected: date.iso === safeSelectedDateIso
      });
    })
    .join("");

  const draft = buildDraftDay(weekData, safeSelectedDateIso, shiftSettings);
  const dayDate = fromISODate(safeSelectedDateIso);
  const formHtml = renderEditForm({
    dayLabel: formatDayLabel(dayDate),
    dateLabel: formatDateLabel(dayDate),
    draft,
    autoShift: getAutoShiftHint(safeSelectedDateIso, shiftSettings)
  });

  return {
    safeSelectedDateIso,
    html: `
      <section class="editor-layout">
        <div class="week-selector">
          ${selectorHtml}
        </div>
        ${formHtml}
      </section>
    `
  };
}
