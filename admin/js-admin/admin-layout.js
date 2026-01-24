// admin-layout.js
// ===============================
// تحميل Sidebar و Topbar لجميع صفحات الأدمن
// ===============================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
    const topbarPlaceholder = document.getElementById("topbar-placeholder");

    if (sidebarPlaceholder) {
      const sidebarHTML = await (await fetch("partials-admin/sidebar.html")).text();
      sidebarPlaceholder.innerHTML = sidebarHTML;
    }

    if (topbarPlaceholder) {
      const topbarHTML = await (await fetch("partials-admin/topbar.html")).text();
      topbarPlaceholder.innerHTML = topbarHTML;
    }

  } catch (err) {
    console.error("فشل تحميل Sidebar أو Topbar:", err);
  }
});

