// courses-admin.js
document.addEventListener("DOMContentLoaded", () => {
  const pageContent = document.getElementById("page-content");

  pageContent.innerHTML = `
    <button id="add-course-btn" class="admin-btn">إضافة دورة جديدة</button>
    <table class="admin-table">
      <thead>
        <tr>
          <th>عنوان الدورة</th>
          <th>الوصف</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody id="courses-table-body"></tbody>
    </table>
  `;

  const courses = JSON.parse(localStorage.getItem("coursehub_courses")) || [];
  const tbody = document.getElementById("courses-table-body");

  courses.forEach(course => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${course.title}</td>
      <td>${course.description}</td>
      <td>
        <button class="edit-btn" data-id="${course.id}">تعديل</button>
        <button class="delete-btn" data-id="${course.id}">حذف</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("add-course-btn").addEventListener("click", () => {
    window.location.href = "add-course.html";
  });

  tbody.addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains("delete-btn")) {
      if (confirm("هل تريد حذف هذه الدورة؟")) {
        const updatedCourses = courses.filter(c => c.id !== id);
        localStorage.setItem("coursehub_courses", JSON.stringify(updatedCourses));
        window.location.reload();
      }
    }
  });
});
