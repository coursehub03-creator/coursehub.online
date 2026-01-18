// login.js
import { auth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber } from './firebase-config.js';

// --- Email login ---
document.getElementById('email-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert('تم تسجيل الدخول بنجاح!');
    window.location.href = "index.html"; // إعادة التوجيه بعد تسجيل الدخول
  } catch (err) {
    alert(err.message);
  }
});

// --- Google Login ---
document.getElementById('google-login').addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    alert('تم تسجيل الدخول بواسطة Google!');
    window.location.href = "index.html";
  } catch (err) {
    alert(err.message);
  }
});

// --- Phone Login ---
const phoneBtn = document.getElementById('phone-login');
const phoneDiv = document.getElementById('phone-auth-div');

phoneBtn.addEventListener('click', () => {
  phoneDiv.style.display = 'block';
  window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {}, auth);
});

document.getElementById('send-otp').addEventListener('click', async () => {
  const phoneNumber = document.getElementById('phone-number').value;
  const appVerifier = window.recaptchaVerifier;
  try {
    window.confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    alert('تم إرسال رمز التحقق');
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('verify-otp').addEventListener('click', async () => {
  const code = document.getElementById('otp').value;
  try {
    await window.confirmationResult.confirm(code);
    alert('تم تسجيل الدخول بالهاتف!');
    window.location.href = "index.html";
  } catch (err) {
    alert(err.message);
  }
});

// --- Auth state ---
onAuthStateChanged(auth, user => {
  if(user){
    console.log('User logged in:', user.email || user.phoneNumber);
  } else {
    console.log('No user logged in');
  }
});
