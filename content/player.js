(() => {
  "use strict";
  // Runs in the page's world: player methods are not visible to content.js.
  function collectLayoutIds(value, ids = new Set()) {
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (key === "layoutId" && typeof child === "string") ids.add(child);
        else collectLayoutIds(child, ids);
      }
    }
    return ids;
  }
  document.addEventListener("v-block-skip", () => {
    const player = document.getElementById("movie_player");
    // The current ad's layout id is not exposed, so report every one listed.
    for (const id of collectLayoutIds(player?.getPlayerResponse?.())) {
      player.onAdUxClicked?.("skip-button", id);
    }
  });
})();
