import { escapeHtml } from "./normalize.js";
import { getStats, getStoreIconMeta } from "./purchase-utils.js";

function renderStoreIcon(store, className = "store-icon") {
  const icon = getStoreIconMeta(store);
  const hasImage = Boolean(icon.url);
  const imageHtml = hasImage
    ? `<img class="${className}__img" src="${escapeHtml(icon.url)}" alt="${escapeHtml(store)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.hidden=false;" />`
    : "";
  return `
    <span class="${className}">
      ${imageHtml}
      <span class="${className}__fallback" aria-hidden="true" ${hasImage ? "hidden" : ""}>${escapeHtml(icon.emoji)}</span>
    </span>
  `;
}

function renderPurchaseStoreCard(store, items) {
  const itemsHtml =
    items.length === 0
      ? '<p class="purchase-empty-line">Sin productos</p>'
      : items
          .map(
            (item) => `
              <button
                type="button"
                class="purchase-item ${item.checked ? "is-checked" : ""}"
                data-toggle-purchase-item="${escapeHtml(item.id)}"
                aria-pressed="${item.checked ? "true" : "false"}"
              >
                <span class="purchase-item-check">${item.checked ? "&#10003;" : ""}</span>
                <span class="purchase-item-text">${escapeHtml(item.text)}</span>
              </button>
            `
          )
          .join("");

  return `
    <article class="purchase-store-card">
      <header class="purchase-store-head">
        <h3>${renderStoreIcon(store, "store-icon-mini")} ${escapeHtml(store)}</h3>
        <span>${items.length}</span>
      </header>
      <div class="purchase-store-items">${itemsHtml}</div>
    </article>
  `;
}

function renderPurchaseEditor(state, purchaseData) {
  if (!state.purchaseEditOpen) {
    return "";
  }

  const gridItems = purchaseData.storesOrder
    .map((store) => {
      const count = (purchaseData.itemsByStore[store] || []).length;
      return `
        <button
          type="button"
          class="store-pick-card"
          data-open-store-editor="${escapeHtml(store)}"
        >
          <span class="store-pick-icon-wrap">${renderStoreIcon(store, "store-icon-big")}</span>
          <span class="store-pick-name">${escapeHtml(store)}</span>
          <span class="store-pick-count">${count} productos</span>
        </button>
      `;
    })
    .join("");

  return `
    <section class="purchase-editor-overlay" role="dialog" aria-modal="true" aria-label="Editar compra">
      <div class="purchase-editor-shell">
        <header class="purchase-editor-header">
          <h2>Editar compra</h2>
          <button type="button" data-close-purchase-editor aria-label="Cerrar editor">&times;</button>
        </header>
        <div class="purchase-editor-content">
          <p class="purchase-editor-subtitle">Selecciona supermercado para a\u00f1adir o editar productos.</p>
          <section class="store-pick-grid">
            ${gridItems}
          </section>
        </div>
      </div>
      ${renderStoreModal(state, purchaseData)}
    </section>
  `;
}

function renderStoreModal(state, purchaseData) {
  const store = state.purchaseStoreModalStore;
  if (!store) {
    return "";
  }

  const items = purchaseData.itemsByStore[store] || [];
  const isEditing = Boolean(state.purchaseStoreEditingItemId);
  const submitLabel = isEditing ? "Guardar cambio" : "A\u00f1adir";

  return `
    <section class="store-editor-overlay" role="dialog" aria-modal="true" aria-label="Editar ${escapeHtml(store)}">
      <div class="store-editor-shell">
        <header class="store-editor-header">
          <h3>${renderStoreIcon(store, "store-icon-mini")} ${escapeHtml(store)}</h3>
          <button type="button" data-close-store-editor aria-label="Cerrar supermercado">&times;</button>
        </header>

        <div class="store-editor-body">
          <form id="store-item-form" class="store-item-form">
            <label for="store_item_text">Producto</label>
            <div class="store-item-input-row">
              <input
                id="store_item_text"
                name="text"
                type="text"
                value="${escapeHtml(state.purchaseStoreInputText || "")}" 
                placeholder="Ej: leche, pan, tomate"
              />
              <button type="submit" ${state.purchaseSaving ? "disabled" : ""}>${submitLabel}</button>
            </div>
          </form>
          ${
            isEditing
              ? ""
              : '<p class="purchase-empty-line">Tip: puedes escribir varios productos separados por comas.</p>'
          }

          ${
            isEditing
              ? `
                <div class="store-editing-banner">
                  <span>Editando producto</span>
                  <button type="button" data-cancel-store-item-edit>Cancelar edici\u00f3n</button>
                </div>
              `
              : ""
          }

          <section class="store-items-list">
            ${
              items.length === 0
                ? '<p class="purchase-empty-line">Sin productos en este supermercado</p>'
                : `
                    <ul>
                      ${items
                        .map(
                          (item) => `
                            <li>
                              <span class="store-item-text ${item.checked ? "is-checked" : ""}">${escapeHtml(item.text)}</span>
                              <div class="store-item-actions">
                                <button type="button" data-store-item-edit="${escapeHtml(item.id)}">Editar</button>
                                <button type="button" class="danger" data-store-item-delete="${escapeHtml(item.id)}">Borrar</button>
                              </div>
                            </li>
                          `
                        )
                        .join("")}
                    </ul>
                  `
            }
          </section>
        </div>

        <footer class="store-editor-footer">
          <button type="button" class="primary" data-close-store-editor>Finalizar</button>
        </footer>
      </div>
    </section>
  `;
}

export function renderPurchaseSection(state, purchaseData) {
  if (state.purchaseLoading && !state.purchaseLoaded) {
    return '<section class="loading">Cargando compra activa...</section>';
  }

  const stats = getStats(purchaseData);
  const storesToRender = purchaseData.storesOrder.filter((store) => (purchaseData.itemsByStore[store] || []).length > 0);

  const cards =
    storesToRender.length === 0
      ? '<section class="purchase-empty-main"><p>No hay productos en la compra activa.</p></section>'
      : storesToRender.map((store) => renderPurchaseStoreCard(store, purchaseData.itemsByStore[store] || [])).join("");

  const allChecked = stats.itemsTotal > 0 && stats.pendingCount === 0;
  const suggestion = allChecked
    ? `
      <section class="purchase-finish-hint">
        <p>Todo est\u00e1 marcado como comprado.</p>
        <button type="button" data-finish-purchase ${state.purchaseSaving ? "disabled" : ""}>Finalizar compra</button>
      </section>
    `
    : "";

  return `
    <section class="purchase-section">
      <header class="purchase-header">
        <h2>Compra semanal</h2>
        <p>${stats.itemsTotal} productos &middot; ${stats.checkedCount} comprados &middot; ${stats.pendingCount} pendientes</p>
        <div class="purchase-toolbar">
          <button type="button" data-open-purchase-editor>Editar compra</button>
          <button type="button" class="primary" data-finish-purchase ${state.purchaseSaving ? "disabled" : ""}>Compra finalizada</button>
        </div>
      </header>
      ${suggestion}
      <section class="purchase-grid">${cards}</section>
    </section>
    ${renderPurchaseEditor(state, purchaseData)}
  `;
}

