// js-admin/slide-builder.js
export class SlideBuilder {
  constructor() {
    this.slides = {};
  }

  addSlide(lessonId, container) {
    if (!this.slides[lessonId]) this.slides[lessonId] = [];

    const slideId = crypto.randomUUID();
    const slide = {
      id: slideId,
      type: "text",
      content: ""
    };

    this.slides[lessonId].push(slide);
    this.renderSlide(slide, container, lessonId);
  }

  renderSlide(slide, container, lessonId) {
    const div = document.createElement("div");
    div.className = "slide-card";
    div.draggable = true;

    div.innerHTML = `
      <select class="slide-type">
        <option value="text">نص</option>
        <option value="image">صورة</option>
        <option value="video">فيديو</option>
        <option value="pdf">PDF</option>
      </select>

      <textarea class="slide-content" placeholder="محتوى السلايد"></textarea>

      <button class="btn small danger">حذف</button>
    `;

    const typeSelect = div.querySelector(".slide-type");
    const contentInput = div.querySelector(".slide-content");

    typeSelect.onchange = e => slide.type = e.target.value;
    contentInput.oninput = e => slide.content = e.target.value;

    div.querySelector(".danger").onclick = () => {
      this.slides[lessonId] = this.slides[lessonId].filter(s => s.id !== slide.id);
      div.remove();
    };

    this.enableDrag(div, container, lessonId);
    container.appendChild(div);
  }

  enableDrag(el, container, lessonId) {
    el.addEventListener("dragstart", () => el.classList.add("dragging"));
    el.addEventListener("dragend", () => el.classList.remove("dragging"));

    container.addEventListener("dragover", e => {
      e.preventDefault();
      const after = [...container.children].find(c =>
        e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2
      );
      after ? container.insertBefore(el, after) : container.appendChild(el);
    });
  }

  getSlides(lessonId) {
    return this.slides[lessonId] || [];
  }
}
