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
import {
  addItem,
  clonePurchase,
  createEmptyPurchase,
  deleteItem,
  getItemById,
  getStats,
  isPurchaseEmpty,
  moveItem,
  toggleItemChecked,
  updateItemText
} from "./js/purchase-utils.js";
import {
  finalizePurchase,
  loadActivePurchase,
  loadHistory,
  restoreHistoryToActive,
  saveActivePurchase
} from "./js/purchase-service.js";

const appRoot = document.querySelector("#app");
const firestoreClient = createFirestoreClient(firebaseSetup);
const shiftSettings = getShiftSettings(shiftSetup?.baseDate);

const todayIso = getTodayISO();
const todayWeekStartIso = toISODate(startOfWeekMonday(fromISODate(todayIso)));
let toastTimerId = null;

const state = {
  activeSection: "menu",
  editorOpen: false,
  loading: false,
  saving: false,
  infoMessage: "",
  toastMessage: "",
  errorMessage: "",
  firebaseReady: false,
  firebaseMessage: "",
  autoScrolledWeekKey: "",
  currentWeekStartIso: todayWeekStartIso,
  selectedDateIso: todayIso,
  weeksByStart: {},

  purchaseLoaded: false,
  purchaseLoading: false,
  purchaseSaving: false,
  purchaseData: createEmptyPurchase(),
  purchaseEditOpen: false,
  purchaseDraft: null,
  purchaseActionItemId: "",
  purchaseActionText: "",
  purchaseActionStore: "",

  historyLoaded: false,
  historyLoading: false,
  historyEntries: [],
  historyExpandedIds: []
};

function setState(patch) {
  Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  render();
}

function showToast(message) {
  if (toastTimerId) {
    clearTimeout(toastTimerId);
  }
  setState({ toastMessage: message });
  toastTimerId = window.setTimeout(() => {
    state.toastMessage = "";
    render();
  }, 1900);
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

async function ensurePurchaseLoaded(force = false) {
  if (!force && state.purchaseLoaded) {
    return;
  }

  setState({
    purchaseLoading: true,
    errorMessage: ""
  });

  try {
    const purchase = await loadActivePurchase(firestoreClient);
    setState({
      purchaseLoaded: true,
      purchaseLoading: false,
      purchaseData: purchase
    });
  } catch (error) {
    setState({
      purchaseLoaded: true,
      purchaseLoading: false,
      errorMessage: error instanceof Error ? error.message : "No se pudo cargar la compra activa."
    });
  }
}

async function ensureHistoryLoaded(force = false) {
  if (!force && state.historyLoaded) {
    return;
  }

  setState({
    historyLoading: true,
    errorMessage: ""
  });

  try {
    const entries = await loadHistory(firestoreClient);
    setState({
      historyLoaded: true,
      historyLoading: false,
      historyEntries: entries
    });
  } catch (error) {
    setState({
      historyLoaded: true,
      historyLoading: false,
      errorMessage: error instanceof Error ? error.message : "No se pudo cargar el historial."
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
      editorOpen: false,
      weeksByStart: {
        ...prev.weeksByStart,
        [prev.currentWeekStartIso]: result.weekData
      },
      infoMessage: ""
    }));

    showToast(result.persistedRemote ? "Guardado" : "Guardado local");
  } catch (error) {
    setState({
      saving: false,
      errorMessage: error instanceof Error ? error.message : "No se pudo guardar."
    });
  }
}

function closePurchaseActionModal() {
  setState({
    purchaseActionItemId: "",
    purchaseActionText: "",
    purchaseActionStore: ""
  });
}

function openPurchaseEditor() {
  const draft = clonePurchase(state.purchaseData);
  setState({
    purchaseEditOpen: true,
    purchaseDraft: draft,
    purchaseActionItemId: "",
    purchaseActionText: "",
    purchaseActionStore: "",
    errorMessage: ""
  });
}

function closePurchaseEditor() {
  if (state.purchaseSaving) {
    return;
  }
  setState({
    purchaseEditOpen: false,
    purchaseDraft: null,
    purchaseActionItemId: "",
    purchaseActionText: "",
    purchaseActionStore: "",
    errorMessage: ""
  });
}

