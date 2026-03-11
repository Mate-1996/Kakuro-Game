import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCu1vUGcUEQVgrZdfC4kD_3FSUaoBqd8hs",
  authDomain: "kakuro-f8702.firebaseapp.com",
  projectId: "kakuro-f8702",
  storageBucket: "kakuro-f8702.firebasestorage.app",
  messagingSenderId: "64802608590",
  appId: "1:64802608590:web:1f85eafe4b74faaea0c79f",
  measurementId: "G-5KCQ94V1SH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;