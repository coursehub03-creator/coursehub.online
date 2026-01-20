document.addEventListener("DOMContentLoaded", () => {

  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  if (!user) {
    alert("يجب تسجيل الدخول لعرض الإنجازات");
    window.location.href = "login.html";
    return;
  }

  const progressKey = "coursehub_progress";
  let progress = JSON.parse(localStorage.getItem(progressKey));

  // إنشاء بيانات أولية إذا لم تكن موجودة
  if (!progress || progress.userEmail !== user.email) {
    progress = {
      userEmail: user.email,
      completedCourses: [],
      certificates: []
    };
    localStorage.setItem(progressKey, JSON.stringify(progress));
  }

  // --- Summary ---
  const totalCourses = progress.completedCourses.length;
  const totalCertificates = progress.certificates.length;
  const totalHours = progress.completedCourses.reduce(
    (sum, c) => sum + (c.hours || 0), 0
  );

  document.getElementById("completedCourses").textContent = totalCourses;
  document.getElementById("certificatesCount").textContent = totalCertificates;
  document.getElementById("learningHours").textContent = totalHours;

  // --- Certificates ---
  const certList = document.getElementById("certificatesList");
  certList.innerHTML = "";

  if (totalCertificates === 0) {
    certList.innerHTML = "<p>لم تحصل على أي شهادة بعد.</p>";
  } else {
    progress.certificates.forEach(cert => {
      certList.innerHTML += `
        <div class="certificate-card">
          <h4>${cert.title}</h4>
          <span>تاريخ الإصدار: ${cert.issuedAt}</span>
          <button onclick="openCertificate('${cert.certificateUrl}')">
            عرض الشهادة
          </button>
        </div>
      `;
    });
  }

  // --- Completed Courses ---
  const coursesList = document.getElementById("coursesList");
  coursesList.innerHTML = "";

  if (totalCourses === 0) {
    coursesList.innerHTML = "<p>لم تكمل أي دورة بعد.</p>";
  } else {
    progress.completedCourses.forEach(course => {
      coursesList.innerHTML += `
        <div class="course-card">
          <img src="${course.image}" alt="${course.title}">
          <div class="course-content">
            <h4>${course.title}</h4>
            <span>المدرب: ${course.instructor}</span><br>
            <span>أكملت في: ${course.completedAt}</span>
          </div>
        </div>
      `;
    });
  }

});

function openCertificate(url) {
  window.open(url, "_blank");
}
