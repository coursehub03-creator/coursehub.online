// auth-guard.js
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const path = window.location.pathname.toLowerCase();

  const adminPages = [
    "dashboard.html",
    "manage-users.html",
    "add-course.html"
  ];

  const isAdminPage = adminPages.some(page => path.endsWith(page));

  if (isAdminPage) {
    if (!user || user.role !== "admin") {
      // ⛔ مهم جدًا
      window.location.replace("../login.html");
    }
  }
});
