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

  const adminEmails = [
    "kaleadsalous30@gmail.com",
    "coursehub03@gmail.com"
  ];

  if (isAdminPage) {
    if (!user || !adminEmails.includes(user.email)) {
      // ⛔ مهم جدًا
      window.location.replace("../login.html");
    }
  }
});
