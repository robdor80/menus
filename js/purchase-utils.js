export const DEFAULT_STORES = [
  "Mercadona",
  "Lidl",
  "Froiz",
  "Gadis",
  "Alcampo",
  "Carrefour",
  "Erosky",
  "Otros"
];

export const STORE_ICONS = {
  Mercadona: "\uD83D\uDED2",
  Lidl: "\uD83D\uDED2",
  Froiz: "\uD83C\uDFEA",
  Gadis: "\uD83C\uDFEA",
  Alcampo: "\uD83C\uDFEC",
  Carrefour: "\uD83D\uDED2",
  Erosky: "\uD83D\uDED2",
  Otros: "\uD83D\uDCCC"
};

export const STORE_ICON_URLS = {
  Mercadona:
    "https://www.plazamayor.es/wp-content/uploads/sites/35/2019/05/6382c008-c63c-4305-b05e-ab45d1a7d6be.mercadona.png",
  Lidl:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Lidl-Logo.svg/250px-Lidl-Logo.svg.png",
  Carrefour:
    "https://upload.wikimedia.org/wikipedia/en/6/65/Carrefour_Groupe.svg",
  Gadis:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Favicon_gadis.svg/250px-Favicon_gadis.svg.png",
  Froiz:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Distribuciones_Froiz_supermercados_vectorial.svg",
  Erosky:
    "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/Eroski.svg/1280px-Eroski.svg.png",
  Alcampo:
    "https://www.lenciclopedia.org/w/thumb.php?f=Lalcampo.jpg&width=240"
};

export function getStoreIconMeta(store) {
  return {
    emoji: STORE_ICONS[store] || "\uD83E\uDDFE",
    url: STORE_ICON_URLS[store] || ""
  };
}

function safeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function safeStoreName(value) {
  const clean = safeText(value);
  return clean || "Otros";
}

