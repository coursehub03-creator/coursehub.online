// header.js - تحميل Header ديناميكياً وعرض حالة المستخدم
document.addEventListener("DOMContentLoaded", () => {
  const headerPlaceholder = document.getElementById("header-placeholder");
  if (!headerPlaceholder) return;

  headerPlaceholder.innerHTML = `
    <header>
      <div class="top-bar container">

        <!-- شعار الموقع -->
        <div class="site-name">
          <a href="index.html">CourseHub</a>
        </div>

        <!-- الروابط الرئيسية -->
        <nav>
          <a href="index.html">الرئيسية</a>
          <a href="courses.html">الدورات</a>
          <a href="tests.html">الاختبارات</a>
          <a href="certificates.html">الشهادات</a>
        </nav>

        <!-- Search Bar -->
        <div id="headerSearchBar" class="search-bar">
          <input type="text" id="searchInput" placeholder="ابحث عن دورة...">
          <button id="searchBtn"><i class="fa fa-search"></i></button>
        </div>

        <!-- User Info / Login -->
        <div id="user-info" class="user-info-container"></div>
        <a href="login.html" id="login-link">تسجيل الدخول</a>

        <!-- Language Toggle -->
        <button id="langBtn"><i class="fa fa-globe"></i> عربي</button>

      </div>
    </header>
  `;

  // إظهار Search Bar فقط في index.html و courses.html
  const path = window.location.pathname.split("/").pop();
  const searchBar = headerPlaceholder.querySelector("#headerSearchBar");
  if (searchBar) {
    if (path === "index.html" || path === "courses.html") {
      searchBar.style.display = "flex";
    } else {
      searchBar.style.display = "none";
    }
  }

  // بعد تحميل الهيدر، إعداد حالة المستخدم
  setupUserState();
});

// عرض اسم المستخدم وصورته إذا سجل الدخول
function setupUserState() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const loginLink = document.getElementById("login-link");
  const userInfo = document.getElementById("user-info");
  const adminLink = document.getElementById("admin-link");

  if (user) {
    if (loginLink) loginLink.style.display = "none";

    if (userInfo) {
      userInfo.style.display = "flex";
      userInfo.innerHTML = `
        <img src="${user.picture || 'assets/images/default-user.png'}" class="user-pic" alt="صورة المستخدم">
        <span>${user.name || 'مستخدم'}</span>
      `;
    }

    if (adminLink && user.role === "admin") {
      adminLink.innerHTML = `<a href="admin/dashboard.html">لوحة التحكم</a>`;
    }
  }
}
