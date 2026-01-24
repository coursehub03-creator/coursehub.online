// settings-admin.js
document.addEventListener("DOMContentLoaded", () => {
  const pageContent = document.getElementById("page-content");

  pageContent.innerHTML = `
    <h2>إعدادات الموقع</h2>
    <label>اسم الموقع:</label>
    <input type="text" id="siteName" placeholder="CourseHub">
    <label>الوصف:</label>
    <textarea id="siteDesc" placeholder="وصف الموقع"></textarea>
    <button id="saveSettings" class="admin-btn">حفظ الإعدادات</button>
  `;

  // حفظ الإعدادات في localStorage
  document.getElementById("saveSettings").addEventListener("click", () => {
    const settings = {
      name: document.getElementById("siteName").value,
      description: document.getElementById("siteDesc").value
    };
    localStorage.setItem("coursehub_settings", JSON.stringify(settings));
    alert("تم حفظ الإعدادات بنجاح!");
  });
});
