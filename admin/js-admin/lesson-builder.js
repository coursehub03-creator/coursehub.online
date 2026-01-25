// js-admin/lesson-builder.js
export class LessonBuilder {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.lessons = [];
  }

  addLesson() {
    const lessonId = crypto.randomUUID();

    const lesson = {
      id: lessonId,
      title: "",
      slides: [],
      quiz: []
    };

    this.lessons.push(lesson);
    this.renderLesson(lesson);
  }

  removeLesson(id) {
    this.lessons = this.lessons.filter(l => l.id !== id);
    document.getElementById(`lesson-${id}`)?.remove();
    this.reindex();
  }

  renderLesson(lesson) {
    const div = document.createElement("div");
    div.className = "lesson-card";
    div.id = `lesson-${lesson.id}`;

    div.innerHTML = `
      <div class="lesson-header">
        <input type="text" placeholder="عنوان الدرس" class="lesson-title" />
        <div class="lesson-actions">
          <button class="btn small danger">🗑 حذف</button>
        </div>
      </div>

      <div class="lesson-body">
        <div class="slides-container" data-lesson="${lesson.id}"></div>
        <button class="btn outline add-slide">➕ إضافة سلايد</button>

        <hr>

        <div class="quiz-container" data-lesson="${lesson.id}"></div>
        <button class="btn outline add-quiz">➕ إضافة اختبار</button>
      </div>
    `;

    div.querySelector(".danger").onclick = () => this.removeLesson(lesson.id);

    div.querySelector(".lesson-title").oninput = e => {
      lesson.title = e.target.value;
    };

    this.container.appendChild(div);
    this.reindex();
  }

  reindex() {
    [...this.container.children].forEach((el, i) => {
      el.querySelector(".lesson-title").dataset.index = i + 1;
    });
  }

  getData() {
    return this.lessons;
  }
}