async function onTogglePurchaseItem(itemId) {
  const previous = state.purchaseData;
  const next = toggleItemChecked(previous, itemId);
  if (next === previous) {
    return;
  }

  setState({
    purchaseData: next,
    errorMessage: ""
  });

  try {
    const persisted = await saveActivePurchase(firestoreClient, next);
    setState({ purchaseData: persisted });
  } catch (error) {
    setState({
      purchaseData: previous,
      errorMessage: error instanceof Error ? error.message : "No se pudo actualizar el estado del item."
    });
  }
}

async function onSavePurchaseEditor() {
  if (!state.purchaseDraft) {
    return;
  }

  setState({
    purchaseSaving: true,
    errorMessage: ""
  });

  try {
    const saved = await saveActivePurchase(firestoreClient, state.purchaseDraft);
    setState({
      purchaseSaving: false,
      purchaseData: saved,
      purchaseEditOpen: false,
      purchaseDraft: null,
      purchaseActionItemId: "",
      purchaseActionText: "",
      purchaseActionStore: ""
    });
    showToast("Compra guardada");
  } catch (error) {
    setState({
      purchaseSaving: false,
      errorMessage: error instanceof Error ? error.message : "No se pudo guardar la compra."
    });
  }
}

function openPurchaseItemActions(itemId) {
  if (!state.purchaseEditOpen || !state.purchaseDraft) {
    return;
  }

  const item = getItemById(state.purchaseDraft, itemId);
  if (!item) {
    return;
  }

  setState({
    purchaseActionItemId: item.id,
    purchaseActionText: item.text,
    purchaseActionStore: item.store
  });
}

function bindPurchaseLongPress() {
  document.querySelectorAll("[data-edit-item-id]").forEach((button) => {
    let timerId = null;
    let startX = 0;
    let startY = 0;
    let longPressed = false;
    const itemId = button.getAttribute("data-edit-item-id");
    if (!itemId) {
      return;
    }

    const clear = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      longPressed = false;
      startX = event.clientX;
      startY = event.clientY;
      clear();
      timerId = window.setTimeout(() => {
        longPressed = true;
        openPurchaseItemActions(itemId);
      }, 460);
    });

    button.addEventListener("pointermove", (event) => {
      if (!timerId) {
        return;
      }
      if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) {
        clear();
      }
    });

    button.addEventListener("pointerup", clear);
    button.addEventListener("pointerleave", clear);
    button.addEventListener("pointercancel", clear);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (longPressed) {
        event.stopPropagation();
      }
    });

    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openPurchaseItemActions(itemId);
    });
  });
}

async function onFinishPurchase() {
  const stats = getStats(state.purchaseData);
  if (stats.itemsTotal === 0) {
    showToast("No hay productos para finalizar");
    return;
  }

  if (stats.pendingCount > 0) {
    const confirmPending = window.confirm(
      `Quedan ${stats.pendingCount} productos sin comprar. ¿Finalizar compra igualmente?`
    );
    if (!confirmPending) {
      return;
    }
  } else {
    const confirmDone = window.confirm("¿Finalizar compra?");
    if (!confirmDone) {
      return;
    }
  }

  setState({
    purchaseSaving: true,
    errorMessage: ""
  });

  try {
    const result = await finalizePurchase(firestoreClient, state.purchaseData);
    const nextHistory = firestoreClient.status.ready
      ? await loadHistory(firestoreClient)
      : [result.historyEntry, ...state.historyEntries];

    setState({
      purchaseSaving: false,
      purchaseData: result.nextActivePurchase,
      purchaseEditOpen: false,
      purchaseDraft: null,
      purchaseActionItemId: "",
      purchaseActionText: "",
      purchaseActionStore: "",
      historyEntries: nextHistory,
      historyLoaded: true,
      historyExpandedIds: []
    });
    showToast("Compra finalizada");
  } catch (error) {
    setState({
      purchaseSaving: false,
      errorMessage: error instanceof Error ? error.message : "No se pudo finalizar la compra."
    });
  }
}

