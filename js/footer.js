// footer.js - تحميل Footer وإدارة الحقوق
document.addEventListener("DOMContentLoaded", async () => {
  const footerPlaceholder = document.getElementById("footer-placeholder");

  if (!footerPlaceholder) console.warn("footer-placeholder غير موجود");

  try {
    if (footerPlaceholder) {
      const footerHTML = await (await fetch("partials/footer.html")).text();
      footerPlaceholder.innerHTML = footerHTML;
    }

    // تحديث سنة الحقوق تلقائيًا
    const yearEl = footerPlaceholder.querySelector("#year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

  } catch (err) {
    console.error("فشل تحميل الفوتر:", err);
  }
});
