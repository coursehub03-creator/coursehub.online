// main.js - تحميل CSS, Header/Footer, وإعداد حالة المستخدم

// تحميل ملف CSS إذا لم يكن موجوداً مسبقاً
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
  setupUserState();
});
