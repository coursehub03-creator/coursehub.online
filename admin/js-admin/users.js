import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  const tbody = document.getElementById("users-list");
  const roleFilter = document.getElementById("user-role-filter");
  const statusFilter = document.getElementById("user-status-filter");
  const searchInput = document.getElementById("user-search");

  if (!tbody) return;

  let allUsers = [];

  const renderUsers = (users) => {
    tbody.innerHTML = "";
    if (!users.length) {
      tbody.innerHTML = "<tr><td colspan='4'>لا يوجد مستخدمون بعد.</td></tr>";
      return;
    }

    users.forEach((user) => {
      const displayName =
        user.name ||
        user.displayName ||
        user.fullName ||
        user.email?.split("@")[0] ||
        user.id ||
        "-";
      const roleLabel = (user.role || "student") === "user" ? "student" : user.role || "student";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${displayName}</td>
        <td>${user.email || "-"}</td>
        <td>${roleLabel}</td>
        <td><span class="badge neutral">${user.status || "active"}</span></td>
      `;
      tbody.appendChild(tr);
    });
  };

  const applyFilters = () => {
    const role = roleFilter?.value || "all";
    const status = statusFilter?.value || "all";
    const query = searchInput?.value.toLowerCase().trim() || "";

    const filtered = allUsers.filter((user) => {
      const normalizedRole = (user.role || "student") === "user" ? "student" : user.role || "student";
      const roleMatch = role === "all" || normalizedRole === role;
      const statusMatch = status === "all" || (user.status || "active") === status;
      const normalizedName = (user.name || user.displayName || user.fullName || "").toLowerCase();
      const normalizedEmail = (user.email || "").toLowerCase();
      const normalizedUid = (user.uid || user.id || "").toLowerCase();
      const searchMatch =
        !query ||
        normalizedName.includes(query) ||
        normalizedEmail.includes(query) ||
        normalizedUid.includes(query);
      return roleMatch && statusMatch && searchMatch;
    });

    renderUsers(filtered);
  };

  try {
    const snapshot = await getDocs(collection(db, "users"));
    allUsers = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    applyFilters();
  } catch (error) {
    console.error("خطأ في تحميل المستخدمين:", error);
    tbody.innerHTML = "<tr><td colspan='4'>حدث خطأ أثناء التحميل.</td></tr>";
  }

  roleFilter?.addEventListener("change", applyFilters);
  statusFilter?.addEventListener("change", applyFilters);
  searchInput?.addEventListener("input", applyFilters);

  document.addEventListener("adminSearch", (event) => {
    if (!searchInput) return;
    searchInput.value = event.detail?.query || "";
    applyFilters();
  });
});
