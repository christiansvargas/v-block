const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
async function fixture({
  ad = false,
  duration = 30,
  muted = false,
  button = null,
  enabled = true,
} = {}) {
  let activeAd = ad,
    callback,
    pending,
    clicks = 0;
  const toasts = [];
  const timers = [];
  const video = {
    muted,
    currentTime: 3,
    duration,
    readyState: 1,
    currentSrc: "test-video",
  };
  const player = {
    classList: { contains: () => activeAd },
    querySelector: () => video,
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
    addEventListener() {},
    removeEventListener() {},
  };
  vm.runInNewContext(source, {
    document,
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
  return {
    video,
    toasts,
    timers,
    clicks: () => clicks,
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
test("marked short ad is muted and sought to end", async () => {
  const f = await fixture({ ad: true });
  assert.equal(f.video.currentTime, 30);
  assert.equal(f.video.muted, true);
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
test("visible skip button takes precedence over seeking", async () => {
  const f = await fixture({ ad: true, button: true });
  assert.equal(f.clicks(), 1);
  assert.equal(f.video.currentTime, 3);
});
test("skip button shows a toast that clears after two seconds", async () => {
  const f = await fixture({ ad: true, button: true });
  assert.equal(f.toasts.length, 1);
  assert.equal(f.toasts[0].textContent, "Ad skipped by v-block");
  const { fn, ms } = f.timers.at(-1);
  assert.equal(ms, 2000);
  fn();
  assert.equal(f.toasts.length, 0);
});
test("seeking past an ad shows a toast", async () => {
  const f = await fixture({ ad: true });
  assert.equal(f.toasts.length, 1);
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
