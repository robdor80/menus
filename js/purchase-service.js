import {
  buildPurchaseSignature,
  buildHistoryRecord,
  createEmptyPurchase,
  getStats,
  normalizePurchase,
  nowIso
} from "./purchase-utils.js";

const ACTIVE_COLLECTION = "shopping_active";
const ACTIVE_DOCUMENT = "current";
const HISTORY_COLLECTION = "shopping_history";

export function getPurchaseCollections() {
  return {
    ACTIVE_COLLECTION,
    ACTIVE_DOCUMENT,
    HISTORY_COLLECTION
  };
}

export async function loadActivePurchase(firestoreClient) {
  const empty = createEmptyPurchase();

  if (!firestoreClient.status.ready) {
    return empty;
  }

  const snap = await firestoreClient.getDocument(ACTIVE_COLLECTION, ACTIVE_DOCUMENT);
  if (!snap.exists || !snap.data) {
    return empty;
  }

  return normalizePurchase(snap.data);
}

export async function saveActivePurchase(firestoreClient, purchase) {
  const normalized = normalizePurchase({
    ...purchase,
    updatedAt: nowIso()
  });

  if (firestoreClient.status.ready) {
    await firestoreClient.setDocument({
      targetCollection: ACTIVE_COLLECTION,
      documentId: ACTIVE_DOCUMENT,
      data: normalized,
      merge: false
    });
  }

  return normalized;
}

export async function clearActivePurchase(firestoreClient) {
  const empty = createEmptyPurchase();

  if (firestoreClient.status.ready) {
    await firestoreClient.setDocument({
      targetCollection: ACTIVE_COLLECTION,
      documentId: ACTIVE_DOCUMENT,
      data: empty,
      merge: false
    });
  }

  return empty;
}

function normalizeHistoryEntry(rawEntry) {
  const purchase = normalizePurchase(rawEntry);
  const stats = rawEntry?.stats && typeof rawEntry.stats === "object"
    ? rawEntry.stats
    : {
        storesCount: purchase.storesOrder.filter((store) => (purchase.itemsByStore[store] || []).length > 0).length,
        itemsTotal: purchase.storesOrder.reduce((acc, store) => acc + (purchase.itemsByStore[store] || []).length, 0),
        checkedCount: purchase.storesOrder.reduce(
          (acc, store) => acc + (purchase.itemsByStore[store] || []).filter((item) => item.checked).length,
          0
        ),
        pendingCount: 0
      };

  return {
    id: rawEntry.id || "",
    createdAt: typeof rawEntry.createdAt === "string" ? rawEntry.createdAt : nowIso(),
    sourceUpdatedAt: typeof rawEntry.sourceUpdatedAt === "string" ? rawEntry.sourceUpdatedAt : purchase.updatedAt,
    storesOrder: purchase.storesOrder,
    itemsByStore: purchase.itemsByStore,
    stats: {
      ...stats,
      pendingCount: typeof stats.pendingCount === "number"
        ? stats.pendingCount
        : Math.max(0, (stats.itemsTotal || 0) - (stats.checkedCount || 0))
    }
  };
}

export async function loadHistory(firestoreClient, limitCount = 60) {
  if (!firestoreClient.status.ready) {
    return [];
  }

  const docs = await firestoreClient.listDocuments({
    targetCollection: HISTORY_COLLECTION,
    orderByField: "createdAt",
    direction: "desc",
    limitCount
  });

  return docs.map(normalizeHistoryEntry);
}

function splitPurchaseByChecked(purchase) {
  const normalized = normalizePurchase(purchase);
  const checked = createEmptyPurchase(normalized.storesOrder);
  const pending = createEmptyPurchase(normalized.storesOrder);

  normalized.storesOrder.forEach((store) => {
    const items = normalized.itemsByStore[store] || [];
    checked.itemsByStore[store] = items
      .filter((item) => item.checked)
      .map((item) => ({ ...item, checked: true }));
    pending.itemsByStore[store] = items
      .filter((item) => !item.checked)
      .map((item) => ({ ...item, checked: false }));
  });

  checked.updatedAt = nowIso();
  checked.restoredFromHistoryId = "";
  checked.restoredFromHistorySignature = "";

  pending.updatedAt = nowIso();
  pending.restoredFromHistoryId = "";
  pending.restoredFromHistorySignature = "";

  return {
    checked: normalizePurchase(checked),
    pending: normalizePurchase(pending)
  };
}

export async function finalizePurchase(firestoreClient, purchase) {
  const normalized = normalizePurchase(purchase);
  const currentSignature = buildPurchaseSignature(normalized);
  const isRestoredWithoutChanges =
    Boolean(normalized.restoredFromHistoryId) &&
    Boolean(normalized.restoredFromHistorySignature) &&
    normalized.restoredFromHistorySignature === currentSignature;

  const { checked, pending } = splitPurchaseByChecked(normalized);
  const checkedStats = getStats(checked);
  if (checkedStats.itemsTotal === 0) {
    const nextActivePurchase = await saveActivePurchase(firestoreClient, pending);
    return {
      historyEntry: null,
      nextActivePurchase,
      skippedDuplicate: false,
      skippedNoChecked: true
    };
  }

  const historyRecord = buildHistoryRecord(checked);
  let historyEntry = null;

  if (!isRestoredWithoutChanges) {
    let historyId = `local_${Date.now()}`;
    if (firestoreClient.status.ready) {
      historyId = await firestoreClient.addDocument(HISTORY_COLLECTION, historyRecord);
    }
    historyEntry = normalizeHistoryEntry({ ...historyRecord, id: historyId });
  }

  const nextActivePurchase = await saveActivePurchase(firestoreClient, pending);
  return {
    historyEntry,
    nextActivePurchase,
    skippedDuplicate: isRestoredWithoutChanges,
    skippedNoChecked: false
  };
}

export async function restoreHistoryToActive(firestoreClient, historyEntry) {
  const base = normalizePurchase({
    storesOrder: historyEntry?.storesOrder,
    itemsByStore: historyEntry?.itemsByStore,
    updatedAt: nowIso()
  });
  const signature = buildPurchaseSignature(base);
  const purchase = normalizePurchase({
    ...base,
    restoredFromHistoryId: historyEntry?.id || "",
    restoredFromHistorySignature: signature,
    updatedAt: nowIso()
  });

  const saved = await saveActivePurchase(firestoreClient, purchase);
  return saved;
}

export async function deleteHistoryEntry(firestoreClient, historyId) {
  if (!historyId) {
    return;
  }

  if (!firestoreClient.status.ready) {
    return;
  }

  await firestoreClient.deleteDocument(HISTORY_COLLECTION, historyId);
}
