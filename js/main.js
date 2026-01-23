// main.js - تحميل CSS وميزات عامة
function loadCSS(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

// تحميل CSS الأساسي
loadCSS("css/header.css");
loadCSS("css/footer.css");
loadCSS("css/style.css");

document.addEventListener("DOMContentLoaded", () => {
  console.log("Main JS جاهز!");
});
