import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function loadFamilySetup(familyId) {
  const snap = await getDoc(doc(db, "families", familyId));

  if (!snap.exists()) {
    return {
      setupBuckets: [],
      buckets: [],
    };
  }

  const data = snap.data();

  return {
    setupBuckets: data.setupBuckets || [],
    buckets: data.buckets || [],
  };
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