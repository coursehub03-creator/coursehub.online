// admin-guard.js
// ===============================
// حماية صفحات الأدمن - يجب أن يكون المستخدم أدمن
// ===============================

// دالة يمكن استدعاؤها من أي صفحة للتحقق من صلاحيات الأدمن
export function protectAdmin() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const adminEmails = ["kaleadsalous30@gmail.com", "coursehub03@gmail.com"];

  if (!user || !adminEmails.includes(user.email)) {
    alert("ليس لديك صلاحية الدخول إلى هذه الصفحة.");
    window.location.href = "/login.html";
  }
}

// تحقق تلقائي عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
  protectAdmin();
});
