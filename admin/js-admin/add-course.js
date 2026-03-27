import { createCourseBuilder } from "/js/shared/course-builder-core.js";

document.addEventListener("DOMContentLoaded", async () => {
  const builder = createCourseBuilder({
    role: "admin",
    selectors: {
      localDraftKey: "coursehub_admin_builder_draft_v8",
      draftCollection: "adminCourseDrafts"
    }
  });
  await builder.mount();
});
