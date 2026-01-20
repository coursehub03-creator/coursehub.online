// ===============================
// main.js - تحميل Header و Footer + وظائف
// ===============================

// ===============================
// تحميل CSS مرة واحدة فقط
// ===============================
function loadCSS(href) {
    if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
    }
}

// ===============================
// تحميل Header و Footer من ملفات خارجية
// ===============================
async function loadHeaderFooter() {

    // ===== Header =====
    try {
        const headerResponse = await fetch("header.html");
        const headerHTML = await headerResponse.text();
        document.body.insertAdjacentHTML("afterbegin", headerHTML);
        loadCSS("header.css");
    } catch (err) {
        console.error("فشل تحميل الهيدر:", err);
    }

    // ===== Footer =====
    try {
        const footerResponse = await fetch("footer.html");
        const footerHTML = await footerResponse.text();
        document.body.insertAdjacentHTML("beforeend", footerHTML);
        loadCSS("footer.css");
    } catch (err) {
        console.error("فشل تحميل الفوتر:", err);
    }

    // إعدادات بعد التحميل
    setupUserState();
    setupHeaderSearch();
    setupLanguageToggle();
}

// ===============================
// إدارة حالة المستخدم (تسجيل دخول / خروج)
// ===============================
function setupUserState() {
    const user = JSON.parse(localStorage.getItem("coursehub_user"));
    const userContainer = document.getElementById("user-info");
    const loginLink = document.getElementById("login-link");

    if (user && userContainer) {
        if (loginLink) loginLink.style.display = "none";

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
        userContainer.style.display = "flex";

        const dropdown = userContainer.querySelector(".dropdown-menu");
        const toggleDropdown = e => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
        };

        userContainer.querySelector(".user-pic").addEventListener("click", toggleDropdown);
        userContainer.querySelector(".user-name").addEventListener("click", toggleDropdown);

        document.addEventListener("click", () => {
            dropdown.style.display = "none";
        });

        dropdown.addEventListener("click", e => e.stopPropagation());

        const logoutLink = document.getElementById("logout-link");
        if (logoutLink) {
            logoutLink.addEventListener("click", e => {
                e.preventDefault();
                localStorage.removeItem("coursehub_user");
                if (loginLink) loginLink.style.display = "block";
                userContainer.style.display = "none";
                window.location.href = "login.html";
            });
        }

    } else {
        if (loginLink) loginLink.style.display = "block";
        if (userContainer) userContainer.style.display = "none";
    }
}

// ===============================
// شريط البحث (ظهور فقط في index.html و courses.html)
// ===============================
function setupHeaderSearch() {
    const path = window.location.pathname.split("/").pop();
    const searchBar = document.getElementById("headerSearchBar");

    if (!searchBar) return;

    if (path === "" || path === "index.html" || path === "courses.html") {
        searchBar.style.display = "flex";

        const searchBtn = document.getElementById("searchBtn");
        if (searchBtn) {
            searchBtn.addEventListener("click", () => {
                const query = document.getElementById("searchInput").value.trim();
                if (query) alert(`بحث عن: ${query}`);
            });
        }

    } else {
        searchBar.style.display = "none";
    }
}

// ===============================
// تبديل اللغة
// ===============================
function setupLanguageToggle() {
    const langBtn = document.getElementById("langBtn");
    if (!langBtn) return;

    langBtn.addEventListener("click", e => {
        e.stopPropagation();
        const text = langBtn.textContent.trim();

        if (text.includes("عربي")) langBtn.innerHTML = '<i class="fa fa-globe"></i> English';
        else if (text.includes("English")) langBtn.innerHTML = '<i class="fa fa-globe"></i> Français';
        else langBtn.innerHTML = '<i class="fa fa-globe"></i> عربي';
    });
}

// ===============================
// تشغيل كل شيء بعد تحميل DOM
// ===============================
document.addEventListener("DOMContentLoaded", loadHeaderFooter);
