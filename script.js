const enabled = document.getElementById("enabled");
const skip = document.getElementById("skipVideoAds");
const status = document.getElementById("status");
let current;
function render() {
  enabled.checked = current.enabled;
  skip.checked = current.skipVideoAds;
  enabled.disabled = false;
  skip.disabled = !current.enabled;
  status.textContent = current.enabled
    ? "Filtering enabled on desktop YouTube."
    : "Filtering paused. Reload if needed.";
}
async function save() {
  const next = { enabled: enabled.checked, skipVideoAds: skip.checked };
  enabled.disabled = skip.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "set-options",
      ...next,
    });
    if (!result?.ok)
      throw new Error(result?.error || "Could not save settings.");
    current = next;
    render();
  } catch (error) {
    render();
    status.textContent = `Settings not saved: ${error.message}`;
  }
}
chrome.storage.local
  .get({ enabled: true, skipVideoAds: true })
  .then((settings) => {
    current = settings;
    render();
  })
  .catch((error) => {
    status.textContent = `Could not load settings: ${error.message}`;
  });
enabled.addEventListener("change", save);
skip.addEventListener("change", save);
