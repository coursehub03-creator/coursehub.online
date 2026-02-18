import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const instructorsListEl = document.getElementById("chatInstructorsList");
const messagesEl = document.getElementById("adminChatMessages");
const inputEl = document.getElementById("adminChatInput");
const sendBtn = document.getElementById("adminSendChatBtn");
const titleEl = document.getElementById("chatWithTitle");

let selectedInstructorId = "";
let selectedInstructorEmail = "";

function fmtDate(value) {
  const d = value?.toDate ? value.toDate() : new Date(value || Date.now());
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("ar-EG");
}

async function loadInstructorThreads() {
  const snap = await getDocs(collection(db, "instructorMessages"));
  const rows = snap.docs.map((d) => d.data()).filter((r) => r.instructorId);
  const unique = new Map();
  rows.forEach((row) => {
    const prev = unique.get(row.instructorId);
    const prevTime = prev?.createdAt?.toMillis?.() || 0;
    const nowTime = row.createdAt?.toMillis?.() || 0;
    if (!prev || nowTime >= prevTime) unique.set(row.instructorId, row);
  });

  if (!unique.size) {
    instructorsListEl.innerHTML = "<p>لا توجد محادثات حالياً.</p>";
    return;
  }

  instructorsListEl.innerHTML = [...unique.values()].map((row) => `
    <button type="button" class="btn outline chat-instructor-btn" data-id="${row.instructorId}" data-email="${row.instructorEmail || ""}">
      ${row.instructorEmail || row.instructorId}
    </button>
  `).join("");

  instructorsListEl.querySelectorAll(".chat-instructor-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      selectedInstructorId = btn.dataset.id;
      selectedInstructorEmail = btn.dataset.email;
      titleEl.textContent = `المحادثة مع: ${selectedInstructorEmail || selectedInstructorId}`;
      await loadMessages();
    });
  });
}

async function loadMessages() {
  if (!selectedInstructorId) {
    messagesEl.innerHTML = "<p>اختر أستاذًا من القائمة.</p>";
    return;
  }

  const snap = await getDocs(query(collection(db, "instructorMessages"), where("instructorId", "==", selectedInstructorId)));
  const msgs = snap.docs.map((d) => d.data()).sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

  messagesEl.innerHTML = msgs.length
    ? msgs.map((m) => `<div style="padding:10px;border-radius:10px;max-width:80%;${m.senderRole === "admin" ? "margin-right:auto;background:#dbeafe" : "margin-left:auto;background:#f3f4f6"}">${m.text || ""}<div style="font-size:12px;color:#6b7280;margin-top:4px;">${m.senderRole === "admin" ? "أنت" : "الأستاذ"} • ${fmtDate(m.createdAt)}</div></div>`).join("")
    : "<p>لا توجد رسائل بعد.</p>";

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage(adminUser) {
  const text = inputEl.value.trim();
  if (!text || !selectedInstructorId) return;

  await addDoc(collection(db, "instructorMessages"), {
    instructorId: selectedInstructorId,
    instructorEmail: selectedInstructorEmail,
    senderId: adminUser.uid,
    senderRole: "admin",
    text,
    createdAt: serverTimestamp()
  });

  inputEl.value = "";
  await loadMessages();
}

document.addEventListener("DOMContentLoaded", async () => {
  const adminUser = await protectAdmin();
  await loadInstructorThreads();
  sendBtn?.addEventListener("click", () => sendMessage(adminUser));
});
