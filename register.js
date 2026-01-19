```javascript
const {
  auth,
  createUserWithEmailAndPassword,
  sendEmailVerification
} = window.firebaseAuth;

registerForm.addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );
    await sendEmailVerification(cred.user);
    alert("تم إنشاء الحساب، تحقق من بريدك الإلكتروني");
    window.location.href = "login.html";
  } catch (err) {
    alert(err.message);
  }
});
```
