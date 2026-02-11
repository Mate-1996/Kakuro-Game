// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCu1vUGcUEQVgrZdfC4kD_3FSUaoBqd8hs",
  authDomain: "kakuro-f8702.firebaseapp.com",
  projectId: "kakuro-f8702",
  storageBucket: "kakuro-f8702.firebasestorage.app",
  messagingSenderId: "64802608590",
  appId: "1:64802608590:web:1f85eafe4b74faaea0c79f",
  measurementId: "G-5KCQ94V1SH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;