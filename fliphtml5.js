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

  // FlipHTML5 short embed code: <script src="https://online.fliphtml5.com/ACCOUNT/BOOK/embed.js"></script>
  function scriptEmbedAttributes(code) {
    const match = String(code || "").match(/online\.fliphtml5\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/embed\.js/i);
    if (!match) return null;
    return { id: `${match[1]}#${match[2]}`, width: "100%", height: "700px", title: "Халгай клиник салон" };
  }

  // FlipHTML5 iframe embed: <iframe src="https://online.fliphtml5.com/ACCOUNT/BOOK/" ...></iframe>
  function iframeEmbedAttributes(code) {
    const match = String(code || "").match(/online\.fliphtml5\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\//i);
    if (!match) return null;
    const heightMatch = String(code).match(/height=["']?([\d]+(?:px|%|vh)?)["']?/i);
    const widthMatch = String(code).match(/width=["']?([\d]+(?:px|%|vw)?)["']?/i);
    return {
      id: `${match[1]}#${match[2]}`,
      width: widthMatch ? widthMatch[1] : "100%",
      height: heightMatch ? heightMatch[1] : "700px",
      title: "Халгай клиник салон"
    };
  }

  function flipConfig(code) {
    const attributes =
      shortcodeAttributes(code) ||
      scriptEmbedAttributes(code) ||
      iframeEmbedAttributes(code) ||
      shortcodeAttributes(DEFAULT_CODE);
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

  function buildIframeHtml(config) {
    return `<iframe src="${htmlSafe(config.src)}" title="${htmlSafe(config.title)}" width="${htmlSafe(config.width)}" height="${htmlSafe(config.height)}" loading="eager" scrolling="no" frameborder="0" allow="fullscreen" allowfullscreen></iframe>`;
  }

  // Хэрэглэгчийн оруулсан кодыг эх төрөлх байдлаар нь харуулна: [fliph5 ...] shortcode-ыг iframe-ээр орлуулж,
  // <script ... embed.js></script>-г iframe-ээр орлуулна. Бусад HTML/CSS хэвээр үлдэнэ.
  function transformCode(code, config) {
    let output = String(code || "");
    // 1) [fliph5 ...] shortcode → iframe
    output = output.replace(/\[fliph5\s+[^\]]+\]/gi, buildIframeHtml(config));
    // 2) <script src="...online.fliphtml5.com/ACCOUNT/BOOK/embed.js"></script> → iframe
    output = output.replace(/<script[^>]*src=["']https?:\/\/online\.fliphtml5\.com\/[^"']*embed\.js["'][^>]*>\s*<\/script>/gi, buildIframeHtml(config));
    // Хэрэв ямар ч тэмдэглэгээ илэрсэнгүй бөгөөд iframe ч байхгүй бол iframe-ийг нэмж өгнө
    if (!/\[fliph5\s/i.test(String(code || "")) && !/online\.fliphtml5\.com\/[^"'\s]+\/[^"'\s]+\/embed\.js/i.test(String(code || "")) && !/<iframe[^>]*online\.fliphtml5\.com/i.test(output)) {
      output += buildIframeHtml(config);
    }
    return output;
  }

  function render(stage, catalog = {}) {
    if (!stage) return;
    const rawCode = String(catalog.flipHtml5Code || "").trim();
    const code = rawCode || DEFAULT_CODE;
    const config = flipConfig(code);
    const hint = catalog.dragHintEnabled === false ? "" : `<iframe class="catalog-drag-hint-frame" id="catalogDragHintFrame" title="Хуудсыг чирэх заавар" sandbox=""></iframe>`;
    stage.innerHTML = `${transformCode(code, config)}${hint}`;
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
