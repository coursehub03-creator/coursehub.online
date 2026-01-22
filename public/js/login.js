const {
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber
} = window.firebaseAuth;

// تعريف الحقول
const email = document.getElementById("email");
const password = document.getElementById("password");
const phone = document.getElementById("phone");
const code = document.getElementById("code");
const sendCode = document.getElementById("sendCode");
const verifyCode = document.getElementById("verifyCode");
const phoneBox = document.getElementById("phoneBox"); // الحاوية لإدخال الرقم
const errorMsg = document.getElementById("errorMsg");

// =====================
// تسجيل الدخول بالبريد الإلكتروني
// =====================
document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value);
    const user = userCredential.user;

    // حفظ بيانات المستخدم محليًا
    localStorage.setItem("coursehub_user", JSON.stringify({
      email: user.email,
      uid: user.uid,
      role: "student" // لو عندك دور أدمن حدد هنا
    }));

    window.location.href = "index.html";
  } catch (err) {
    if(errorMsg) errorMsg.textContent = err.message;
    else alert(err.message);
    console.error(err);
  }
});

// =====================
// تسجيل الدخول عبر Google
// =====================
document.getElementById("googleLogin").onclick = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    localStorage.setItem("coursehub_user", JSON.stringify({
      email: user.email,
      uid: user.uid,
      role: "student"
    }));

    window.location.href = "index.html";
  } catch (err) {
    if(errorMsg) errorMsg.textContent = err.message;
    else alert(err.message);
    console.error(err);
  }
};

// =====================
// تسجيل الدخول برقم الهاتف
// =====================
document.getElementById("phoneLogin").onclick = () => {
  if(phoneBox) phoneBox.style.display = "block";

  window.recaptchaVerifier = new RecaptchaVerifier(
    "recaptcha-container",
    {},
    auth
  );
};

// إرسال رمز التحقق
if(sendCode){
  sendCode.onclick = async () => {
    try {
      window.confirmationResult = await signInWithPhoneNumber(auth, phone.value, window.recaptchaVerifier);
      alert("تم إرسال الرمز");
    } catch(err){
      console.error(err);
      alert("فشل إرسال الرمز: " + err.message);
    }
  };
}

// التحقق من الرمز
if(verifyCode){
  verifyCode.onclick = async () => {
    try {
      await window.confirmationResult.confirm(code.value);
      window.location.href = "../index.html";
    } catch(err){
      console.error(err);
      alert("رمز التحقق غير صحيح: " + err.message);
    }
  };
}
