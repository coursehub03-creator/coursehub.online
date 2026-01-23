import { auth, googleProvider } from './firebase-config.js';
import { signInWithPopup, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- زر تسجيل الدخول بالبريد ---
const loginForm = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // حفظ بيانات المستخدم في localStorage
    localStorage.setItem("coursehub_user", JSON.stringify({
      name: user.displayName || user.email.split("@")[0],
      email: user.email,
      picture: user.photoURL || "assets/images/default-user.png",
      uid: user.uid,
      role: "user" // يمكن تعديل الدور حسب احتياجك
    }));

    window.location.href = "index.html"; // بعد تسجيل الدخول
  } catch (error) {
    console.error("Login Error:", error);
    errorMsg.textContent = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  }
});

// --- زر تسجيل الدخول بـ Google ---
const googleBtn = document.getElementById("googleLoginBtn");
googleBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // حفظ بيانات المستخدم في localStorage
    localStorage.setItem("coursehub_user", JSON.stringify({
      name: user.displayName || user.email.split("@")[0],
      email: user.email,
      picture: user.photoURL || "assets/images/default-user.png",
      uid: user.uid,
      role: "user"
    }));

    window.location.href = "index.html"; // بعد تسجيل الدخول
  } catch (error) {
    console.error("Google Login Error:", error);
    errorMsg.textContent = "فشل تسجيل الدخول بحساب Google.";
  }
});

// --- مراقبة حالة تسجيل الدخول ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    // إذا المستخدم مسجل الدخول مسبقًا يتم إعادة توجيه مباشرة
    // لكن يمكن حفظ بياناته في localStorage أيضًا
    const storedUser = JSON.parse(localStorage.getItem("coursehub_user"));
    if (!storedUser) {
      localStorage.setItem("coursehub_user", JSON.stringify({
        name: user.displayName || user.email.split("@")[0],
        email: user.email,
        picture: user.photoURL || "assets/images/default-user.png",
        uid: user.uid,
        role: "user"
      }));
    }
  }
});
