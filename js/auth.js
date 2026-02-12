import { auth, db, googleProvider } from './firebase-config.js';
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
    ar: "يرجى تفعيل بريدك الإلكتروني أولاً. أعدنا إرسال رسالة التحقق.",
    en: "Please verify your email first. We sent a new verification email."
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
    ar: "تم إنشاء الحساب. أرسلنا رسالة التحقق إلى بريدك الإلكتروني.",
    en: "Account created. We sent a verification email to your inbox."
  },
  registerError: {
    ar: "تعذر إنشاء الحساب. تأكد من البيانات وحاول مرة أخرى.",
    en: "Unable to create account. Please check your info and try again."
  },
  emailInUse: {
    ar: "هذا البريد مستخدم بالفعل. سجّل دخولك بدلًا من ذلك.",
    en: "This email is already in use. Log in instead."
  },
  resetSent: {
    ar: "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك.",
    en: "Password reset link sent to your email."
  },
  resetError: {
    ar: "تعذر إرسال رابط إعادة التعيين. تحقق من البريد وحاول مجددًا.",
    en: "Unable to send reset email. Check your address and try again."
  }
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
    email: user.email || "",
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

  const fullNameFromFields = `${profileData.firstName || ""} ${profileData.lastName || ""}`.trim();
  if (user.displayName || fullNameFromFields) {
    payload.name = user.displayName || fullNameFromFields;
  }

  if (profileData.firstName) payload.firstName = profileData.firstName;
  if (profileData.lastName) payload.lastName = profileData.lastName;
  if (profileData.gender) payload.gender = profileData.gender;
  if (profileData.country) payload.country = profileData.country;
  if (profileData.birthDate) payload.birthDate = profileData.birthDate;

  if (options.isNewUser) payload.createdAt = serverTimestamp();

  await setDoc(doc(db, "users", user.uid), payload, { merge: true });
}

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const forgotForm = document.getElementById("forgotForm");

const errorMsg = document.getElementById("errorMsg");
const registerMsg = document.getElementById("registerMsg");
const forgotMsg = document.getElementById("forgotMsg");

/* =========================
   Login
========================= */
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("emailInput")?.value?.trim();
    const password = document.getElementById("passwordInput")?.value;

    if (!email || !password) {
      if (errorMsg) errorMsg.textContent = textFor("requiredFields");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Enforce email verification
      if (!user.emailVerified) {
        await sendEmailVerification(user);
        await signOut(auth);
        if (errorMsg) errorMsg.textContent = textFor("emailNotVerified");
        return;
      }

      storeUser(user);
      await saveUserProfile(user, {}, { isNewUser: false });

      window.location.href = "index.html";
    } catch (error) {
      console.error("Login Error:", error);
      if (errorMsg) errorMsg.textContent = textFor("invalidCredentials");
    }
  });
}

/* =========================
   Google Auth (Login/Register buttons)
========================= */
const googleButtons = ["googleLoginBtn", "googleRegisterBtn"];
googleButtons.forEach((id) => {
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
      if (target) target.textContent = textFor("googleError");
    }
  });
});

/* =========================
   Register
   - Supports both:
     A) detailed fields (first/last/gender/country/birthDate + confirm)
     B) simple fields (name + email + password)
========================= */
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Detailed fields (if exist)
    const firstNameEl = document.getElementById("regFirstName");
    const lastNameEl = document.getElementById("regLastName");
    const genderEl = document.getElementById("regGender");
    const countryEl = document.getElementById("regCountry");
    const birthDateEl = document.getElementById("regBirthDate");
    const confirmEl = document.getElementById("regConfirmPassword");

    // Simple field (if exist)
    const nameEl = document.getElementById("regName");

    const firstName = firstNameEl?.value?.trim();
    const lastName = lastNameEl?.value?.trim();
    const gender = genderEl?.value;
    const country = countryEl?.value?.trim();
    const birthDate = birthDateEl?.value;

    const name = nameEl?.value?.trim();
    const email = document.getElementById("regEmail")?.value?.trim();
    const password = document.getElementById("regPassword")?.value;
    const confirmPassword = confirmEl?.value;

    // Determine which mode we are in
    const hasDetailedFields = !!(firstNameEl || lastNameEl || genderEl || countryEl || birthDateEl);

    // Required fields check
    if (!email || !password) {
      if (registerMsg) registerMsg.textContent = textFor("requiredFields");
      return;
    }

    if (hasDetailedFields) {
      if (!firstName || !lastName || !gender || !country || !birthDate || !confirmPassword) {
        if (registerMsg) registerMsg.textContent = textFor("requiredFields");
        return;
      }
    }

    // Password rules
    if (!isStrongPassword(password)) {
      if (registerMsg) registerMsg.textContent = textFor("weakPassword");
      return;
    }

    // Confirm password if field exists
    if (confirmEl && password !== confirmPassword) {
      if (registerMsg) registerMsg.textContent = textFor("confirmPasswordMismatch");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      const fullName = hasDetailedFields
        ? `${firstName} ${lastName}`.trim()
        : (name || userCredential.user.displayName || "");

      // Update profile name + avatar
      const profileUpdate = {};
      if (fullName) profileUpdate.displayName = fullName;

      // Set default avatar if no photo
      profileUpdate.photoURL = userCredential.user.photoURL || DEFAULT_AVATAR;

      await updateProfile(userCredential.user, profileUpdate);

      // Send verification + save profile
      await sendEmailVerification(userCredential.user);

      if (hasDetailedFields) {
        await saveUserProfile(
          userCredential.user,
          { firstName, lastName, gender, country, birthDate },
          { isNewUser: true }
        );
      } else {
        await saveUserProfile(userCredential.user, {}, { isNewUser: true });
      }

      storeUser(userCredential.user, {
        name: fullName || userCredential.user.displayName,
        picture: userCredential.user.photoURL || DEFAULT_AVATAR
      });

      if (registerMsg) {
        registerMsg.classList.add("success-msg");
        registerMsg.textContent = textFor("registerSuccess");
      }

      // Force logout until email verified, then redirect to login
      await signOut(auth);
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1600);

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

/* =========================
   Forgot Password
========================= */
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("forgotEmail")?.value?.trim();
    if (!email) {
      if (forgotMsg) forgotMsg.textContent = textFor("requiredFields");
      return;
    }

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

/* =========================
   Persist user in localStorage
========================= */
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  const storedUser = JSON.parse(localStorage.getItem("coursehub_user"));
  if (!storedUser) {
    storeUser(user);
  }
});
