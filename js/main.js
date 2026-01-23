// main.js - تحميل CSS وميزات عامة + تحميل الهيدر والفوتر
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

// تحميل الهيدر والفوتر وإظهار حالة المستخدم
document.addEventListener("DOMContentLoaded", async () => {
  const headerPlaceholder = document.getElementById("header-placeholder");
  const footerPlaceholder = document.getElementById("footer-placeholder");

  if (!headerPlaceholder) console.warn("header-placeholder غير موجود");
  if (!footerPlaceholder) console.warn("footer-placeholder غير موجود");

  try {
    if (headerPlaceholder) {
      const headerHTML = await (await fetch("/partials/header.html")).text();
      headerPlaceholder.innerHTML = headerHTML;
    }

    if (footerPlaceholder) {
      const footerHTML = await (await fetch("/partials/footer.html")).text();
      footerPlaceholder.innerHTML = footerHTML;
    }

    // بعد تحميل الهيدر والفوتر، استدعاء setupUserState
    if (typeof setupUserState === "function") setupUserState();

    // إظهار Search Bar فقط في index.html و courses.html
    const path = window.location.pathname.split("/").pop();
    const searchBar = headerPlaceholder?.querySelector("#headerSearchBar");
    if (searchBar) {
      searchBar.style.display = (path === "index.html" || path === "courses.html") ? "flex" : "none";
    }

  } catch (err) {
    console.error("فشل تحميل الهيدر أو الفوتر:", err);
  }

  console.log("Main JS جاهز!");
});
