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

  // Press quotes: shown one at a time under the photo.
  // The section stays hidden as long as this list is empty.
  // Use only real quotes, with the exact wording and the real source.
  //   text:   the quote as it was published
  //   en/nl:  (optional) a translation for the other language
  //   source: where it appeared, e.g. "Het Parool" or "Het Parool, 2024"
  quotes: [
    // { text: "Paste the real quote here.", en: "Optional English translation.", source: "Het Parool" },
  ],
  quoteSeconds: 7,     // seconds per quote

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
