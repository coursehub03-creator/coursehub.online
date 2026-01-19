// التحقق من تسجيل الدخول
const user = JSON.parse(localStorage.getItem("coursehub_user"));

const userInfoContainer = document.getElementById("user-info");
const loginLink = document.getElementById("login-link");

if(user){
  loginLink.style.display = "none";

  userInfoContainer.innerHTML = `
    <div class="notification">
      <i class="fas fa-bell"></i>
      <span class="badge">3</span>
    </div>

    <div class="language-selector">
      <i class="fas fa-globe"></i> <span>عربي</span>
      <div class="language-dropdown">
        <div data-lang="ar">العربية</div>
        <div data-lang="fr">Français</div>
        <div data-lang="en">English</div>
      </div>
    </div>

    <img src="${user.picture}" alt="${user.name}" class="user-pic">
    <span class="user-name">${user.name}</span>

    <div class="dropdown-menu">
      <a href="profile.html"><i class="fas fa-user"></i> الملف الشخصي</a>
      <a href="#"><i class="fas fa-trophy"></i> الإنجازات</a>
      <a href="#"><i class="fas fa-book"></i> دوراتي</a>
      <a href="#"><i class="fas fa-cog"></i> الإعدادات</a>
      <a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</a>
    </div>
  `;

  // Dropdown المستخدم
  const userDropdown = userInfoContainer.querySelector(".dropdown-menu");
  const userPic = userInfoContainer.querySelector(".user-pic");
  const userName = userInfoContainer.querySelector(".user-name");

  const toggleDropdown = () => userInfoContainer.classList.toggle("active");

  userPic.addEventListener("click", toggleDropdown);
  userName.addEventListener("click", toggleDropdown);

  // إخفاء عند النقر خارج
  document.addEventListener("click", (e) => {
    if(!userInfoContainer.contains(e.target)){
      userInfoContainer.classList.remove("active");
    }
  });

  // Logout
  document.getElementById("logout-link").addEventListener("click", () => {
    localStorage.removeItem("coursehub_user");
    window.location.href="login.html";
  });

  // Dropdown اللغة
  const langSelector = userInfoContainer.querySelector(".language-selector");
  const langDropdown = userInfoContainer.querySelector(".language-dropdown");

  langSelector.addEventListener("click", (e) => {
    e.stopPropagation(); // منع غلق dropdown
    langSelector.classList.toggle("active");
  });

  document.querySelectorAll(".language-dropdown div").forEach(el => {
    el.addEventListener("click", () => {
      const selected = el.dataset.lang;
      alert(`تم اختيار اللغة: ${selected}`);
      langSelector.querySelector("span").textContent = el.textContent;
      langSelector.classList.remove("active");
    });
  });

  document.addEventListener("click", () => {
    langSelector.classList.remove("active");
  });

} else {
  loginLink.style.display = "block";
}
