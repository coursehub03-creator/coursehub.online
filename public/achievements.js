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

  document.getElementById("completedCourses").textContent = totalCourses;
  document.getElementById("certificatesCount").textContent = totalCertificates;

  // --- Certificates ---
  const certList = document.getElementById("certificatesList");
  certList.innerHTML = "";

  if (totalCertificates === 0) {
    certList.innerHTML = "<p>لم تحصل على أي شهادة بعد.</p>";
  } else {
    progress.certificates.forEach(cert => {
      const certCard = document.createElement("div");
      certCard.className = "certificate-card";
      certCard.innerHTML = `
        <button class="download-btn" onclick="downloadCertificate('${cert.certificateUrl}')">
          تحميل
        </button>
        <h4>${cert.title}</h4>
        <span>تاريخ الإصدار: ${cert.issuedAt}</span>
        <button onclick="openCertificate('${cert.certificateUrl}')">
          عرض الشهادة
        </button>
      `;
      certList.appendChild(certCard);
    });
  }

  // --- Completed Courses ---
  const coursesList = document.getElementById("coursesList");
  coursesList.innerHTML = "";

  if (totalCourses === 0) {
    coursesList.innerHTML = "<p>لم تكمل أي دورة بعد.</p>";
  } else {
    progress.completedCourses.forEach(course => {
      const courseCard = document.createElement("div");
      courseCard.className = "course-card";
      courseCard.innerHTML = `
        <img src="${course.image}" alt="${course.title}">
        <div class="course-content">
          <h4>
            <a href="${course.pageUrl}" target="_blank">${course.title}</a>
          </h4>
          <span>المدرب: ${course.instructor}</span><br>
          <span>أكملت في: ${course.completedAt}</span>
        </div>
      `;
      coursesList.appendChild(courseCard);
    });
  }

});

// فتح الشهادة في نافذة جديدة
function openCertificate(url) {
  window.open(url, "_blank");
}

// تحميل الشهادة
function downloadCertificate(url) {
  const link = document.createElement("a");
  link.href = url;
  link.download = url.split("/").pop(); // اسم الملف من الرابط
  link.click();
}
