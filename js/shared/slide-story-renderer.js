const esc = (v = "") =>
  String(v).replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

export function normalizeSlideBackground(background) {
  if (!background) return { type: "color", color: "#f8fafc", image: "" };
  if (typeof background === "string") return { type: "color", color: background, image: "" };
  return {
    type: background.type === "image" && background.image ? "image" : "color",
    color: background.color || "#f8fafc",
    image: background.image || ""
  };
}

export function slideBackgroundStyle(background) {
  const bg = normalizeSlideBackground(background);
  if (bg.type === "image" && bg.image) {
    return `background-color:${bg.color};background-image:url('${esc(bg.image)}');background-size:cover;background-position:center;`;
  }
  return `background:${bg.color};`;
}

function renderMediaByType(type, src, alt = "") {
  if (!src) return `<div class="media-placeholder">${type === "video" ? "أضف رابط فيديو" : "أضف رابط صورة"}</div>`;
  if (type === "video") {
    if (src.includes("youtube.com") || src.includes("youtu.be")) {
      const videoId = src.includes("youtu.be/") ? src.split("youtu.be/")[1]?.split(/[?&]/)[0] : new URL(src).searchParams.get("v");
      if (videoId) {
        return `<iframe src="https://www.youtube.com/embed/${esc(videoId)}" loading="lazy" allowfullscreen></iframe>`;
      }
    }
    return `<video src="${esc(src)}" controls></video>`;
  }
  return `<img src="${esc(src)}" alt="${esc(alt || "وسائط")}" loading="lazy">`;
}

export function renderSlideElements(slide, options = {}) {
  const {
    scale = 1,
    editable = false,
    selectedElementId = "",
    withResizeHandle = false,
    withMediaInput = false
  } = options;

  const elements = Array.isArray(slide?.elements) ? [...slide.elements].sort((a, b) => (a.z || 0) - (b.z || 0)) : [];
  return elements
    .map((el) => {
      const style = el.style || {};
      const x = Math.round((el.x || 0) * scale);
      const y = Math.round((el.y || 0) * scale);
      const w = Math.max(24, Math.round((el.w || 120) * scale));
      const h = Math.max(20, Math.round((el.h || 60) * scale));
      const isSelected = selectedElementId && selectedElementId === el.id;
      const baseStyle = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${el.z || 1};color:${style.color || "#0f172a"};font-size:${(style.fontSize || 20) * scale}px;font-weight:${style.fontWeight || (el.type === "heading" ? 700 : 500)};text-align:${style.align || "right"};border-radius:${Math.round((style.radius || 8) * scale)}px;${el.type === "shape" ? `background:${style.background || "#dbeafe"};` : "background:transparent;"}`;

      let body = "";
      if (el.type === "image" || el.type === "video") {
        body = withMediaInput && editable
          ? `<div class="media-editor"><input class="media-url-inline" data-el-src="${el.id}" value="${esc(el.src || "")}" placeholder="رابط ${el.type === "video" ? "الفيديو" : "الصورة"}">${renderMediaByType(el.type, el.src || "", el.text || "")}</div>`
          : renderMediaByType(el.type, el.src || "", el.text || "");
      } else {
        body = `<div ${editable ? 'contenteditable="true" spellcheck="false"' : ""} data-el-text="${el.id}">${esc(el.text || (el.type === "heading" ? "عنوان" : "نص"))}</div>`;
      }

      return `<div class="canvas-element ${isSelected ? "selected" : ""}" data-el-id="${el.id}" data-el-type="${el.type}" style="${baseStyle}">${body}${
        withResizeHandle ? `<button type="button" class="resize-handle" data-resize="${el.id}" aria-label="تغيير الحجم"></button>` : ""
      }</div>`;
    })
    .join("");
}
