import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getActionCodeSettings } from "./email-action-settings.js";

const messageEl = document.getElementById("verifyMessage");
const resendBtn = document.getElementById("resendVerificationBtn");
const params = new URLSearchParams(window.location.search);
const presetEmail = params.get("email");

const lang = () => localStorage.getItem("coursehub_lang") || "ar";
const text = {
  ar: {
    sentTo: (email) => `تم إرسال رابط التفعيل إلى: ${email}`,
    needLogin: "سجّل الدخول أولًا لإعادة إرسال رابط التفعيل.",
    alreadyVerified: "حسابك مفعّل بالفعل. يمكنك تسجيل الدخول الآن.",
    resent: "تمت إعادة إرسال رابط التفعيل. افحص Inbox وSpam/Promotions.",
    resendFailed: "تعذر إعادة إرسال رابط التفعيل. حاول مرة أخرى.",
    tooMany: "محاولات كثيرة جدًا. انتظر قليلًا ثم أعد المحاولة."
  },
  en: {
    sentTo: (email) => `Verification link sent to: ${email}`,
    needLogin: "Please login first to resend the verification link.",
    alreadyVerified: "Your account is already verified. You can log in now.",
    resent: "Verification email resent. Check Inbox and Spam/Promotions.",
    resendFailed: "Could not resend verification email. Please try again.",
    tooMany: "Too many attempts. Please wait and try again."
  }
};
const t = text[lang()];

if (presetEmail && messageEl) {
  messageEl.textContent = t.sentTo(presetEmail);
}

resendBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    if (messageEl) messageEl.textContent = t.needLogin;
    return;
  }

  if (user.emailVerified) {
    if (messageEl) messageEl.textContent = t.alreadyVerified;
    return;
  }

  try {
    await sendEmailVerification(user, getActionCodeSettings());
    if (messageEl) messageEl.textContent = t.resent;
  } catch (error) {
    console.error("Resend verify email failed:", error);
    if (messageEl) {
      messageEl.textContent =
        error?.code === "auth/too-many-requests" ? t.tooMany : t.resendFailed;
    }
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user || !messageEl || presetEmail) return;
  messageEl.textContent = t.sentTo(user.email || "");
});
