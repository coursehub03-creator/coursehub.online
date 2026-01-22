// js/main.js

function loadCSS(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

async function loadHeaderFooter() {
  try {
    // تحميل الهيدر
    const headerHTML = await (await fetch("partials/header.html")).text();
    const headerEl = document.getElementById("header-placeholder");
    if (headerEl) headerEl.innerHTML = headerHTML;

    // تحميل الفوتر
    const footerHTML = await (await fetch("partials/footer.html")).text();
    const footerEl = document.getElementById("footer-placeholder");
    if (footerEl) footerEl.innerHTML = footerHTML;

  } catch (err) {
    console.error("فشل تحميل الهيدر أو الفوتر:", err);
  }
}

/* ===== حالة المستخدم ===== */
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
        <img src="${user.picture}" class="user-pic">
        <span>${user.name}</span>
      `;
    }
    if (adminLink && user.role === "admin") {
      adminLink.innerHTML = `<a href="admin/dashboard.html">لوحة التحكم</a>`;
    }
  }
}

/* ===== تنفيذ بعد تحميل DOM ===== */
document.addEventListener("DOMContentLoaded", async () => {
  await loadHeaderFooter();
  setupUserState();
});
