// --- تحميل Header و Footer ---
async function loadHeaderFooter() {
    // Header
    const headerResponse = await fetch('header.html');
    const headerHTML = await headerResponse.text();
    document.body.insertAdjacentHTML('afterbegin', headerHTML);

    // Footer
    const footerResponse = await fetch('footer.html');
    const footerHTML = await footerResponse.text();
    document.body.insertAdjacentHTML('beforeend', footerHTML);

    setupUserDropdown();
    setupHeaderSearch(); // شريط البحث
}

// --- إعداد المستخدم بعد تسجيل الدخول ---
function setupUserDropdown() {
    const user = JSON.parse(localStorage.getItem("coursehub_user"));
    const userInfoContainer = document.getElementById("user-info");
    const loginLink = document.getElementById("login-link");

    if(user && userInfoContainer){
        if(loginLink) loginLink.style.display = "none";

        userInfoContainer.innerHTML = `
            <div class="header-user-wrapper">
                <div class="notifications">
                    <i class="fas fa-bell"></i>
                    <span class="notif-count">3</span>
                </div>

                <div class="language-selector">
                    <i class="fas fa-globe"></i>
                    <span>عربي</span>
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
                    <a href="achievements.html"><i class="fas fa-trophy"></i> الإنجازات</a>
                    <a href="my-courses.html"><i class="fas fa-book"></i> دوراتي</a>
                    <a href="settings.html"><i class="fas fa-cog"></i> الإعدادات</a>
                    <a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</a>
                </div>
            </div>
        `;

        const userWrapper = userInfoContainer.querySelector(".header-user-wrapper");
        const dropdown = userWrapper.querySelector(".dropdown-menu");
        const userPic = userWrapper.querySelector(".user-pic");
        const userName = userWrapper.querySelector(".user-name");

        // Toggle Dropdown المستخدم
        const toggleDropdown = (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        };
        userPic.addEventListener("click", toggleDropdown);
        userName.addEventListener("click", toggleDropdown);

        // إخفاء عند النقر خارج
        document.addEventListener("click", () => {
            dropdown.style.display = 'none';
        });

        // Logout
        const logoutLink = document.getElementById("logout-link");
        if(logoutLink){
            logoutLink.addEventListener("click", (e)=>{
                e.preventDefault();
                localStorage.removeItem("coursehub_user");
                window.location.href = "login.html";
            });
        }

        // Dropdown اللغة
        const langSelector = userWrapper.querySelector(".language-selector");
        const langDropdown = userWrapper.querySelector(".language-dropdown");

        langSelector.addEventListener("click", (e)=>{
            e.stopPropagation();
            langSelector.classList.toggle("active");
        });

        document.querySelectorAll(".language-dropdown div").forEach(el=>{
            el.addEventListener("click", ()=>{
                const selected = el.dataset.lang;
                langSelector.querySelector("span").textContent = el.textContent;
                langSelector.classList.remove("active");
                console.log(`تم اختيار اللغة: ${selected}`);
            });
        });

        // إغلاق dropdown اللغة عند النقر خارجها
        document.addEventListener("click", ()=>{
            langSelector.classList.remove("active");
        });
    } else {
        if(loginLink) loginLink.style.display = "block";
    }
}

// --- إضافة شريط البحث فقط للصفحة الرئيسية وصفحة الدورات ---
function setupHeaderSearch() {
    const path = window.location.pathname.split("/").pop();
    const headerContainer = document.querySelector("header .top-bar");
    const existingSearch = document.querySelector(".search-bar");
    if(existingSearch) existingSearch.remove(); // إزالة أي بحث موجود

    if(path === "index.html" || path === "courses.html") {
        const searchBar = document.createElement("div");
        searchBar.className = "search-bar container";
        searchBar.innerHTML = `
            <input type="text" id="searchInput" placeholder="ابحث عن دورة...">
            <button type="button" id="searchBtn"><i class="fa fa-search"></i> بحث</button>
        `;
        headerContainer.insertAdjacentElement("afterend", searchBar);

        // زر البحث
        const searchBtn = document.getElementById("searchBtn");
        searchBtn.addEventListener("click", ()=>{
            const query = document.getElementById("searchInput").value;
            alert(`بحث عن: ${query}`);
        });
    }
}

// تشغيل التحميل
loadHeaderFooter();
