// header.js - تحميل Header ديناميكياً وعرض حالة المستخدم
document.addEventListener("DOMContentLoaded", async () => {
  const headerPlaceholder = document.getElementById("header-placeholder");
  const footerPlaceholder = document.getElementById("footer-placeholder");
  if (!headerPlaceholder || !footerPlaceholder) return;

  try {
    // تحميل الهيدر والفوتر من partials
    const headerHTML = await (await fetch("partials/header.html")).text();
    headerPlaceholder.innerHTML = headerHTML;

    const footerHTML = await (await fetch("partials/footer.html")).text();
    footerPlaceholder.innerHTML = footerHTML;

    // بعد تحميل الهيدر، إعداد حالة المستخدم
    setupUserState();

    // Search Bar يظهر فقط في index و courses
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
});

function setupUserState() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  const loginLink = document.getElementById("login-link");
  const userInfo = document.getElementById("user-info");

  if (user) {
    if (loginLink) loginLink.style.display = "none";

    if (userInfo) {
      userInfo.style.display = "flex";
      userInfo.innerHTML = `
        <img src="${user.picture}" class="user-pic" alt="صورة المستخدم">
        <span>${user.name}</span>
      `;
    }
  }
}
