// js/auth.js

async function login(email, password) {
  try {
    // مثال: تحقق بسيط فقط (يمكنك تعديل API أو Firebase)
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      alert("البريد أو كلمة المرور غير صحيحة");
      return;
    }

    // تخزين المستخدم الحالي
    localStorage.setItem("coursehub_user", JSON.stringify(user));
    window.location.href = "index.html"; // بعد تسجيل الدخول
  } catch (err) {
    console.error("خطأ في تسجيل الدخول:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const email = form.email.value;
      const password = form.password.value;
      login(email, password);
    });
  }
});
