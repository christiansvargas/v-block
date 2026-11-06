(() => {
  "use strict";
  const ROOT_CLASS = "v-block-enabled";
  const SKIP =
    ".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern";
  // Rendered from the start of a skippable ad, unlike the button itself.
  const SKIPPABLE_AD = ".ytp-skip-ad";
  const SKIP_EVENT = "v-block-skip";
  const MEDIA_EVENTS = ["loadedmetadata", "durationchange", "canplay"];
  const HAVE_FUTURE_DATA = 3;
  const SKIP_WAIT_MS = 300;
  const SKIP_RETRY_MS = 500;
  const TOAST_MS = 2000;
  let options = { enabled: true, skipVideoAds: true };
  let player = null;
  let saved = null;
  let timer = null;
  let lastSkip = 0;
  let skipRequested = false;
  let tickTarget = null;
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
  function stopWatchingSeek() {
    saved.video.removeEventListener("seeked", saved.onSeekDone);
    saved.video.removeEventListener("emptied", saved.onSeekDone);
  }
  function restore() {
    if (saved) {
      // Only restore the property we changed, and only if it is still muted.
      if (saved.video.muted) saved.video.muted = saved.muted;
      stopWatchingSeek();
      saved = null;
    }
  }
  // While an ad plays, recheck on each playback tick (about 4 per second).
  // The Skip button can become visible without a mutation the observers see.
  function watchAdPlayback(target) {
    if (tickTarget === target) return;
    tickTarget?.removeEventListener("timeupdate", schedule, true);
    tickTarget = target;
    tickTarget?.addEventListener("timeupdate", schedule, true);
  }
  function requestSkip() {
    skipRequested = true;
    // Never button.click(): YouTube ignores untrusted clicks and reports them.
    document.dispatchEvent(new CustomEvent(SKIP_EVENT));
  }
  function handleAd() {
    const adShowing = player?.classList.contains("ad-showing");
    const active = options.enabled && options.skipVideoAds && adShowing;
    watchAdPlayback(active ? player : null);
    if (!active) {
      // The player reports no skip result, so only the ad ending confirms it.
      if (skipRequested && !adShowing) showToast();
      skipRequested = false;
      restore();
      return;
    }
    const button = [...player.querySelectorAll(SKIP)].find(
      (el) =>
        !el.disabled &&
        el.getAttribute("aria-disabled") !== "true" &&
        el.getClientRects().length,
    );
    if (button && Date.now() - lastSkip > SKIP_RETRY_MS) {
      lastSkip = Date.now();
      requestSkip();
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
    const key = `${video.currentSrc}|${video.duration}`;
    if (
      // Seeking before playback data exists freezes the player at the ad's end.
      video.readyState < HAVE_FUTURE_DATA ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.currentTime >= video.duration - 0.25
    ) {
      return;
    }
    // Prefer a skip: YouTube flags prerolls that are sought, not ones skipped.
    // Non-skippable ads ignore the request, so they fall through to seeking.
    if (saved.skipKey !== key) {
      saved.skipKey = key;
      saved.skipWaiting = true;
      requestSkip();
      const waited = saved;
      setTimeout(() => {
        waited.skipWaiting = false;
        skipRequested = false;
        schedule();
      }, SKIP_WAIT_MS);
      return;
    }
    // Experimental: only seek a finite video while YouTube explicitly marks the
    // player as an ad, and past two minutes only if the ad is also skippable.
    // Never block googlevideo.com or change speed.
    if (
      !saved.skipWaiting &&
      (video.duration <= 120 || player.querySelector(SKIPPABLE_AD)) &&
      saved.attempted !== key
    ) {
      saved.attempted = key;
      stopWatchingSeek();
      // Only confirm the skip once playback has actually reached the end. The
      // ad is usually replaced first, which empties the video without "seeked".
      saved.onSeekDone = (event) => {
        stopWatchingSeek();
        if (
          event.type === "emptied" ||
          video.currentTime >= video.duration - 0.25
        ) {
          showToast();
        }
      };
      try {
        video.currentTime = video.duration - 0.05;
        video.addEventListener("seeked", saved.onSeekDone);
        video.addEventListener("emptied", saved.onSeekDone);
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
      removeMediaListeners();
      player = next;
      if (player) {
        playerObserver = new MutationObserver(schedule);
        playerObserver.observe(player, {
          attributes: true,
          attributeFilter: ["class"],
          childList: true,
          subtree: true,
        });
        for (const type of MEDIA_EVENTS) {
          player.addEventListener(type, schedule, true);
        }
      }
    }
    handleAd();
  }
  function removeMediaListeners() {
    for (const type of MEDIA_EVENTS) {
      player?.removeEventListener(type, schedule, true);
    }
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
    watchAdPlayback(null);
    hideToast();
    document.documentElement?.classList.remove(ROOT_CLASS);
    document.removeEventListener("yt-navigate-finish", schedule);
    removeMediaListeners();
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