async function onRestoreHistoryEntry(historyId) {
  const entry = state.historyEntries.find((item) => item.id === historyId);
  if (!entry) {
    return;
  }

  if (!isPurchaseEmpty(state.purchaseData)) {
    const confirmReplace = window.confirm(
      "La compra activa no está vacía. ¿Quieres reemplazarla con la compra histórica?"
    );
    if (!confirmReplace) {
      return;
    }
  }

  setState({
    purchaseSaving: true,
    errorMessage: ""
  });

  try {
    const restored = await restoreHistoryToActive(firestoreClient, entry);
    setState({
      purchaseSaving: false,
      purchaseData: restored,
      purchaseLoaded: true,
      activeSection: "purchase",
      purchaseEditOpen: false,
      purchaseDraft: null,
      purchaseActionItemId: "",
      purchaseActionText: "",
      purchaseActionStore: ""
    });
    showToast("Compra restaurada");
  } catch (error) {
    setState({
      purchaseSaving: false,
      errorMessage: error instanceof Error ? error.message : "No se pudo restaurar la compra."
    });
  }
}

async function onSectionChange(section) {
  if (!section || state.activeSection === section) {
    return;
  }

  setState({
    activeSection: section,
    editorOpen: false,
    purchaseEditOpen: false,
    purchaseDraft: null,
    purchaseActionItemId: "",
    purchaseActionText: "",
    purchaseActionStore: "",
    infoMessage: "",
    errorMessage: ""
  });

  if (section === "menu") {
    await ensureWeekLoaded();
  }

  if (section === "purchase") {
    await ensurePurchaseLoaded();
  }

  if (section === "history") {
    await ensureHistoryLoaded();
  }
}

function bindEvents() {
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.getAttribute("data-section");
      void onSectionChange(section);
    });
  });

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
      autoScrolledWeekKey: "",
      infoMessage: "",
      errorMessage: ""
    });
    await ensureWeekLoaded();
  });

  document.querySelectorAll("[data-close-editor]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.saving) {
        return;
      }
      setState({ editorOpen: false, errorMessage: "" });
    });
  });

  document.querySelectorAll("[data-open-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const iso = button.getAttribute("data-open-edit");
      if (!iso) {
        return;
      }
      setState({
        selectedDateIso: iso,
        editorOpen: true,
        errorMessage: ""
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

  const menuForm = document.querySelector("#day-form");
  if (menuForm) {
    menuForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void onSaveDay(menuForm);
    });
    menuForm.addEventListener("change", syncSegmentedUi);
  }

  document.querySelectorAll("[data-toggle-purchase-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.getAttribute("data-toggle-purchase-item");
      if (!itemId) {
        return;
      }
      void onTogglePurchaseItem(itemId);
    });
  });

  document.querySelector("[data-open-purchase-editor]")?.addEventListener("click", () => {
    openPurchaseEditor();
  });

  document.querySelectorAll("[data-close-purchase-editor]").forEach((button) => {
    button.addEventListener("click", () => {
      closePurchaseEditor();
    });
  });

  document.querySelector("[data-save-purchase-editor]")?.addEventListener("click", () => {
    void onSavePurchaseEditor();
  });

  const addForm = document.querySelector("#purchase-add-form");
  if (addForm) {
    addForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!state.purchaseDraft) {
        return;
      }

      const formData = new FormData(addForm);
      const store = cleanText(formData.get("store")) || "Otros";
      const text = cleanText(formData.get("text"));
      if (!text) {
        return;
      }

      const nextDraft = addItem(state.purchaseDraft, {
        storeName: store,
        text
      });
      setState({
        purchaseDraft: nextDraft
      });

      addForm.reset();
      const storeInput = addForm.querySelector('[name="store"]');
      if (storeInput) {
        storeInput.value = store;
      }
    });
  }

  bindPurchaseLongPress();

  document.querySelectorAll("[data-purchase-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.purchaseDraft || !state.purchaseActionItemId) {
        closePurchaseActionModal();
        return;
      }

      const action = button.getAttribute("data-purchase-action");
      const itemId = state.purchaseActionItemId;
      const textInput = document.querySelector("#purchase_action_text");
      const storeInput = document.querySelector("#purchase_action_store");
      const nextText = cleanText(textInput?.value || "");
      const nextStore = cleanText(storeInput?.value || "") || "Otros";

      if (action === "close") {
        closePurchaseActionModal();
        return;
      }

      if (action === "save-text") {
        const nextDraft = updateItemText(state.purchaseDraft, itemId, nextText);
        setState({
          purchaseDraft: nextDraft,
          purchaseActionText: nextText || state.purchaseActionText
        });
        return;
      }

      if (action === "move-item") {
        const nextDraft = moveItem(state.purchaseDraft, itemId, nextStore);
        setState({
          purchaseDraft: nextDraft,
          purchaseActionStore: nextStore
        });
        return;
      }

      if (action === "delete-item") {
        const confirmDelete = window.confirm("¿Eliminar este producto de la lista?");
        if (!confirmDelete) {
          return;
        }
        const nextDraft = deleteItem(state.purchaseDraft, itemId);
        setState({
          purchaseDraft: nextDraft
        });
        closePurchaseActionModal();
      }
    });
  });

  document.querySelectorAll("[data-finish-purchase]").forEach((button) => {
    button.addEventListener("click", () => {
      void onFinishPurchase();
    });
  });

  document.querySelectorAll("[data-toggle-history]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-toggle-history");
      if (!id) {
        return;
      }

      const expanded = state.historyExpandedIds.includes(id);
      if (expanded) {
        setState({
          historyExpandedIds: state.historyExpandedIds.filter((value) => value !== id)
        });
      } else {
        setState({
          historyExpandedIds: [...state.historyExpandedIds, id]
        });
      }
    });
  });

  document.querySelectorAll("[data-restore-history]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-restore-history");
      if (!id) {
        return;
      }
      void onRestoreHistoryEntry(id);
    });
  });
}

