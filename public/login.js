
```javascript
const {
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber
} = window.firebaseAuth;

// Email login
document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );
    window.location.href = "index.html";
  } catch (err) {
    alert(err.message);
  }
});

// Google login
document.getElementById("googleLogin").onclick = async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    window.location.href = "index.html";
  } catch (err) {
    alert(err.message);
  }
};

// Phone login
document.getElementById("phoneLogin").onclick = () => {
  phoneBox.style.display = "block";
  window.recaptchaVerifier = new RecaptchaVerifier(
    "recaptcha-container",
    {},
    auth
  );
};

sendCode.onclick = async () => {
  window.confirmationResult = await signInWithPhoneNumber(
    auth,
    phone.value,
    window.recaptchaVerifier
  );
  alert("تم إرسال الرمز");
};

verifyCode.onclick = async () => {
  await window.confirmationResult.confirm(code.value);
  window.location.href = "index.html";
};
```

