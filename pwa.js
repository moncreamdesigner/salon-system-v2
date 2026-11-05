/* Installation only. Deliberately no service worker, offline storage or fetch
   interception: operational data and updates keep the existing network path. */
(() => {
  const button = document.getElementById("installAppButton");
  if (!button) return;
  const displayMode = window.matchMedia("(display-mode: standalone)");
  let installPrompt = null;
  let prompting = false;
  let installed = displayMode.matches || window.navigator.standalone === true;

  const refresh = () => {
    button.hidden = installed || displayMode.matches || !installPrompt;
    button.disabled = prompting;
  };
  refresh();

  window.addEventListener("beforeinstallprompt", event => {
    if (installed || displayMode.matches) return;
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

  button.addEventListener("click", async () => {
    if (!installPrompt || prompting || installed || displayMode.matches) return;
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
