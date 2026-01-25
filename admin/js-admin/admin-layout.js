// admin-layout.js
// =====================================
// تحميل Sidebar و Topbar لجميع صفحات الأدمن
// + إطلاق حدث بعد اكتمال التحميل
// =====================================

document.addEventListener("DOMContentLoaded", async () => {
  const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
  const topbarPlaceholder = document.getElementById("topbar-placeholder");

  try {
    const loadPromises = [];

    // تحميل Sidebar
    if (sidebarPlaceholder) {
      loadPromises.push(
        fetch("/admin/partials-admin/sidebar.html")
          .then(res => {
            if (!res.ok) throw new Error("فشل تحميل sidebar");
            return res.text();
          })
          .then(html => {
            sidebarPlaceholder.innerHTML = html;
          })
      );
    }

    // تحميل Topbar
    if (topbarPlaceholder) {
      loadPromises.push(
        fetch("/admin/partials-admin/topbar.html")
          .then(res => {
            if (!res.ok) throw new Error("فشل تحميل topbar");
            return res.text();
          })
          .then(html => {
            topbarPlaceholder.innerHTML = html;
          })
      );
    }

    // انتظار تحميل الكل
    await Promise.all(loadPromises);

    // إطلاق حدث مخصص لباقي ملفات الأدمن
    document.dispatchEvent(new Event("adminLayoutLoaded"));

  } catch (err) {
    console.error("❌ فشل تحميل Layout الأدمن:", err);
  }
});
