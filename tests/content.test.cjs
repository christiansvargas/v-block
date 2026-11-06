const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../content/content.js"), "utf8");
async function fixture({
  ad = false,
  duration = 30,
  muted = false,
  button = null,
  enabled = true,
  readyState = 4,
  skippable = false,
  settle = true,
} = {}) {
  let activeAd = ad,
    callback,
    pending,
    clicks = 0,
    skipRequests = 0;
  const toasts = [];
  const timers = [];
  const videoListeners = { seeked: new Set(), emptied: new Set() };
  const video = {
    muted,
    currentTime: 3,
    duration,
    readyState,
    currentSrc: "test-video",
    addEventListener(type, fn) {
      videoListeners[type]?.add(fn);
    },
    removeEventListener(type, fn) {
      videoListeners[type]?.delete(fn);
    },
  };
  const fire = (type) => {
    for (const fn of [...videoListeners[type]]) fn({ type });
  };
  const player = {
    classList: { contains: () => activeAd },
    querySelector: (selector) =>
      selector === "video" ? video : skippable ? {} : null,
    querySelectorAll: () =>
      button
        ? [
            {
              disabled: false,
              getAttribute: () => null,
              getClientRects: () => [1],
              click: () => clicks++,
            },
          ]
        : [],
    addEventListener() {},
    removeEventListener() {},
  };
  const document = {
    documentElement: { classList: { toggle() {}, remove() {} } },
    body: {
      append(el) {
        toasts.push(el);
      },
    },
    createElement: () => ({
      setAttribute() {},
      remove() {
        toasts.splice(toasts.indexOf(this), 1);
      },
    }),
    getElementById: () => player,
    dispatchEvent(event) {
      if (event.type === "v-block-skip") skipRequests++;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  vm.runInNewContext(source, {
    document,
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    window: { addEventListener() {} },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    setTimeout(fn, ms) {
      pending = fn;
      timers.push({ fn, ms });
      return 1;
    },
    clearTimeout() {},
    chrome: {
      storage: {
        local: { get: async () => ({ enabled, skipVideoAds: true }) },
        onChanged: {
          addListener(fn) {
            callback = fn;
          },
          removeListener() {},
        },
      },
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  // Wait out the skip request, then run the update it schedules.
  const finishSkipWait = () => {
    pending?.();
    pending?.();
  };
  if (settle) finishSkipWait();
  return {
    video,
    toasts,
    timers,
    clicks: () => clicks,
    skipRequests: () => skipRequests,
    fire,
    finishSkipWait,
    change(values) {
      callback(values, "local");
      pending?.();
    },
    endAd() {
      activeAd = false;
      callback({ enabled: { newValue: true } }, "local");
      pending?.();
    },
  };
}
test("normal content is neither muted nor sought", async () => {
  const f = await fixture();
  assert.equal(f.video.currentTime, 3);
  assert.equal(f.video.muted, false);
});
test("marked short ad is muted and sought just before its end", async () => {
  const f = await fixture({ ad: true });
  assert.equal(f.video.currentTime, 29.95);
  assert.equal(f.video.muted, true);
});
test("ad is not sought until playback data is ready", async () => {
  const f = await fixture({ ad: true, readyState: 1 });
  assert.equal(f.video.currentTime, 3);
  assert.equal(f.skipRequests(), 0);
  assert.equal(f.video.muted, true);
  f.video.readyState = 3;
  f.change({ enabled: { newValue: true } });
  assert.equal(f.skipRequests(), 1);
  f.finishSkipWait();
  assert.equal(f.video.currentTime, 29.95);
});
test("ready ad gets a skip request before any seek", async () => {
  const f = await fixture({ ad: true, settle: false });
  assert.equal(f.skipRequests(), 1);
  assert.equal(f.video.currentTime, 3);
  f.finishSkipWait();
  assert.equal(f.skipRequests(), 1);
  assert.equal(f.video.currentTime, 29.95);
});
test("updates during the skip wait do not seek", async () => {
  const f = await fixture({ ad: true, settle: false });
  f.change({ enabled: { newValue: true } });
  assert.equal(f.video.currentTime, 3);
});
test("ad ended by the skip request is not sought and shows a toast", async () => {
  const f = await fixture({ ad: true, settle: false });
  f.endAd();
  assert.equal(f.toasts.length, 1);
  assert.equal(f.video.currentTime, 3);
});
test("ignored skip request shows no toast when the ad later ends", async () => {
  const f = await fixture({ ad: true, duration: 121 });
  f.endAd();
  assert.equal(f.toasts.length, 0);
});
test("skippable ads are sought past two minutes", async () => {
  const f = await fixture({ ad: true, duration: 157, skippable: true });
  assert.equal(f.video.currentTime, 156.95);
});
test("audio restores when ad ends", async () => {
  const f = await fixture({ ad: true });
  f.endAd();
  assert.equal(f.video.muted, false);
});
test("original mute preference survives ad", async () => {
  const f = await fixture({ ad: true, muted: true });
  f.endAd();
  assert.equal(f.video.muted, true);
});
test("disabling restores audio immediately", async () => {
  const f = await fixture({ ad: true });
  f.change({ enabled: { newValue: false } });
  assert.equal(f.video.muted, false);
});
test("disabled extension leaves ad video alone", async () => {
  const f = await fixture({ ad: true, enabled: false });
  assert.equal(f.video.currentTime, 3);
  assert.equal(f.video.muted, false);
});
test("live and long videos are not sought", async () => {
  for (const duration of [Infinity, NaN, 121]) {
    const f = await fixture({ ad: true, duration });
    assert.equal(f.video.currentTime, 3);
  }
});
test("live skippable ads are not sought", async () => {
  for (const duration of [Infinity, NaN]) {
    const f = await fixture({ ad: true, duration, skippable: true });
    assert.equal(f.video.currentTime, 3);
  }
});
test("visible skip button takes precedence over seeking", async () => {
  const f = await fixture({ ad: true, button: true });
  assert.equal(f.skipRequests(), 1);
  assert.equal(f.video.currentTime, 3);
});
test("skip button is never clicked by script", async () => {
  const f = await fixture({ ad: true, button: true });
  assert.equal(f.clicks(), 0);
});
test("skip request shows no toast until the ad ends", async () => {
  const f = await fixture({ ad: true, button: true });
  assert.equal(f.toasts.length, 0);
  f.endAd();
  assert.equal(f.toasts.length, 1);
});
test("skip toast clears after two seconds", async () => {
  const f = await fixture({ ad: true, button: true });
  f.endAd();
  assert.equal(f.toasts.length, 1);
  assert.equal(f.toasts[0].textContent, "Ad skipped by v-block");
  const { fn, ms } = f.timers.at(-1);
  assert.equal(ms, 2000);
  fn();
  assert.equal(f.toasts.length, 0);
});
test("seeking past an ad shows a toast once the seek completes", async () => {
  const f = await fixture({ ad: true });
  assert.equal(f.toasts.length, 0);
  f.fire("seeked");
  assert.equal(f.toasts.length, 1);
});
test("ad replaced before the seek completes shows a toast", async () => {
  const f = await fixture({ ad: true });
  f.fire("emptied");
  assert.equal(f.toasts.length, 1);
});
test("rejected seek shows no toast when the ad later ends", async () => {
  const f = await fixture({ ad: true });
  f.video.currentTime = 3;
  f.fire("seeked");
  f.fire("emptied");
  assert.equal(f.toasts.length, 0);
});
test("rejected seek shows no toast", async () => {
  const f = await fixture({ ad: true });
  f.video.currentTime = 3;
  f.fire("seeked");
  assert.equal(f.toasts.length, 0);
});
test("seek finishing after the ad ends shows no toast", async () => {
  const f = await fixture({ ad: true });
  f.endAd();
  f.fire("seeked");
  assert.equal(f.toasts.length, 0);
});
test("no toast without a skip", async () => {
  for (const options of [
    {},
    { ad: true, duration: 121 },
    { ad: true, enabled: false },
  ]) {
    const f = await fixture(options);
    assert.equal(f.toasts.length, 0);
  }
});
