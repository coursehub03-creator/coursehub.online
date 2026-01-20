document.addEventListener("DOMContentLoaded", () => {
  const headerPlaceholder = document.getElementById("header-placeholder");
  if(!headerPlaceholder) return;

  headerPlaceholder.innerHTML = `
    <header class="main-header">
      <div class="container header-container">
        <!-- شعار الموقع -->
        <div class="logo">
          <a href="index.html">CourseHub</a>
        </div>

        <!-- القائمة الرئيسية -->
        <nav class="main-nav">
          <ul>
            <li><a href="index.html">الرئيسية</a></li>
            <li><a href="courses.html">الدورات</a></li>
            <li><a href="tests.html">الاختبارات</a></li>
            <li><a href="certificates.html">الشهادات</a></li>
          </ul>
        </nav>

        <!-- شريط البحث -->
        <div id="headerSearchBar" class="header-search">
          <input type="text" id="searchInput" placeholder="ابحث عن دورة...">
          <button id="searchBtn"><i class="fa fa-search"></i></button>
        </div>

        <!-- معلومات المستخدم وزر تسجيل الدخول -->
        <div id="user-info" class="user-info"></div>
        <a href="login.html" id="login-link" class="login-btn">تسجيل الدخول</a>

        <!-- زر تغيير اللغة -->
        <button id="langBtn" class="lang-btn"><i class="fa fa-globe"></i> عربي</button>
      </div>
    </header>
  `;

  // عرض أو إخفاء Search Bar حسب الصفحة
  const path = window.location.pathname.split("/").pop();
  const searchBar = document.getElementById("headerSearchBar");
  if(path === "index.html" || path === "courses.html") {
    searchBar.style.display = "flex";
  } else {
    searchBar.style.display = "none";
  }
});
