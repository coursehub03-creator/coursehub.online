// --- تحميل Header + إعداد الوظائف ---
document.addEventListener("DOMContentLoaded", () => {
  setupUserDropdown();
  setupHeaderSearch();
  setupLanguageToggle();
});

// --- User Dropdown ---
function setupUserDropdown() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const userContainer = document.getElementById("user-info");
  const loginLink = document.getElementById("login-link");

  if(user && userContainer){
    if(loginLink) loginLink.style.display = "none";

    userContainer.innerHTML = `
      <img src="${user.picture}" alt="${user.name}" class="user-pic">
      <span class="user-name">${user.name}</span>
      <div class="dropdown-menu">
          <a href="profile.html">الملف الشخصي</a>
          <a href="achievements.html">إنجازاتي</a>
          <a href="my-courses.html">دوراتي</a>
          <a href="settings.html">الإعدادات</a>
          <a href="#" id="logout-link">تسجيل الخروج</a>
      </div>
    `;

    const dropdown = userContainer.querySelector(".dropdown-menu");
    const userPic = userContainer.querySelector(".user-pic");
    const userName = userContainer.querySelector(".user-name");

    const toggleDropdown = e => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
    userPic.addEventListener("click", toggleDropdown);
    userName.addEventListener("click", toggleDropdown);

    document.addEventListener("click", () => dropdown.style.display = 'none');

    const logoutLink = document.getElementById("logout-link");
    if(logoutLink){
      logoutLink.addEventListener("click", e => {
        e.preventDefault();
        localStorage.removeItem("coursehub_user");
        window.location.href = "login.html";
      });
    }
  } else {
    if(loginLink) loginLink.style.display = "block";
  }
}

// --- Language Toggle ---
function setupLanguageToggle() {
  const langBtn = document.getElementById("langBtn");
  langBtn.addEventListener("click", () => {
    const current = langBtn.textContent.trim();
    if(current.includes("عربي")) langBtn.innerHTML = '<i class="fa fa-globe"></i> English';
    else if(current.includes("English")) langBtn.innerHTML = '<i class="fa fa-globe"></i> Français';
    else langBtn.innerHTML = '<i class="fa fa-globe"></i> عربي';
  });
}

// --- Search Bar (ظهور فقط في index و courses) ---
function setupHeaderSearch() {
  const path = window.location.pathname.split("/").pop();
  const searchBar = document.getElementById("headerSearchBar");
  if(path === "index.html" || path === "courses.html") {
    searchBar.style.display = "flex";

    const searchBtn = document.getElementById("searchBtn");
    searchBtn.addEventListener("click", () => {
      const query = document.getElementById("searchInput").value.trim();
      if(query) alert(`بحث عن: ${query}`);
    });
  } else {
    searchBar.style.display = "none";
  }
}
