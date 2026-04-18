import { initializeApp, getApps } from "firebase/app";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseConfig } from "./config.js";

let dbInstance = null;

function getDb() {
  if (dbInstance) {
    return dbInstance;
  }
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(getFirebaseConfig());
  dbInstance = getFirestore(app);
  return dbInstance;
}

export async function getWeekDocument(weekId) {
  const ref = doc(getDb(), "weeks", weekId);
  return getDoc(ref);
}

export async function upsertWeekDay({ weekId, startDate, endDate, dateIso, dayData, createIfMissing }) {
  const ref = doc(getDb(), "weeks", weekId);
  const payload = {
    weekId,
    startDate,
    endDate,
    updatedAt: serverTimestamp(),
    days: {
      [dateIso]: dayData
    }
  };

  if (createIfMissing) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });
}
