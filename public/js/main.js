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
    const headerHTML = await (await fetch("./partials/header.html")).text();
    document.getElementById("header-placeholder").innerHTML = headerHTML;

    const footerHTML = await (await fetch("./partials/footer.html")).text();
    document.getElementById("footer-placeholder").innerHTML = footerHTML;
  } catch (err) {
    console.error("فشل تحميل الهيدر أو الفوتر:", err);
  }
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
