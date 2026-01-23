// header.js - تحميل Header وفحص المستخدم
document.addEventListener("DOMContentLoaded", async () => {
  const headerPlaceholder = document.getElementById("header-placeholder");
  const footerPlaceholder = document.getElementById("footer-placeholder");

  // تأكد من وجود العناصر قبل التنفيذ
  if (!headerPlaceholder) console.warn("header-placeholder غير موجود");
  if (!footerPlaceholder) console.warn("footer-placeholder غير موجود");

  try {
    if (headerPlaceholder) {
      const headerHTML = await (await fetch("partials/header.html")).text();
      headerPlaceholder.innerHTML = headerHTML;
    }

    if (footerPlaceholder) {
      const footerHTML = await (await fetch("partials/footer.html")).text();
      footerPlaceholder.innerHTML = footerHTML;
    }

    // عرض حالة المستخدم بعد تحميل الهيدر
    setupUserState();

    // Search Bar يظهر فقط في index.html و courses.html
    const path = window.location.pathname.split("/").pop();
    const searchBar = headerPlaceholder?.querySelector("#headerSearchBar");
    if (searchBar) {
      searchBar.style.display = (path === "index.html" || path === "courses.html") ? "flex" : "none";
    }

  } catch (err) {
    console.error("فشل تحميل الهيدر أو الفوتر:", err);
  }
});

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
        <img src="${user.picture}" class="user-pic" alt="${user.name}">
        <span>${user.name}</span>
      `;
    }

    if (adminLink && user.role === "admin") {
      adminLink.innerHTML = `<a href="/admin/dashboard.html">لوحة التحكم</a>`;
    }
  }
}
