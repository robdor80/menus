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
  createEmptyPurchase,
  deleteItem,
  getItemById,
  getStats,
  isPurchaseEmpty,
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
  purchaseStoreModalStore: "",
  purchaseStoreInputText: "",
  purchaseStoreEditingItemId: "",

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
  }, 1800);
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

function splitStoreItemsInput(value) {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((part) => cleanText(part))
    .filter(Boolean);
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

function openPurchaseEditor() {
  setState({
    purchaseEditOpen: true,
    purchaseStoreModalStore: "",
    purchaseStoreInputText: "",
    purchaseStoreEditingItemId: "",
    errorMessage: ""
  });
}

function closePurchaseEditor() {
  if (state.purchaseSaving) {
    return;
  }
  setState({
    purchaseEditOpen: false,
    purchaseStoreModalStore: "",
    purchaseStoreInputText: "",
    purchaseStoreEditingItemId: ""
  });
}

function openStoreModal(store) {
  if (!store) {
    return;
  }
  setState({
    purchaseStoreModalStore: store,
    purchaseStoreInputText: "",
    purchaseStoreEditingItemId: ""
  });
}

function closeStoreModal() {
  setState({
    purchaseStoreModalStore: "",
    purchaseStoreInputText: "",
    purchaseStoreEditingItemId: ""
  });
}

function startStoreItemEdit(itemId) {
  if (!itemId || !state.purchaseStoreModalStore) {
    return;
  }
  const item = getItemById(state.purchaseData, itemId);
  if (!item) {
    return;
  }
  setState({
    purchaseStoreEditingItemId: item.id,
    purchaseStoreInputText: item.text
  });
}

function cancelStoreItemEdit() {
  setState({
    purchaseStoreEditingItemId: "",
    purchaseStoreInputText: ""
  });
}

async function persistPurchaseChange(nextPurchase, successMessage) {
  const previous = state.purchaseData;
  if (nextPurchase === previous) {
    return;
  }

  setState({
    purchaseSaving: true,
    purchaseData: nextPurchase,
    errorMessage: ""
  });

  try {
    const saved = await saveActivePurchase(firestoreClient, nextPurchase);
    setState({
      purchaseSaving: false,
      purchaseData: saved
    });
    if (successMessage) {
      showToast(successMessage);
    }
  } catch (error) {
    setState({
      purchaseSaving: false,
      purchaseData: previous,
      errorMessage: error instanceof Error ? error.message : "No se pudo guardar la compra."
    });
  }
}

async function onTogglePurchaseItem(itemId) {
  const next = toggleItemChecked(state.purchaseData, itemId);
  await persistPurchaseChange(next, "");
}

async function onSubmitStoreItem(formData) {
  const store = state.purchaseStoreModalStore;
  if (!store) {
    return;
  }

  const rawInput = typeof formData.get("text") === "string" ? formData.get("text") : "";
  const text = cleanText(rawInput);
  if (!text) {
    return;
  }

  const editingId = state.purchaseStoreEditingItemId;
  if (editingId) {
    const next = updateItemText(state.purchaseData, editingId, text);
    await persistPurchaseChange(next, "Producto actualizado");
  } else {
    const entries = splitStoreItemsInput(rawInput);
    if (entries.length === 0) {
      return;
    }

    let next = state.purchaseData;
    entries.forEach((entry) => {
      next = addItem(next, { storeName: store, text: entry });
    });

    const message = entries.length === 1 ? "Producto a\u00f1adido" : `${entries.length} productos a\u00f1adidos`;
    await persistPurchaseChange(next, message);
  }

  setState({
    purchaseStoreEditingItemId: "",
    purchaseStoreInputText: ""
  });
}

async function onDeleteStoreItem(itemId) {
  const confirmDelete = window.confirm("Eliminar este producto?");
  if (!confirmDelete) {
    return;
  }
  const next = deleteItem(state.purchaseData, itemId);
  await persistPurchaseChange(next, "Producto eliminado");
  if (state.purchaseStoreEditingItemId === itemId) {
    cancelStoreItemEdit();
  }
}

async function onFinishPurchase() {
  const stats = getStats(state.purchaseData);
  if (stats.itemsTotal === 0) {
    showToast("No hay productos para finalizar");
    return;
  }

  if (stats.pendingCount > 0) {
    const confirmPending = window.confirm(
      `Quedan ${stats.pendingCount} productos sin comprar. Finalizar compra igualmente?`
    );
    if (!confirmPending) {
      return;
    }
  } else {
    const confirmDone = window.confirm("Finalizar compra?");
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
      purchaseStoreModalStore: "",
      purchaseStoreInputText: "",
      purchaseStoreEditingItemId: "",
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
      "La compra activa no est\u00e1 vac\u00eda. \u00bfQuieres reemplazarla con la compra hist\u00f3rica?"
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
      purchaseStoreModalStore: "",
      purchaseStoreInputText: "",
      purchaseStoreEditingItemId: ""
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
    purchaseStoreModalStore: "",
    purchaseStoreInputText: "",
    purchaseStoreEditingItemId: "",
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

  document.querySelector(".purchase-editor-overlay")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      closePurchaseEditor();
    }
  });

  document.querySelectorAll("[data-open-store-editor]").forEach((button) => {
    button.addEventListener("click", () => {
      const store = button.getAttribute("data-open-store-editor");
      openStoreModal(store);
    });
  });

  document.querySelectorAll("[data-close-store-editor]").forEach((button) => {
    button.addEventListener("click", () => {
      closeStoreModal();
    });
  });

  document.querySelector(".store-editor-overlay")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      closeStoreModal();
    }
  });

  const storeForm = document.querySelector("#store-item-form");
  if (storeForm) {
    storeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(storeForm);
      void onSubmitStoreItem(formData);
    });
  }

  document.querySelectorAll("[data-store-item-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.getAttribute("data-store-item-edit");
      if (!itemId) {
        return;
      }
      startStoreItemEdit(itemId);
    });
  });

  document.querySelectorAll("[data-store-item-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.getAttribute("data-store-item-delete");
      if (!itemId) {
        return;
      }
      void onDeleteStoreItem(itemId);
    });
  });

  document.querySelector("[data-cancel-store-item-edit]")?.addEventListener("click", () => {
    cancelStoreItemEdit();
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
  document.body.classList.toggle("modal-open", state.editorOpen || state.purchaseEditOpen || Boolean(state.purchaseStoreModalStore));
  bindEvents();
  syncSegmentedUi();
  focusStoreInputIfNeeded();
  maybeAutoScrollToTodayCard();
}

function focusStoreInputIfNeeded() {
  if (!state.purchaseStoreModalStore) {
    return;
  }
  const input = document.querySelector("#store_item_text");
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  input.focus();
  const length = input.value.length;
  input.setSelectionRange(length, length);
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
    if (event.key !== "Escape") {
      return;
    }
    if (state.purchaseStoreModalStore) {
      closeStoreModal();
      return;
    }
    if (state.purchaseEditOpen && !state.purchaseSaving) {
      closePurchaseEditor();
      return;
    }
    if (state.editorOpen && !state.saving) {
      setState({ editorOpen: false, errorMessage: "" });
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
