import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";

export async function loadFamilySetup(familyId) {
  const snap = await getDoc(doc(db, "families", familyId));

  if (!snap.exists()) {
    return {
      setupBuckets: [],
      buckets: [],
    };
  }

  return snap.data();
}

export function watchFamilySetup(familyId, callback) {
  return onSnapshot(
    doc(db, "families", familyId),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data());
      }
    }
  );
}

export async function saveFamilySetup(
  familyId,
  setupBuckets
) {
  await updateDoc(doc(db, "families", familyId), {
    setupBuckets,
    buckets: setupBuckets,
    updatedAt: serverTimestamp(),
  });
}