import { escapeHtml } from "./normalize.js";
import { STORE_ICONS } from "./purchase-utils.js";

function formatHistoryDate(value) {
  if (!value) {
    return "Sin fecha";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderStoreDetails(entry) {
  return entry.storesOrder
    .filter((store) => (entry.itemsByStore[store] || []).length > 0)
    .map((store) => {
      const items = entry.itemsByStore[store] || [];
      return `
        <section class="history-store">
          <h4>${STORE_ICONS[store] || "🧾"} ${escapeHtml(store)}</h4>
          <ul>
            ${items
              .map(
                (item) => `
                  <li class="${item.checked ? "is-checked" : ""}">
                    <span class="dot">${item.checked ? "✓" : "•"}</span>
                    <span>${escapeHtml(item.text)}</span>
                  </li>
                `
              )
              .join("")}
          </ul>
        </section>
      `;
    })
    .join("");
}

export function renderHistorySection(state, historyEntries) {
  if (state.historyLoading) {
    return '<section class="loading">Cargando historial...</section>';
  }

  if (!historyEntries || historyEntries.length === 0) {
    return `
      <section class="history-section">
        <header class="history-header">
          <h2>Historial</h2>
        </header>
        <p class="history-empty">Todavia no hay compras finalizadas.</p>
      </section>
    `;
  }

  return `
    <section class="history-section">
      <header class="history-header">
        <h2>Historial</h2>
        <p>${historyEntries.length} compras guardadas</p>
      </header>

      <section class="history-list">
        ${historyEntries
          .map((entry) => {
            const expanded = state.historyExpandedIds.includes(entry.id);
            return `
              <article class="history-card">
                <header class="history-card-head">
                  <div>
                    <h3>${formatHistoryDate(entry.createdAt)}</h3>
                    <p>${entry.stats.storesCount} supermercados · ${entry.stats.itemsTotal} items</p>
                    <p>${entry.stats.checkedCount} comprados · ${entry.stats.pendingCount} pendientes</p>
                  </div>
                  <div class="history-actions">
                    <button type="button" data-toggle-history="${escapeHtml(entry.id)}">${expanded ? "Ocultar" : "Ver detalle"}</button>
                    <button type="button" class="primary" data-restore-history="${escapeHtml(entry.id)}">Restaurar compra</button>
                  </div>
                </header>
                ${expanded ? `<section class="history-details">${renderStoreDetails(entry)}</section>` : ""}
              </article>
            `;
          })
          .join("")}
      </section>
    </section>
  `;
}
