import { createCourseBuilder } from "/js/shared/course-builder-core.js";

document.addEventListener("DOMContentLoaded", async () => {
  const builder = createCourseBuilder({
    role: "instructor",
    selectors: {
      localDraftKey: "coursehub_instructor_builder_draft_v8",
      draftCollection: "instructorCourseDrafts"
    }
  });
  await builder.mount();
});
