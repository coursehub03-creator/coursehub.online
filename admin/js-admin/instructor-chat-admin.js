import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const instructorsListEl = document.getElementById("chatInstructorsList");
const messagesEl = document.getElementById("adminChatMessages");
const inputEl = document.getElementById("adminChatInput");
const sendBtn = document.getElementById("adminSendChatBtn");
const deleteBtn = document.getElementById("deleteChatBtn");
const titleEl = document.getElementById("chatWithTitle");

let selectedInstructorId = "";
let selectedInstructorName = "";
let selectedInstructorEmail = "";
let allMessages = [];
let chatUnsub = null;
let adminUser = null;

function fmtDate(value) {
  const d = value?.toDate ? value.toDate() : new Date(value || Date.now());
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("ar-EG");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMessages(msgs) {
  if (!messagesEl) return;

  if (!msgs.length) {
    messagesEl.innerHTML = "<p class=\"helper-text\">لا توجد رسائل بعد.</p>";
    return;
  }

  messagesEl.innerHTML = msgs
    .map((m) => {
      const role = m.senderRole === "admin" ? "admin" : "instructor";
      const senderLabel = role === "admin" ? "المشرف" : (selectedInstructorName || "الأستاذ");
      return `
        <article class="admin-chat-bubble ${role}">
          <p>${escapeHtml(m.text || "")}</p>
          <div class="admin-chat-bubble-meta">${senderLabel} • ${fmtDate(m.createdAt)}</div>
        </article>
      `;
    })
    .join("");

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateAdminNavBadge(messages) {
  const navBadge = document.getElementById("adminChatNavBadge");
  if (!navBadge) return;

  const unreadCount = messages.filter((m) => m.senderRole === "instructor" && !m.readByAdmin).length;
  navBadge.hidden = unreadCount === 0;
  navBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
}

async function notifyInstructorMessage(instructorId, text) {
  if (!instructorId) return;

  await addDoc(collection(db, "notifications"), {
    userId: instructorId,
    title: "رسالة جديدة من المشرف",
    message: text.length > 110 ? `${text.slice(0, 110)}...` : text,
    link: "/instructor-dashboard.html",
    read: false,
    createdAt: serverTimestamp()
  });
}

async function markMessagesReadByAdmin(messages) {
  const unread = messages.filter((m) => m.senderRole === "instructor" && !m.readByAdmin && m.id);
  if (!unread.length) return;

  const batch = writeBatch(db);
  unread.forEach((msg) => {
    batch.update(doc(db, "instructorMessages", msg.id), { readByAdmin: true });
  });
  await batch.commit();
}

async function deleteConversation() {
  if (!selectedInstructorId) return;
  const ok = window.confirm("هل أنت متأكد من حذف هذه المحادثة بالكامل؟ لا يمكن التراجع.");
  if (!ok) return;

  const snap = await getDocs(query(collection(db, "instructorMessages"), where("instructorId", "==", selectedInstructorId)));
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((msgDoc) => batch.delete(msgDoc.ref));
  await batch.commit();

  selectedInstructorId = "";
  selectedInstructorName = "";
  selectedInstructorEmail = "";
  deleteBtn.hidden = true;
  titleEl.textContent = "اختر أستاذًا لبدء المحادثة";
  messagesEl.innerHTML = "<p class=\"helper-text\">تم حذف المحادثة.</p>";
}

async function loadInstructorThreads() {
  const [messagesSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "instructorMessages")),
    getDocs(query(collection(db, "users"), where("role", "==", "instructor")))
  ]);

  const usersMap = new Map(
    usersSnap.docs.map((u) => [u.id, u.data()])
  );

  allMessages = messagesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.instructorId);

  const unique = new Map();
  allMessages.forEach((row) => {
    const prev = unique.get(row.instructorId);
    const prevTime = prev?.createdAt?.toMillis?.() || 0;
    const nowTime = row.createdAt?.toMillis?.() || 0;
    if (!prev || nowTime >= prevTime) unique.set(row.instructorId, row);
  });

  updateAdminNavBadge(allMessages);

  if (!unique.size) {
    instructorsListEl.innerHTML = "<p class=\"helper-text\">لا توجد محادثات حالياً.</p>";
    return;
  }

  instructorsListEl.innerHTML = [...unique.values()]
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    .map((row) => {
      const profile = usersMap.get(row.instructorId) || {};
      const name = profile.name || row.instructorName || "أستاذ";
      const unread = allMessages.filter((m) => m.instructorId === row.instructorId && m.senderRole === "instructor" && !m.readByAdmin).length;

      return `
        <button type="button" class="chat-instructor-btn ${selectedInstructorId === row.instructorId ? "active" : ""}" data-id="${row.instructorId}" data-name="${escapeHtml(name)}" data-email="${escapeHtml(row.instructorEmail || profile.email || "")}">
          <span class="chat-instructor-name">${escapeHtml(name)}</span>
          <span class="chat-instructor-email">${escapeHtml(row.instructorEmail || profile.email || "")}</span>
          ${unread ? `<span class="chat-instructor-unread">${unread}</span>` : ""}
        </button>
      `;
    })
    .join("");

  instructorsListEl.querySelectorAll(".chat-instructor-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedInstructorId = btn.dataset.id || "";
      selectedInstructorName = btn.dataset.name || "";
      selectedInstructorEmail = btn.dataset.email || "";
      titleEl.textContent = `المحادثة مع: ${selectedInstructorName || selectedInstructorEmail || selectedInstructorId}`;
      deleteBtn.hidden = !selectedInstructorId;
      subscribeToSelectedConversation();
      loadInstructorThreads();
    });
  });
}

function subscribeToSelectedConversation() {
  if (chatUnsub) chatUnsub();
  if (!selectedInstructorId) {
    messagesEl.innerHTML = "<p class=\"helper-text\">اختر أستاذًا من القائمة.</p>";
    return;
  }

  chatUnsub = onSnapshot(
    query(collection(db, "instructorMessages"), where("instructorId", "==", selectedInstructorId)),
    async (snap) => {
      const msgs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

      renderMessages(msgs);
      await markMessagesReadByAdmin(msgs);
    }
  );
}

async function sendMessage() {
  const text = inputEl?.value?.trim();
  if (!text || !selectedInstructorId || !adminUser) return;

  await addDoc(collection(db, "instructorMessages"), {
    instructorId: selectedInstructorId,
    instructorName: selectedInstructorName,
    instructorEmail: selectedInstructorEmail,
    senderId: adminUser.uid,
    senderRole: "admin",
    text,
    readByAdmin: true,
    readByInstructor: false,
    createdAt: serverTimestamp()
  });

  await notifyInstructorMessage(selectedInstructorId, text);

  inputEl.value = "";
}

document.addEventListener("adminLayoutLoaded", () => {
  loadInstructorThreads().catch((error) => {
    console.error("Failed loading instructor threads:", error);
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  adminUser = await protectAdmin();

  onSnapshot(collection(db, "instructorMessages"), async () => {
    await loadInstructorThreads();
  });

  sendBtn?.addEventListener("click", sendMessage);
  inputEl?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });

  deleteBtn?.addEventListener("click", deleteConversation);
});
