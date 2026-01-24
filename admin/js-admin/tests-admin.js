// tests-admin.js
document.addEventListener("DOMContentLoaded", () => {
  const pageContent = document.getElementById("page-content");
  pageContent.innerHTML = `
    <button id="add-test-btn" class="admin-btn">إضافة اختبار جديد</button>
    <table class="admin-table">
      <thead>
        <tr>
          <th>اسم الاختبار</th>
          <th>الوصف</th>
          <th>تاريخ الإنشاء</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody id="tests-table-body"></tbody>
    </table>
  `;

  const tests = JSON.parse(localStorage.getItem("coursehub_tests")) || [];
  const tbody = document.getElementById("tests-table-body");

  tests.forEach(test => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${test.title}</td>
      <td>${test.description}</td>
      <td>${test.date}</td>
      <td>
        <button class="delete-btn" data-id="${test.id}">حذف</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("add-test-btn").addEventListener("click", () => {
    alert("يمكنك إضافة صفحة لإضافة اختبار جديد لاحقًا.");
  });

  tbody.addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-btn")) {
      const id = e.target.dataset.id;
      if (confirm("هل تريد حذف هذا الاختبار؟")) {
        const updated = tests.filter(t => t.id !== id);
        localStorage.setItem("coursehub_tests", JSON.stringify(updated));
        window.location.reload();
      }
    }
  });
});
