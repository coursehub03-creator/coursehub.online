import { auth, googleProvider } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const getLang = () => localStorage.getItem("coursehub_lang") || "ar";

const messages = {
  invalidCredentials: {
    ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    en: "The email or password is incorrect."
  },
  googleError: {
    ar: "فشل تسجيل الدخول باستخدام Google.",
    en: "Google sign-in failed."
  },
  weakPassword: {
    ar: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
    en: "Password should be at least 8 characters."
  },
  registerSuccess: {
    ar: "تم إنشاء الحساب بنجاح. سيتم تحويلك للصفحة الرئيسية...",
    en: "Account created successfully. Redirecting to home page..."
  },
  registerError: {
    ar: "تعذر إنشاء الحساب. تأكد من البيانات وحاول مرة أخرى.",
    en: "Unable to create account. Please check your info and try again."
  },
  emailInUse: {
    ar: "هذا البريد مستخدم بالفعل. سجّل دخولك بدلًا من ذلك.",
    en: "This email is already in use. Log in instead."
  }
};

function textFor(key) {
  const lang = getLang();
  return messages[key]?.[lang] || messages[key]?.ar || "";
}

function storeUser(user) {
  if (!user) return;
  localStorage.setItem("coursehub_user", JSON.stringify({
    name: user.displayName || user.email?.split("@")[0] || "User",
    email: user.email,
    picture: user.photoURL,
    uid: user.uid,
    role: "user"
  }));
}

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const errorMsg = document.getElementById("errorMsg");
const registerMsg = document.getElementById("registerMsg");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("emailInput")?.value?.trim();
    const password = document.getElementById("passwordInput")?.value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      storeUser(userCredential.user);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Login Error:", error);
      if (errorMsg) errorMsg.textContent = textFor("invalidCredentials");
    }
  });
}

const googleButtons = ["googleLoginBtn", "googleRegisterBtn"];
googleButtons.forEach((id) => {
  const button = document.getElementById(id);
  if (!button) return;

  button.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      storeUser(result.user);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Google Auth Error:", error);
      const target = errorMsg || registerMsg;
      if (target) target.textContent = textFor("googleError");
    }
  });
});

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("regName")?.value?.trim();
    const email = document.getElementById("regEmail")?.value?.trim();
    const password = document.getElementById("regPassword")?.value;

    if (!password || password.length < 8) {
      if (registerMsg) registerMsg.textContent = textFor("weakPassword");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      if (name) {
        await updateProfile(userCredential.user, { displayName: name });
      }

      storeUser({ ...userCredential.user, displayName: name || userCredential.user.displayName });

      if (registerMsg) {
        registerMsg.classList.add("success-msg");
        registerMsg.textContent = textFor("registerSuccess");
      }

      setTimeout(() => {
        window.location.href = "index.html";
      }, 1200);
    } catch (error) {
      console.error("Register Error:", error);
      if (!registerMsg) return;

      registerMsg.classList.remove("success-msg");
      if (error.code === "auth/email-already-in-use") {
        registerMsg.textContent = textFor("emailInUse");
      } else {
        registerMsg.textContent = textFor("registerError");
      }
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  const storedUser = JSON.parse(localStorage.getItem("coursehub_user"));
  if (!storedUser) {
    storeUser(user);
  }
});
