import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
  projectId: "kakuro-f8702",
  storageBucket: "kakuro-f8702.firebasestorage.app",
  messagingSenderId: "64802608590",
  appId: process.env.NEXT_PUBLIC_APP_ID,
  measurementId: "G-5KCQ94V1SH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;