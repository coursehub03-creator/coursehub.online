import { auth } from './firebase-config.js';
import { onAuthStateChanged, reload, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const verifyMsg = document.getElementById("verifyMsg");
const emailEl = document.getElementById("verifyEmailAddress");
const resendBtn = document.getElementById("resendVerificationBtn");
const checkBtn = document.getElementById("checkVerificationBtn");

function setMsg(text, success = false) {
  if (!verifyMsg) return;
  verifyMsg.classList.toggle("success-msg", success);
  verifyMsg.textContent = text;
}

function getPendingEmail() {
  return localStorage.getItem("coursehub_pending_verification_email") || "";
}

if (emailEl) {
  const email = getPendingEmail();
  emailEl.textContent = email ? `البريد المستهدف: ${email}` : "";
}

resendBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    setMsg("سجّل الدخول أولًا ثم أعد طلب رسالة التفعيل.");
    return;
  }

  try {
    await sendEmailVerification(user);
    setMsg("تم إرسال رسالة تفعيل جديدة.", true);
  } catch (error) {
    console.error(error);
    setMsg("تعذر إعادة إرسال الرسالة الآن.");
  }
});

checkBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  await reload(user);
  if (user.emailVerified) {
    localStorage.removeItem("coursehub_pending_verification_email");
    await signOut(auth);
    setMsg("تم تفعيل الحساب بنجاح. يمكنك تسجيل الدخول الآن.", true);
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);
  } else {
    setMsg("لم يتم تفعيل البريد بعد. افتح الرسالة واضغط رابط التفعيل.");
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user && !getPendingEmail()) {
    setMsg("لا يوجد طلب تفعيل نشط. يمكنك إنشاء حساب جديد.");
  }
});
