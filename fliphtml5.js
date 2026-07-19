(function () {
  const DEFAULT_CODE = `<div id="flipOuter" style="position:relative; overflow:hidden; width:100vw; margin-left:calc(-50vw + 50%); margin-top:0; margin-bottom:0; padding:0; display:block; line-height:0;">

  [fliph5 id="tbyony#sieu" width="100%" height="700px" title="Халгай клиник салон"]

</div>

<style>
#flipOuter {
  height: 700px;
  font-size: 0;
}

#flipOuter iframe {
  width: 100% !important;
  height: 700px !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  vertical-align: top !important;
}

.elementor-widget-html {
  margin: 0 !important;
  padding: 0 !important;
}

/* Утас */
@media (max-width: 767px) {
  #flipOuter {
    height: 100vh !important;
  }
  #flipOuter iframe {
    height: 100vh !important;
    margin: 0 !important;
  }
}
</style>`;

  const DEFAULT_HINT_HTML = `<span class="drag-hint-disc"><img src="assets/drag4.svg" alt="Хуудсыг зүүн, баруун тийш чирнэ"></span>`;
  const DEFAULT_HINT_CSS = `.drag-hint-disc {
  width: 90px;
  height: 90px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 13px;
  border-radius: 50%;
  background: #78a450;
}
.drag-hint-disc img { width: 100%; height: 100%; object-fit: contain; }
selector {
  display: inline-block;
  pointer-events: none !important;
  cursor: grab;
  animation: slowDrag 2.5s linear infinite, hideAfter 10s forwards;
}
@keyframes slowDrag {
  0% { transform: translateX(0); }
  25% { transform: translateX(-20px); }
  50% { transform: translateX(0); }
  75% { transform: translateX(20px); }
  100% { transform: translateX(0); }
}
@keyframes hideAfter {
  0% { opacity: 1; }
  90% { opacity: 1; }
  100% { opacity: 0; visibility: hidden; }
}`;

  function htmlSafe(value = "") {
    return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function shortcodeAttributes(code) {
    const match = String(code || "").match(/\[fliph5\s+([^\]]+)\]/i);
    if (!match) return null;
    const attributes = {};
    for (const item of match[1].matchAll(/([a-zA-Z][\w-]*)\s*=\s*"([^"]*)"/g)) attributes[item[1].toLowerCase()] = item[2];
    return attributes;
  }

  function cssSize(value, fallback) {
    const candidate = String(value || "").trim();
    return /^(?:\d+(?:\.\d+)?)(?:px|%|vh|vw|rem|em)$/.test(candidate) ? candidate : fallback;
  }

  function flipConfig(code) {
    const attributes = shortcodeAttributes(code);
    if (!attributes) return null;
    const id = String(attributes?.id || "tbyony#sieu");
    const [accountRaw, bookRaw] = id.split("#");
    const account = String(accountRaw || "tbyony").replace(/[^a-zA-Z0-9_-]/g, "") || "tbyony";
    const book = String(bookRaw || "sieu").replace(/[^a-zA-Z0-9_-]/g, "") || "sieu";
    return {
      src: `https://online.fliphtml5.com/${account}/${book}/`,
      width: cssSize(attributes?.width, "100%"),
      height: cssSize(attributes?.height, "700px"),
      title: attributes?.title || "Халгай клиник салон"
    };
  }

  function hintDocument(catalog) {
    const html = String(catalog.dragHintHtml || DEFAULT_HINT_HTML);
    const css = String(catalog.dragHintCss || DEFAULT_HINT_CSS).replace(/\bselector\b/g, ".drag-hint-content");
    const baseUrl = htmlSafe(new URL(".", location.href).href);
    return `<!doctype html><html><head><meta charset="utf-8"><base href="${baseUrl}"><style>html,body{width:100%;height:100%;margin:0;overflow:visible;background:transparent}body{display:flex;align-items:center;justify-content:center}.drag-hint-content{max-width:100%;max-height:100%}${css}</style></head><body><div class="drag-hint-content">${html}</div></body></html>`;
  }

  function customStyles(code) {
    return [...String(code || "").matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
      .map(match => match[1])
      .join("\n")
      .replace(/<\/style/gi, "<\\/style");
  }

  function outerInlineStyle(code) {
    const tag = String(code || "").match(/<div\b[^>]*\bid=["']flipOuter["'][^>]*>/i)?.[0] || "";
    return tag.match(/\bstyle=["']([^"']*)["']/i)?.[1] || "";
  }

  function render(stage, catalog = {}) {
    if (!stage) return;
    const code = Object.prototype.hasOwnProperty.call(catalog, "flipHtml5Code")
      ? String(catalog.flipHtml5Code ?? "")
      : DEFAULT_CODE;
    const config = flipConfig(code);
    if (!config) {
      stage.replaceChildren();
      return;
    }
    const customCss = customStyles(code);
    const customStyleTag = customCss ? `<style class="catalog-custom-style">${customCss}</style>` : "";
    const inlineStyle = outerInlineStyle(code);
    const hint = catalog.dragHintEnabled === false ? "" : `<iframe class="catalog-drag-hint-frame" id="catalogDragHintFrame" title="Хуудсыг чирэх заавар" sandbox=""></iframe>`;
    const adCoverDesktop = Math.max(0, Math.min(300, Number(catalog.adCoverDesktop) || 0));
    const adCoverMobile = Math.max(0, Math.min(300, Number(catalog.adCoverMobile) || 0));
    const adCover = adCoverDesktop || adCoverMobile
      ? `<div class="catalog-ad-cover" style="--catalog-ad-cover-desktop:${adCoverDesktop}px;--catalog-ad-cover-mobile:${adCoverMobile}px" aria-hidden="true"></div>`
      : "";
    stage.innerHTML = `${customStyleTag}<div id="flipOuter" style="${htmlSafe(inlineStyle)};--flip-width:${htmlSafe(config.width)};--flip-height:${htmlSafe(config.height)}"><iframe src="${htmlSafe(config.src)}" title="${htmlSafe(config.title)}" loading="eager" scrolling="no" frameborder="0" allow="fullscreen" allowfullscreen></iframe></div>${adCover}${hint}`;
    const hintFrame = document.getElementById("catalogDragHintFrame");
    if (hintFrame) hintFrame.srcdoc = hintDocument(catalog);
  }

  window.KhalgaiFlipHtml5 = {
    DEFAULT_CODE,
    DEFAULT_HINT_HTML,
    DEFAULT_HINT_CSS,
    render
  };
})();
