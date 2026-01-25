// js-admin/quiz-builder.js
export class QuizBuilder {
  constructor() {
    this.quizzes = {};
  }

  addQuiz(lessonId, container) {
    if (!this.quizzes[lessonId]) this.quizzes[lessonId] = [];

    const quiz = {
      question: "",
      options: ["", "", "", ""],
      correct: 0
    };

    this.quizzes[lessonId].push(quiz);
    this.renderQuiz(quiz, container);
  }

  renderQuiz(quiz, container) {
    const div = document.createElement("div");
    div.className = "quiz-card";

    div.innerHTML = `
      <input placeholder="نص السؤال" class="quiz-question" />

      ${quiz.options.map((_, i) => `
        <label>
          <input type="radio" name="correct">
          <input placeholder="إجابة ${i + 1}" class="quiz-option">
        </label>
      `).join("")}

      <button class="btn small danger">حذف</button>
    `;

    div.querySelector(".quiz-question").oninput = e => quiz.question = e.target.value;

    div.querySelectorAll(".quiz-option").forEach((input, i) => {
      input.oninput = e => quiz.options[i] = e.target.value;
    });

    div.querySelectorAll("input[type=radio]").forEach((r, i) => {
      r.onchange = () => quiz.correct = i;
    });

    div.querySelector(".danger").onclick = () => div.remove();

    container.appendChild(div);
  }

  validate(lessonId) {
    return (this.quizzes[lessonId] || []).every(q =>
      q.question && q.options.every(o => o)
    );
  }

  getQuiz(lessonId) {
    return this.quizzes[lessonId] || [];
  }
}
