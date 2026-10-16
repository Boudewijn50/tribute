/* =========================================================
   SETTINGS — the only file you might ever need to touch.
   Texts (name, subheader, tribute) live in index.html.
   ========================================================= */
window.SITE_CONFIG = {

  // Folder names (next to index.html)
  photoFolder: "photos",
  musicFolder: "music",

  // Photo roulette: seconds per photo
  fastestSeconds: 3,   // slider fully on "fast"
  slowestSeconds: 10,  // slider fully on "slow"
  startSeconds: 6,     // where the slider starts

  // Music
  shuffleOnStart: true,
  startVolume: 0.8,    // 0 – 1

  // GitHub Pages: leave empty — it's detected from the web address
  // (username.github.io/repo-name). Only fill in if you use your own domain.
  github: {
    user: "",
    repo: "",
    branch: ""
  }
};
