import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

export function watchFamilyTransactions(familyId, callback) {
  const transactionsRef = collection(
    db,
    "families",
    familyId,
    "transactions"
  );

  return onSnapshot(transactionsRef, (snapshot) => {
    const transactions = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    callback(transactions);
  });
}

export async function saveFamilyTransactions(familyId, transactions) {
  const transactionsRef = collection(
    db,
    "families",
    familyId,
    "transactions"
  );

  const existingSnap = await getDocs(transactionsRef);
  const batch = writeBatch(db);

  const nextIds = new Set(transactions.map((transaction) => transaction.id));

  existingSnap.docs.forEach((docSnap) => {
    if (!nextIds.has(docSnap.id)) {
      batch.delete(docSnap.ref);
    }
  });

  transactions.forEach((transaction) => {
    const transactionRef = doc(transactionsRef, transaction.id);

    batch.set(
      transactionRef,
      {
        ...transaction,
        syncedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
}