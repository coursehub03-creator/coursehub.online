// certificate-admin.js
document.addEventListener("DOMContentLoaded", () => {
  const pageContent = document.getElementById("page-content");
  pageContent.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>اسم الطالب</th>
          <th>اسم الدورة</th>
          <th>تاريخ الإصدار</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody id="certificates-table-body"></tbody>
    </table>
  `;

  const certificates = JSON.parse(localStorage.getItem("coursehub_certificates")) || [];
  const tbody = document.getElementById("certificates-table-body");

  certificates.forEach(cert => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cert.student}</td>
      <td>${cert.course}</td>
      <td>${cert.date}</td>
      <td>
        <button class="delete-btn" data-id="${cert.id}">حذف</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-btn")) {
      const id = e.target.dataset.id;
      if (confirm("هل تريد حذف الشهادة؟")) {
        const updated = certificates.filter(c => c.id !== id);
        localStorage.setItem("coursehub_certificates", JSON.stringify(updated));
        window.location.reload();
      }
    }
  });
});
