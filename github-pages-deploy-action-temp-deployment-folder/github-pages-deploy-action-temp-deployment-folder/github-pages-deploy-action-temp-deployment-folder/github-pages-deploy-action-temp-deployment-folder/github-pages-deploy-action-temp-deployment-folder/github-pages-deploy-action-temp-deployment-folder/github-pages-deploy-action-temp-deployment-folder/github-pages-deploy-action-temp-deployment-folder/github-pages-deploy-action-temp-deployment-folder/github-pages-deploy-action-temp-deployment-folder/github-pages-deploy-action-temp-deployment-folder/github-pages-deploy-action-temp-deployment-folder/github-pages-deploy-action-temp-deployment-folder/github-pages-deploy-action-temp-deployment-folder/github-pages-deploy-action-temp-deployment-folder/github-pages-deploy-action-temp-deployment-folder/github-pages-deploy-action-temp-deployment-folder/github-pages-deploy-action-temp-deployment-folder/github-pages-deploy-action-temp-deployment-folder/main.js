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

    setupUserDropdown(); // إعداد dropdown المستخدم
    setupHeaderSearch(); // إعداد شريط البحث فقط للصفحة الرئيسية والدورات
}

// --- إعداد المستخدم بعد تسجيل الدخول ---
function setupUserDropdown() {
    const user = JSON.parse(localStorage.getItem("coursehub_user"));
    const userInfoContainer = document.getElementById("user-info");
    const loginLink = document.getElementById("login-link");

    if(user && userInfoContainer){
        if(loginLink) loginLink.style.display = "none";

        userInfoContainer.classList.add("header-user-wrapper");

        userInfoContainer.innerHTML += `
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

        const dropdown = userInfoContainer.querySelector(".dropdown-menu");
        const userPic = userInfoContainer.querySelector(".user-pic");
        const userName = userInfoContainer.querySelector(".user-name");

        const toggleDropdown = (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        };
        userPic.addEventListener("click", toggleDropdown);
        userName.addEventListener("click", toggleDropdown);

        document.addEventListener("click", () => {
            dropdown.style.display = 'none';
        });

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

        const searchBtn = document.getElementById("searchBtn");
        searchBtn.addEventListener("click", ()=>{
            const query = document.getElementById("searchInput").value;
            alert(`بحث عن: ${query}`);
        });
    }
}

// تشغيل التحميل
loadHeaderFooter();
