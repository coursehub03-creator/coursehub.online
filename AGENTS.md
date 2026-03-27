# CourseHub Engineering Instructions

## Project Stack
This is a static HTML/CSS/JavaScript Firebase project.
Do not rewrite the whole project into React, Vue, or Next unless absolutely necessary.
Prefer improving and refactoring the current architecture.

## Main Architecture
Relevant files include:
- admin/add-course.html
- admin/js-admin/add-course.js
- admin/courses-admin.html
- admin/js-admin/courses-admin.js
- instructor-builder.html
- js/instructor-builder.js
- instructor-courses.html
- js/instructor-portal.js
- css/instructor-builder.css
- css/design-system.css
- css/app-shell.css
- functions/index.js

## Product
CourseHub is an Arabic RTL e-learning platform with three main roles:
- Admin
- Instructor
- Student

## Core Product Goals
- Make the course builder professional and practical
- Unify admin and instructor course creation experience
- Improve moderation/review workflow
- Make the student course experience premium
- Preserve maintainability and current Firebase integration

## Critical Rules
- Keep the current project structure unless refactoring is clearly needed
- Reuse current HTML/JS/CSS architecture
- Use Firebase/Firestore/Storage/Cloud Functions patterns already present
- Do not break existing auth or role logic
- Arabic RTL UX quality is mandatory
- Prefer modular reusable JS over duplicated code

## Roles
### Admin
- Can create courses directly
- Can edit all fields
- Can set final price
- Can publish/unpublish
- Can approve/reject/request changes for instructor submissions
- Can override instructor suggested price

### Instructor
- Can create and edit only own course drafts/submissions
- Uses the same builder UX as admin
- Can suggest price only
- Cannot publish directly
- Can submit for review
- Can receive notes, edit, and resubmit

### Student
- Sees only published courses
- Should get premium course landing and lesson experience

## Workflow States
Use and normalize these states where practical:
- draft
- submitted
- under_review
- changes_requested
- resubmitted
- approved
- rejected
- published
- archived

Record review notes and timeline history where practical.

## Builder Expectations
The builder should support:
- basic info
- cover and promo media
- curriculum
- flexible lesson content
- slide/story editing
- quizzes/checkpoints
- preview
- submit/review/publish flow

## Slide Editor
High priority:
- multi-slide lesson editing
- visual canvas-like editing
- move text/images/video freely
- resize
- reorder layers
- delete/duplicate
- real preview rendering for student view
- saved structured JSON schema

## Quiz Requirements
- multiple questions
- 4 options by default
- ability to add more options/questions
- correct answer
- explanations
- passing score
- final quiz and checkpoint quiz support

## UI/UX Standards
- professional Arabic copy
- strong hierarchy
- clean cards/panels
- reduced empty space
- responsive layouts
- clear validation and feedback states
- no crude prototype feel

## Execution Behavior
- inspect existing files before editing
- refactor shared logic into reusable builder utilities if useful
- connect frontend + Firestore + Cloud Functions end-to-end
- preserve working functionality when possible
- after changes, summarize exactly what changed
- state assumptions clearly
