// main.js - تحميل CSS، Header، Footer وإدارة حالة المستخدم

/* ===== Ignore Extension Errors ===== */
window.addEventListener("unhandledrejection", (event) => {
  const reasonText = String(event?.reason?.message || event?.reason || "");
  if (
    reasonText.includes("Receiving end does not exist") ||
    reasonText.includes("Could not establish connection") ||
    reasonText.includes("The message port closed before a response was received")
  ) {
    event.preventDefault();
  }
});

window.addEventListener("error", (event) => {
  const message = String(event?.message || "");
  if (
    message.includes("Receiving end does not exist") ||
    message.includes("Could not establish connection")
  ) {
    event.preventDefault();
  }
});

/* ===== Load CSS ===== */
function loadCSS(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

loadCSS("/css/header.css");
loadCSS("/css/footer.css");
loadCSS("/css/style.css");

async function performLogout(redirectTo = "/") {
  try {
    const [{ auth }, authMod] = await Promise.all([
      import("/js/firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js")
    ]);
    await authMod.signOut(auth);
  } catch (error) {
    console.warn("تعذر تسجيل الخروج من Firebase، سيتم إنهاء الجلسة محليًا.", error);
  } finally {
    try {
      localStorage.removeItem("coursehub_user");
      localStorage.removeItem("coursehub_user_meta");
      sessionStorage.removeItem("coursehub_user");
      sessionStorage.removeItem("coursehub_user_meta");
    } catch (storageError) {
      console.warn("تعذر تنظيف بيانات الجلسة محليًا.", storageError);
    }
    window.location.replace(redirectTo);
  }
}

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", async () => {
  const headerPlaceholder = document.getElementById("header-placeholder");
  const footerPlaceholder = document.getElementById("footer-placeholder");

  try {
    if (headerPlaceholder) {
      headerPlaceholder.innerHTML = await (await fetch("/partials/header.html")).text();
    }

    if (footerPlaceholder) {
      footerPlaceholder.innerHTML = await (await fetch("/partials/footer.html")).text();
      const yearEl = footerPlaceholder.querySelector("#year");
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    }

    setupUserState();
    setupLanguageToggle();
    setupThemeToggle();
    setupNotifications();

    translationObserver.observe(document.body, { childList: true, subtree: true });

    syncUserProfile();

    const path = window.location.pathname.split("/").pop();
    const searchBar = headerPlaceholder?.querySelector("#headerSearchBar");
    if (searchBar) {
      searchBar.style.display =
        path === "index.html" || path === "courses.html" ? "flex" : "none";
    }

    setupHeaderSearch();
  } catch (err) {
    console.error("فشل تحميل الهيدر أو الفوتر:", err);
  }
});

