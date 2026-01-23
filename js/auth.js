import { auth, googleProvider } from 'firebase-config.js';
import { signInWithPopup, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- زر تسجيل الدخول بالبريد ---
const loginForm = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
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
    await signInWithPopup(auth, googleProvider);
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
    window.location.href = "index.html";
  }
});
