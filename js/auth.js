import { auth, googleProvider, db, storage } from './firebase-config.js';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
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
    tooManyRequests: "تم تنفيذ محاولات كثيرة. يرجى الانتظار قليلًا ثم المحاولة مجددًا.",
    instructorPending: "تم التحقق من بريدك، لكن حساب الأستاذ قيد المراجعة. سنرسل لك رسالة عند قبول الطلب.",
    instructorRejected: "تم رفض طلب الأستاذ. راجع بريدك لمعرفة السبب أو تواصل مع الدعم.",
    instructorTermsRequired: "يجب الموافقة على شروط وقواعد الأساتذة قبل التسجيل.",
    instructorPdfRequired: "يرجى رفع شهادة عمل بصيغة PDF.",
    instructorApplySuccess: "تم إرسال طلب الأستاذ بنجاح. سيتم مراجعته وإشعارك عبر البريد الإلكتروني."
  },
  en: {
    invalidLogin: "The email or password is incorrect.",
    googleFailed: "Google sign-in failed.",
    verifyFirst: "Your account is not verified. A new verification email has been sent. Check Inbox/Spam/Promotions.",
    verifySentAfterRegister: "Account created. Verification email sent. Check Inbox/Spam/Promotions.",
    registerFailed: "Failed to create account. Please check your data and try again.",
    resetSent: "Password reset email sent. Check Inbox/Spam/Promotions.",
    resetFailed: "Could not send reset email. Please verify the email and try again.",
    tooManyRequests: "Too many attempts. Please wait a bit and try again.",
    instructorPending: "Email verified, but your instructor account is pending review.",
    instructorRejected: "Your instructor request was rejected. Check your email for details.",
    instructorTermsRequired: "You must accept instructor terms before registration.",
    instructorPdfRequired: "Please upload employment proof in PDF format.",
    instructorApplySuccess: "Instructor application submitted. We will review your profile and notify you by email."
  }
};

const t = (key) => messages[lang()]?.[key] || messages.ar[key];

function setError(text) {
  const errorMsg = document.getElementById("errorMsg");
  if (errorMsg) errorMsg.textContent = text;
}

function saveUser(user, role = "student") {
  localStorage.setItem("coursehub_user", JSON.stringify({
    name: user.displayName || user.email?.split("@")[0] || "User",
    email: user.email,
    picture: user.photoURL,
    uid: user.uid,
    role
  }));
}

async function getUserMeta(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data() : null;
}

const accountTypeInputs = document.querySelectorAll('input[name="accountType"]');
const instructorFields = document.getElementById("instructorFields");
accountTypeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    const isInstructor = document.querySelector('input[name="accountType"]:checked')?.value === "instructor";
    if (instructorFields) instructorFields.style.display = isInstructor ? "flex" : "none";
  });
});

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

      const meta = await getUserMeta(user.uid);
      const role = meta?.role || "student";

      if (role === "instructor") {
        if (meta?.status === "pending") {
          await signOut(auth);
          setError(t("instructorPending"));
          return;
        }
        if (meta?.status === "rejected") {
          await signOut(auth);
          setError(t("instructorRejected"));
          return;
        }
      }

      saveUser(user, role);
      window.location.href = role === "instructor" ? "/instructor-dashboard.html" : "index.html";
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
      const meta = await getUserMeta(result.user.uid);
      const role = meta?.role || "student";
      saveUser(result.user, role);
      window.location.href = role === "instructor" ? "/instructor-dashboard.html" : "index.html";
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

    const name = document.getElementById("regFullName")?.value?.trim() || "";
    const email = document.getElementById("regEmail")?.value?.trim();
    const phone = document.getElementById("regPhone")?.value?.trim() || "";
    const password = document.getElementById("regPassword")?.value;
    const accountType = document.querySelector('input[name="accountType"]:checked')?.value || "student";

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      if (accountType === "instructor") {
        const termsAccepted = document.getElementById("instructorTerms")?.checked;
        const proofFile = document.getElementById("regWorkProof")?.files?.[0] || null;

        if (!termsAccepted) {
          await user.delete();
          alert(t("instructorTermsRequired"));
          return;
        }

        if (!proofFile || !proofFile.type.includes("pdf")) {
          await user.delete();
          alert(t("instructorPdfRequired"));
          return;
        }

        const fileRef = ref(storage, `instructor-applications/${user.uid}/work-proof-${Date.now()}.pdf`);
        await uploadBytes(fileRef, proofFile);
        const workProofUrl = await getDownloadURL(fileRef);

        const instructorData = {
          uid: user.uid,
          name,
          email,
          phone,
          role: "instructor",
          status: "pending",
          university: document.getElementById("regUniversity")?.value?.trim() || "",
          specialization: document.getElementById("regSpecialization")?.value?.trim() || "",
          experienceYears: Number(document.getElementById("regExperience")?.value || 0),
          bio: document.getElementById("regBio")?.value?.trim() || "",
          termsAcceptedAt: serverTimestamp(),
          workProofUrl,
          createdAt: serverTimestamp()
        };

        await setDoc(doc(db, "users", user.uid), instructorData, { merge: true });
        await addDoc(collection(db, "instructorApplications"), {
          ...instructorData,
          applicationStatus: "pending",
          reviewedAt: null,
          reviewedBy: null,
          reviewReason: ""
        });

        await sendEmailVerification(user, getActionCodeSettings());
        await signOut(auth);
        alert(t("instructorApplySuccess"));
        window.location.href = `/instructor-pending.html?email=${encodeURIComponent(email)}`;
        return;
      }

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name,
        email,
        phone,
        role: "student",
        status: "active",
        createdAt: serverTimestamp()
      }, { merge: true });

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

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const storedUser = JSON.parse(localStorage.getItem("coursehub_user"));
    if (!storedUser && user.emailVerified) {
      const meta = await getUserMeta(user.uid);
      saveUser(user, meta?.role || "student");
    }
  }
});
