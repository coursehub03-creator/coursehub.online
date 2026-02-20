// main.js - تحميل CSS، Header، Footer وإدارة حالة المستخدم

// تجاهل أخطاء إضافات المتصفح الخارجية التي لا تخص كود المنصة
window.addEventListener("unhandledrejection", (event) => {
  const reasonText = String(event?.reason?.message || event?.reason || "");
  if (
    reasonText.includes("Receiving end does not exist")
    || reasonText.includes("Could not establish connection")
    || reasonText.includes("The message port closed before a response was received")
  ) {
    event.preventDefault();
  }
});

// main.js - تحميل CSS، Header، Footer وإدارة حالة المستخدم

// تجاهل أخطاء إضافات المتصفح الخارجية التي لا تخص كود المنصة
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

// ✅ إضافة codex: تجاهل بعض أخطاء إضافات المتصفح (errors) أيضًا
window.addEventListener("error", (event) => {
  const message = String(event?.message || "");
  if (
    message.includes("Receiving end does not exist") ||
    message.includes("Could not establish connection")
  ) {
    event.preventDefault();
  }
});

// ===============================
// تحميل CSS ديناميكيًا إذا لم يكن موجودًا
// ===============================
function loadCSS(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

// تحميل CSS الأساسي
loadCSS("/css/header.css");
loadCSS("/css/footer.css");
loadCSS("/css/style.css");

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Main JS جاهز!");

  const headerPlaceholder = document.getElementById("header-placeholder");
  const footerPlaceholder = document.getElementById("footer-placeholder");

  try {
    if (headerPlaceholder) {
      const headerHTML = await (await fetch("/partials/header.html")).text();
      headerPlaceholder.innerHTML = headerHTML;
    }

    if (footerPlaceholder) {
      const footerHTML = await (await fetch("/partials/footer.html")).text();
      footerPlaceholder.innerHTML = footerHTML;

      const yearEl = footerPlaceholder.querySelector("#year");
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    }

    // ✅ إدارة حالة المستخدم + اللغة + المظهر + الإشعارات
    setupUserState();
    setupLanguageToggle();
    setupThemeToggle();
    setupNotifications();
    translationObserver.observe(document.body, { childList: true, subtree: true });

    // ✅ ميزة codex: مزامنة البروفايل مع Firestore
    syncUserProfile();

    // Search Bar يظهر فقط في index.html و courses.html
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

// ===============================
// مزامنة بيانات المستخدم إلى Firestore (ميزة codex)
// ===============================
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
    if (error?.code === "permission-denied") {
      console.info("تخطي مزامنة بروفايل المستخدم: لا توجد صلاحية Firestore في الحالة الحالية.");
      return;
    }
    console.warn("تعذر مزامنة بيانات المستخدم:", error);
  }
}

// ===============================
// بحث الهيدر
// ===============================
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
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  });
}

// ===============================
// إشعارات (LocalStorage + Firestore fallback)
// ===============================
const NOTIFICATION_KEY = "coursehub_notifications";
const notificationText = {
  ar: {
    emptyShort: "لا توجد إشعارات بعد.",
    emptyList: "لا توجد إشعارات جديدة حتى الآن.",
    open: "فتح الإشعار",
    count: (total) => `${total} إشعار`,
    read: "مقروء",
    unread: "غير مقروء"
  },
  en: {
    emptyShort: "No notifications yet.",
    emptyList: "No new notifications yet.",
    open: "Open notification",
    count: (total) => `${total} notifications`,
    read: "Read",
    unread: "Unread"
  }
};

function getStoredNotifications() {
  try {
    const data = JSON.parse(localStorage.getItem(NOTIFICATION_KEY));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("تعذر قراءة الإشعارات:", error);
    return [];
  }
}

function saveStoredNotifications(notifications) {
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
}

function formatNotificationTime(dateValue) {
  const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const locale = getCurrentLang() === "en" ? "en-US" : "ar-EG";
  return date.toLocaleString(locale, { hour12: true });
}

