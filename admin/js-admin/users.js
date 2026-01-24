// users.js
document.addEventListener("DOMContentLoaded", () => {
  const pageContent = document.getElementById("page-content");

  // مثال جدول المستخدمين
  pageContent.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>الاسم</th>
          <th>البريد الإلكتروني</th>
          <th>الدور</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody id="users-table-body"></tbody>
    </table>
  `;

  const users = JSON.parse(localStorage.getItem("coursehub_users")) || [];

  const tbody = document.getElementById("users-table-body");
  users.forEach(user => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.role}</td>
      <td>
        <button class="edit-btn" data-email="${user.email}">تعديل</button>
        <button class="delete-btn" data-email="${user.email}">حذف</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // حذف مستخدم
  tbody.addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-btn")) {
      const email = e.target.dataset.email;
      if (confirm(`هل أنت متأكد من حذف المستخدم ${email}?`)) {
        const updatedUsers = users.filter(u => u.email !== email);
        localStorage.setItem("coursehub_users", JSON.stringify(updatedUsers));
        window.location.reload();
      }
    }
  });
});
