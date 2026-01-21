// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCagdZU_eAHebBGCmG5W4FFTcDZIH4wOp0",
  authDomain: "coursehub-23ed2.firebaseapp.com",
  projectId: "coursehub-23ed2",
  storageBucket: "coursehub-23ed2.firebasestorage.app",
  messagingSenderId: "367073521017",
  appId: "1:367073521017:web:67f5fd3be4c6407247d3a8"
};

// تهيئة Firebase مرة واحدة فقط
const app = initializeApp(firebaseConfig);

// خدمات Firebase
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// تصديرها للاستعمال
export { auth, db, googleProvider };
