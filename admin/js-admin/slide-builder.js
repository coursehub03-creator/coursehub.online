// js-admin/slide-builder.js
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

export class SlideBuilder {
  constructor() {
    this.slides = {};
  }

  addSlide(lessonId, container) {
    if (!this.slides[lessonId]) this.slides[lessonId] = [];

    const slideId = crypto.randomUUID();
    const slide = {
      id: slideId,
      type: "image",
      title: "",
      text: "",
      mediaUrl: "",
      mediaFile: null,
      textColor: "#0f172a",
      backgroundColor: "#ffffff",
      fontSize: 18,
      fontWeight: 600,
      textAlign: "right",
      layout: "media-right"
    };

    this.slides[lessonId].push(slide);
    this.renderSlide(slide, container, lessonId);
  }

  renderSlide(slide, container, lessonId) {
    const div = document.createElement("div");
    div.className = "slide-card";
    div.draggable = true;

    div.innerHTML = `
      <div class="slide-toolbar">
        <div class="field-group">
          <label>نوع السلايد</label>
          <select class="slide-type">
            <option value="text">نص فقط</option>
            <option value="image">صورة + نص</option>
            <option value="video">فيديو + نص</option>
          </select>
        </div>
        <button class="btn small danger">حذف السلايد</button>
      </div>

      <div class="slide-config">
        <div class="field-group">
          <label>قالب سريع</label>
          <select class="slide-template">
            <option value="classic">كلاسيكي</option>
            <option value="coursera">Coursera Clean</option>
            <option value="dark">داكن حديث</option>
            <option value="brand">علامة تجارية</option>
          </select>
        </div>
        <div class="field-group">
          <label>عنوان السلايد</label>
          <input type="text" class="slide-title" placeholder="عنوان مختصر">
        </div>
        <div class="field-group">
          <label>نص السلايد</label>
          <textarea class="slide-text" rows="3" placeholder="اكتب نصًا يوضح النقاط الرئيسية"></textarea>
        </div>
        <div class="field-group">
          <label>تحميل الوسائط</label>
          <input type="file" class="slide-media-file" accept="image/*,video/*">
          <span class="field-help">يمكن رفع صورة أو فيديو، أو استخدام رابط خارجي.</span>
        </div>
        <div class="field-group">
          <label>رابط الوسائط</label>
          <input type="url" class="slide-media-url" placeholder="https://">
        </div>
        <div class="field-group">
          <label>تموضع الوسائط</label>
          <select class="slide-layout">
            <option value="media-right">الوسائط يمين</option>
            <option value="media-left">الوسائط يسار</option>
            <option value="media-top">الوسائط أعلى</option>
          </select>
        </div>
        <div class="field-group">
          <label>محاذاة النص</label>
          <select class="slide-align">
            <option value="right">يمين</option>
            <option value="center">وسط</option>
            <option value="left">يسار</option>
          </select>
        </div>
        <div class="field-group">
          <label>حجم الخط</label>
          <input type="number" class="slide-font-size" min="12" max="40" value="18">
        </div>
        <div class="field-group">
          <label>سُمك الخط</label>
          <select class="slide-font-weight">
            <option value="400">عادي</option>
            <option value="600" selected>متوسط</option>
            <option value="700">غامق</option>
          </select>
        </div>
        <div class="field-group">
          <label>لون النص</label>
          <input type="color" class="slide-text-color" value="#0f172a">
        </div>
        <div class="field-group">
          <label>لون الخلفية</label>
          <input type="color" class="slide-bg-color" value="#ffffff">
        </div>
      </div>

      <div class="slide-preview media-right">
        <div class="slide-media">المعاينة ستظهر هنا</div>
        <div class="slide-preview-content"></div>
      </div>
    `;

    const typeSelect = div.querySelector(".slide-type");
    const titleInput = div.querySelector(".slide-title");
    const textInput = div.querySelector(".slide-text");
    const templateSelect = div.querySelector(".slide-template");
    const mediaFileInput = div.querySelector(".slide-media-file");
    const mediaUrlInput = div.querySelector(".slide-media-url");
    const layoutSelect = div.querySelector(".slide-layout");
    const alignSelect = div.querySelector(".slide-align");
    const fontSizeInput = div.querySelector(".slide-font-size");
    const fontWeightSelect = div.querySelector(".slide-font-weight");
    const textColorInput = div.querySelector(".slide-text-color");
    const bgColorInput = div.querySelector(".slide-bg-color");
    const preview = div.querySelector(".slide-preview");
    const previewContent = div.querySelector(".slide-preview-content");
    const previewMedia = div.querySelector(".slide-media");

    const updatePreview = () => {
      preview.classList.remove("media-right", "media-left", "media-top");
      preview.classList.add(slide.layout);
      preview.style.background = slide.backgroundColor;

      previewContent.innerHTML = `
        <div style="color: ${slide.textColor}; text-align: ${slide.textAlign};">
          <div style="font-size: ${slide.fontSize}px; font-weight: ${slide.fontWeight}; margin-bottom: 6px;">
            ${slide.title || "عنوان السلايد"}
          </div>
          <div style="font-size: ${Math.max(slide.fontSize - 2, 12)}px;">
            ${slide.text || "وصف السلايد يظهر هنا."}
          </div>
        </div>
      `;

      if (slide.type === "text") {
        previewMedia.innerHTML = "سلايد نصي";
      } else if (slide.mediaPreview) {
        previewMedia.innerHTML = slide.type === "video"
          ? `<video src="${slide.mediaPreview}" controls></video>`
          : `<img src="${slide.mediaPreview}" alt="معاينة">`;
      } else if (slide.mediaUrl) {
        previewMedia.innerHTML = slide.type === "video"
          ? `<video src="${slide.mediaUrl}" controls></video>`
          : `<img src="${slide.mediaUrl}" alt="معاينة">`;
      } else {
        previewMedia.innerHTML = "أضف وسائط للمعاينة";
      }
    };

    typeSelect.value = slide.type;
    templateSelect.value = "classic";
    layoutSelect.value = slide.layout;
    alignSelect.value = slide.textAlign;
    fontSizeInput.value = slide.fontSize;
    fontWeightSelect.value = slide.fontWeight;
    textColorInput.value = slide.textColor;
    bgColorInput.value = slide.backgroundColor;

    typeSelect.onchange = e => {
      slide.type = e.target.value;
      updatePreview();
    };

    templateSelect.onchange = e => {
      const template = e.target.value;
      if (template === "coursera") {
        slide.backgroundColor = "#ffffff";
        slide.textColor = "#1f2937";
        slide.fontWeight = 600;
      } else if (template === "dark") {
        slide.backgroundColor = "#0f172a";
        slide.textColor = "#f8fafc";
        slide.fontWeight = 600;
      } else if (template === "brand") {
        slide.backgroundColor = "#e0e7ff";
        slide.textColor = "#1e3a8a";
        slide.fontWeight = 700;
      } else {
        slide.backgroundColor = "#ffffff";
        slide.textColor = "#0f172a";
        slide.fontWeight = 600;
      }
      bgColorInput.value = slide.backgroundColor;
      textColorInput.value = slide.textColor;
      fontWeightSelect.value = slide.fontWeight;
      updatePreview();
    };

    titleInput.oninput = e => {
      slide.title = e.target.value;
      updatePreview();
    };

    textInput.oninput = e => {
      slide.text = e.target.value;
      updatePreview();
    };

    mediaUrlInput.oninput = e => {
      slide.mediaUrl = e.target.value;
      slide.mediaPreview = e.target.value;
      updatePreview();
    };

    mediaFileInput.onchange = e => {
      const file = e.target.files[0];
      slide.mediaFile = file || null;
      if (file) {
        slide.mediaPreview = URL.createObjectURL(file);
      }
      updatePreview();
    };

    layoutSelect.onchange = e => {
      slide.layout = e.target.value;
      updatePreview();
    };

    alignSelect.onchange = e => {
      slide.textAlign = e.target.value;
      updatePreview();
    };

    fontSizeInput.oninput = e => {
      slide.fontSize = Number(e.target.value);
      updatePreview();
    };

    fontWeightSelect.onchange = e => {
      slide.fontWeight = Number(e.target.value);
      updatePreview();
    };

    textColorInput.oninput = e => {
      slide.textColor = e.target.value;
      updatePreview();
    };

    bgColorInput.oninput = e => {
      slide.backgroundColor = e.target.value;
      updatePreview();
    };

    div.querySelector(".danger").onclick = () => {
      this.slides[lessonId] = this.slides[lessonId].filter(s => s.id !== slide.id);
      div.remove();
    };

    this.enableDrag(div, container);
    container.appendChild(div);
    updatePreview();
  }

  enableDrag(el, container) {
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

  async getSlidesForSave(lessonId, storage) {
    const slides = this.slides[lessonId] || [];
    const prepared = [];

    for (const slide of slides) {
      let finalMediaUrl = slide.mediaUrl;
      if (slide.mediaFile) {
        const mediaRef = ref(
          storage,
          `courses/slides/${lessonId}/${Date.now()}_${slide.mediaFile.name}`
        );
        await uploadBytes(mediaRef, slide.mediaFile);
        finalMediaUrl = await getDownloadURL(mediaRef);
      }

      prepared.push({
        id: slide.id,
        type: slide.type,
        title: slide.title,
        text: slide.text,
        mediaUrl: finalMediaUrl || "",
        style: {
          textColor: slide.textColor,
          backgroundColor: slide.backgroundColor,
          fontSize: slide.fontSize,
          fontWeight: slide.fontWeight,
          textAlign: slide.textAlign,
          layout: slide.layout
        }
      });
    }

    return prepared;
  }

  getSlides(lessonId) {
    return this.slides[lessonId] || [];
  }
}
