document.addEventListener("DOMContentLoaded", () => {
  const footerPlaceholder = document.getElementById("footer-placeholder");
  if(!footerPlaceholder) return;

  footerPlaceholder.innerHTML = `
    <footer>
      <div class="footer-container">
        <div class="footer-col">
          <h4>حول CourseHub</h4>
          <p>CourseHub هو منصتك لتعلم المهارات والحصول على شهادات معتمدة.</p>
        </div>
        <div class="footer-col">
          <h4>روابط سريعة</h4>
          <a href="index.html">الرئيسية</a>
          <a href="courses.html">الدورات</a>
          <a href="tests.html">الاختبارات</a>
          <a href="certificates.html">الشهادات</a>
        </div>
        <div class="footer-col">
          <h4>تابعنا</h4>
          <div class="social-icons">
            <a href="#"><i class="fab fa-facebook-f"></i></a>
            <a href="#"><i class="fab fa-twitter"></i></a>
            <a href="#"><i class="fab fa-instagram"></i></a>
          </div>
        </div>
        <div class="footer-col">
          <h4>اتصل بنا</h4>
          <p>info@coursehub.com</p>
          <p>+213 123 456 789</p>
        </div>
      </div>
      <div class="footer-bottom">
        &copy; <span id="year"></span> CourseHub. جميع الحقوق محفوظة.
      </div>
    </footer>
  `;

  const yearSpan = document.getElementById("year");
  if(yearSpan){
    yearSpan.textContent = new Date().getFullYear();
  }
});
