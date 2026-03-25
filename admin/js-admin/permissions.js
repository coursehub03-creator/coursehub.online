import { auth, db } from "/js/firebase-config.js";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { protectAdmin } from "./admin-guard.js";

let all = [];
document.addEventListener("adminLayoutLoaded", init);

async function init() {
  await protectAdmin();
  document.getElementById("permissionsSearch")?.addEventListener("input", render);
  document.getElementById("permissionsRoleFilter")?.addEventListener("change", render);
  document.getElementById("permissionsStatusFilter")?.addEventListener("change", render);
  await loadUsers();
}

async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}

function formatDate(value) {
  if (!value) return "-";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function render() {
  const q = (document.getElementById("permissionsSearch")?.value || "").toLowerCase().trim();
  const roleFilter = document.getElementById("permissionsRoleFilter")?.value || "all";
  const statusFilter = document.getElementById("permissionsStatusFilter")?.value || "all";
  const rows = document.getElementById("permissionsRows");

  const list = all.filter((u) => {
    const name = String(u.name || u.displayName || u.fullName || "").toLowerCase();
    const email = String(u.email || "").toLowerCase();
    const role = normRole(u.role);
    const status = u.status || "active";

    const searchMatch = !q || name.includes(q) || email.includes(q);
    const roleMatch = roleFilter === "all" || role === roleFilter;
    const statusMatch = statusFilter === "all" || status === statusFilter;
    return searchMatch && roleMatch && statusMatch;
  });

  if (!list.length) {
    rows.innerHTML = "<tr><td colspan='6'>لا توجد نتائج.</td></tr>";
    return;
  }

  rows.innerHTML = list.map((u) => {
    const isCurrent = auth.currentUser?.uid && (u.uid === auth.currentUser.uid || u.id === auth.currentUser.uid);
    return `
      <tr data-id="${u.id}">
        <td>${u.name || u.displayName || u.fullName || "-"}${isCurrent ? " <span class='badge primary'>أنت</span>" : ""}</td>
        <td>${u.email || "-"}</td>
        <td>
          <select data-role ${isCurrent ? "disabled" : ""}>
            <option value="student" ${normRole(u.role) === "student" ? "selected" : ""}>student</option>
            <option value="instructor" ${normRole(u.role) === "instructor" ? "selected" : ""}>instructor</option>
            <option value="admin" ${normRole(u.role) === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td>
          <select data-status>
            <option value="active" ${(u.status || "active") === "active" ? "selected" : ""}>active</option>
            <option value="pending" ${(u.status || "") === "pending" ? "selected" : ""}>pending</option>
            <option value="pending_verification" ${(u.status || "") === "pending_verification" ? "selected" : ""}>pending_verification</option>
            <option value="blocked" ${(u.status || "") === "blocked" ? "selected" : ""}>blocked</option>
            <option value="rejected" ${(u.status || "") === "rejected" ? "selected" : ""}>rejected</option>
          </select>
        </td>
        <td>${formatDate(u.updatedAt)}</td>
        <td><button class="btn" data-save ${isCurrent ? "disabled" : ""}>حفظ</button></td>
      </tr>
    `;
  }).join("");

  rows.querySelectorAll("[data-save]").forEach((btn) => btn.addEventListener("click", onSave));
}

function normRole(role) {
  return role === "user" ? "student" : (role || "student");
}

async function onSave(e) {
  const tr = e.target.closest("tr");
  const id = tr.dataset.id;
  const role = tr.querySelector("[data-role]")?.value || "student";
  const status = tr.querySelector("[data-status]")?.value || "active";
  const btn = tr.querySelector("[data-save]");
  btn.disabled = true;

  try {
    await updateDoc(doc(db, "users", id), { role, status, updatedAt: serverTimestamp() });
    const idx = all.findIndex((u) => u.id === id);
    if (idx >= 0) all[idx] = { ...all[idx], role, status, updatedAt: new Date() };
    btn.textContent = "تم الحفظ";
    setTimeout(() => (btn.textContent = "حفظ"), 1200);
    render();
  } catch (err) {
    console.error(err);
    alert("تعذر حفظ الصلاحية. تأكد من قواعد Firestore وصلاحية admin.");
  } finally {
    btn.disabled = false;
  }
}
