// تحميل CSS إذا لم يكن موجوداً مسبقاً
function loadCSS(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

// تحميل الهيدر والفوتر ديناميكياً
async function loadHeaderFooter() {
  try {
    const headerHTML = await (await fetch("partials/header.html")).text();
    const headerPlaceholder = document.getElementById("header-placeholder");
    if (headerPlaceholder) headerPlaceholder.innerHTML = headerHTML;

    const footerHTML = await (await fetch("partials/footer.html")).text();
    const footerPlaceholder = document.getElementById("footer-placeholder");
    if (footerPlaceholder) footerPlaceholder.innerHTML = footerHTML;

    // بعد تحميل الهيدر والفوتر، إعداد حالة المستخدم
    setupUserState();

    // بعد تحميل الهيدر، ضبط Search Bar حسب الصفحة
    const path = window.location.pathname.split("/").pop();
    const searchBar = headerPlaceholder.querySelector("#headerSearchBar");
    if (searchBar) {
      if (path === "index.html" || path === "courses.html") {
        searchBar.style.display = "flex";
      } else {
        searchBar.style.display = "none";
      }
    }
  } catch (err) {
    console.error("فشل تحميل الهيدر أو الفوتر:", err);
  }
}

// إعداد حالة المستخدم بعد تحميل الصفحة
function setupUserState() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const loginLink = document.getElementById("login-link");
  const userInfo = document.getElementById("user-info");
  const adminLink = document.getElementById("admin-link");

  if (user) {
    if (loginLink) loginLink.style.display = "none";
    if (userInfo) {
      userInfo.style.display = "flex";
      userInfo.innerHTML = `
        <img src="${user.picture || ''}" class="user-pic" alt="صورة المستخدم">
        <span>${user.name || 'مستخدم'}</span>
      `;
    }

    if (adminLink && user.role === "admin") {
      adminLink.innerHTML = `<a href="admin/dashboard.html">لوحة التحكم</a>`;
    }
  }
}

// عند تحميل DOM
document.addEventListener("DOMContentLoaded", async () => {
  await loadHeaderFooter();
});