/* ===== Sync Profile ===== */
async function syncUserProfile() {
  const storedUser = JSON.parse(localStorage.getItem("coursehub_user"));
  if (!storedUser?.uid) return;

  try {
    const { auth, db } = await import("/js/firebase-config.js");
    const { doc, setDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const currentUid = auth.currentUser?.uid;
    if (!currentUid || currentUid !== storedUser.uid) return;

    const normalizedRole =
      storedUser.role === "user" ? "student" : storedUser.role || "student";

    await setDoc(
      doc(db, "users", storedUser.uid),
      {
        uid: storedUser.uid,
        name: storedUser.name || storedUser.email?.split("@")[0] || "",
        email: storedUser.email || "",
        picture: storedUser.picture || "",
        role: normalizedRole,
        status: "active",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error) {
    if (error?.code === "permission-denied") return;
    console.warn("تعذر مزامنة المستخدم:", error);
  }
}

/* ===== Header Search ===== */
function setupHeaderSearch() {
  const path = window.location.pathname.split("/").pop();
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");

  if (!searchInput || !searchBtn) return;

  const handleSearch = () => {
    const query = searchInput.value.trim();
    if (!query) return;

    if (path === "" || path === "index.html") {
      window.location.href = `/courses.html?search=${encodeURIComponent(query)}`;
    }
  };

  searchBtn.addEventListener("click", handleSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  });
}

/* ===== Role UI ===== */
function applyRoleBasedUI(user) {
  const role = user?.role === "user" ? "student" : (user?.role || "guest");
  document.querySelectorAll("[data-role-only]").forEach((el) => {
    const required = el.getAttribute("data-role-only");
    el.style.display = role === required ? "" : "none";
  });
}

/* ===== User State ===== */
function setupUserState() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const loginLink = document.getElementById("login-link");
  const userInfo = document.getElementById("user-info");
  const adminLink = document.getElementById("admin-link");

  const adminEmails = [
    "kaleadsalous30@gmail.com",
    "coursehub03@gmail.com"
  ];

  if (user) {
    if (loginLink) loginLink.style.display = "none";

    if (userInfo) {
      userInfo.style.display = "flex";

      const instructorLink =
        user.role === "instructor"
          ? `<a href="/instructor-dashboard.html">لوحة الأستاذ</a>`
          : "";

      userInfo.innerHTML = `
        <img src="${user.picture || "/assets/images/admin-avatar.png"}" class="user-pic">
        <span class="user-name">${user.name || ""}</span>
        <div class="dropdown-menu">
          <a href="/profile.html">الملف الشخصي</a>
          <a href="/achievements.html">إنجازاتي</a>
          <a href="/my-courses.html">دوراتي</a>
          ${instructorLink}
          <a href="/settings.html">الإعدادات</a>
          <a href="#" id="logout-link">تسجيل الخروج</a>
        </div>
      `;

      const dropdown = userInfo.querySelector(".dropdown-menu");

      const toggle = (e) => {
        e.stopPropagation();
        dropdown.style.display =
          dropdown.style.display === "block" ? "none" : "block";
      };

      userInfo.querySelector(".user-pic")?.addEventListener("click", toggle);
      userInfo.querySelector(".user-name")?.addEventListener("click", toggle);

      document.addEventListener("click", () => (dropdown.style.display = "none"));

      const logout = document.getElementById("logout-link");
      if (logout) {
        logout.onclick = async (e) => {
          e.preventDefault();
          logout.setAttribute("aria-busy", "true");
          logout.style.pointerEvents = "none";
          await performLogout("/");
        };
      }
    }

    applyRoleBasedUI(user);

    if (adminLink) {
      const isAdmin =
        user.role === "admin" ||
        adminEmails.includes(String(user.email || "").toLowerCase());

      adminLink.innerHTML = isAdmin
        ? `<a href="/admin/dashboard.html" class="admin-btn">لوحة التحكم</a>`
        : "";
    }
  } else {
    applyRoleBasedUI(null);
    if (loginLink) loginLink.style.display = "block";
    if (userInfo) userInfo.style.display = "none";
    if (adminLink) adminLink.innerHTML = "";
  }
}

/* ===== Language / Theme / Notifications (Safe defaults) ===== */
let isApplyingTranslations = false;
let translationQueued = false;

const translationObserver = new MutationObserver((mutations) => {
  if (isApplyingTranslations || translationQueued) return;

  const shouldTranslate = mutations.some((mutation) => {
    if (mutation.type !== "childList") return false;
    return [...mutation.addedNodes].some((node) => {
      if (!(node instanceof Element)) return false;
      return (
        node.matches?.("[data-i18n-en], [data-i18n-placeholder-en], [data-i18n-aria-label-en]") ||
        node.querySelector?.("[data-i18n-en], [data-i18n-placeholder-en], [data-i18n-aria-label-en]")
      );
    });
  });

  if (!shouldTranslate) return;

  translationQueued = true;
  queueMicrotask(() => {
    translationQueued = false;
    const lang = localStorage.getItem("coursehub_lang") || "ar";
    applyTranslations(lang);
  });
});

function applyTranslations(lang) {
  isApplyingTranslations = true;
  try {
    const isEnglish = lang === "en";
    document.documentElement.lang = isEnglish ? "en" : "ar";
    document.documentElement.dir = isEnglish ? "ltr" : "rtl";

    document.querySelectorAll("[data-i18n-en]").forEach((el) => {
      if (el.hasAttribute("data-i18n-skip")) return;
      const arText = el.dataset.i18nAr || el.textContent;
      if (!el.dataset.i18nAr) el.dataset.i18nAr = arText;
      el.textContent = isEnglish ? el.dataset.i18nEn : el.dataset.i18nAr;
    });

    document.querySelectorAll("[data-i18n-placeholder-en]").forEach((el) => {
      const arPlaceholder = el.dataset.i18nPlaceholderAr || el.getAttribute("placeholder") || "";
      if (!el.dataset.i18nPlaceholderAr) el.dataset.i18nPlaceholderAr = arPlaceholder;
      el.setAttribute(
        "placeholder",
        isEnglish ? el.dataset.i18nPlaceholderEn : el.dataset.i18nPlaceholderAr
      );
    });

    document.querySelectorAll("[data-i18n-aria-label-en]").forEach((el) => {
      const arLabel = el.dataset.i18nAriaLabelAr || el.getAttribute("aria-label") || "";
      if (!el.dataset.i18nAriaLabelAr) el.dataset.i18nAriaLabelAr = arLabel;
      el.setAttribute(
        "aria-label",
        isEnglish ? el.dataset.i18nAriaLabelEn : el.dataset.i18nAriaLabelAr
      );
    });
  } finally {
    isApplyingTranslations = false;
  }
}

function setupLanguageToggle() {
  const btn = document.getElementById("langBtn");
  if (!btn) return;

  const currentLang = localStorage.getItem("coursehub_lang") || "ar";
  applyTranslations(currentLang);
  btn.innerHTML = currentLang === "en" ? '<i class="fa fa-globe"></i> English' : '<i class="fa fa-globe"></i> عربي';

  btn.addEventListener("click", () => {
    const nextLang = (localStorage.getItem("coursehub_lang") || "ar") === "ar" ? "en" : "ar";
    localStorage.setItem("coursehub_lang", nextLang);
    applyTranslations(nextLang);
    btn.innerHTML = nextLang === "en" ? '<i class="fa fa-globe"></i> English' : '<i class="fa fa-globe"></i> عربي';
  });
}

function setupThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  const applyTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("coursehub_theme", theme);
  };

  applyTheme(localStorage.getItem("coursehub_theme") || "light");

  btn.addEventListener("click", () => {
    const current = localStorage.getItem("coursehub_theme") || "light";
    applyTheme(current === "light" ? "dark" : "light");
  });
}

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function setupNotifications() {
  const btn = document.getElementById("notifBtn");
  const menu = document.getElementById("notificationMenu");
  const items = document.getElementById("notificationItems");
  const badge = document.getElementById("notifBadge");

  if (!btn || !menu) return;

  const notifications = JSON.parse(localStorage.getItem("coursehub_notifications") || "[]");

  if (items) {
    if (!notifications.length) {
      items.innerHTML = "<div class='notification-empty'>لا توجد إشعارات جديدة</div>";
    } else {
      items.innerHTML = notifications
        .slice(0, 5)
        .map((n) => `<div class='notification-item'>${escapeHtml(n?.text || "")}</div>`)
        .join("");
    }
  }

  if (badge) badge.textContent = String(notifications.length || 0);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
    menu.style.display = menu.classList.contains("open") ? "block" : "none";
  });

  document.addEventListener("click", () => {
    menu.classList.remove("open");
    menu.style.display = "none";
  });
}
