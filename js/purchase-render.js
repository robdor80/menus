import { escapeHtml } from "./normalize.js";
import { getStats, STORE_ICONS } from "./purchase-utils.js";

function iconForStore(store) {
  return STORE_ICONS[store] || "🧾";
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
                <span class="purchase-item-check">${item.checked ? "✓" : ""}</span>
                <span class="purchase-item-text">${escapeHtml(item.text)}</span>
              </button>
            `
          )
          .join("");

  return `
    <article class="purchase-store-card">
      <header class="purchase-store-head">
        <h3>${iconForStore(store)} ${escapeHtml(store)}</h3>
        <span>${items.length}</span>
      </header>
      <div class="purchase-store-items">${itemsHtml}</div>
    </article>
  `;
}

function renderDraftStoreItems(store, items) {
  return `
    <section class="purchase-draft-store">
      <header>
        <h4>${iconForStore(store)} ${escapeHtml(store)}</h4>
        <span>${items.length}</span>
      </header>
      ${
        items.length === 0
          ? '<p class="purchase-empty-line">Sin productos</p>'
          : `
            <ul>
              ${items
                .map(
                  (item) => `
                    <li>
                      <button
                        type="button"
                        class="purchase-draft-item"
                        data-edit-item-id="${escapeHtml(item.id)}"
                        title="Manten pulsado para editar, mover o eliminar"
                      >
                        <span class="purchase-draft-dot ${item.checked ? "is-checked" : ""}"></span>
                        <span>${escapeHtml(item.text)}</span>
                      </button>
                    </li>
                  `
                )
                .join("")}
            </ul>
          `
      }
    </section>
  `;
}

function renderStoresDatalist(stores) {
  return `
    <datalist id="purchase-store-options">
      ${stores.map((store) => `<option value="${escapeHtml(store)}"></option>`).join("")}
    </datalist>
  `;
}

function renderPurchaseEditorModal(state) {
  if (!state.purchaseEditOpen || !state.purchaseDraft) {
    return "";
  }

  const stores = state.purchaseDraft.storesOrder;
  const draftList = stores
    .map((store) => renderDraftStoreItems(store, state.purchaseDraft.itemsByStore[store] || []))
    .join("");

  const actionItem = state.purchaseActionItemId
    ? Object.values(state.purchaseDraft.itemsByStore)
        .flat()
        .find((item) => item.id === state.purchaseActionItemId)
    : null;

  const actionModal =
    state.purchaseActionItemId && actionItem
      ? `
        <section class="purchase-action-overlay" role="dialog" aria-modal="true" aria-label="Acciones del producto">
          <div class="purchase-action-modal">
            <h4>Editar producto</h4>
            <p>${escapeHtml(actionItem.text)}</p>

            <label for="purchase_action_text">Texto</label>
            <input id="purchase_action_text" name="purchase_action_text" type="text" value="${escapeHtml(state.purchaseActionText || actionItem.text)}" />

            <label for="purchase_action_store">Mover a</label>
            <input
              id="purchase_action_store"
              name="purchase_action_store"
              type="text"
              list="purchase-store-options"
              value="${escapeHtml(state.purchaseActionStore || actionItem.store)}"
            />

            <div class="purchase-action-buttons">
              <button type="button" data-purchase-action="save-text">Guardar texto</button>
              <button type="button" data-purchase-action="move-item">Mover</button>
              <button type="button" class="danger" data-purchase-action="delete-item">Eliminar</button>
              <button type="button" data-purchase-action="close">Cancelar</button>
            </div>
          </div>
        </section>
      `
      : "";

  return `
    <section class="purchase-editor-overlay" role="dialog" aria-modal="true" aria-label="Editar compra">
      <div class="purchase-editor-shell">
        <header class="purchase-editor-header">
          <h2>Editar compra</h2>
          <button type="button" data-close-purchase-editor aria-label="Cerrar editor">×</button>
        </header>
        <div class="purchase-editor-content">
          <section class="purchase-editor-layout">
            <section class="purchase-editor-add">
              <h3>Añadir producto</h3>
              <form id="purchase-add-form">
                <label for="purchase_store_select">Supermercado</label>
                <input id="purchase_store_select" name="store" type="text" list="purchase-store-options" value="${escapeHtml(stores[0] || "Otros")}" />
                <label for="purchase_item_text">Producto</label>
                <input id="purchase_item_text" name="text" type="text" placeholder="Ej: Tomate triturado" />
                <button type="submit">Añadir</button>
              </form>
              ${renderStoresDatalist(stores)}
              <p class="purchase-hint">En esta pantalla: manten pulsado un item para editar, mover o eliminar.</p>
            </section>

            <section class="purchase-editor-list">
              ${draftList}
            </section>
          </section>
        </div>
        <footer class="purchase-editor-footer">
          <button type="button" data-close-purchase-editor>Cancelar</button>
          <button type="button" class="primary" data-save-purchase-editor ${state.purchaseSaving ? "disabled" : ""}>
            ${state.purchaseSaving ? "Guardando..." : "Guardar"}
          </button>
        </footer>
      </div>
      ${actionModal}
    </section>
  `;
}

export function renderPurchaseSection(state, purchaseData) {
  if (state.purchaseLoading && !state.purchaseLoaded) {
    return '<section class="loading">Cargando compra activa...</section>';
  }

  const stats = getStats(purchaseData);
  const storesToRender = purchaseData.storesOrder.filter((store) => {
    const items = purchaseData.itemsByStore[store] || [];
    return items.length > 0;
  });

  const cards =
    storesToRender.length === 0
      ? '<section class="purchase-empty-main"><p>No hay productos en la compra activa.</p></section>'
      : storesToRender
          .map((store) => renderPurchaseStoreCard(store, purchaseData.itemsByStore[store] || []))
          .join("");

  const allChecked = stats.itemsTotal > 0 && stats.pendingCount === 0;
  const suggestion = allChecked
    ? `
      <section class="purchase-finish-hint">
        <p>Todo esta marcado como comprado.</p>
        <button type="button" data-finish-purchase ${state.purchaseSaving ? "disabled" : ""}>Finalizar compra</button>
      </section>
    `
    : "";

  return `
    <section class="purchase-section">
      <header class="purchase-header">
        <h2>Compra semanal</h2>
        <p>${stats.itemsTotal} items · ${stats.checkedCount} comprados · ${stats.pendingCount} pendientes</p>
        <div class="purchase-toolbar">
          <button type="button" data-open-purchase-editor>Editar compra</button>
          <button type="button" class="primary" data-finish-purchase ${state.purchaseSaving ? "disabled" : ""}>Compra finalizada</button>
        </div>
      </header>
      ${suggestion}
      <section class="purchase-grid">${cards}</section>
    </section>
    ${renderPurchaseEditorModal(state)}
  `;
}
