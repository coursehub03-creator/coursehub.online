import { auth, db, googleProvider } from "./firebase-config.js";
import { getAllCountries } from "./geo-data.js";
import { getActionCodeSettings } from "./email-action-settings.js";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const DEFAULT_AVATAR = "/assets/images/admin-avatar.png";
const getLang = () => localStorage.getItem("coursehub_lang") || "ar";

const messages = {
  invalidCredentials: {
    ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    en: "The email or password is incorrect."
  },
  emailNotVerified: {
    ar: "حسابك غير مفعّل. أعدنا إرسال رابط تفعيل جديد. افحص البريد وSpam/Promotions.",
    en: "Your account is not verified. A new verification email has been sent. Check Inbox/Spam/Promotions."
  },
  googleError: {
    ar: "فشل تسجيل الدخول باستخدام Google.",
    en: "Google sign-in failed."
  },
  weakPassword: {
    ar: "كلمة المرور يجب أن تحتوي حرفًا كبيرًا وحرفًا صغيرًا ورقمًا، وبطول 8 أحرف على الأقل.",
    en: "Password must include uppercase, lowercase and number, with at least 8 chars."
  },
  confirmPasswordMismatch: {
    ar: "تأكيد كلمة المرور غير مطابق.",
    en: "Password confirmation does not match."
  },
  requiredFields: {
    ar: "يرجى تعبئة كل الحقول المطلوبة.",
    en: "Please fill all required fields."
  },
  registerSuccess: {
    ar: "تم إنشاء الحساب وإرسال رابط التفعيل. افحص البريد وSpam/Promotions.",
    en: "Account created. Verification email sent. Check Inbox/Spam/Promotions."
  },
  registerError: {
    ar: "تعذر إنشاء الحساب. تحقق من البيانات وحاول مجددًا.",
    en: "Unable to create account. Please check your info and try again."
  },
  emailInUse: {
    ar: "هذا البريد مستخدم بالفعل. سجّل دخولك بدلًا من ذلك.",
    en: "This email is already in use. Log in instead."
  },
  resetSent: {
    ar: "تم إرسال رابط إعادة تعيين كلمة المرور. افحص البريد وSpam/Promotions.",
    en: "Password reset link sent. Check Inbox/Spam/Promotions."
  },
  resetError: {
    ar: "تعذر إرسال رابط إعادة التعيين. تحقق من البريد وحاول مرة أخرى.",
    en: "Unable to send reset email. Check your address and try again."
  },
  tooManyRequests: {
    ar: "تم تنفيذ محاولات كثيرة. يرجى الانتظار قليلًا ثم المحاولة مجددًا.",
    en: "Too many attempts. Please wait a bit and try again."
  }
};

function textFor(key) {
  const lang = getLang();
  return messages[key]?.[lang] || messages[key]?.ar || "";
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password || "");
}

function setText(node, text, ok = false) {
  if (!node) return;
  node.classList.toggle("success-msg", ok);
  node.textContent = text || "";
}

function storeUser(user, extra = {}) {
  if (!user) return;

  localStorage.setItem(
    "coursehub_user",
    JSON.stringify({
      name: user.displayName || user.email?.split("@")[0] || "User",
      email: user.email || "",
      picture: user.photoURL || DEFAULT_AVATAR,
      uid: user.uid,
      emailVerified: !!user.emailVerified,
      role: "user",
      ...extra
    })
  );
}

async function saveUserProfile(user, profileData = {}, options = {}) {
  if (!user?.uid) return;

  const payload = {
    uid: user.uid,
    email: user.email || "",
    emailVerified: !!user.emailVerified,
    picture: user.photoURL || DEFAULT_AVATAR,
    role: "student",
    status: user.emailVerified ? "active" : "pending_verification",
    updatedAt: serverTimestamp()
  };

  const fullNameFromFields = `${profileData.firstName || ""} ${profileData.lastName || ""}`.trim();
  if (user.displayName || fullNameFromFields) {
    payload.name = user.displayName || fullNameFromFields;
  }

  ["firstName", "lastName", "gender", "country", "birthDate"].forEach((field) => {
    if (profileData[field]) payload[field] = profileData[field];
  });

  if (options.isNewUser) payload.createdAt = serverTimestamp();

  await setDoc(doc(db, "users", user.uid), payload, { merge: true });
}

/* =========================
   Helpers for email actions
========================= */
function actionSettingsSafe() {
  try {
    return typeof getActionCodeSettings === "function" ? getActionCodeSettings() : undefined;
  } catch {
    return undefined;
  }
}

/* =========================
   Country Picker
========================= */
function initCountryPicker() {
  const countrySearch = document.getElementById("countrySearch");
  const countrySelect = document.getElementById("regCountry");
  if (!countrySelect) return;

  const countries = getAllCountries();

  const renderOptions = (query = "") => {
    const q = query.trim().toLowerCase();
    const filtered = countries.filter((item) => item.name.toLowerCase().includes(q));

    countrySelect.innerHTML = "";
    filtered.forEach((country, index) => {
      const option = document.createElement("option");
      option.value = country.name;
      option.textContent = `${country.flag} ${country.name}`;
      if (!q && index === 0) option.selected = true;
      countrySelect.appendChild(option);
    });
  };

  renderOptions();
  countrySearch?.addEventListener("input", (e) => renderOptions(e.target.value));
}

