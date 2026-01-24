v// manage-users.js
// إدارة المستخدمين (Static Version)

document.addEventListener("DOMContentLoaded", () => {
  protectAdminPage();
  renderUsers();
});

/* ===============================
   حماية صفحة الأدمن
================================ */
function protectAdminPage() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  if (!user || user.role !== "admin") {
    window.location.href = "../login.html";
  }
}

/* ===============================
   جلب المستخدمين
   (حاليًا من localStorage)
================================ */
function getUsers() {
  const users = JSON.parse(localStorage.getItem("coursehub_users"));
  return Array.isArray(users) ? users : [];
}

/* ===============================
   حفظ المستخدمين
================================ */
function saveUsers(users) {
  localStorage.setItem("coursehub_users", JSON.stringify(users));
}

/* ===============================
   عرض المستخدمين
================================ */
function renderUsers() {
  const container = document.getElementById("users-list");
  if (!container) return;

  const users = getUsers();

  if (users.length === 0) {
    container.innerHTML = `<p>لا يوجد مستخدمون حاليًا.</p>`;
    return;
  }

  container.innerHTML = "";

  users.forEach((user, index) => {
    const card = document.createElement("div");
    card.className = "user-card";

    card.innerHTML = `
      <div class="user-info">
        <img src="${user.picture || "../assets/images/default-user.png"}" alt="user">
        <div>
          <strong>${user.name}</strong>
          <p>${user.email}</p>
          <span class="role ${user.role}">${user.role === "admin" ? "أدمن" : "مستخدم"}</span>
        </div>
      </div>

      <div class="user-actions">
        ${
          user.role !== "admin"
            ? `<button class="danger" onclick="deleteUser(${index})">حذف</button>`
            : `<span class="locked">🔒 لا يمكن حذف الأدمن</span>`
        }
      </div>
    `;

    container.appendChild(card);
  });
}

/* ===============================
   حذف مستخدم
================================ */
function deleteUser(index) {
  const users = getUsers();
  const user = users[index];

  if (!confirm(`هل أنت متأكد من حذف المستخدم: ${user.name}؟`)) return;

  users.splice(index, 1);
  saveUsers(users);
  renderUsers();
}

/* ===============================
   (اختياري) إضافة مستخدم تلقائيًا
   لتجربة الصفحة
================================ */
// هذا الكود للتجربة فقط – احذفه لاحقًا
(function seedDemoUsers() {
  const existing = getUsers();
  if (existing.length > 0) return;

  const demoUsers = [
    {
      name: "Admin User",
      email: "admin@coursehub.com",
      role: "admin",
      picture: "https://i.pravatar.cc/150?img=1"
    },
    {
      name: "Ahmed Ali",
      email: "ahmed@mail.com",
      role: "user",
      picture: "https://i.pravatar.cc/150?img=2"
    },
    {
      name: "Sara Mohamed",
      email: "sara@mail.com",
      role: "user",
      picture: "https://i.pravatar.cc/150?img=3"
    }
  ];

  saveUsers(demoUsers);
})();
