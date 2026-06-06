import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBKUZ8aHKxK4dFXkNDs8VpnHAsqn212zq8",
  authDomain: "family-budget-app-6790f.firebaseapp.com",
  projectId: "family-budget-app-6790f",
  storageBucket: "family-budget-app-6790f.firebasestorage.app",
  messagingSenderId: "637177282462",
  appId: "1:637177282462:web:aea60a52038c2d6582a08f",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;