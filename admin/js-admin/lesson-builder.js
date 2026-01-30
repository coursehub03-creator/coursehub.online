diff --git a/admin/js-admin/lesson-builder.js b/admin/js-admin/lesson-builder.js
index 109e419dc6c6f954ab4c42fa1d432da5862e012b..bc14f3ae5b405e8f78d4e483e19875017858f74b 100644
--- a/admin/js-admin/lesson-builder.js
+++ b/admin/js-admin/lesson-builder.js
@@ -1,71 +1,114 @@
 // js-admin/lesson-builder.js
 export class LessonBuilder {
   constructor(containerId) {
     this.container = document.getElementById(containerId);
     this.lessons = [];
+    this.emptyState = document.getElementById("lessonsEmpty");
+    this.updateEmptyState();
   }
 
   addLesson() {
     const lessonId = crypto.randomUUID();
 
     const lesson = {
       id: lessonId,
       title: "",
+      duration: "",
+      summary: "",
       slides: [],
       quiz: []
     };
 
     this.lessons.push(lesson);
     this.renderLesson(lesson);
+    this.updateEmptyState();
   }
 
   removeLesson(id) {
     this.lessons = this.lessons.filter(l => l.id !== id);
     document.getElementById(`lesson-${id}`)?.remove();
     this.reindex();
+    this.updateEmptyState();
   }
 
   renderLesson(lesson) {
     const div = document.createElement("div");
     div.className = "lesson-card";
     div.id = `lesson-${lesson.id}`;
 
     div.innerHTML = `
       <div class="lesson-header">
-        <input type="text" placeholder="عنوان الدرس" class="lesson-title" />
+        <div>
+          <div class="lesson-number">الدرس 1</div>
+          <input type="text" placeholder="عنوان الدرس" class="lesson-title" />
+        </div>
         <div class="lesson-actions">
           <button class="btn small danger">🗑 حذف</button>
         </div>
       </div>
 
       <div class="lesson-body">
+        <div class="lesson-meta">
+          <div class="field-group">
+            <label>مدة الدرس (دقيقة)</label>
+            <input type="number" class="lesson-duration" min="1" placeholder="مثال: 45">
+          </div>
+          <div class="field-group">
+            <label>ملخص الدرس</label>
+            <input type="text" class="lesson-summary" placeholder="وصف مختصر للدرس">
+          </div>
+        </div>
+
+        <h4>السلايدات</h4>
         <div class="slides-container" data-lesson="${lesson.id}"></div>
-        <button class="btn outline add-slide">➕ إضافة سلايد</button>
+        <button class="btn outline add-slide">
+          <i class="fa-solid fa-images"></i>
+          إضافة سلايد
+        </button>
 
         <hr>
 
+        <h4>اختبار الدرس</h4>
         <div class="quiz-container" data-lesson="${lesson.id}"></div>
-        <button class="btn outline add-quiz">➕ إضافة اختبار</button>
+        <button class="btn outline add-quiz">
+          <i class="fa-solid fa-circle-question"></i>
+          إضافة اختبار
+        </button>
       </div>
     `;
 
     div.querySelector(".danger").onclick = () => this.removeLesson(lesson.id);
 
     div.querySelector(".lesson-title").oninput = e => {
       lesson.title = e.target.value;
     };
 
+    div.querySelector(".lesson-duration").oninput = e => {
+      lesson.duration = e.target.value;
+    };
+
+    div.querySelector(".lesson-summary").oninput = e => {
+      lesson.summary = e.target.value;
+    };
+
     this.container.appendChild(div);
     this.reindex();
   }
 
   reindex() {
     [...this.container.children].forEach((el, i) => {
       el.querySelector(".lesson-title").dataset.index = i + 1;
+      const number = el.querySelector(".lesson-number");
+      if (number) number.textContent = `الدرس ${i + 1}`;
     });
   }
 
+  updateEmptyState() {
+    if (!this.emptyState) return;
+    this.emptyState.style.display = this.lessons.length ? "none" : "block";
+  }
+
   getData() {
     return this.lessons;
   }
 }
