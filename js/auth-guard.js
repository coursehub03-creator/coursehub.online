// auth-guard.js
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const path = window.location.pathname.toLowerCase();

  const adminPages = [
    "dashboard.html",
    "manage-users.html",
    "add-course.html"
  ];
  const adminEmails = ["kaleadsalous30@gmail.com", "coursehub03@gmail.com"];

  const isAdminPage = adminPages.some(page => path.endsWith(page));

  if (isAdminPage) {
    const isAdmin = user && (user.role === "admin" || adminEmails.includes(String(user.email || "").toLowerCase()));
    if (!isAdmin) {
      // ⛔ مهم جدًا
      window.location.replace("../login.html");
    }
  }
});
