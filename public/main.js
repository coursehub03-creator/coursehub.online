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
    // Header
    try {
        const headerResponse = await fetch("header.html");
        const headerHTML = await headerResponse.text();
        document.body.insertAdjacentHTML("afterbegin", headerHTML);
        loadCSS("header.css");
    } catch (err) { console.error("فشل تحميل الهيدر:", err); }

    // Footer
    try {
        const footerResponse = await fetch("footer.html");
        const footerHTML = await footerResponse.text();
        document.body.insertAdjacentHTML("beforeend", footerHTML);
        loadCSS("footer.css");
    } catch (err) { console.error("فشل تحميل الفوتر:", err); }

    // إعدادات بعد التحميل
    setupUserState();
    setupHeaderSearch();
    setupLanguageToggle();
}

// ===============================
// إدارة حالة المستخدم بدون innerHTML
// ===============================
function setupUserState() {
    const user = JSON.parse(localStorage.getItem("coursehub_user"));
    const userContainer = document.getElementById("user-info");
    const loginLink = document.getElementById("login-link");

    if (!userContainer) return;

    if (user) {
        if (loginLink) loginLink.style.display = "none";
        userContainer.textContent = ""; // إزالة أي محتوى سابق
        userContainer.style.display = "flex";

        // صورة المستخدم
        const img = document.createElement("img");
        img.src = user.picture;
        img.alt = user.name;
        img.className = "user-pic";

        // اسم المستخدم
        const spanName = document.createElement("span");
        spanName.className = "user-name";
        spanName.textContent = user.name;

        // قائمة dropdown
        const dropdown = document.createElement("div");
        dropdown.className = "dropdown-menu";

        const links = [
            { href: "profile.html", text: "الملف الشخصي" },
            { href: "achievements.html", text: "إنجازاتي" },
            { href: "my-courses.html", text: "دوراتي" },
            { href: "settings.html", text: "الإعدادات" },
            { href: "#", text: "تسجيل الخروج", id: "logout-link" }
        ];

        links.forEach(linkData => {
            const a = document.createElement("a");
            a.href = linkData.href;
            a.textContent = linkData.text;
            if (linkData.id) a.id = linkData.id;
            dropdown.appendChild(a);
        });

        // إضافة العناصر للحاوية
        userContainer.appendChild(img);
        userContainer.appendChild(spanName);
        userContainer.appendChild(dropdown);

        // toggle القائمة
        const toggleDropdown = e => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
        };
        img.addEventListener("click", toggleDropdown);
        spanName.addEventListener("click", toggleDropdown);

        // إغلاق القائمة عند الضغط خارجها
        document.addEventListener("click", () => { dropdown.style.display = "none"; });
        dropdown.addEventListener("click", e => e.stopPropagation());

        // زر تسجيل الخروج
        const logoutLinkEl = document.getElementById("logout-link");
        if (logoutLinkEl) {
            logoutLinkEl.addEventListener("click", e => {
                e.preventDefault();
                localStorage.removeItem("coursehub_user");
                if (loginLink) loginLink.style.display = "block";
                userContainer.style.display = "none";
                window.location.href = "login.html";
            });
        }

    } else {
        if (loginLink) loginLink.style.display = "block";
        userContainer.style.display = "none";
    }
}

// ===============================
// شريط البحث
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
        if (text.includes("عربي")) langBtn.textContent = "English";
        else if (text.includes("English")) langBtn.textContent = "Français";
        else langBtn.textContent = "عربي";
    });
}

// ===============================
// تشغيل كل شيء بعد تحميل DOM
// ===============================
document.addEventListener("DOMContentLoaded", loadHeaderFooter);