function getUserNotifications(userId) {
  return getStoredNotifications()
    .filter((item) => item.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function setupNotifications() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const userId = user?.uid;
  if (!userId) return;

  const notifBtn = document.getElementById("notifBtn");
  const notifBadge = document.getElementById("notifBadge");
  const notifMenu = document.getElementById("notificationMenu");
  const notifItems = document.getElementById("notificationItems");

  if (!notifBtn || !notifBadge || !notifMenu || !notifItems) return;

  loadNotifications(userId).then((notifications) => {
    const unreadCount = notifications.filter((item) => !item.read).length;
    const lang = getCurrentLang();

    notifBadge.textContent = unreadCount;
    notifBadge.style.display = unreadCount ? "inline-flex" : "none";

    if (!notifications.length) {
      notifItems.innerHTML = `<div class="notification-empty">${notificationText[lang].emptyShort}</div>`;
    } else {
      notifItems.innerHTML = notifications
        .slice(0, 5)
        .map(
          (item) => `
        <a class="notification-item ${item.read ? "" : "unread"}"
           href="${item.link}"
           data-id="${item.id}">
          <strong>${item.title}</strong>
          <span class="notification-message">${item.message}</span>
          <span class="notification-time">${formatNotificationTime(item.createdAt)}</span>
        </a>
      `
        )
        .join("");
    }
  });

  notifBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    notifMenu.classList.toggle("active");
  });

  notifMenu.addEventListener("click", (event) => {
    const target = event.target.closest(".notification-item");
    if (!target) return;
    const id = target.dataset.id;
    if (id) markNotificationRead(userId, id);
  });

  document.addEventListener("click", () => {
    notifMenu.classList.remove("active");
  });

  const listContainer = document.getElementById("notificationsList");
  if (listContainer) renderNotificationsPage(listContainer, userId);
}

function renderNotificationsPage(listContainer, userId) {
  const countEl = document.getElementById("notificationsCount");
  const markAllBtn = document.getElementById("markAllReadBtn");

  loadNotifications(userId).then((notifications) => {
    if (countEl) {
      const lang = getCurrentLang();
      countEl.textContent = notificationText[lang].count(notifications.length);
    }

    if (!notifications.length) {
      const lang = getCurrentLang();
      listContainer.innerHTML = `<div class="notification-empty-state">${notificationText[lang].emptyList}</div>`;
    } else {
      const lang = getCurrentLang();
      listContainer.innerHTML = notifications
        .map(
          (item) => `
        <div class="notification-card ${item.read ? "" : "unread"}">
          <h3>${item.title}</h3>
          <p>${item.message}</p>
          <div class="notification-meta">
            <span>${formatNotificationTime(item.createdAt)}</span>
            <span>${item.read ? notificationText[lang].read : notificationText[lang].unread}</span>
          </div>
          <a class="notification-action" href="${item.link}" data-id="${item.id}">
            ${notificationText[lang].open}
          </a>
        </div>
      `
        )
        .join("");
    }
  });

  if (markAllBtn) {
    markAllBtn.onclick = () =>
      markAllNotificationsRead(userId).then(() => renderNotificationsPage(listContainer, userId));
  }

  listContainer.onclick = (event) => {
    const actionLink = event.target.closest(".notification-action");
    if (!actionLink) return;
    const id = actionLink.dataset.id;
    if (id) markNotificationRead(userId, id);
  };
}

async function loadNotifications(userId) {
  try {
    const { db } = await import("/js/firebase-config.js");
    const { collection, getDocs, query, where, orderBy } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    if (error?.code === "permission-denied") {
      console.info("تم استخدام إشعارات localStorage لأن Firestore Rules منعت القراءة.");
      return getUserNotifications(userId);
    }
    console.error("تعذر تحميل الإشعارات من Firestore:", error);
    return getUserNotifications(userId);
  }
}

