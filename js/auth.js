import { auth, db, googleProvider } from './firebase-config.js';
import { getAllCountries } from './geo-data.js';
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
  invalidCredentials: { ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة.", en: "The email or password is incorrect." },
  emailNotVerified: { ar: "يرجى تفعيل بريدك الإلكتروني أولاً. أعدنا إرسال رسالة التحقق.", en: "Please verify your email first. Verification email resent." },
  googleError: { ar: "فشل تسجيل الدخول باستخدام Google.", en: "Google sign-in failed." },
  weakPassword: { ar: "كلمة المرور يجب أن تحتوي حرفًا كبيرًا وحرفًا صغيرًا ورقمًا، وبطول 8 أحرف على الأقل.", en: "Password must include uppercase, lowercase and number, with at least 8 chars." },
  confirmPasswordMismatch: { ar: "تأكيد كلمة المرور غير مطابق.", en: "Password confirmation does not match." },
  requiredFields: { ar: "يرجى تعبئة كل الحقول المطلوبة.", en: "Please fill all required fields." },
  registerSuccess: { ar: "تم إنشاء الحساب. يلزم تفعيل البريد أولاً.", en: "Account created. Email verification is required." },
  registerError: { ar: "تعذر إنشاء الحساب. تأكد من البيانات وحاول مرة أخرى.", en: "Unable to create account. Please check your info and try again." },
  emailInUse: { ar: "هذا البريد مستخدم بالفعل. سجّل دخولك بدلًا من ذلك.", en: "This email is already in use. Log in instead." },
  resetSent: { ar: "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك.", en: "Password reset link sent to your email." },
  resetError: { ar: "تعذر إرسال رابط إعادة التعيين. تحقق من البريد وحاول مجددًا.", en: "Unable to send reset email. Check your address and try again." }
};

function textFor(key) {
  const lang = getLang();
  return messages[key]?.[lang] || messages[key]?.ar || "";
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password || "");
}

function storeUser(user, extra = {}) {
  if (!user) return;
  localStorage.setItem("coursehub_user", JSON.stringify({
    name: user.displayName || user.email?.split("@")[0] || "User",
    email: user.email,
    picture: user.photoURL || DEFAULT_AVATAR,
    uid: user.uid,
    emailVerified: !!user.emailVerified,
    role: "user",
    ...extra
  }));
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

  const fullName = `${profileData.firstName || ""} ${profileData.lastName || ""}`.trim();
  if (user.displayName || fullName) payload.name = user.displayName || fullName;

  ["firstName", "lastName", "gender", "country", "birthDate"].forEach((field) => {
    if (profileData[field]) payload[field] = profileData[field];
  });

  if (options.isNewUser) payload.createdAt = serverTimestamp();

  await setDoc(doc(db, "users", user.uid), payload, { merge: true });
}

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

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const forgotForm = document.getElementById("forgotForm");
const errorMsg = document.getElementById("errorMsg");
const registerMsg = document.getElementById("registerMsg");
const forgotMsg = document.getElementById("forgotMsg");

initCountryPicker();

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("emailInput")?.value?.trim();
    const password = document.getElementById("passwordInput")?.value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        await signOut(auth);
        if (errorMsg) errorMsg.textContent = textFor("emailNotVerified");
        return;
      }

      storeUser(user);
      await saveUserProfile(user);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Login Error:", error);
      if (errorMsg) errorMsg.textContent = textFor("invalidCredentials");
    }
  });
}

["googleLoginBtn", "googleRegisterBtn"].forEach((id) => {
  const button = document.getElementById(id);
  if (!button) return;

  button.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      storeUser(result.user);
      await saveUserProfile(result.user);
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

    const firstName = document.getElementById("regFirstName")?.value?.trim();
    const lastName = document.getElementById("regLastName")?.value?.trim();
    const gender = document.getElementById("regGender")?.value;
    const country = document.getElementById("regCountry")?.value;
    const birthDate = document.getElementById("regBirthDate")?.value;
    const email = document.getElementById("regEmail")?.value?.trim();
    const password = document.getElementById("regPassword")?.value;
    const confirmPassword = document.getElementById("regConfirmPassword")?.value;

    if (!firstName || !lastName || !gender || !country || !birthDate || !email || !password || !confirmPassword) {
      if (registerMsg) registerMsg.textContent = textFor("requiredFields");
      return;
    }

    if (!isStrongPassword(password)) {
      if (registerMsg) registerMsg.textContent = textFor("weakPassword");
      return;
    }

    if (password !== confirmPassword) {
      if (registerMsg) registerMsg.textContent = textFor("confirmPasswordMismatch");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fullName = `${firstName} ${lastName}`.trim();

      await updateProfile(userCredential.user, { displayName: fullName, photoURL: DEFAULT_AVATAR });
      await sendEmailVerification(userCredential.user);
      await saveUserProfile(
        userCredential.user,
        { firstName, lastName, gender, country, birthDate },
        { isNewUser: true }
      );

      storeUser(userCredential.user, { name: fullName, picture: DEFAULT_AVATAR, emailVerified: false });
      localStorage.setItem("coursehub_pending_verification_email", email);

      if (registerMsg) {
        registerMsg.classList.add("success-msg");
        registerMsg.textContent = textFor("registerSuccess");
      }

      setTimeout(() => {
        window.location.href = "verify-email.html";
      }, 1200);
    } catch (error) {
      console.error("Register Error:", error);
      if (!registerMsg) return;

      registerMsg.classList.remove("success-msg");
      registerMsg.textContent = error.code === "auth/email-already-in-use"
        ? textFor("emailInUse")
        : textFor("registerError");
    }
  });
}

if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("forgotEmail")?.value?.trim();

    try {
      await sendPasswordResetEmail(auth, email);
      if (forgotMsg) {
        forgotMsg.classList.add("success-msg");
        forgotMsg.textContent = textFor("resetSent");
      }
    } catch (error) {
      console.error("Reset password error:", error);
      if (forgotMsg) {
        forgotMsg.classList.remove("success-msg");
        forgotMsg.textContent = textFor("resetError");
      }
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  const storedUser = JSON.parse(localStorage.getItem("coursehub_user"));
  if (!storedUser) storeUser(user);
});
