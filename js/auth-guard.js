// auth-guard.js - حماية صفحات الإدارة
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));

  // صفحات الإدارة
  const adminPages = ["/admin/dashboard.html", "/admin/manage-users.html", "/admin/add-course.html"];

  const path = window.location.pathname;

  if (adminPages.includes(path)) {
    // السماح فقط للأدمن
    const adminEmails = ["kaleadsalous30@gmail.com", "coursehub03@gmail.com"];
    if (!user || !adminEmails.includes(user.email)) {
      // إذا لم يكن المستخدم أدمن، تحويله لصفحة تسجيل الدخول
      window.location.href = "/login.html";
    }
  }

  // مثال: صفحات عامة يمكن إضافة فحص تسجيل الدخول إذا أردت
  // if (userPages.includes(path) && !user) window.location.href = "/login.html";
});
