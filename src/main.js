import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";

import { VIEW_EDIT, VIEW_HOME, getViewFromHash, onViewChange, setViewInHash } from "./router.js";
import { createStore } from "./state/store.js";
import {
  addDays,
  addWeeks,
  formatWeekRange,
  fromISODate,
  getDayIndexInWeek,
  getTodayISO,
  getWeekDates,
  startOfWeekMonday,
  toISODate
} from "./utils/date.js";
import { loadWeekData, saveDay } from "./services/weekService.js";
import { getShiftSettingsFromEnv } from "./services/shiftEngine.js";
import { renderHomeView } from "./views/homeView.js";
import { renderEditorView } from "./views/editorView.js";
import { CASA_MODE_FUERA, CASA_MODE_TEXT, sanitizeText } from "./utils/normalize.js";

const appRoot = document.querySelector("#app");
const shiftSettings = getShiftSettingsFromEnv();

const todayIso = getTodayISO();
const todayWeekStartIso = toISODate(startOfWeekMonday(fromISODate(todayIso)));

const initialState = {
  view: getViewFromHash(),
  currentWeekStartIso: todayWeekStartIso,
  selectedDateIso: todayIso,
  loading: false,
  saving: false,
  infoMessage: "",
  errorMessage: "",
  weeksById: {}
};

const store = createStore(initialState);
store.subscribe(render);

onViewChange((view) => {
  store.setState((state) => ({ ...state, view }));
});

void ensureWeekLoaded();

function getCurrentWeekDates(state) {
  const weekStartDate = fromISODate(state.currentWeekStartIso);
  return getWeekDates(weekStartDate).map((date) => ({ iso: toISODate(date), date }));
}

function getCurrentWeekData(state) {
  return Object.values(state.weeksById).find((week) => week.startDate === state.currentWeekStartIso) ?? null;
}

function getWeekIdByStartDate(state, weekStartIso) {
  return Object.values(state.weeksById).find((week) => week.startDate === weekStartIso)?.weekId;
}

async function ensureWeekLoaded(force = false) {
  const state = store.getState();
  const weekStartIso = state.currentWeekStartIso;
  const cachedWeekId = getWeekIdByStartDate(state, weekStartIso);

  if (!force && cachedWeekId && state.weeksById[cachedWeekId]) {
    return;
  }

  store.setState((prev) => ({
    ...prev,
    loading: true,
    errorMessage: ""
  }));

  try {
    const loadedWeek = await loadWeekData(fromISODate(weekStartIso));
    store.setState((prev) => ({
      ...prev,
      loading: false,
      weeksById: {
        ...prev.weeksById,
        [loadedWeek.weekId]: loadedWeek
      }
    }));
  } catch (error) {
    store.setState((prev) => ({
      ...prev,
      loading: false,
      errorMessage: error instanceof Error ? error.message : "No se pudo cargar la semana."
    }));
  }
}

function changeWeek(offset) {
  store.setState((state) => {
    const currentStart = fromISODate(state.currentWeekStartIso);
    const nextStart = addWeeks(currentStart, offset);
    const currentSelectedIndex = getDayIndexInWeek(state.currentWeekStartIso, state.selectedDateIso);
    const nextSelected = toISODate(addDays(nextStart, currentSelectedIndex));
    return {
      ...state,
      currentWeekStartIso: toISODate(nextStart),
      selectedDateIso: nextSelected,
      infoMessage: "",
      errorMessage: ""
    };
  });
  void ensureWeekLoaded();
}

function goToTodayWeek() {
  store.setState((state) => ({
    ...state,
    currentWeekStartIso: todayWeekStartIso,
    selectedDateIso: todayIso,
    infoMessage: "",
    errorMessage: ""
  }));
  void ensureWeekLoaded();
}

function setSelectedDay(dateIso) {
  store.setState((state) => ({
    ...state,
    selectedDateIso: dateIso
  }));
}

function switchView(view) {
  setViewInHash(view);
  store.setState((state) => ({
    ...state,
    view
  }));
}

function parseDraftFromForm(form) {
  const shift = sanitizeText(form.get("shift"));
  const casaComidaMode = form.get("casa_comida_mode") === CASA_MODE_FUERA ? CASA_MODE_FUERA : CASA_MODE_TEXT;
  const casaCenaMode = form.get("casa_cena_mode") === CASA_MODE_FUERA ? CASA_MODE_FUERA : CASA_MODE_TEXT;

  return {
    shift,
    roberto: {
      comida: sanitizeText(form.get("roberto_comida")),
      cena: sanitizeText(form.get("roberto_cena"))
    },
    casa: {
      comida: {
        mode: casaComidaMode,
        text: sanitizeText(form.get("casa_comida_text"))
      },
      cena: {
        mode: casaCenaMode,
        text: sanitizeText(form.get("casa_cena_text"))
      }
    },
    note: sanitizeText(form.get("note"))
  };
}

