document.addEventListener("DOMContentLoaded", () => {
  const headerPlaceholder = document.getElementById("header-placeholder");
  if(!headerPlaceholder) return;

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

  // Search Bar يظهر فقط في index و courses
  const path = window.location.pathname.split("/").pop();
  const searchBar = document.getElementById("headerSearchBar");
  if(path === "index.html" || path === "courses.html") {
    searchBar.style.display = "flex";
  } else {
    searchBar.style.display = "none";
  }
});
