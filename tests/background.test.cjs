const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
function fixture(failStorage = false) {
  let listener,
    state = { enabled: true, skipVideoAds: true },
    rules = true;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../background.js"), "utf8"),
    {
      console: { error() {} },
      chrome: {
        runtime: {
          id: "test",
          onInstalled: { addListener() {} },
          onStartup: { addListener() {} },
          onMessage: {
            addListener(fn) {
              listener = fn;
            },
          },
        },
        storage: {
          local: {
            get: async () => ({ ...state }),
            set: async (value) => {
              if (failStorage) throw Error("storage failed");
              state = value;
            },
          },
        },
        declarativeNetRequest: {
          updateEnabledRulesets: async (value) => {
            rules = value.enableRulesetIds.length > 0;
          },
        },
      },
    },
  );
  return {
    state: () => state,
    rules: () => rules,
    send: (values) =>
      new Promise((resolve) =>
        listener({ type: "set-options", ...values }, { id: "test" }, resolve),
      ),
  };
}
test("toggle updates rules and preferences together", async () => {
  const f = fixture();
  assert.equal(
    (await f.send({ enabled: false, skipVideoAds: false })).ok,
    true,
  );
  assert.equal(f.rules(), false);
  assert.equal(f.state().enabled, false);
});
test("storage failure rolls network rules back", async () => {
  const f = fixture(true);
  assert.equal(
    (await f.send({ enabled: false, skipVideoAds: true })).ok,
    false,
  );
  assert.equal(f.rules(), true);
  assert.equal(f.state().enabled, true);
});
test("reject malformed preference messages", async () => {
  const f = fixture();
  assert.equal(
    (await f.send({ enabled: "false", skipVideoAds: true })).ok,
    false,
  );
  assert.equal(f.rules(), true);
});
