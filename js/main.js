// main.js - تحميل CSS، Header، Footer وإدارة حالة المستخدم

// ===============================
// تحميل CSS ديناميكيًا إذا لم يكن موجودًا
// ===============================
function loadCSS(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

// تحميل CSS الأساسي
loadCSS("/css/header.css");
loadCSS("/css/footer.css");
loadCSS("/css/style.css");

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Main JS جاهز!");

  // ===============================
  // تحميل Header و Footer ديناميكيًا
  // ===============================
  const headerPlaceholder = document.getElementById("header-placeholder");
  const footerPlaceholder = document.getElementById("footer-placeholder");

  try {
    if (headerPlaceholder) {
      const headerHTML = await (await fetch("/partials/header.html")).text();
      headerPlaceholder.innerHTML = headerHTML;
    }

    if (footerPlaceholder) {
      const footerHTML = await (await fetch("/partials/footer.html")).text();
      footerPlaceholder.innerHTML = footerHTML;

      // تحديث سنة الحقوق تلقائيًا
      const yearEl = footerPlaceholder.querySelector("#year");
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    }

    // ===============================
    // إدارة حالة المستخدم في Header
    // ===============================
    setupUserState();

    // Search Bar يظهر فقط في index.html و courses.html
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
// إدارة حالة المستخدم (مشترك مع header.js)
// ===============================
function setupUserState() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const loginLink = document.getElementById("login-link");
  const userInfo = document.getElementById("user-info");
  const adminLink = document.getElementById("admin-link");

  const adminEmails = ["kaleadsalous30@gmail.com", "coursehub03@gmail.com"];

  if (user) {
    if (loginLink) loginLink.style.display = "none";

    if (userInfo) {
      userInfo.style.display = "flex";
      userInfo.innerHTML = `
        <img src="${user.picture}" class="user-pic" alt="${user.name}">
        <span class="user-name">${user.name}</span>
        <div class="dropdown-menu">
          <a href="profile.html">الملف الشخصي</a>
          <a href="achievements.html">إنجازاتي</a>
          <a href="my-courses.html">دوراتي</a>
          <a href="settings.html">الإعدادات</a>
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
          window.location.href = "login.html";
        });
      }
    }

    // رابط الإدارة للأدمن
    if (adminLink) {
      if (adminEmails.includes(user.email)) {
        adminLink.innerHTML = `<a href="admin/dashboard.html" class="admin-btn">لوحة التحكم</a>`;
      } else {
        adminLink.innerHTML = "";
      }
    }

  } else {
    if (loginLink) loginLink.style.display = "block";
    if (userInfo) userInfo.style.display = "none";
    if (adminLink) adminLink.innerHTML = "";
  }
}
