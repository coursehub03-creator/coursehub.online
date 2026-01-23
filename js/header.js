// header.js - إدارة حالة المستخدم في الهيدر والفوتر

document.addEventListener("DOMContentLoaded", () => {
  // إذا الهيدر والفوتر موجودين، استدعاء setupUserState بعد تحميلهم
  const waitForHeader = setInterval(() => {
    const userInfo = document.getElementById("user-info");
    if (userInfo) {
      setupUserState();
      clearInterval(waitForHeader);
    }
  }, 100);
});

export function setupUserState() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const loginLink = document.getElementById("login-link");
  const userInfo = document.getElementById("user-info");
  const adminLink = document.getElementById("admin-link");

  // قائمة بريدية للأدمنين
  const adminEmails = ["kaleadsalous30@gmail.com", "coursehub03@gmail.com"];

  if (user) {
    // إخفاء رابط تسجيل الدخول
    if (loginLink) loginLink.style.display = "none";

    // إظهار صورة واسم المستخدم
    if (userInfo) {
      userInfo.style.display = "flex";
      userInfo.innerHTML = `
        <img src="${user.picture}" alt="${user.name}" class="user-pic">
        <span class="user-name">${user.name}</span>
        <div class="dropdown-menu">
          <a href="../profile.html">الملف الشخصي</a>
          <a href="../achievements.html">إنجازاتي</a>
          <a href="../my-courses.html">دوراتي</a>
          <a href="../settings.html">الإعدادات</a>
          <a href="#" id="logout-link">تسجيل الخروج</a>
        </div>
      `;

      // إدارة Dropdown المستخدم
      const dropdown = userInfo.querySelector(".dropdown-menu");
      const toggleDropdown = e => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
      };
      userInfo.querySelector(".user-pic").addEventListener("click", toggleDropdown);
      userInfo.querySelector(".user-name").addEventListener("click", toggleDropdown);
      document.addEventListener("click", () => { dropdown.style.display = "none"; });
      dropdown.addEventListener("click", e => e.stopPropagation());

      // تسجيل الخروج
      const logoutLink = document.getElementById("logout-link");
      if (logoutLink) {
        logoutLink.addEventListener("click", e => {
          e.preventDefault();
          localStorage.removeItem("coursehub_user");
          if (loginLink) loginLink.style.display = "block";
          if (userInfo) userInfo.style.display = "none";
          if (adminLink) adminLink.innerHTML = "";
          window.location.href = "login.html";
        });
      }
    }

    // إظهار رابط لوحة الإدارة للأدمن
    if (adminLink) {
      if (adminEmails.includes(user.email)) {
        adminLink.innerHTML = `<a href="/admin/dashboard.html" class="admin-btn">لوحة التحكم</a>`;
      } else {
        adminLink.innerHTML = "";
      }
    }

  } else {
    // حالة عدم تسجيل الدخول
    if (loginLink) loginLink.style.display = "block";
    if (userInfo) userInfo.style.display = "none";
    if (adminLink) adminLink.innerHTML = "";
  }
}