async function handleSaveDay(formElement) {
  const state = store.getState();
  const weekData = getCurrentWeekData(state);
  if (!weekData || !weekData.weekId) {
    store.setState((prev) => ({
      ...prev,
      errorMessage: "No hay semana cargada para guardar."
    }));
    return;
  }

  const formData = new FormData(formElement);
  const draft = parseDraftFromForm(formData);

  store.setState((prev) => ({
    ...prev,
    saving: true,
    infoMessage: "",
    errorMessage: ""
  }));

  try {
    const result = await saveDay({
      weekData,
      dateIso: state.selectedDateIso,
      draftDay: draft,
      shiftSettings
    });

    store.setState((prev) => ({
      ...prev,
      saving: false,
      weeksById: {
        ...prev.weeksById,
        [result.weekData.weekId]: result.weekData
      },
      infoMessage: result.created
        ? "Semana creada en Firestore y dia guardado."
        : "Dia guardado correctamente."
    }));
  } catch (error) {
    store.setState((prev) => ({
      ...prev,
      saving: false,
      errorMessage: error instanceof Error ? error.message : "No se pudo guardar el dia."
    }));
  }
}

function syncCasaModeUI() {
  const form = document.querySelector("#day-edit-form");
  if (!form) {
    return;
  }
  ["casa_comida", "casa_cena"].forEach((fieldName) => {
    const selectedMode = form.querySelector(`input[name="${fieldName}_mode"]:checked`)?.value;
    const textRow = form.querySelector(`[data-text-row="${fieldName}"]`);
    if (!textRow) {
      return;
    }
    if (selectedMode === CASA_MODE_FUERA) {
      textRow.classList.add("is-hidden");
    } else {
      textRow.classList.remove("is-hidden");
    }
  });
}

function bindEvents() {
  document.querySelector("[data-week-nav='prev']")?.addEventListener("click", () => changeWeek(-1));
  document.querySelector("[data-week-nav='next']")?.addEventListener("click", () => changeWeek(1));
  document.querySelector("[data-week-nav='today']")?.addEventListener("click", goToTodayWeek);

  document.querySelector("[data-view='home']")?.addEventListener("click", () => switchView(VIEW_HOME));
  document.querySelector("[data-view='edit']")?.addEventListener("click", () => switchView(VIEW_EDIT));

  document.querySelectorAll("[data-open-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const dateIso = button.getAttribute("data-open-edit");
      if (!dateIso) {
        return;
      }
      setSelectedDay(dateIso);
      switchView(VIEW_EDIT);
    });
  });

  document.querySelectorAll("[data-select-day]").forEach((button) => {
    button.addEventListener("click", () => {
      const dateIso = button.getAttribute("data-select-day");
      if (!dateIso) {
        return;
      }
      setSelectedDay(dateIso);
    });
  });

  const form = document.querySelector("#day-edit-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void handleSaveDay(form);
    });

    form.addEventListener("change", () => {
      syncCasaModeUI();
      form
        .querySelectorAll(".segmented-option")
        .forEach((option) => option.classList.remove("is-active"));
      form
        .querySelectorAll('input[type="radio"]:checked')
        .forEach((input) => input.closest(".segmented-option")?.classList.add("is-active"));
    });
  }
}

function render() {
  const state = store.getState();
  const weekDates = getCurrentWeekDates(state);
  const weekData = getCurrentWeekData(state) ?? {
    weekId: "",
    startDate: state.currentWeekStartIso,
    endDate: weekDates[6].iso,
    existsInDb: false,
    days: {}
  };
  const weekRangeLabel = formatWeekRange(fromISODate(state.currentWeekStartIso));
  const isTodayWeek = state.currentWeekStartIso === todayWeekStartIso;
  const editorView = renderEditorView({
    weekDates,
    weekData,
    selectedDateIso: state.selectedDateIso,
    shiftSettings
  });

  const content = state.loading
    ? `<section class="loading">Cargando semana...</section>`
    : state.view === VIEW_HOME
      ? renderHomeView({
          weekDates,
          weekData,
          shiftSettings
        })
      : editorView.html;

  appRoot.innerHTML = `
    <main class="app-shell">
      <header class="app-header">
        <h1 class="app-title">Men&uacute; Semanal</h1>
        <p class="week-meta">${weekRangeLabel}</p>
        <div class="week-nav">
          <button class="btn-soft" type="button" data-week-nav="prev">Semana anterior</button>
          <button class="btn-soft" type="button" data-week-nav="today" ${isTodayWeek ? "disabled" : ""}>Hoy</button>
          <button class="btn-soft" type="button" data-week-nav="next">Semana siguiente</button>
        </div>
        <div class="view-tabs">
          <button class="btn-tab ${state.view === VIEW_HOME ? "is-active" : ""}" data-view="home" type="button">Men&uacute;</button>
          <button class="btn-tab ${state.view === VIEW_EDIT ? "is-active" : ""}" data-view="edit" type="button">Editar semana</button>
        </div>
        ${
          state.infoMessage
            ? `<div class="status-banner status-info">${state.infoMessage}</div>`
            : ""
        }
        ${
          state.errorMessage
            ? `<div class="status-banner status-error">${state.errorMessage}</div>`
            : ""
        }
      </header>
      <section class="app-content">${content}</section>
    </main>
  `;

  if (state.view === VIEW_EDIT && state.selectedDateIso !== editorView.safeSelectedDateIso) {
    setSelectedDay(editorView.safeSelectedDateIso);
  }

  bindEvents();
  syncCasaModeUI();
}
