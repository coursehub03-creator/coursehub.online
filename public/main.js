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
// تحميل Header و Footer
// ===============================
async function loadHeaderFooter() {

    // ===== Header =====
    const headerResponse = await fetch("header.html");
    const headerHTML = await headerResponse.text();
    document.body.insertAdjacentHTML("afterbegin", headerHTML);
    loadCSS("header.css");

    // ===== Footer =====
    const footerResponse = await fetch("footer.html");
    const footerHTML = await footerResponse.text();
    document.body.insertAdjacentHTML("beforeend", footerHTML);
    loadCSS("footer.css");

    // إعدادات بعد التحميل
    setupUserDropdown();
    setupHeaderSearch();
    setupLanguageSwitcher();
}

// ===============================
// إعداد dropdown المستخدم
// ===============================
function setupUserDropdown() {
    const user = JSON.parse(localStorage.getItem("coursehub_user"));
    const userContainer = document.getElementById("user-info");
    const loginLink = document.getElementById("login-link");

    if (user && userContainer) {
        if (loginLink) loginLink.style.display = "none";

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
        const toggle = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("show");
        };

        userContainer.querySelector(".user-pic").addEventListener("click", toggle);
        userContainer.querySelector(".user-name").addEventListener("click", toggle);

        document.addEventListener("click", () => dropdown.classList.remove("show"));

        document.getElementById("logout-link").addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("coursehub_user");
            window.location.href = "login.html";
        });

    } else {
        if (loginLink) loginLink.style.display = "block";
    }
}

// ===============================
// شريط البحث (فقط الرئيسية + الدورات)
// ===============================
function setupHeaderSearch() {
    const page = window.location.pathname.split("/").pop();

    if (page === "" || page === "index.html" || page === "courses.html") {
        if (!document.querySelector(".search-bar")) {
            const header = document.querySelector("header");
            const searchBar = document.createElement("div");

            searchBar.className = "search-bar container";
            searchBar.innerHTML = `
                <input type="text" id="searchInput" placeholder="ابحث عن دورة...">
                <button id="searchBtn"><i class="fa fa-search"></i></button>
            `;

            header.insertAdjacentElement("afterend", searchBar);

            document.getElementById("searchBtn").addEventListener("click", () => {
                const q = document.getElementById("searchInput").value.trim();
                if (q) alert(`بحث عن: ${q}`);
            });
        }
    }
}

// ===============================
// تغيير اللغة
// ===============================
function setupLanguageSwitcher() {
    const langBtn = document.getElementById("langBtn");
    if (!langBtn) return;

    langBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = langBtn.textContent;

        if (text.includes("عربي")) {
            langBtn.innerHTML = `<i class="fa fa-globe"></i> English`;
        } else if (text.includes("English")) {
            langBtn.innerHTML = `<i class="fa fa-globe"></i> Français`;
        } else {
            langBtn.innerHTML = `<i class="fa fa-globe"></i> عربي`;
        }
    });
}

// ===============================
// تشغيل
// ===============================
document.addEventListener("DOMContentLoaded", loadHeaderFooter);