async function markNotificationRead(userId, notificationId) {
  try {
    const { db } = await import("/js/firebase-config.js");
    const { doc, updateDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
  } catch (error) {
    console.error("تعذر تحديث الإشعار:", error);
    const notifications = getUserNotifications(userId);
    const updated = notifications.map((item) =>
      item.id === notificationId ? { ...item, read: true } : item
    );
    saveStoredNotifications(updated);
  }
}

async function markAllNotificationsRead(userId) {
  try {
    const { db } = await import("/js/firebase-config.js");
    const { doc, updateDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );
    const notifications = await loadNotifications(userId);
    await Promise.all(
      notifications.map((item) => updateDoc(doc(db, "notifications", item.id), { read: true }))
    );
  } catch (error) {
    console.error("تعذر تحديث كل الإشعارات:", error);
    markAllNotificationsReadLocal(userId);
  }
}

function markAllNotificationsReadLocal(userId) {
  const notifications = getStoredNotifications();
  const updated = notifications.map((item) =>
    item.userId === userId ? { ...item, read: true } : item
  );
  saveStoredNotifications(updated);
}

// ===============================
// اللغة (i18n)
// ===============================
function getCurrentLang() {
  return localStorage.getItem("coursehub_lang") || "ar";
}

function setupLanguageToggle() {
  const langBtn = document.getElementById("langBtn");
  const currentLang = getCurrentLang();
  applyTranslations(currentLang);

  if (!langBtn) return;

  langBtn.addEventListener("click", () => {
    const nextLang = getCurrentLang() === "ar" ? "en" : "ar";
    localStorage.setItem("coursehub_lang", nextLang);
    applyTranslations(nextLang);
  });
}

function applyElementTranslations(el, lang) {
  if (el.closest("[data-i18n-skip='true']")) {
    return;
  }
  const textAr = el.dataset.i18nAr;
  const textEn = el.dataset.i18nEn;
  const htmlAr = el.dataset.i18nHtmlAr;
  const htmlEn = el.dataset.i18nHtmlEn;

  if (!textAr && !textEn && !htmlAr && !htmlEn && !el.dataset.i18n) {
    return;
  }

  if (!el.dataset.i18nAr && !el.dataset.i18nHtmlAr) {
    el.dataset.i18nAr = el.textContent?.trim() || "";
  }

  if (lang === "en") {
    if (htmlEn) {
      el.innerHTML = htmlEn;
    } else if (textEn) {
      el.textContent = textEn;
    }
  } else if (lang === "ar") {
    if (htmlAr) {
      el.innerHTML = htmlAr;
    } else if (textAr) {
      el.textContent = textAr;
    }
  }

  const placeholderAr = el.dataset.i18nPlaceholderAr;
  const placeholderEn = el.dataset.i18nPlaceholderEn;
  if (placeholderAr || placeholderEn) {
    if (!el.dataset.i18nPlaceholderAr && el.getAttribute("placeholder")) {
      el.dataset.i18nPlaceholderAr = el.getAttribute("placeholder");
    }
    if (lang === "en" && placeholderEn) {
      el.setAttribute("placeholder", placeholderEn);
    } else if (lang === "ar" && placeholderAr) {
      el.setAttribute("placeholder", placeholderAr);
    }
  }

  const ariaAr = el.dataset.i18nAriaLabelAr;
  const ariaEn = el.dataset.i18nAriaLabelEn;
  if (ariaAr || ariaEn) {
    if (!el.dataset.i18nAriaLabelAr && el.getAttribute("aria-label")) {
      el.dataset.i18nAriaLabelAr = el.getAttribute("aria-label");
    }
    if (lang === "en" && ariaEn) {
      el.setAttribute("aria-label", ariaEn);
    } else if (lang === "ar" && ariaAr) {
      el.setAttribute("aria-label", ariaAr);
    }
  }

  const titleAr = el.dataset.i18nTitleAr;
  const titleEn = el.dataset.i18nTitleEn;
  if (titleAr || titleEn) {
    if (!el.dataset.i18nTitleAr && el.getAttribute("title")) {
      el.dataset.i18nTitleAr = el.getAttribute("title");
    }
    if (lang === "en" && titleEn) {
      el.setAttribute("title", titleEn);
    } else if (lang === "ar" && titleAr) {
      el.setAttribute("title", titleAr);
    }
  }
}

function applyTranslations(lang) {
  const translations = {
    ar: {
      nav_home: "الرئيسية",
      nav_courses: "الدورات",
      nav_paths: "المسارات",
      lang: "عربي",
      theme: "المظهر"
    },
    en: {
      nav_home: "Home",
      nav_courses: "Courses",
      nav_paths: "Paths",
      lang: "English",
      theme: "Theme"
    }
  };

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (translations[lang]?.[key]) el.textContent = translations[lang][key];
  });

  document
    .querySelectorAll(
      "[data-i18n-en], [data-i18n-ar], [data-i18n-html-en], [data-i18n-html-ar], [data-i18n-placeholder-en], [data-i18n-placeholder-ar], [data-i18n-aria-label-en], [data-i18n-aria-label-ar], [data-i18n-title-en], [data-i18n-title-ar]"
    )
    .forEach((el) => applyElementTranslations(el, lang));

  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    const themeLabel = translations[lang]?.theme || "Theme";
    themeToggle.setAttribute("aria-label", themeLabel);
  }

  const currentTheme = localStorage.getItem("coursehub_theme") || "light";
  applyTheme(currentTheme);
}

