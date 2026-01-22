// js/auth.js
import { auth, db, googleProvider } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signInWithCredential
} from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";

/* ===== Helpers ===== */
function saveUserLocally(user) {
  // تخزين نسخة صغيرة محليًا لتحديث الهيدر والفوتر بسرعة
  localStorage.setItem("coursehub_user", JSON.stringify(user));
}

function redirectUser(role) {
  if (role === "admin") window.location.href = "admin/dashboard.html";
  else window.location.href = "courses.html";
}

/* ===== Email Login ===== */
const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      // تسجيل الدخول عبر Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // جلب بيانات المستخدم من Firestore
      const userRef = doc(db, "users", cred.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) throw new Error("المستخدم غير موجود");

      const userData = snap.data();

      // حفظ نسخة صغيرة محليًا لتحديث الهيدر بسرعة
      saveUserLocally({
        name: userData.name,
        email: userData.email,
        picture: userData.picture || "default-avatar.png",
        role: userData.role
      });

      redirectUser(userData.role);

    } catch (err) {
      console.error("خطأ في تسجيل الدخول:", err);
      errorMsg.textContent = "بيانات الدخول غير صحيحة";
    }
  });
}

/* ===== Google Login ===== */
window.handleGoogleLogin = async (res) => {
  try {
    const jwt = res.credential;
    const payload = JSON.parse(atob(jwt.split(".")[1]));

    // تسجيل الدخول عبر Firebase Credential
    const cred = googleProvider.credential(jwt);
    const userCred = await signInWithCredential(auth, cred);

    // مرجع المستخدم في Firestore
    const userRef = doc(db, "users", userCred.user.uid);
    const snap = await getDoc(userRef);

    let role = "student"; // القيمة الافتراضية

    if (!snap.exists()) {
      // إنشاء مستخدم جديد في Firestore
      await setDoc(userRef, {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        role,
        createdAt: new Date()
      });
    } else {
      role = snap.data().role;
    }

    // حفظ نسخة صغيرة محليًا لتحديث الهيدر بسرعة
    saveUserLocally({
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      role
    });

    redirectUser(role);

  } catch (err) {
    console.error("خطأ في تسجيل الدخول عبر Google:", err);
    alert("حدث خطأ أثناء تسجيل الدخول عبر Google");
  }
};