export function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `item_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function createEmptyPurchase(stores = DEFAULT_STORES) {
  const uniqueStores = Array.from(new Set(stores.map(safeStoreName)));
  const itemsByStore = uniqueStores.reduce((acc, store) => {
    acc[store] = [];
    return acc;
  }, {});

  return {
    updatedAt: nowIso(),
    storesOrder: uniqueStores,
    itemsByStore
  };
}

function normalizeItem(rawItem, fallbackStore) {
  const store = safeStoreName(rawItem?.store ?? fallbackStore);
  return {
    id: safeText(rawItem?.id) || createId(),
    text: safeText(rawItem?.text),
    store,
    checked: Boolean(rawItem?.checked),
    updatedAt: safeText(rawItem?.updatedAt) || nowIso()
  };
}

export function normalizePurchase(rawData) {
  const baseStores = Array.isArray(rawData?.storesOrder) ? rawData.storesOrder.map(safeStoreName) : [];
  const mapStores = rawData?.itemsByStore && typeof rawData.itemsByStore === "object"
    ? Object.keys(rawData.itemsByStore).map(safeStoreName)
    : [];

  const storesOrder = Array.from(new Set([...DEFAULT_STORES, ...baseStores, ...mapStores]));
  const itemsByStore = storesOrder.reduce((acc, store) => {
    acc[store] = [];
    return acc;
  }, {});

  if (rawData?.itemsByStore && typeof rawData.itemsByStore === "object") {
    Object.entries(rawData.itemsByStore).forEach(([storeName, rawItems]) => {
      const normalizedStore = safeStoreName(storeName);
      if (!Array.isArray(rawItems)) {
        return;
      }

      rawItems.forEach((rawItem) => {
        const item = normalizeItem(rawItem, normalizedStore);
        if (!item.text) {
          return;
        }
        if (!itemsByStore[item.store]) {
          itemsByStore[item.store] = [];
          storesOrder.push(item.store);
        }
        itemsByStore[item.store].push(item);
      });
    });
  }

  return {
    updatedAt: safeText(rawData?.updatedAt) || nowIso(),
    storesOrder,
    itemsByStore
  };
}

export function clonePurchase(purchase) {
  const copy = typeof structuredClone === "function"
    ? structuredClone(purchase)
    : JSON.parse(JSON.stringify(purchase));
  return normalizePurchase(copy);
}

export function getAllItems(purchase) {
  return purchase.storesOrder.flatMap((store) => purchase.itemsByStore[store] || []);
}

export function getStats(purchase) {
  const items = getAllItems(purchase);
  const checkedCount = items.filter((item) => item.checked).length;
  const pendingCount = items.length - checkedCount;
  const storesCount = purchase.storesOrder.filter((store) => (purchase.itemsByStore[store] || []).length > 0).length;

  return {
    storesCount,
    itemsTotal: items.length,
    checkedCount,
    pendingCount
  };
}

export function isPurchaseEmpty(purchase) {
  return getStats(purchase).itemsTotal === 0;
}

export function ensureStore(purchase, storeName) {
  const store = safeStoreName(storeName);
  const next = clonePurchase(purchase);
  if (!next.storesOrder.includes(store)) {
    next.storesOrder.push(store);
  }
  if (!next.itemsByStore[store]) {
    next.itemsByStore[store] = [];
  }
  return next;
}

export function addItem(purchase, { storeName, text }) {
  const trimmedText = safeText(text);
  if (!trimmedText) {
    return purchase;
  }

  let next = ensureStore(purchase, storeName);
  const store = safeStoreName(storeName);
  next.itemsByStore[store].push({
    id: createId(),
    text: trimmedText,
    store,
    checked: false,
    updatedAt: nowIso()
  });
  next.updatedAt = nowIso();
  return next;
}

function findItemPosition(purchase, itemId) {
  for (const store of purchase.storesOrder) {
    const index = (purchase.itemsByStore[store] || []).findIndex((item) => item.id === itemId);
    if (index >= 0) {
      return { store, index };
    }
  }
  return null;
}

export function updateItemText(purchase, itemId, nextText) {
  const text = safeText(nextText);
  if (!text) {
    return purchase;
  }

  const next = clonePurchase(purchase);
  const pos = findItemPosition(next, itemId);
  if (!pos) {
    return purchase;
  }
  next.itemsByStore[pos.store][pos.index].text = text;
  next.itemsByStore[pos.store][pos.index].updatedAt = nowIso();
  next.updatedAt = nowIso();
  return next;
}

export function deleteItem(purchase, itemId) {
  const next = clonePurchase(purchase);
  const pos = findItemPosition(next, itemId);
  if (!pos) {
    return purchase;
  }
  next.itemsByStore[pos.store].splice(pos.index, 1);
  next.updatedAt = nowIso();
  return next;
}

export function moveItem(purchase, itemId, targetStoreName) {
  const targetStore = safeStoreName(targetStoreName);
  let next = ensureStore(purchase, targetStore);
  const pos = findItemPosition(next, itemId);
  if (!pos) {
    return purchase;
  }

  const [item] = next.itemsByStore[pos.store].splice(pos.index, 1);
  if (!item) {
    return purchase;
  }
  item.store = targetStore;
  item.updatedAt = nowIso();
  next.itemsByStore[targetStore].push(item);
  next.updatedAt = nowIso();
  return next;
}

export function toggleItemChecked(purchase, itemId) {
  const next = clonePurchase(purchase);
  const pos = findItemPosition(next, itemId);
  if (!pos) {
    return purchase;
  }

  const item = next.itemsByStore[pos.store][pos.index];
  item.checked = !item.checked;
  item.updatedAt = nowIso();
  next.updatedAt = nowIso();
  return next;
}

export function getItemById(purchase, itemId) {
  for (const store of purchase.storesOrder) {
    const item = (purchase.itemsByStore[store] || []).find((value) => value.id === itemId);
    if (item) {
      return item;
    }
  }
  return null;
}

export function buildHistoryRecord(purchase) {
  const normalized = normalizePurchase(purchase);
  return {
    createdAt: nowIso(),
    sourceUpdatedAt: normalized.updatedAt,
    storesOrder: normalized.storesOrder,
    itemsByStore: normalized.itemsByStore,
    stats: getStats(normalized)
  };
}

