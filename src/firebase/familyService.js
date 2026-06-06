import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";

/**
 * Create a new family
 */
export async function createFamily(user) {
  const familyId = crypto.randomUUID();

  await setDoc(doc(db, "families", familyId), {
    familyId,
    ownerId: user.uid,
    members: {
      [user.uid]: true,
    },
    setupBuckets: [],
    buckets: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, "users", user.uid),
    {
      email: user.email,
      familyId,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return familyId;
}

/**
 * Join an existing family
 */
export async function joinFamily(user, familyId) {
  const familyRef = doc(db, "families", familyId);

  const familySnap = await getDoc(familyRef);

  if (!familySnap.exists()) {
    throw new Error("Family not found");
  }

  await updateDoc(familyRef, {
    [`members.${user.uid}`]: true,
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, "users", user.uid),
    {
      email: user.email,
      familyId,
    },
    { merge: true }
  );
}

/**
 * Get current user's familyId
 */
export async function getUserFamilyId(uid) {
  const userSnap = await getDoc(doc(db, "users", uid));

  if (!userSnap.exists()) {
    return null;
  }

  return userSnap.data().familyId || null;
}