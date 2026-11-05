/* Desktop presentation only. Deliberately no service worker, offline storage or fetch
   interception: operational data and updates keep the existing network path. */
(() => {
  const button = document.getElementById("installAppButton");
  if (!button) return;
  const displayMode = window.matchMedia("(display-mode: standalone)");
  const overlayMode = window.matchMedia("(display-mode: window-controls-overlay)");
  const inAppWindow = () => displayMode.matches || overlayMode.matches || window.navigator.standalone === true;
  let installPrompt = null;
  let prompting = false;
  let installed = inAppWindow();

  const refresh = () => {
    button.hidden = installed || inAppWindow() || !installPrompt;
    button.disabled = prompting;
  };
  refresh();

  window.addEventListener("beforeinstallprompt", event => {
    if (installed || inAppWindow()) return;
    event.preventDefault();
    installPrompt = event;
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    installPrompt = null;
    refresh();
  });
  displayMode.addEventListener?.("change", refresh);
  overlayMode.addEventListener?.("change", refresh);

  button.addEventListener("click", async () => {
    if (!installPrompt || prompting || installed || inAppWindow()) return;
    const prompt = installPrompt;
    installPrompt = null;
    prompting = true;
    refresh();
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === "accepted") installed = true;
    } catch (error) {
      // Unsupported/dismissed prompts must never interfere with salon work.
      console.warn("App installation prompt unavailable", error);
    } finally {
      prompting = false;
      refresh();
    }
  });
})();
