/* =========================================================
   SETTINGS — the only file you might ever need to touch.
   Texts (name, subheader, tribute) live in index.html.
   ========================================================= */
window.SITE_CONFIG = {

  // Folder names (next to index.html)
  photoFolder: "photos",
  musicFolder: "music",

  // Photo roulette: seconds each photo stays on screen
  photoSeconds: 8,

  // How much of the original colour comes through:
  // 0 = fully black & white, 1 = original colours. 0.3 = a hint of vintage colour.
  photoColour: 0.3,

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
