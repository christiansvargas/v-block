(() => {
  "use strict";
  const ROOT_CLASS = "v-block-enabled";
  const SKIP =
    ".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern";
  const TOAST_MS = 2000;
  let options = { enabled: true, skipVideoAds: true };
  let player = null;
  let saved = null;
  let timer = null;
  let lastSkip = 0;
  let observer = null;
  let playerObserver = null;
  let stopped = false;
  let toast = null;
  let toastTimer = null;

  function hideToast() {
    clearTimeout(toastTimer);
    toast?.remove();
    toast = null;
  }
  function showToast() {
    hideToast();
    toast = document.createElement("div");
    toast.id = "v-block-toast";
    toast.setAttribute("role", "status");
    toast.textContent = "Ad skipped by v-block";
    // Only the fullscreen element's subtree is rendered in fullscreen.
    (document.fullscreenElement ?? document.body).append(toast);
    toastTimer = setTimeout(hideToast, TOAST_MS);
  }
  function restore() {
    if (saved) {
      // Only restore the property we changed, and only if it is still muted.
      if (saved.video.muted) saved.video.muted = saved.muted;
      saved = null;
    }
  }
  function handleAd() {
    if (
      !options.enabled ||
      !options.skipVideoAds ||
      !player?.classList.contains("ad-showing")
    ) {
      restore();
      return;
    }
    const button = [...player.querySelectorAll(SKIP)].find(
      (el) =>
        !el.disabled &&
        el.getAttribute("aria-disabled") !== "true" &&
        el.getClientRects().length,
    );
    if (button && Date.now() - lastSkip > 1000) {
      lastSkip = Date.now();
      button.click();
      showToast();
      return;
    }
    const video = player.querySelector("video");
    if (!video) {
      restore();
      return;
    }
    if (saved?.video !== video) {
      restore();
      saved = { video, muted: video.muted, attempted: "" };
    }
    video.muted = true;
    // Experimental: only seek a finite, short video while YouTube explicitly
    // marks the player as an ad. Never block googlevideo.com or change speed.
    const key = `${video.currentSrc}|${video.duration}`;
    if (
      video.readyState >= 1 &&
      Number.isFinite(video.duration) &&
      video.duration > 0 &&
      video.duration <= 120 &&
      video.currentTime < video.duration - 0.25 &&
      saved.attempted !== key
    ) {
      saved.attempted = key;
      try {
        video.currentTime = video.duration;
        showToast();
      } catch {
        /* Some ads disallow seeking. */
      }
    }
  }
  function update() {
    timer = null;
    if (stopped) return;
    document.documentElement?.classList.toggle(ROOT_CLASS, options.enabled);
    const next = document.getElementById("movie_player");
    if (next !== player) {
      restore();
      playerObserver?.disconnect();
      player?.removeEventListener("loadedmetadata", schedule, true);
      player?.removeEventListener("durationchange", schedule, true);
      player = next;
      if (player) {
        playerObserver = new MutationObserver(schedule);
        playerObserver.observe(player, {
          attributes: true,
          attributeFilter: ["class"],
          childList: true,
          subtree: true,
        });
        player.addEventListener("loadedmetadata", schedule, true);
        player.addEventListener("durationchange", schedule, true);
      }
    }
    handleAd();
  }
  function schedule() {
    if (!stopped && timer === null) timer = setTimeout(update, 100);
  }
  function onChange(changes, area) {
    if (area !== "local") return;
    for (const key of ["enabled", "skipVideoAds"]) {
      if (changes[key]) options[key] = changes[key].newValue ?? true;
    }
    if (!options.enabled || !options.skipVideoAds) restore();
    schedule();
  }
  function cleanup() {
    stopped = true;
    clearTimeout(timer);
    observer?.disconnect();
    playerObserver?.disconnect();
    restore();
    hideToast();
    document.documentElement?.classList.remove(ROOT_CLASS);
    document.removeEventListener("yt-navigate-finish", schedule);
    player?.removeEventListener("loadedmetadata", schedule, true);
    player?.removeEventListener("durationchange", schedule, true);
    chrome.storage.onChanged.removeListener(onChange);
  }
  chrome.storage.onChanged.addListener(onChange);
  chrome.storage.local
    .get(options)
    .then((result) => {
      if (stopped) return;
      options = result;
      observer = new MutationObserver(schedule);
      // Child-list only: no repeated full-page selector scans, no permanent timer.
      observer.observe(document, { childList: true, subtree: true });
      document.addEventListener("yt-navigate-finish", schedule);
      update();
    })
    .catch(cleanup);
  // BFCache pages must retain their listeners so they work when restored.
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) cleanup();
  });
})();
