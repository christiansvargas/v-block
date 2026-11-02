// The worker sleeps between setting changes; there is no background polling.
const DEFAULTS = { enabled: true, skipVideoAds: true };
async function setRules(enabled) {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? ["ad_rules"] : [],
    disableRulesetIds: enabled ? [] : ["ad_rules"],
  });
}
let queue = Promise.resolve();
function enqueue(task) {
  const result = queue.then(task);
  queue = result.catch(console.error);
  return result;
}
async function reconcile() {
  const settings = await chrome.storage.local.get(DEFAULTS);
  await setRules(settings.enabled);
}
chrome.runtime.onInstalled.addListener(() => enqueue(reconcile));
chrome.runtime.onStartup.addListener(() => enqueue(reconcile));
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.type !== "set-options")
    return;
  if (
    typeof message.enabled !== "boolean" ||
    typeof message.skipVideoAds !== "boolean"
  ) {
    respond({ ok: false, error: "Invalid settings." });
    return;
  }
  enqueue(async () => {
    const previous = await chrome.storage.local.get(DEFAULTS);
    await setRules(message.enabled);
    try {
      await chrome.storage.local.set({
        enabled: message.enabled,
        skipVideoAds: message.skipVideoAds,
      });
    } catch (error) {
      await setRules(previous.enabled);
      throw error;
    }
  }).then(
    () => respond({ ok: true }),
    (error) => respond({ ok: false, error: error.message }),
  );
  return true;
});
