import { firebaseSetup, shiftSetup } from "./firebase-config.js";
import {
  addWeeks,
  formatWeekRange,
  fromISODate,
  getTodayISO,
  getWeekDates,
  startOfWeekMonday,
  toISODate
} from "./js/date-utils.js";
import { createFirestoreClient } from "./js/firestore-service.js";
import { CASA_FUERA, CASA_TEXT, cleanText } from "./js/normalize.js";
import { renderApp } from "./js/render.js";
import { getShiftSettings } from "./js/shift-engine.js";
import { buildEmptyWeek, loadWeek, saveDay } from "./js/week-service.js";

const appRoot = document.querySelector("#app");
const firestoreClient = createFirestoreClient(firebaseSetup);
const shiftSettings = getShiftSettings(shiftSetup?.baseDate);

const todayIso = getTodayISO();
const todayWeekStartIso = toISODate(startOfWeekMonday(fromISODate(todayIso)));

const state = {
  view: "home",
  loading: false,
  saving: false,
  infoMessage: "",
  errorMessage: "",
  firebaseReady: false,
  firebaseMessage: "",
  currentWeekStartIso: todayWeekStartIso,
  selectedDateIso: todayIso,
  weeksByStart: {}
};

function setState(patch) {
  Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  render();
}

function currentWeekDates() {
  const startDate = fromISODate(state.currentWeekStartIso);
  return getWeekDates(startDate).map((date) => toISODate(date));
}

function selectedDayIndex(weekDates) {
  const index = weekDates.indexOf(state.selectedDateIso);
  return index >= 0 ? index : 0;
}

function currentWeekData() {
  return state.weeksByStart[state.currentWeekStartIso] || buildEmptyWeek(fromISODate(state.currentWeekStartIso));
}

async function ensureWeekLoaded() {
  if (state.weeksByStart[state.currentWeekStartIso]) {
    return;
  }

  setState({
    loading: true,
    errorMessage: ""
  });

  try {
    const week = await loadWeek(fromISODate(state.currentWeekStartIso), firestoreClient);
    setState((prev) => ({
      loading: false,
      weeksByStart: {
        ...prev.weeksByStart,
        [prev.currentWeekStartIso]: week
      }
    }));
  } catch (error) {
    setState({
      loading: false,
      errorMessage: error instanceof Error ? error.message : "No se pudo cargar la semana."
    });
  }
}

function parseDraft(formData) {
  return {
    shift: cleanText(formData.get("shift")),
    roberto: {
      comida: cleanText(formData.get("roberto_comida")),
      cena: cleanText(formData.get("roberto_cena"))
    },
    casa: {
      comida: {
        mode: formData.get("casa_comida_mode") === CASA_FUERA ? CASA_FUERA : CASA_TEXT,
        text: cleanText(formData.get("casa_comida_text"))
      },
      cena: {
        mode: formData.get("casa_cena_mode") === CASA_FUERA ? CASA_FUERA : CASA_TEXT,
        text: cleanText(formData.get("casa_cena_text"))
      }
    },
    note: cleanText(formData.get("note"))
  };
}

function syncSegmentedUi() {
  const form = document.querySelector("#day-form");
  if (!form) {
    return;
  }

  ["casa_comida", "casa_cena"].forEach((name) => {
    const selected = form.querySelector(`input[name="${name}_mode"]:checked`);
    const row = form.querySelector(`[data-text-row="${name}"]`);

    if (row) {
      if (selected?.value === CASA_FUERA) {
        row.classList.add("hidden");
      } else {
        row.classList.remove("hidden");
      }
    }
  });

  form.querySelectorAll(".segmented label").forEach((label) => label.classList.remove("active"));
  form.querySelectorAll('.segmented input[type="radio"]:checked').forEach((input) => {
    input.closest("label")?.classList.add("active");
  });
}

async function onSaveDay(form) {
  const weekData = currentWeekData();
  const formData = new FormData(form);
  const draft = parseDraft(formData);

  setState({
    saving: true,
    infoMessage: "",
    errorMessage: ""
  });

  try {
    const result = await saveDay({
      weekData,
      dateIso: state.selectedDateIso,
      draftDay: draft,
      shiftSettings,
      firestoreClient
    });

    setState((prev) => ({
      saving: false,
      weeksByStart: {
        ...prev.weeksByStart,
        [prev.currentWeekStartIso]: result.weekData
      },
      infoMessage: result.persistedRemote
        ? "Dia guardado en Firestore."
        : "Dia guardado en memoria local (Firebase no activo)."
    }));
  } catch (error) {
    setState({
      saving: false,
      errorMessage: error instanceof Error ? error.message : "No se pudo guardar."
    });
  }
}

