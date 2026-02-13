import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getActionCodeSettings } from "./email-action-settings.js";

/* =========================
   Elements
========================= */
const verifyMsg = document.getElementById("verifyMsg");
const emailEl = document.getElementById("verifyEmailAddress");
const resendBtn = document.getElementById("resendVerificationBtn");
const checkBtn = document.getElementById("checkVerificationBtn");

/* =========================
   i18n
========================= */
const lang = () => localStorage.getItem("coursehub_lang") || "ar";

const text = {
  ar: {
    sentTo: (email) => `تم إرسال رابط التفعيل إلى: ${email}`,
    targetEmail: (email) => `البريد المستهدف: ${email}`,
    noTargetEmail: "",
    needLogin: "سجّل الدخول أولًا لإعادة إرسال رابط التفعيل.",
    alreadyVerified: "حسابك مفعّل بالفعل. يمكنك تسجيل الدخول الآن.",
    resent: "تمت إعادة إرسال رابط التفعيل. افحص Inbox وSpam/Promotions.",
    resendFailed: "تعذر إعادة إرسال رابط التفعيل. حاول مرة أخرى.",
    tooMany: "محاولات كثيرة جدًا. انتظر قليلًا ثم أعد المحاولة.",
    noActive: "لا يوجد طلب تفعيل نشط. يمكنك إنشاء حساب جديد.",
    verifyNow: "تحقق من تفعيل بريدك ثم اضغط زر التحقق.",
    notYet: "لم يتم تفعيل البريد بعد. افتح الرسالة واضغط رابط التفعيل.",
    verifiedOk: "تم تفعيل الحساب بنجاح. يمكنك تسجيل الدخول الآن."
  },
  en: {
    sentTo: (email) => `Verification link sent to: ${email}`,
    targetEmail: (email) => `Target email: ${email}`,
    noTargetEmail: "",
    needLogin: "Please login first to resend the verification link.",
    alreadyVerified: "Your account is already verified. You can log in now.",
    resent: "Verification email resent. Check Inbox/Spam/Promotions.",
    resendFailed: "Could not resend verification email. Please try again.",
    tooMany: "Too many attempts. Please wait and try again.",
    noActive: "No active verification request. You can register again.",
    verifyNow: "Verify your email then click the check button.",
    notYet: "Email is not verified yet. Open the message and click the verification link.",
    verifiedOk: "Account verified successfully. You can log in now."
  }
};

const t = () => text[lang()] || text.ar;

/* =========================
   Helpers
========================= */
function setMsg(message, success = false) {
  if (!verifyMsg) return;
  verifyMsg.classList.toggle("success-msg", success);
  verifyMsg.textContent = message || "";
}

function getPendingEmail() {
  return localStorage.getItem("coursehub_pending_verification_email") || "";
}

function getPresetEmailFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("email") || "";
}

function resolveTargetEmail(user) {
  return getPresetEmailFromUrl() || getPendingEmail() || user?.email || "";
}

/* =========================
   Init UI
========================= */
const initialTargetEmail = resolveTargetEmail(auth.currentUser);

if (emailEl) {
  emailEl.textContent = initialTargetEmail ? t().targetEmail(initialTargetEmail) : t().noTargetEmail;
}

if (initialTargetEmail) {
  setMsg(t().sentTo(initialTargetEmail), true);
}

/* =========================
   Resend Verification
========================= */
resendBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;

  if (!user) {
    setMsg(t().needLogin);
    return;
  }

  if (user.emailVerified) {
    setMsg(t().alreadyVerified, true);
    return;
  }

  try {
    await sendEmailVerification(user, getActionCodeSettings());
    setMsg(t().resent, true);
  } catch (error) {
    console.error("Resend verify email failed:", error);
    setMsg(error?.code === "auth/too-many-requests" ? t().tooMany : t().resendFailed);
  }
});

/* =========================
   Check Verification (reload)
========================= */
checkBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    await reload(user);

    if (user.emailVerified) {
      localStorage.removeItem("coursehub_pending_verification_email");
      await signOut(auth);

      setMsg(t().verifiedOk, true);
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1000);
    } else {
      setMsg(t().notYet);
    }
  } catch (error) {
    console.error("Check verification failed:", error);
    setMsg(t().notYet);
  }
});

/* =========================
   Auth State
========================= */
onAuthStateChanged(auth, (user) => {
  const targetEmail = resolveTargetEmail(user);

  if (emailEl) {
    emailEl.textContent = targetEmail ? t().targetEmail(targetEmail) : t().noTargetEmail;
  }

  if (!user && !targetEmail) {
    setMsg(t().noActive);
    return;
  }

  if (user?.emailVerified) {
    setMsg(t().alreadyVerified, true);
    return;
  }

  if (targetEmail) {
    setMsg(t().sentTo(targetEmail), true);
  } else {
    setMsg(t().verifyNow);
  }
});
