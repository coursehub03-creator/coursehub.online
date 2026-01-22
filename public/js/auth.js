// js/auth.js

// Email Login
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginForm = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const userCredential = await auth.signInWithEmailAndPassword(
        emailInput.value,
        passwordInput.value
      );
      const user = userCredential.user;

      localStorage.setItem(
        "coursehub_user",
        JSON.stringify({ name: user.displayName || "", email: user.email, uid: user.uid, role: "student" })
      );

      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      if (errorMsg) errorMsg.textContent = "خطأ: " + err.message;
      else alert(err.message);
    }
  });
}

// Google Login
const googleBtn = document.getElementById("googleLoginBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const result = await auth.signInWithPopup(googleProvider);
      const user = result.user;

      localStorage.setItem(
        "coursehub_user",
        JSON.stringify({
          name: user.displayName,
          email: user.email,
          picture: user.photoURL,
          role: "student"
        })
      );

      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert("فشل تسجيل الدخول عبر Google: " + err.message);
    }
  });
}

// Password Reset
const resetBtn = document.getElementById("resetBtn");
const resetEmail = document.getElementById("resetEmail");
if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    try {
      await auth.sendPasswordResetEmail(resetEmail.value);
      alert("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني");
    } catch (err) {
      console.error(err);
      alert("فشل الإرسال: " + err.message);
    }
  });
}
