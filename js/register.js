// Legacy register entrypoint retained for backward compatibility.
// Registration is handled securely through Firebase in js/auth.js.

document.addEventListener("DOMContentLoaded", () => {
  const legacyForm = document.getElementById("register-form");
  if (!legacyForm) return;

  const notice = document.createElement("p");
  notice.className = "error-msg";
  notice.textContent = "تم نقل إنشاء الحساب إلى نظام تسجيل آمن. سيتم تحويلك...";
  legacyForm.replaceWith(notice);

  setTimeout(() => {
    window.location.href = "register.html";
  }, 900);
});
