// js/auth-guard.js

document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));

  if (!user) {
    // المستخدم غير مسجل الدخول → تحويل لصفحة تسجيل الدخول
    window.location.href = "login.html";
  }
});
