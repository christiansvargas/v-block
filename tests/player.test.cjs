const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(
  path.join(__dirname, "../content/player.js"),
  "utf8",
);
function fixture(player) {
  const listeners = {};
  vm.runInNewContext(source, {
    document: {
      addEventListener(type, fn) {
        listeners[type] = fn;
      },
      getElementById: () => player,
    },
  });
  return () => listeners["v-block-skip"]();
}
test("skip reports every layout in the player response", () => {
  const calls = [];
  const skip = fixture({
    getPlayerResponse: () => ({
      adSlots: [
        { layoutId: "a", nested: [{ layoutId: "b" }] },
        { layoutId: 7, other: null },
      ],
    }),
    onAdUxClicked: (...args) => calls.push(args),
  });
  skip();
  assert.deepEqual(calls, [
    ["skip-button", "a"],
    ["skip-button", "b"],
  ]);
});
test("skip is harmless without a usable player", () => {
  fixture(null)();
  fixture({})();
  fixture({ getPlayerResponse: () => ({ layoutId: "a" }) })();
});
