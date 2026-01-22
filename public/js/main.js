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
    const header = await fetch("./partials/header.html");
    document.getElementById("header-placeholder").innerHTML =
      await header.text();
    loadCSS("css/header.css");
  } catch (e) {
    console.error("Header error", e);
  }

  try {
    const footer = await fetch("./partials/footer.html");
    document.getElementById("footer-placeholder").innerHTML =
      await footer.text();
    loadCSS("css/footer.css");
  } catch (e) {
    console.error("Footer error", e);
  }

  setupUserState();
}

/* ===== User State ===== */
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

document.addEventListener("DOMContentLoaded", loadHeaderFooter);
