diff --git a/admin/js-admin/courses-admin.js b/admin/js-admin/courses-admin.js
index 540f1f934515be7ebb4457756b17aba31308fc38..8cc4162d159a61261d43a7c2c60ffaf778ff9e85 100644
--- a/admin/js-admin/courses-admin.js
+++ b/admin/js-admin/courses-admin.js
@@ -1,97 +1,136 @@
 // js-admin/courses-admin.js
 
 import { db } from "/js/firebase-config.js";
 import { protectAdmin } from "./admin-guard.js";
 import {
   collection,
   getDocs,
   doc,
   deleteDoc
 } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
 
 document.addEventListener("DOMContentLoaded", async () => {
   // 🔐 حماية الأدمن
   const adminUser = await protectAdmin();
   console.log("أدمن مسجل:", adminUser.email);
 
-  const addBtn = document.getElementById("add-course-btn");
-  const tbody = document.getElementById("courses-list");
+  const addBtn = document.getElementById("add-course-btn");
+  const tbody = document.getElementById("courses-list");
+  const statusFilter = document.getElementById("course-status-filter");
+  const searchInput = document.getElementById("course-search");
+  const categoryFilter = document.getElementById("course-category-filter");
 
   if (!addBtn || !tbody) {
     console.error("عناصر الصفحة غير موجودة");
     return;
   }
 
   // ✅ زر إضافة دورة
   addBtn.addEventListener("click", (e) => {
     e.preventDefault();
     console.log("تم الضغط على زر إضافة دورة");
     window.location.href = "/admin/add-course.html";
   });
 
   // -----------------------------
   // تحميل الدورات
   // -----------------------------
-  async function loadCourses() {
-    tbody.innerHTML =
-      "<tr><td colspan='4'>جارٍ تحميل الدورات...</td></tr>";
+  let allCourses = [];
+
+  const statusBadge = (status) => {
+    if (status === "published") return "<span class='badge success'>منشورة</span>";
+    if (status === "review") return "<span class='badge warning'>قيد المراجعة</span>";
+    return "<span class='badge neutral'>مسودة</span>";
+  };
+
+  const renderCourses = (courses) => {
+    tbody.innerHTML = "";
+
+    if (!courses.length) {
+      tbody.innerHTML =
+        "<tr><td colspan='5'>لا توجد دورات حالياً</td></tr>";
+      return;
+    }
+
+    courses.forEach(({ id, data }) => {
+      const course = data;
+      const tr = document.createElement("tr");
+      tr.innerHTML = `
+        <td>${course.title || "-"}</td>
+        <td>${course.description || "-"}</td>
+        <td>${statusBadge(course.status)}</td>
+        <td>${course.studentsCount || 0}</td>
+        <td>
+          <button
+            type="button"
+            class="delete-btn"
+            data-id="${id}"
+          >
+            حذف
+          </button>
+        </td>
+      `;
+
+      tbody.appendChild(tr);
+    });
+  };
+
+  const applyFilters = () => {
+    const statusValue = statusFilter?.value || "all";
+    const categoryValue = categoryFilter?.value || "all";
+    const query = searchInput?.value.toLowerCase().trim() || "";
+
+    const filtered = allCourses.filter(({ data }) => {
+      const statusMatch = statusValue === "all" || data.status === statusValue;
+      const categoryMatch = categoryValue === "all" || data.category === categoryValue;
+      const searchMatch = !query || (data.title || "").toLowerCase().includes(query);
+      return statusMatch && categoryMatch && searchMatch;
+    });
+
+    renderCourses(filtered);
+  };
+
+  async function loadCourses() {
+    tbody.innerHTML =
+      "<tr><td colspan='5'>جارٍ تحميل الدورات...</td></tr>";
 
     try {
       const snapshot = await getDocs(collection(db, "courses"));
-      tbody.innerHTML = "";
-
-      if (snapshot.empty) {
-        tbody.innerHTML =
-          "<tr><td colspan='4'>لا توجد دورات حالياً</td></tr>";
-        return;
-      }
-
-      snapshot.forEach((docSnap) => {
-        const course = docSnap.data();
-
-        const tr = document.createElement("tr");
-        tr.innerHTML = `
-          <td>${course.title || "-"}</td>
-          <td>${course.description || "-"}</td>
-          <td>${course.studentsCount || 0}</td>
-          <td>
-            <button
-              type="button"
-              class="delete-btn"
-              data-id="${docSnap.id}"
-            >
-              حذف
-            </button>
-          </td>
-        `;
-
-        tbody.appendChild(tr);
-      });
-    } catch (err) {
-      console.error("خطأ في تحميل الدورات:", err);
-      tbody.innerHTML =
-        "<tr><td colspan='4'>حدث خطأ أثناء التحميل</td></tr>";
-    }
-  }
+      allCourses = snapshot.docs.map((docSnap) => ({
+        id: docSnap.id,
+        data: docSnap.data()
+      }));
+
+      applyFilters();
+    } catch (err) {
+      console.error("خطأ في تحميل الدورات:", err);
+      tbody.innerHTML =
+        "<tr><td colspan='5'>حدث خطأ أثناء التحميل</td></tr>";
+    }
+  }
 
   // -----------------------------
   // حذف دورة
   // -----------------------------
   tbody.addEventListener("click", async (e) => {
     if (!e.target.classList.contains("delete-btn")) return;
 
     const courseId = e.target.dataset.id;
 
     if (!confirm("هل أنت متأكد من حذف الدورة؟")) return;
 
     try {
       await deleteDoc(doc(db, "courses", courseId));
       await loadCourses();
     } catch (err) {
       console.error("فشل حذف الدورة:", err);
       alert("حدث خطأ أثناء الحذف");
     }
   });
 
-  await loadCourses();
-});
+  await loadCourses();
+
+  statusFilter?.addEventListener("change", applyFilters);
+  categoryFilter?.addEventListener("change", applyFilters);
+  searchInput?.addEventListener("input", applyFilters);
+});
