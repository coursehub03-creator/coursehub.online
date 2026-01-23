// main.js - تحميل CSS ووظائف عامة

// تحميل ملف CSS إذا لم يكن موجوداً مسبقاً
function loadCSS(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

// تحميل ملفات CSS الأساسية
loadCSS("css/header.css");
loadCSS("css/footer.css");
loadCSS("css/style.css");

// عند تحميل DOM، يمكن إضافة أي وظائف عامة أخرى هنا
document.addEventListener("DOMContentLoaded", () => {
  console.log("Main JS جاهز!");
});
