function validateFirebaseConfig(config) {
  const requiredKeys = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId"
  ];

  return requiredKeys.filter((key) => !config?.[key] || !String(config[key]).trim());
}

let sdkPromise = null;

async function loadFirebaseSdk() {
  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
  ]);

  return sdkPromise;
}

export function createFirestoreClient(firebaseSetup) {
  const status = {
    enabled: Boolean(firebaseSetup?.enabled),
    ready: false,
    message: ""
  };

  const collectionName = firebaseSetup?.collectionName || "weeks";
  const firebaseConfig = firebaseSetup?.config || {};
  const missing = validateFirebaseConfig(firebaseConfig);

  let db = null;
  let firestore = null;

  if (!status.enabled) {
    status.message = "Firebase desactivado. La app funciona en modo local (sin guardado remoto).";
  } else if (missing.length > 0) {
    status.message = `Configuracion Firebase incompleta: ${missing.join(", ")}.`;
  }

  async function initialize() {
    if (!status.enabled || missing.length > 0 || db) {
      return status;
    }

    try {
      const [{ getApps, initializeApp }, firestoreSdk] = await loadFirebaseSdk();
      const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      db = firestoreSdk.getFirestore(app);
      firestore = firestoreSdk;
      status.ready = true;
      status.message = "";
      return status;
    } catch (error) {
      status.ready = false;
      status.message = error instanceof Error ? error.message : "No se pudo cargar Firebase.";
      return status;
    }
  }

  async function getWeekDoc(weekId) {
    if (!status.ready || !db || !firestore) {
      return { exists: false, data: null };
    }
    const ref = firestore.doc(db, collectionName, weekId);
    const snap = await firestore.getDoc(ref);
    return {
      exists: snap.exists(),
      data: snap.exists() ? snap.data() : null
    };
  }

  async function upsertWeekDay({ weekId, startDate, endDate, dateIso, dayData, createIfMissing }) {
    if (!status.ready || !db || !firestore) {
      throw new Error("Firebase no esta listo para guardar.");
    }

    const ref = firestore.doc(db, collectionName, weekId);
    const payload = {
      weekId,
      startDate,
      endDate,
      updatedAt: firestore.serverTimestamp(),
      days: {
        [dateIso]: dayData
      }
    };

    if (createIfMissing) {
      payload.createdAt = firestore.serverTimestamp();
    }

    await firestore.setDoc(ref, payload, { merge: true });
  }

  return {
    status,
    initialize,
    getWeekDoc,
    upsertWeekDay
  };
}

