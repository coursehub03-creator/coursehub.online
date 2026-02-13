import { auth, googleProvider } from './firebase-config.js';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getActionCodeSettings } from "./email-action-settings.js";

const lang = () => localStorage.getItem("coursehub_lang") || "ar";

const messages = {
  ar: {
    invalidLogin: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    googleFailed: "فشل تسجيل الدخول بحساب Google.",
    verifyFirst: "حسابك غير مفعّل. أرسلنا رابط تفعيل جديد. افحص البريد وSpam/Promotions.",
    verifySentAfterRegister: "تم إنشاء الحساب وإرسال رابط التفعيل. افحص البريد وSpam/Promotions.",
    registerFailed: "تعذر إنشاء الحساب. تحقق من البيانات وحاول مجددًا.",
    resetSent: "تم إرسال رابط إعادة تعيين كلمة المرور. افحص البريد وSpam/Promotions.",
    resetFailed: "تعذر إرسال رابط إعادة التعيين. تحقق من البريد وحاول مرة أخرى.",
    tooManyRequests: "تم تنفيذ محاولات كثيرة. يرجى الانتظار قليلًا ثم المحاولة مجددًا."
  },
  en: {
    invalidLogin: "The email or password is incorrect.",
    googleFailed: "Google sign-in failed.",
    verifyFirst: "Your account is not verified. A new verification email has been sent. Check Inbox/Spam/Promotions.",
    verifySentAfterRegister: "Account created. Verification email sent. Check Inbox/Spam/Promotions.",
    registerFailed: "Failed to create account. Please check your data and try again.",
    resetSent: "Password reset email sent. Check Inbox/Spam/Promotions.",
    resetFailed: "Could not send reset email. Please verify the email and try again.",
    tooManyRequests: "Too many attempts. Please wait a bit and try again."
  }
};

const t = (key) => messages[lang()]?.[key] || messages.ar[key];

function setError(text) {
  const errorMsg = document.getElementById("errorMsg");
  if (errorMsg) errorMsg.textContent = text;
}

function saveUser(user) {
  localStorage.setItem("coursehub_user", JSON.stringify({
    name: user.displayName || user.email?.split("@")[0] || "User",
    email: user.email,
    picture: user.photoURL,
    uid: user.uid,
    role: "user"
  }));
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("emailInput")?.value?.trim();
    const password = document.getElementById("passwordInput")?.value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        try {
          await sendEmailVerification(user, getActionCodeSettings());
        } catch (verificationError) {
          console.error("Verification resend error:", verificationError);
        }
        await signOut(auth);
        setError(t("verifyFirst"));
        return;
      }

      saveUser(user);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Login Error:", error);
      if (error?.code === "auth/too-many-requests") {
        setError(t("tooManyRequests"));
      } else {
        setError(t("invalidLogin"));
      }
    }
  });
}

const googleBtn = document.getElementById("googleLoginBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      saveUser(result.user);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Google Login Error:", error);
      setError(t("googleFailed"));
    }
  });
}

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("regEmail")?.value?.trim();
    const password = document.getElementById("regPassword")?.value;

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(user, getActionCodeSettings());
      alert(t("verifySentAfterRegister"));
      window.location.href = `/verify-email.html?email=${encodeURIComponent(email)}`;
    } catch (error) {
      console.error("Register Error:", error);
      if (error?.code === "auth/too-many-requests") {
        alert(t("tooManyRequests"));
      } else {
        alert(t("registerFailed"));
      }
    }
  });
}

const forgotForm = document.getElementById("forgotForm");
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("forgotEmail")?.value?.trim();
    try {
      await sendPasswordResetEmail(auth, email, getActionCodeSettings());
      alert(t("resetSent"));
    } catch (error) {
      console.error("Reset Error:", error);
      if (error?.code === "auth/too-many-requests") {
        alert(t("tooManyRequests"));
      } else {
        alert(t("resetFailed"));
      }
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    const storedUser = JSON.parse(localStorage.getItem("coursehub_user"));
    if (!storedUser && user.emailVerified) {
      saveUser(user);
    }
  }
});
