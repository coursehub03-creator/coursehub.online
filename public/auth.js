// auth.js
import { auth, db, googleProvider } from "../js/firebase-config.js";

import {
  signInWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";

// =====================
// عناصر الصفحة
// =====================
const form = document.getElementById("email-login-form");
const errorMsg = document.getElementById("errorMsg");

// =====================
// Helper: حفظ المستخدم
// =====================
function saveUserSession(userData) {
  localStorage.setItem("coursehub_user", JSON.stringify(userData));
}

// =====================
// Helper: التوجيه حسب الدور
// =====================
function redirectByRole(role) {
  if (role === "admin") {
    window.location.href = "dashboard.html";
  } else {
    window.location.href = "courses.html";
  }
}

// =====================
// Email & Password Login
// =====================
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error("USER_NOT_FOUND");
      }

      const userData = userSnap.data();
      saveUserSession(userData);
      redirectByRole(userData.role);

    } catch (err) {
      console.error(err);
      errorMsg.textContent = "بيانات الدخول غير صحيحة";
    }
  });
}

// =====================
// Google Login (GSI)
// =====================
window.handleGoogleLogin = async function (response) {
  try {
    const jwt = response.credential;
    const payload = JSON.parse(atob(jwt.split(".")[1]));

    // تسجيل الدخول في Firebase
    const credential = GoogleAuthProvider.credential(jwt);
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let role = "student";

    if (!userSnap.exists()) {
      // إنشاء مستخدم جديد
      await setDoc(userRef, {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        role: "student",
        createdAt: new Date()
      });
    } else {
      role = userSnap.data().role;
    }

    saveUserSession({
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      role
    });

    redirectByRole(role);

  } catch (err) {
    console.error("Google Login Error:", err);
    alert("فشل تسجيل الدخول عبر Google");
  }
};
