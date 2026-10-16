/* =========================================================
   Boudewijn Rooseboom — photo roulette + music player
   Reads every photo/track from the folders automatically.
   ========================================================= */
(() => {
  "use strict";

  const CFG = Object.assign({
    photoFolder: "photos", musicFolder: "music",
    fastestSeconds: 3, slowestSeconds: 10, startSeconds: 6,
    shuffleOnStart: true, startVolume: 0.8,
    github: {}
  }, window.SITE_CONFIG || {});

  const IMG_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
  const AUD_EXT = ["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac"];

  const $ = (s) => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------------------------------------------------------
     1. FIND FILES IN A FOLDER
     a) on GitHub Pages: ask GitHub what is in the folder
     b) optional files.json (for other hosts)
     c) a server directory listing (local testing)
     --------------------------------------------------------- */
  const extOf = (name) => (name.split("?")[0].split(".").pop() || "").toLowerCase();
  const keep = (exts) => (name) => exts.includes(extOf(name)) && !name.split("/").pop().startsWith(".");
  const urlFor = (folder, name) => folder + "/" + encodeURIComponent(name);
  const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

  function githubTarget() {
    const g = CFG.github || {};
    if (g.user && g.repo) return { user: g.user, repo: g.repo, branch: g.branch || "" };
    const host = location.hostname;
    if (!host.endsWith(".github.io")) return null;
    const user = host.split(".")[0];
    const first = location.pathname.split("/").filter(Boolean)[0];
    const repo = first && !first.includes(".") ? first : user + ".github.io";
    return { user, repo, branch: g.branch || "" };
  }

  async function fromGitHub(folder, exts) {
    const t = githubTarget();
    if (!t) throw new Error("not github");
    const cacheKey = `gh:${t.user}/${t.repo}/${folder}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.files;
    } catch (e) {}
    const api = `https://api.github.com/repos/${t.user}/${t.repo}/contents/${folder}` + (t.branch ? `?ref=${t.branch}` : "");
    const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 404) return [];            // folder doesn't exist (yet)
    if (!res.ok) throw new Error("github " + res.status);
    const list = await res.json();
    const files = list.filter((f) => f.type === "file").map((f) => f.name)
      .filter(keep(exts)).sort(naturalSort).map((n) => urlFor(folder, n));
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), files })); } catch (e) {}
    return files;
  }

  let manifestPromise = null;
  async function fromManifest(folder, exts, key) {
    manifestPromise = manifestPromise || fetch("files.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const m = await manifestPromise;
    if (!m || !Array.isArray(m[key])) throw new Error("no manifest");
    return m[key].filter(keep(exts)).map((n) => urlFor(folder, n));
  }

  async function fromListing(folder, exts) {
    const res = await fetch(folder + "/", { cache: "no-store" });
    if (!res.ok) throw new Error("no listing");
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const base = new URL(folder + "/", location.href);
    const seen = new Set();
    const names = [];
    doc.querySelectorAll("a[href]").forEach((a) => {
      const u = new URL(a.getAttribute("href"), base);
      if (!u.pathname.startsWith(base.pathname)) return;
      const name = decodeURIComponent(u.pathname.slice(base.pathname.length));
      if (!name || name.includes("/") || seen.has(name) || !keep(exts)(name)) return;
      seen.add(name); names.push(name);
    });
    return names.sort(naturalSort).map((n) => urlFor(folder, n));
  }

  async function listFolder(folder, exts, key) {
    const tries = [() => fromGitHub(folder, exts), () => fromManifest(folder, exts, key), () => fromListing(folder, exts)];
    for (const t of tries) {
      try { return await t(); } catch (e) { /* try next */ }
    }
    return [];
  }

  /* ---------------------------------------------------------
     2. PHOTO ROULETTE
     --------------------------------------------------------- */
  const film = $("#film");
  const frames = [...film.querySelectorAll(".frame")];
  const tempo = $("#tempo");
  let photos = [];
  let showing = -1;
  let activeFrame = 0;
  let timer = null;

  const seconds = () => {
    const v = parseFloat(tempo.value);               // 0 = slow, 1 = fast
    return CFG.slowestSeconds - v * (CFG.slowestSeconds - CFG.fastestSeconds);
  };
  const tempoValueFor = (s) => (CFG.slowestSeconds - s) / (CFG.slowestSeconds - CFG.fastestSeconds);

  function pickNext() {
    if (photos.length < 2) return 0;
    let i;
    do { i = Math.floor(Math.random() * photos.length); } while (i === showing);
    return i;
  }

  function load(src) {
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => ok(true));
      img.onerror = () => ok(false);
      img.src = src;
    });
  }

  async function advance(first = false) {
    clearTimeout(timer);
    if (!photos.length) return;
    const i = pickNext();
    const okLoaded = await load(photos[i]);
    if (!okLoaded) {                                  // broken file: drop it and move on
      photos.splice(i, 1);
      if (showing > i) showing--;
      return advance(first);
    }

    const next = frames[1 - activeFrame];
    const prev = frames[activeFrame];
    const s = seconds();
    // two kinds of change: a film-gate jump with a short fade, or a slow dissolve
    const jump = !first && Math.random() < 0.6;
    const fadeMs = first ? 2400 : jump ? 650 : 1900;

    next.style.backgroundImage = `url("${photos[i]}")`;
    next.style.setProperty("--dx", (Math.random() * 4 - 2).toFixed(2) + "%");
    next.style.setProperty("--dy", (Math.random() * 3 - 1.5).toFixed(2) + "%");
    next.style.setProperty("--drift", (s + fadeMs / 1000 + 2) + "s");
    next.style.transitionDuration = fadeMs + "ms";
    prev.style.transitionDuration = fadeMs + "ms";
    next.classList.remove("drift"); void next.offsetWidth; next.classList.add("drift");

    next.classList.add("is-on");
    prev.classList.remove("is-on");

    if (jump) { film.classList.remove("jump"); void film.offsetWidth; film.classList.add("jump"); }

    activeFrame = 1 - activeFrame;
    showing = i;
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (photos.length > 1) timer = setTimeout(advance, seconds() * 1000);
  }

  const savedTempo = parseFloat(store.get("br:tempo"));
  tempo.value = isNaN(savedTempo) ? tempoValueFor(CFG.startSeconds) : savedTempo;
  tempo.addEventListener("input", () => { store.set("br:tempo", tempo.value); schedule(); });

  // pause the roulette while the tab is hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(timer); else schedule();
  });

  /* ---------------------------------------------------------
     3. MUSIC PLAYER
     --------------------------------------------------------- */
  const audio = $("#audio");
  const player = $("#player");
  const titleEl = $("#trackTitle");
  const playBtn = $("#playBtn"), nextBtn = $("#nextBtn"), prevBtn = $("#prevBtn"), shuffleBtn = $("#shuffleBtn");
  const vol = $("#volume");
  const bar = $("#progressBar"), progress = $("#progress");

  let tracks = [];       // [{src, title}]
  let order = [];        // play order (indices into tracks)
  let pos = 0;           // position in order
  let shuffle = CFG.shuffleOnStart;
  let errors = 0;

  const prettyTitle = (src) => {
    let n = decodeURIComponent(src.split("/").pop());
    n = n.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").replace(/\s*-\s*/g, " — ").replace(/\s+/g, " ").trim();
    n = n.replace(/^\d{1,3}\s*[—.)]?\s+/, "");         // drop leading track numbers like "01 - "
    return n || "Untitled";
  };

  function buildOrder() {
    const current = order[pos];
    order = tracks.map((_, i) => i);
    if (shuffle) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      if (current !== undefined) {                   // keep the current song in place
        order.splice(order.indexOf(current), 1);
        order.unshift(current);
      }
      pos = 0;
    } else {
      pos = current !== undefined ? current : 0;
    }
  }

  function setTrack(p, autoplay = true) {
    if (!tracks.length) return;
    pos = (p + order.length) % order.length;
    const t = tracks[order[pos]];
    audio.src = t.src;
    titleEl.textContent = t.title;
    titleEl.title = t.title;
    bar.style.width = "0";
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: "Boudewijn Rooseboom" });
    }
    if (autoplay) audio.play().catch(() => {});
  }

  const next = () => {
    if (!tracks.length) return;
    if (shuffle && pos === order.length - 1) { buildOrder(); return setTrack(1 % order.length); }
    setTrack(pos + 1);
  };
  const prev = () => {
    if (!tracks.length) return;
    if (audio.currentTime > 4) { audio.currentTime = 0; return; }
    setTrack(pos - 1);
  };
  const toggle = () => {
    if (!tracks.length) return;
    if (!audio.src) return setTrack(0);
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
  };

  playBtn.addEventListener("click", toggle);
  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);
  shuffleBtn.addEventListener("click", () => {
    shuffle = !shuffle;
    shuffleBtn.setAttribute("aria-pressed", shuffle);
    buildOrder();
  });

  audio.addEventListener("ended", next);                    // non-stop: always on to the next one
  audio.addEventListener("playing", () => { errors = 0; player.classList.add("is-playing"); playBtn.setAttribute("aria-label", "Pause"); });
  audio.addEventListener("pause", () => { player.classList.remove("is-playing"); playBtn.setAttribute("aria-label", "Play"); });
  audio.addEventListener("error", () => {                    // unplayable file: skip it
    if (++errors < tracks.length) next();
  });
  audio.addEventListener("timeupdate", () => {
    if (audio.duration) bar.style.width = (audio.currentTime / audio.duration * 100) + "%";
  });
  progress.addEventListener("click", (e) => {
    if (!audio.duration) return;
    const r = progress.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });

  const savedVol = parseFloat(store.get("br:vol"));
  vol.value = isNaN(savedVol) ? CFG.startVolume : savedVol;
  audio.volume = vol.value;
  vol.addEventListener("input", () => { audio.volume = vol.value; store.set("br:vol", vol.value); });

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
  }

  // keyboard: space = play/pause, arrows = prev/next
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, button") || !gate.classList.contains("is-gone")) return;
    if (e.code === "Space") { e.preventDefault(); toggle(); }
    if (e.code === "ArrowRight") next();
    if (e.code === "ArrowLeft") prev();
  });

  /* ---------------------------------------------------------
     4. ENTER GATE + START
     --------------------------------------------------------- */
  const gate = $("#gate");
  document.body.classList.add("locked");

  $("#enterBtn").addEventListener("click", () => {
    gate.classList.add("is-gone");
    document.body.classList.remove("locked");
    player.classList.add("is-ready");
    if (tracks.length) setTrack(pos, true);
  });

  // gentle reveal of the text when scrolled into view
  const revealEls = document.querySelectorAll(".label, .tribute__body p, .foot");
  revealEls.forEach((el) => el.classList.add("reveal"));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    }), { threshold: 0.15 });
    revealEls.forEach((el) => io.observe(el));
  } else revealEls.forEach((el) => el.classList.add("is-in"));

  // load everything
  shuffleBtn.setAttribute("aria-pressed", shuffle);
  Promise.all([
    listFolder(CFG.photoFolder, IMG_EXT, "photos"),
    listFolder(CFG.musicFolder, AUD_EXT, "music")
  ]).then(([p, m]) => {
    photos = p;
    advance(true);

    tracks = m.map((src) => ({ src, title: prettyTitle(src) }));
    if (!tracks.length) { titleEl.textContent = "no tracks yet"; return; }
    buildOrder();
    const t = tracks[order[pos]];
    titleEl.textContent = t.title;
    // if the visitor already clicked "enter" before the list arrived, start now
    if (gate.classList.contains("is-gone") && !audio.src) setTrack(pos, true);
  });
})();
