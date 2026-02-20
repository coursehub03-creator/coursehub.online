import { db } from "/js/firebase-config.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// admin-layout.js
// =====================================
// تحميل Sidebar و Topbar لجميع صفحات الأدمن
// + إطلاق حدث بعد اكتمال التحميل
// =====================================


function setupAdminChatNavBadge() {
  const badge = document.getElementById("adminChatNavBadge");
  if (!badge) return;

  onSnapshot(collection(db, "instructorMessages"), (snap) => {
    const unreadCount = snap.docs
      .map((docSnap) => docSnap.data())
      .filter((msg) => msg.senderRole === "instructor" && !msg.readByAdmin).length;

    badge.hidden = unreadCount === 0;
    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  });
}

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

    const currentPath = window.location.pathname.split("/").pop();
    const sidebarLinks = document.querySelectorAll(".sidebar-menu a");
    sidebarLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === currentPath);
    });

    const sidebarToggle = document.getElementById("sidebar-toggle");
    if (sidebarToggle) {
      const storedState = localStorage.getItem("admin_sidebar_collapsed");
      if (storedState === "true") {
        document.querySelector(".admin-layout")?.classList.add("collapsed");
      }

      sidebarToggle.addEventListener("click", () => {
        const layout = document.querySelector(".admin-layout");
        if (!layout) return;
        layout.classList.toggle("collapsed");
        localStorage.setItem("admin_sidebar_collapsed", layout.classList.contains("collapsed"));
      });
    }

    const adminSearchInput = document.getElementById("adminSearchInput");
    const adminSearchBtn = document.getElementById("adminSearchBtn");
    const emitAdminSearch = () => {
      const query = adminSearchInput?.value || "";
      document.dispatchEvent(new CustomEvent("adminSearch", { detail: { query } }));
    };

    adminSearchInput?.addEventListener("input", emitAdminSearch);
    adminSearchBtn?.addEventListener("click", emitAdminSearch);
    adminSearchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        emitAdminSearch();
      }
    });

    setupAdminChatNavBadge();

    // إطلاق حدث مخصص لباقي ملفات الأدمن
    document.dispatchEvent(new Event("adminLayoutLoaded"));

  } catch (err) {
    console.error("❌ فشل تحميل Layout الأدمن:", err);
  }
});
