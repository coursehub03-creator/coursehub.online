// js/add-course.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("add-course-form");
  if (!form) return;

  form.addEventListener("submit", e => {
    e.preventDefault();
    const title = form.title.value.trim();
    const description = form.description.value.trim();

    if (!title || !description) {
      alert("الرجاء ملء جميع الحقول");
      return;
    }

    const courses = JSON.parse(localStorage.getItem("courses") || "[]");
    const newCourse = {
      id: Date.now(),
      title,
      description
    };
    courses.push(newCourse);
    localStorage.setItem("courses", JSON.stringify(courses));
    alert("تمت إضافة الدورة بنجاح!");
    form.reset();
  });
});