const translationObserver = new MutationObserver((mutations) => {
  const lang = getCurrentLang();
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (
        node.matches(
          "[data-i18n-en], [data-i18n-ar], [data-i18n-html-en], [data-i18n-html-ar], [data-i18n-placeholder-en], [data-i18n-placeholder-ar], [data-i18n-aria-label-en], [data-i18n-aria-label-ar], [data-i18n-title-en], [data-i18n-title-ar], [data-i18n]"
        )
      ) {
        applyElementTranslations(node, lang);
      }
      node
        .querySelectorAll(
          "[data-i18n-en], [data-i18n-ar], [data-i18n-html-en], [data-i18n-html-ar], [data-i18n-placeholder-en], [data-i18n-placeholder-ar], [data-i18n-aria-label-en], [data-i18n-aria-label-ar], [data-i18n-title-en], [data-i18n-title-ar], [data-i18n]"
        )
        .forEach((el) => applyElementTranslations(el, lang));
    });
  });
});

function setupThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  const stored = localStorage.getItem("coursehub_theme") || "light";
  applyTheme(stored);

  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const current = localStorage.getItem("coursehub_theme") || "light";
    const next = current === "light" ? "dark" : "light";
    localStorage.setItem("coursehub_theme", next);
    applyTheme(next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;
  const lang = localStorage.getItem("coursehub_lang") || "ar";
  const label =
    theme === "dark"
      ? lang === "ar"
        ? "فاتح"
        : "Light"
      : lang === "ar"
        ? "داكن"
        : "Dark";
  const icon = theme === "dark" ? "fa-sun" : "fa-moon";
  toggle.innerHTML = `<i class="fa ${icon}"></i> ${label}`;
}

// ===============================
// إدارة حالة المستخدم
// ===============================
function setupUserState() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const loginLink = document.getElementById("login-link");
  const userInfo = document.getElementById("user-info");
  const adminLink = document.getElementById("admin-link");

  const adminEmails = ["kaleadsalous30@gmail.com", "coursehub03@gmail.com"];

  if (user) {
    if (loginLink) loginLink.style.display = "none";

    if (userInfo) {
      userInfo.style.display = "flex";
      const instructorLink = user.role === "instructor"
        ? `<a href="/instructor-dashboard.html">لوحة الأستاذ</a>`
        : "";
      userInfo.innerHTML = `
        <img src="${(user.picture || "/assets/images/admin-avatar.png") || ""}" class="user-pic" alt="${user.name || ""}">
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
      const toggleDropdown = (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
      };

      userInfo.querySelector(".user-pic")?.addEventListener("click", toggleDropdown);
      userInfo.querySelector(".user-name")?.addEventListener("click", toggleDropdown);

      document.addEventListener("click", () => {
        dropdown.style.display = "none";
      });
      dropdown.addEventListener("click", (e) => e.stopPropagation());

      const logoutLink = document.getElementById("logout-link");
      if (logoutLink) {
        logoutLink.addEventListener("click", (e) => {
          e.preventDefault();
          localStorage.removeItem("coursehub_user");

          if (document.getElementById("header-placeholder")) {
            fetch("/partials/header.html")
              .then((res) => res.text())
              .then((html) => {
                document.getElementById("header-placeholder").innerHTML = html;
                setupUserState();
                setupLanguageToggle();
                setupNotifications();
              });
          }
        });
      }
    }

    if (adminLink) {
      if (adminEmails.includes(user.email)) {
        adminLink.innerHTML = `<a href="/admin/dashboard.html" class="admin-btn">لوحة التحكم</a>`;
      } else {
        adminLink.innerHTML = "";
      }
    }
  } else {
    if (loginLink) loginLink.style.display = "block";
    if (userInfo) userInfo.style.display = "none";
    if (adminLink) adminLink.innerHTML = "";
  }
}
