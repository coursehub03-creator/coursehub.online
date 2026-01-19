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

    setupUserDropdown();   // إعداد dropdown المستخدم
    setupHeaderSearch();   // إعداد شريط البحث فقط للصفحة الرئيسية والدورات
}

// --- إعداد dropdown المستخدم ---
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
                <a href="profile.html"><i class="fas fa-user"></i> الملف الشخصي</a>
                <a href="achievements.html"><i class="fas fa-trophy"></i> الإنجازات</a>
                <a href="my-courses.html"><i class="fas fa-book"></i> دوراتي</a>
                <a href="settings.html"><i class="fas fa-cog"></i> الإعدادات</a>
                <a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</a>
            </div>
        `;

        const dropdown = userContainer.querySelector(".dropdown-menu");
        const userPic = userContainer.querySelector(".user-pic");
        const userName = userContainer.querySelector(".user-name");

        // Toggle Dropdown المستخدم
        const toggleDropdown = (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        };
        userPic.addEventListener("click", toggleDropdown);
        userName.addEventListener("click", toggleDropdown);

        document.addEventListener("click", () => { dropdown.style.display = 'none'; });

        // Logout
        const logoutLink = document.getElementById("logout-link");
        if(logoutLink){
            logoutLink.addEventListener("click", (e)=>{
                e.preventDefault();
                localStorage.removeItem("coursehub_user");
                window.location.href = "login.html";
            });
        }
    } else {
        if(loginLink) loginLink.style.display = "block";
    }
}

// --- شريط البحث فقط للصفحة الرئيسية والدورات ---
function setupHeaderSearch() {
    const path = window.location.pathname.split("/").pop();
    if(path === "index.html" || path === "courses.html") {
        const headerContainer = document.querySelector("header .top-bar");
        if(headerContainer && !document.querySelector(".search-bar")) {
            const searchBar = document.createElement("div");
            searchBar.className = "search-bar container";
            searchBar.innerHTML = `
                <input type="text" id="searchInput" placeholder="ابحث عن دورة...">
                <button type="button" id="searchBtn"><i class="fa fa-search"></i> بحث</button>
            `;
            headerContainer.insertAdjacentElement("afterend", searchBar);

            document.getElementById("searchBtn").addEventListener("click", ()=>{
                const query = document.getElementById("searchInput").value;
                alert(`بحث عن: ${query}`);
            });
        }
    }
}

// --- تغيير اللغة ---
document.addEventListener("click", ()=>{
    const langBtn = document.getElementById("langBtn");
    if(langBtn){
        langBtn.addEventListener("click", ()=>{
            const current = langBtn.textContent.trim();
            if(current.includes('عربي')) langBtn.innerHTML='<i class="fa fa-globe"></i> English';
            else if(current.includes('English')) langBtn.innerHTML='<i class="fa fa-globe"></i> Français';
            else langBtn.innerHTML='<i class="fa fa-globe"></i> عربي';
        });
    }
});

// تشغيل التحميل
loadHeaderFooter();
