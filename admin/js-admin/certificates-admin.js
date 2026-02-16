import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  doc,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const listEl = document.getElementById("certificates-list");
const searchEl = document.getElementById("certificate-search");
const statusFilterEl = document.getElementById("certificate-status-filter");
const refreshBtn = document.getElementById("refresh-certificates-btn");
const totalCertificatesEl = document.getElementById("totalCertificates");
const activeCertificatesEl = document.getElementById("activeCertificates");
const inactiveCertificatesEl = document.getElementById("inactiveCertificates");

let certificates = [];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeStatus(status) {
  return status === "inactive" ? "inactive" : "active";
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function applyStats(items) {
  if (totalCertificatesEl) totalCertificatesEl.textContent = String(items.length);
  if (activeCertificatesEl) {
    activeCertificatesEl.textContent = String(items.filter((item) => normalizeStatus(item.status) === "active").length);
  }
  if (inactiveCertificatesEl) {
    inactiveCertificatesEl.textContent = String(items.filter((item) => normalizeStatus(item.status) === "inactive").length);
  }
}

function renderRows(items) {
  if (!listEl) return;

  if (!items.length) {
    listEl.innerHTML = "<tr><td colspan='8'>لا توجد شهادات مطابقة.</td></tr>";
    return;
  }

  listEl.innerHTML = items.map((item) => {
    const status = normalizeStatus(item.status);
    const nextStatus = status === "active" ? "inactive" : "active";

    return `
      <tr>
        <td>${escapeHtml(item.studentName || "-")}</td>
        <td>${escapeHtml(item.studentEmail || "-")}</td>
        <td>${escapeHtml(item.courseTitle || item.courseId || "-")}</td>
        <td><code>${escapeHtml(item.verificationCode || "-")}</code></td>
        <td>${escapeHtml(formatDate(item.completedAt))}</td>
        <td><span class="badge ${status === "active" ? "success" : "danger"}">${status === "active" ? "مفعلة" : "ملغاة"}</span></td>
        <td>
          <button class="btn small ${status === "active" ? "warning" : "success"} toggle-status-btn"
            data-id="${escapeHtml(item.id)}"
            data-next-status="${nextStatus}">
            ${status === "active" ? "إلغاء" : "تفعيل"}
          </button>
        </td>
        <td>
          <a class="btn small" href="/verify-certificate.html?code=${encodeURIComponent(item.verificationCode || "")}" target="_blank">تحقق</a>
        </td>
      </tr>
    `;
  }).join("");

  listEl.querySelectorAll(".toggle-status-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const certId = btn.getAttribute("data-id");
      const nextStatus = btn.getAttribute("data-next-status");
      if (!certId || !nextStatus) return;

      btn.disabled = true;
      try {
        await updateDoc(doc(db, "certificates", certId), {
          status: nextStatus,
          updatedAt: new Date()
        });

        certificates = certificates.map((item) => (
          item.id === certId ? { ...item, status: nextStatus } : item
        ));

        applyFilters();
      } catch (error) {
        console.error("Toggle certificate status failed:", error);
        alert("تعذر تعديل حالة الشهادة.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function applyFilters() {
  const q = (searchEl?.value || "").toLowerCase().trim();
  const status = statusFilterEl?.value || "all";

  const filtered = certificates.filter((item) => {
    const certStatus = normalizeStatus(item.status);
    const matchesStatus = status === "all" || certStatus === status;
    const matchesSearch =
      !q ||
      String(item.studentName || "").toLowerCase().includes(q) ||
      String(item.studentEmail || "").toLowerCase().includes(q) ||
      String(item.verificationCode || "").toLowerCase().includes(q) ||
      String(item.courseTitle || item.courseId || "").toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  applyStats(certificates);
  renderRows(filtered);
}

async function loadCertificates() {
  if (!listEl) return;

  listEl.innerHTML = "<tr><td colspan='8'>جاري تحميل الشهادات...</td></tr>";

  const [certificatesSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "certificates")),
    getDocs(collection(db, "users"))
  ]);

  const usersByUid = new Map(
    usersSnap.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      return [docSnap.id, data];
    })
  );

  certificates = certificatesSnap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    const userMeta = usersByUid.get(data.userId) || {};

    return {
      id: docSnap.id,
      ...data,
      studentName:
        data.userName ||
        data.studentName ||
        userMeta.name ||
        userMeta.displayName ||
        userMeta.fullName ||
        "-",
      studentEmail: data.userEmail || data.email || userMeta.email || "-",
      status: normalizeStatus(data.status)
    };
  }).sort((a, b) => {
    const da = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt || 0);
    const dbDate = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt || 0);
    return dbDate - da;
  });

  applyFilters();
}

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  try {
    await loadCertificates();
  } catch (error) {
    console.error("Load certificates failed:", error);
    if (listEl) listEl.innerHTML = "<tr><td colspan='8'>تعذر تحميل الشهادات.</td></tr>";
  }

  searchEl?.addEventListener("input", applyFilters);
  statusFilterEl?.addEventListener("change", applyFilters);
  refreshBtn?.addEventListener("click", loadCertificates);
});
