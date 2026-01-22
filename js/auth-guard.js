// js/auth-guard.js

document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));

  if (!user) {
    // منع الوصول للصفحات المحمية بدون تسجيل دخول
    window.location.href = "login.html";
  }
});

