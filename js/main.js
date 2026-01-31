// main.js - تحميل CSS، Header، Footer وإدارة حالة المستخدم

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

  // ===============================
  // تحميل Header و Footer ديناميكيًا
  // ===============================
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

      // تحديث سنة الحقوق تلقائيًا
      const yearEl = footerPlaceholder.querySelector("#year");
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    }

    // ===============================
    // إدارة حالة المستخدم في Header
    // ===============================
    setupUserState();
    setupLanguageToggle();
    setupNotifications();
    syncUserProfile();

    // Search Bar يظهر فقط في index.html و courses.html
    const path = window.location.pathname.split("/").pop();
    const searchBar = headerPlaceholder?.querySelector("#headerSearchBar");
    if (searchBar) {
      searchBar.style.display = (path === "index.html" || path === "courses.html") ? "flex" : "none";
    }

    setupHeaderSearch();

  } catch (err) {
    console.error("فشل تحميل الهيدر أو الفوتر:", err);
  }
});

async function syncUserProfile() {
  const storedUser = JSON.parse(localStorage.getItem("coursehub_user"));
  if (!storedUser?.uid) return;

  try {
    const { db } = await import("/js/firebase-config.js");
    const { doc, setDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const normalizedRole = storedUser.role === "user" ? "student" : storedUser.role || "student";

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
    console.warn("تعذر مزامنة بيانات المستخدم:", error);
  }
}

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
// إشعارات داخلية (LocalStorage)
// ===============================
const NOTIFICATION_KEY = "coursehub_notifications";

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
  return date.toLocaleString("ar-EG", { hour12: true });
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

    notifBadge.textContent = unreadCount;
    notifBadge.style.display = unreadCount ? "inline-flex" : "none";

    if (!notifications.length) {
      notifItems.innerHTML = `<div class="notification-empty">لا توجد إشعارات بعد.</div>`;
    } else {
      notifItems.innerHTML = notifications.slice(0, 5).map((item) => `
        <a class="notification-item ${item.read ? "" : "unread"}"
           href="${item.link}"
           data-id="${item.id}">
          <strong>${item.title}</strong>
          <span class="notification-message">${item.message}</span>
          <span class="notification-time">${formatNotificationTime(item.createdAt)}</span>
        </a>
      `).join("");
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
    if (id) {
      markNotificationRead(userId, id);
    }
  });

  document.addEventListener("click", () => {
    notifMenu.classList.remove("active");
  });

  const listContainer = document.getElementById("notificationsList");
  if (listContainer) {
    renderNotificationsPage(listContainer, userId);
  }
}

function renderNotificationsPage(listContainer, userId) {
  const countEl = document.getElementById("notificationsCount");
  const markAllBtn = document.getElementById("markAllReadBtn");

  loadNotifications(userId).then((notifications) => {
    if (countEl) {
      countEl.textContent = `${notifications.length} إشعار`;
    }

    if (!notifications.length) {
      listContainer.innerHTML = `<div class="notification-empty-state">لا توجد إشعارات جديدة حتى الآن.</div>`;
    } else {
      listContainer.innerHTML = notifications.map((item) => `
        <div class="notification-card ${item.read ? "" : "unread"}">
          <h3>${item.title}</h3>
          <p>${item.message}</p>
          <div class="notification-meta">
            <span>${formatNotificationTime(item.createdAt)}</span>
            <span>${item.read ? "مقروء" : "غير مقروء"}</span>
          </div>
          <a class="notification-action" href="${item.link}" data-id="${item.id}">
            فتح الإشعار
          </a>
        </div>
      `).join("");
    }
  });

  if (markAllBtn) {
    markAllBtn.onclick = () => {
      markAllNotificationsRead(userId).then(() => {
        renderNotificationsPage(listContainer, userId);
      });
    };
  }

  listContainer.onclick = (event) => {
    const actionLink = event.target.closest(".notification-action");
    if (!actionLink) return;
    const id = actionLink.dataset.id;
    if (id) {
      markNotificationRead(userId, id);
    }
  };
}

async function loadNotifications(userId) {
  try {
    const { db } = await import("/js/firebase-config.js");
    const {
      collection,
      getDocs,
      query,
      where,
      orderBy
    } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error("تعذر تحميل الإشعارات من Firestore:", error);
    return getUserNotifications(userId);
  }
}

async function markNotificationRead(userId, notificationId) {
  try {
    const { db } = await import("/js/firebase-config.js");
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
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
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
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

function setupLanguageToggle() {
  const langBtn = document.getElementById("langBtn");
  if (!langBtn) return;

  const currentLang = localStorage.getItem("coursehub_lang") || "ar";
  applyTranslations(currentLang);

  langBtn.addEventListener("click", () => {
    const nextLang = (localStorage.getItem("coursehub_lang") || "ar") === "ar" ? "en" : "ar";
    localStorage.setItem("coursehub_lang", nextLang);
    applyTranslations(nextLang);
  });
}

function applyTranslations(lang) {
  const translations = {
    ar: {
      nav_home: "الرئيسية",
      nav_courses: "الدورات",
      nav_tests: "الاختبارات",
      nav_achievements: "إنجازاتي",
      nav_paths: "المسارات",
      lang: "عربي"
    },
    en: {
      nav_home: "Home",
      nav_courses: "Courses",
      nav_tests: "Tests",
      nav_achievements: "Achievements",
      nav_paths: "Paths",
      lang: "English"
    }
  };

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (translations[lang]?.[key]) {
      el.textContent = translations[lang][key];
    }
  });

  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
}

// ===============================
// إدارة حالة المستخدم (مشترك مع header.js)
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
      userInfo.innerHTML = `
        <img src="${user.picture}" class="user-pic" alt="${user.name}">
        <span class="user-name">${user.name}</span>
        <div class="dropdown-menu">
          <a href="/profile.html">الملف الشخصي</a>
          <a href="/achievements.html">إنجازاتي</a>
          <a href="/my-courses.html">دوراتي</a>
          <a href="/settings.html">الإعدادات</a>
          <a href="#" id="logout-link">تسجيل الخروج</a>
        </div>
      `;

      const dropdown = userInfo.querySelector(".dropdown-menu");
      const toggleDropdown = e => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
      };

      userInfo.querySelector(".user-pic").addEventListener("click", toggleDropdown);
      userInfo.querySelector(".user-name").addEventListener("click", toggleDropdown);
      document.addEventListener("click", () => { dropdown.style.display = "none"; });
      dropdown.addEventListener("click", e => e.stopPropagation());

      // ===============================
      // تسجيل الخروج (تحديث جميع الصفحات فورًا)
      // ===============================
      const logoutLink = document.getElementById("logout-link");
      if (logoutLink) {
        logoutLink.addEventListener("click", e => {
          e.preventDefault();
          localStorage.removeItem("coursehub_user");

          // إعادة تحميل الهيدر فقط
          if (document.getElementById("header-placeholder")) {
            fetch("/partials/header.html")
              .then(res => res.text())
              .then(html => {
                document.getElementById("header-placeholder").innerHTML = html;
                setupUserState(); // إعادة تهيئة الهيدر بعد تسجيل الخروج
              });
          }

          // إذا أردت، يمكن إعادة توجيه المستخدم لصفحة تسجيل الدخول
          // window.location.href = "/login.html";
        });
      }
    }

    // رابط الإدارة للأدمن
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