function render() {
  if (!appRoot) {
    return;
  }

  const weekData = currentWeekData();
  const weekDates = currentWeekDates();

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
    shiftSettings,
    todayIso,
    purchaseData: state.purchaseData,
    historyEntries: state.historyEntries
  });

  appRoot.innerHTML = html;
  document.body.classList.toggle(
    "modal-open",
    state.editorOpen || state.purchaseEditOpen || Boolean(state.purchaseActionItemId)
  );
  bindEvents();
  syncSegmentedUi();
  maybeAutoScrollToTodayCard();
}

function maybeAutoScrollToTodayCard() {
  if (state.activeSection !== "menu") {
    return;
  }
  if (state.loading || state.editorOpen) {
    return;
  }
  if (state.currentWeekStartIso !== todayWeekStartIso) {
    return;
  }
  if (state.autoScrolledWeekKey === state.currentWeekStartIso) {
    return;
  }

  const todayCard = document.querySelector(`[data-day-card="${todayIso}"]`);
  if (!todayCard) {
    return;
  }

  requestAnimationFrame(() => {
    todayCard.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  });

  state.autoScrolledWeekKey = state.currentWeekStartIso;
}

function setFatalError(message) {
  if (!appRoot) {
    return;
  }
  appRoot.innerHTML = `
    <main class="app-shell">
      <section class="app-header">
        <h1 class="app-title">Men&uacute; Semanal</h1>
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

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.purchaseActionItemId) {
        closePurchaseActionModal();
        return;
      }

      if (state.purchaseEditOpen && !state.purchaseSaving) {
        closePurchaseEditor();
        return;
      }

      if (state.editorOpen && !state.saving) {
        setState({ editorOpen: false, errorMessage: "" });
      }
    }
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

  await Promise.all([ensureWeekLoaded(), ensurePurchaseLoaded(), ensureHistoryLoaded()]);
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : "Error fatal al iniciar la app.";
  setFatalError(message);
});
