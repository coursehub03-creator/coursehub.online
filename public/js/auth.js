// js/auth.js
import { auth, db, googleProvider } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";

/* ===== Helpers ===== */
function saveUser(user) {
  localStorage.setItem("coursehub_user", JSON.stringify(user));
}

function redirect(role) {
  window.location.href =
    role === "admin" ? "admin/dashboard.html" : "courses.html";
}

/* ===== Email Login ===== */
const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

if (form) {
  form.addEventListener("submit", async e => {
    e.preventDefault();

    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const ref = doc(db, "users", cred.user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) throw new Error("user-not-found");

      const data = snap.data();
      saveUser(data);
      redirect(data.role);

    } catch (err) {
      console.error(err);
      errorMsg.textContent = "بيانات الدخول غير صحيحة";
    }
  });
}

/* ===== Google Login ===== */
const googleBtn = document.getElementById("googleLoginBtn");

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      let role = "student";

      if (!snap.exists()) {
        await setDoc(ref, {
          name: user.displayName,
          email: user.email,
          picture: user.photoURL,
          role,
          createdAt: new Date()
        });
      } else {
        role = snap.data().role;
      }

      saveUser({
        name: user.displayName,
        email: user.email,
        picture: user.photoURL,
        role
      });

      redirect(role);

    } catch (err) {
      console.error(err);
      alert("فشل تسجيل الدخول عبر Google");
    }
  });
}
