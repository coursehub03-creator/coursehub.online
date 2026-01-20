document.addEventListener("DOMContentLoaded", () => {

  // بيانات تجريبية
  const data = {
    completedCourses: 3,
    certificates: [
      { title: "HTML & CSS Basics", date: "2024-11-10" },
      { title: "JavaScript Fundamentals", date: "2024-12-05" }
    ],
    courses: [
      { title: "HTML & CSS Basics", instructor: "Ahmed Ali", image: "assets/course1.jpg" },
      { title: "JavaScript Fundamentals", instructor: "Sara Mohamed", image: "assets/course2.jpg" },
      { title: "Web Design UI", instructor: "Khaled Salous", image: "assets/course3.jpg" }
    ],
    hours: 18
  };

  // Summary
  document.getElementById("completedCourses").textContent = data.completedCourses;
  document.getElementById("certificatesCount").textContent = data.certificates.length;
  document.getElementById("learningHours").textContent = data.hours;

  // Certificates
  const certList = document.getElementById("certificatesList");
  data.certificates.forEach(cert => {
    certList.innerHTML += `
      <div class="certificate-card">
        <h4>${cert.title}</h4>
        <span>تاريخ الحصول: ${cert.date}</span>
        <button>عرض الشهادة</button>
      </div>
    `;
  });

  // Courses
  const coursesList = document.getElementById("coursesList");
  data.courses.forEach(course => {
    coursesList.innerHTML += `
      <div class="course-card">
        <img src="${course.image}">
        <div class="course-content">
          <h4>${course.title}</h4>
          <span>المدرب: ${course.instructor}</span>
        </div>
      </div>
    `;
  });

});
