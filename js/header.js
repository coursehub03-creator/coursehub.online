// header.js - تحميل Header والفوتر وإظهار حالة المستخدم
document.addEventListener("DOMContentLoaded", async () => {
  const headerPlaceholder = document.getElementById("header-placeholder");
  const footerPlaceholder = document.getElementById("footer-placeholder");

  if (!headerPlaceholder) console.warn("header-placeholder غير موجود");
  if (!footerPlaceholder) console.warn("footer-placeholder غير موجود");

  try {
    // تحميل الهيدر والفوتر من partials
    if (headerPlaceholder) {
      const headerHTML = await (await fetch("/partials/header.html")).text();
      headerPlaceholder.innerHTML = headerHTML;
    }

    if (footerPlaceholder) {
      const footerHTML = await (await fetch("/partials/footer.html")).text();
      footerPlaceholder.innerHTML = footerHTML;
    }

    // عرض حالة المستخدم بعد تحميل الهيدر
    setupUserState();

    // إظهار Search Bar فقط في index.html و courses.html
    const path = window.location.pathname.split("/").pop();
    const searchBar = headerPlaceholder?.querySelector("#headerSearchBar");
    if (searchBar) {
      searchBar.style.display = (path === "index.html" || path === "courses.html") ? "flex" : "none";
    }

  } catch (err) {
    console.error("فشل تحميل الهيدر أو الفوتر:", err);
  }
});

// ===============================
// إدارة حالة المستخدم في الهيدر والفوتر
// ===============================
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

    // عرض معلومات المستخدم في الهيدر
    if (userInfo) {
      userInfo.style.display = "flex";
      userInfo.innerHTML = `
        <img src="${(user.picture || "/assets/images/admin-avatar.png")}" class="user-pic" alt="${user.name}">
        <span class="user-name">${user.name}</span>
        <div class="dropdown-menu">
            <a href="/profile.html">الملف الشخصي</a>
            <a href="/achievements.html">إنجازاتي</a>
            <a href="/my-courses.html">دوراتي</a>
            <a href="/settings.html">الإعدادات</a>
            <a href="#" id="logout-link">تسجيل الخروج</a>
        </div>
      `;

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
          userInfo.style.display = "none";
          if (adminLink) adminLink.innerHTML = "";
          window.location.href = "/login.html";
        });
      }
    }

    // عرض رابط الإدارة فقط للأدمنين
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
