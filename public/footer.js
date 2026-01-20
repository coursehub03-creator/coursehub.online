document.addEventListener("DOMContentLoaded", () => {
  const footerPlaceholder = document.getElementById("footer-placeholder");
  if(!footerPlaceholder) return;

  footerPlaceholder.innerHTML = `
    <footer class="main-footer">
      <div class="container footer-container">
        <p>&copy; <span id="year"></span> CourseHub. جميع الحقوق محفوظة.</p>
      </div>
    </footer>
  `;

  // تحديث السنة تلقائيًا
  const yearSpan = document.getElementById("year");
  if(yearSpan){
    yearSpan.textContent = new Date().getFullYear();
  }
});