/* =========================
   DOM
========================= */
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const forgotForm = document.getElementById("forgotForm");

const errorMsg = document.getElementById("errorMsg");
const registerMsg = document.getElementById("registerMsg");
const forgotMsg = document.getElementById("forgotMsg");

// init optional picker (only on register page)
initCountryPicker();

/* =========================
   Login
========================= */
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("emailInput")?.value?.trim();
    const password = document.getElementById("passwordInput")?.value;

    if (!email || !password) {
      setText(errorMsg, textFor("requiredFields"));
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // enforce verification + try resend
      if (!user.emailVerified) {
        try {
          await sendEmailVerification(user, actionSettingsSafe());
        } catch (verificationError) {
          console.error("Verification resend error:", verificationError);
        }

        await signOut(auth);
        setText(errorMsg, textFor("emailNotVerified"));
        return;
      }

      storeUser(user);
      await saveUserProfile(user, {}, { isNewUser: false });

      window.location.href = "index.html";
    } catch (error) {
      console.error("Login Error:", error);
      if (error?.code === "auth/too-many-requests") {
        setText(errorMsg, textFor("tooManyRequests"));
      } else {
        setText(errorMsg, textFor("invalidCredentials"));
      }
    }
  });
}

/* =========================
   Google Auth (Login/Register)
========================= */
["googleLoginBtn", "googleRegisterBtn"].forEach((id) => {
  const button = document.getElementById(id);
  if (!button) return;

  button.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);

      storeUser(result.user);
      await saveUserProfile(result.user, {}, { isNewUser: false });

      window.location.href = "index.html";
    } catch (error) {
      console.error("Google Auth Error:", error);
      const target = errorMsg || registerMsg;
      setText(target, textFor("googleError"));
    }
  });
});

/* =========================
   Register (Detailed form)
========================= */
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = document.getElementById("regFirstName")?.value?.trim();
    const lastName = document.getElementById("regLastName")?.value?.trim();
    const gender = document.getElementById("regGender")?.value;
    const country = document.getElementById("regCountry")?.value;
    const birthDate = document.getElementById("regBirthDate")?.value;

    const email = document.getElementById("regEmail")?.value?.trim();
    const password = document.getElementById("regPassword")?.value;
    const confirmPassword = document.getElementById("regConfirmPassword")?.value;

    if (!firstName || !lastName || !gender || !country || !birthDate || !email || !password || !confirmPassword) {
      setText(registerMsg, textFor("requiredFields"));
      return;
    }

    if (!isStrongPassword(password)) {
      setText(registerMsg, textFor("weakPassword"));
      return;
    }

    if (password !== confirmPassword) {
      setText(registerMsg, textFor("confirmPasswordMismatch"));
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fullName = `${firstName} ${lastName}`.trim();

      await updateProfile(userCredential.user, {
        displayName: fullName,
        photoURL: DEFAULT_AVATAR
      });

      await sendEmailVerification(userCredential.user, actionSettingsSafe());

      await saveUserProfile(
        userCredential.user,
        { firstName, lastName, gender, country, birthDate },
        { isNewUser: true }
      );

      storeUser(userCredential.user, {
        name: fullName,
        picture: DEFAULT_AVATAR,
        emailVerified: false
      });

      localStorage.setItem("coursehub_pending_verification_email", email);

      setText(registerMsg, textFor("registerSuccess"), true);

      // sign out until verified
      await signOut(auth);

      setTimeout(() => {
        window.location.href = "verify-email.html";
      }, 1200);

    } catch (error) {
      console.error("Register Error:", error);

      if (error?.code === "auth/too-many-requests") {
        setText(registerMsg, textFor("tooManyRequests"));
        return;
      }

      if (error?.code === "auth/email-already-in-use") {
        setText(registerMsg, textFor("emailInUse"));
      } else {
        setText(registerMsg, textFor("registerError"));
      }
    }
  });
}

/* =========================
   Forgot Password
========================= */
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("forgotEmail")?.value?.trim();
    if (!email) {
      setText(forgotMsg, textFor("requiredFields"));
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email, actionSettingsSafe());
      setText(forgotMsg, textFor("resetSent"), true);
    } catch (error) {
      console.error("Reset password error:", error);
      if (error?.code === "auth/too-many-requests") {
        setText(forgotMsg, textFor("tooManyRequests"));
      } else {
        setText(forgotMsg, textFor("resetError"));
      }
    }
  });
}

/* =========================
   Persist user in localStorage
========================= */
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  const storedUser = JSON.parse(localStorage.getItem("coursehub_user"));
  if (!storedUser && user.emailVerified) {
    storeUser(user);
  } else if (!storedUser) {
    storeUser(user);
  }
});