function bindEvents() {
  document.querySelector("[data-nav='prev']")?.addEventListener("click", async () => {
    const dates = currentWeekDates();
    const index = selectedDayIndex(dates);
    const nextStartDate = addWeeks(fromISODate(state.currentWeekStartIso), -1);
    const nextDates = getWeekDates(nextStartDate).map((d) => toISODate(d));

    setState({
      currentWeekStartIso: toISODate(nextStartDate),
      selectedDateIso: nextDates[index],
      infoMessage: "",
      errorMessage: ""
    });
    await ensureWeekLoaded();
  });

  document.querySelector("[data-nav='next']")?.addEventListener("click", async () => {
    const dates = currentWeekDates();
    const index = selectedDayIndex(dates);
    const nextStartDate = addWeeks(fromISODate(state.currentWeekStartIso), 1);
    const nextDates = getWeekDates(nextStartDate).map((d) => toISODate(d));

    setState({
      currentWeekStartIso: toISODate(nextStartDate),
      selectedDateIso: nextDates[index],
      infoMessage: "",
      errorMessage: ""
    });
    await ensureWeekLoaded();
  });

  document.querySelector("[data-nav='today']")?.addEventListener("click", async () => {
    setState({
      currentWeekStartIso: todayWeekStartIso,
      selectedDateIso: todayIso,
      infoMessage: "",
      errorMessage: ""
    });
    await ensureWeekLoaded();
  });

  document.querySelector("[data-view='home']")?.addEventListener("click", () => {
    setState({ view: "home" });
  });

  document.querySelector("[data-view='edit']")?.addEventListener("click", () => {
    setState({ view: "edit" });
  });

  document.querySelectorAll("[data-open-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const iso = button.getAttribute("data-open-edit");
      if (!iso) {
        return;
      }
      setState({
        selectedDateIso: iso,
        view: "edit"
      });
    });
  });

  document.querySelectorAll("[data-select-day]").forEach((button) => {
    button.addEventListener("click", () => {
      const iso = button.getAttribute("data-select-day");
      if (!iso) {
        return;
      }
      setState({ selectedDateIso: iso });
    });
  });

  const form = document.querySelector("#day-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void onSaveDay(form);
    });
    form.addEventListener("change", syncSegmentedUi);
  }
}

function render() {
  if (!appRoot) {
    return;
  }

  const weekData = currentWeekData();
  const weekDates = currentWeekDates();

  // Mantiene fecha seleccionada siempre dentro de la semana visible.
  if (!weekDates.includes(state.selectedDateIso)) {
    state.selectedDateIso = weekDates[0];
  }

  const weekRange = formatWeekRange(fromISODate(state.currentWeekStartIso));
  const html = renderApp({
    state,
    weekData,
    weekDates,
    weekRangeLabel: weekRange,
    isCurrentWeek: state.currentWeekStartIso === todayWeekStartIso,
    shiftSettings
  });

  appRoot.innerHTML = html;
  bindEvents();
  syncSegmentedUi();
}

function setFatalError(message) {
  if (!appRoot) {
    return;
  }
  appRoot.innerHTML = `
    <main class="app-shell">
      <section class="app-header">
        <h1 class="app-title">Menu Semanal</h1>
        <div class="status error">${message}</div>
      </section>
    </main>
  `;
}

function setupGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    setFatalError(event.message || "Error inesperado en la aplicacion.");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "");
    setFatalError(reason || "Error inesperado en inicializacion.");
  });
}

async function bootstrap() {
  setupGlobalErrorHandlers();
  render();

  const status = await firestoreClient.initialize();
  if (!status.ready) {
    setState({
      firebaseReady: false,
      firebaseMessage: status.message || "Firebase no disponible. Modo local activo."
    });
  } else {
    setState({
      firebaseReady: true,
      firebaseMessage: ""
    });
  }

  await ensureWeekLoaded();
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : "Error fatal al iniciar la app.";
  setFatalError(message);
});
