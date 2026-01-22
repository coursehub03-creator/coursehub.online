import {
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword
} from "./firebase.js";

// العناصر
const email = document.getElementById("email");
const password = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");

// =====================
// تسجيل الدخول بالبريد
// =====================
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );

    const user = userCredential.user;

    localStorage.setItem("coursehub_user", JSON.stringify({
      uid: user.uid,
      email: user.email,
      role: "student"
    }));

    window.location.href = "index.html";

  } catch (err) {
    errorMsg.textContent = err.message;
    console.error(err);
  }
});

// =====================
// تسجيل الدخول بـ Google
// =====================
document.getElementById("googleLogin").addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    const user = result.user;

    localStorage.setItem("coursehub_user", JSON.stringify({
      uid: user.uid,
      email: user.email,
      role: "student"
    }));

    window.location.href = "index.html";

  } catch (err) {
    errorMsg.textContent = err.message;
    console.error(err);
  }
});
