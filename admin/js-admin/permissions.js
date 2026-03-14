import { db } from "/js/firebase-config.js";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { protectAdmin } from "./admin-guard.js";

let all = [];
document.addEventListener("adminLayoutLoaded", init);

async function init() {
  await protectAdmin();
  document.getElementById("permissionsSearch")?.addEventListener("input", render);
  await loadUsers();
}

async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}

function render() {
  const q = (document.getElementById("permissionsSearch")?.value || "").toLowerCase().trim();
  const rows = document.getElementById("permissionsRows");
  const list = all.filter((u) => {
    const name = String(u.name || "").toLowerCase();
    const email = String(u.email || "").toLowerCase();
    return !q || name.includes(q) || email.includes(q);
  });
  if (!list.length) {
    rows.innerHTML = "<tr><td colspan='5'>لا توجد نتائج.</td></tr>";
    return;
  }

  rows.innerHTML = list.map((u) => `
    <tr data-id="${u.id}">
      <td>${u.name || "-"}</td>
      <td>${u.email || "-"}</td>
      <td>
        <select data-role>
          <option value="student" ${normRole(u.role) === "student" ? "selected" : ""}>student</option>
          <option value="instructor" ${normRole(u.role) === "instructor" ? "selected" : ""}>instructor</option>
          <option value="admin" ${normRole(u.role) === "admin" ? "selected" : ""}>admin</option>
        </select>
      </td>
      <td>
        <select data-status>
          <option value="active" ${(u.status || "active") === "active" ? "selected" : ""}>active</option>
          <option value="pending" ${(u.status || "") === "pending" ? "selected" : ""}>pending</option>
          <option value="blocked" ${(u.status || "") === "blocked" ? "selected" : ""}>blocked</option>
          <option value="rejected" ${(u.status || "") === "rejected" ? "selected" : ""}>rejected</option>
        </select>
      </td>
      <td><button class="btn" data-save>حفظ</button></td>
    </tr>`).join("");

  rows.querySelectorAll("[data-save]").forEach((btn) => btn.addEventListener("click", onSave));
}

function normRole(role) {
  return role === "user" ? "student" : (role || "student");
}

async function onSave(e) {
  const tr = e.target.closest("tr");
  const id = tr.dataset.id;
  const role = tr.querySelector("[data-role]").value;
  const status = tr.querySelector("[data-status]").value;
  const btn = tr.querySelector("[data-save]");
  btn.disabled = true;
  try {
    await updateDoc(doc(db, "users", id), { role, status, updatedAt: serverTimestamp() });
    const idx = all.findIndex((u) => u.id === id);
    if (idx >= 0) all[idx] = { ...all[idx], role, status };
    btn.textContent = "تم";
    setTimeout(() => (btn.textContent = "حفظ"), 1200);
  } catch (err) {
    alert("تعذر حفظ الصلاحية. تأكد من قواعد Firestore وصلاحية admin.");
  } finally {
    btn.disabled = false;
  }
}
