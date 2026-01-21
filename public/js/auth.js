import { auth, db } from "../js/firebase-config.js";

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

/* ============ Helpers ============ */
function saveUser(user) {
  localStorage.setItem("coursehub_user", JSON.stringify(user));
}

function redirect(role) {
  if (role === "admin") location.href = "admin/dashboard.html";
  else location.href = "courses.html";
}

/* ============ Email Login ============ */
const form = document.getElementById("email-login-form");
const errorMsg = document.getElementById("errorMsg");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const email = email.value;
      const password = password.value;

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, "users", cred.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) throw "NO_USER";

      saveUser(snap.data());
      redirect(snap.data().role);

    } catch {
      errorMsg.textContent = "بيانات الدخول غير صحيحة";
    }
  });
}

/* ============ Google Login ============ */
window.handleGoogleLogin = async (res) => {
  const jwt = res.credential;
  const payload = JSON.parse(atob(jwt.split(".")[1]));

  const cred = GoogleAuthProvider.credential(jwt);
  const userCred = await signInWithCredential(auth, cred);

  const ref = doc(db, "users", userCred.user.uid);
  const snap = await getDoc(ref);

  let role = "student";

  if (!snap.exists()) {
    await setDoc(ref, {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      role: "student",
      createdAt: new Date()
    });
  } else {
    role = snap.data().role;
  }

  saveUser({ ...payload, role });
  redirect(role);
};
