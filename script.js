/* =========================================================
   Boudewijn — photo roulette, music player, live analyser
   Reads every photo/track from the folders automatically.
   ========================================================= */
(() => {
  "use strict";

  const CFG = Object.assign({
    photoFolder: "photos", musicFolder: "music",
    photoSeconds: 8, photoColour: 0.55,
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

  document.documentElement.style.setProperty("--photo-colour", Math.max(0, Math.min(1, CFG.photoColour)));

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
    if (res.status === 404) return [];
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
     2. PHOTO ROULETTE — fixed, unhurried tempo
     --------------------------------------------------------- */
  const film = $("#film");
  const frames = [...film.querySelectorAll(".frame")];
  const frameNo = $("#frameNo");
  let photos = [];
  let showing = -1;
  let activeFrame = 0;
  let timer = null;
  let shown = 0;

  const pad = (n) => String(n).padStart(2, "0");

  function pickNext() {
    if (photos.length < 2) return 0;
    let i;
    do { i = Math.floor(Math.random() * photos.length); } while (i === showing);
    return i;
  }

  function load(src) {
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => ok(img));
      img.onerror = () => ok(false);
      img.src = src;
    });
  }

  async function advance(first = false) {
    clearTimeout(timer);
    if (!photos.length) return;
    const i = pickNext();
    const img = await load(photos[i]);
    if (!img) {
      photos.splice(i, 1);
      if (showing > i) showing--;
      return advance(first);
    }

    const next = frames[1 - activeFrame];
    const prev = frames[activeFrame];
    const s = CFG.photoSeconds;
    const fadeMs = first ? 2400 : 2200;                  // always a calm crossfade

    next.style.backgroundImage = `url("${photos[i]}")`;
    next.dataset.ratio = img.naturalWidth / img.naturalHeight;
    place(next);
    next.style.setProperty("--dx", (Math.random() * 3 - 1.5).toFixed(2) + "%");
    next.style.setProperty("--dy", (Math.random() * 2 - 1).toFixed(2) + "%");
    next.style.setProperty("--drift", (s + fadeMs / 1000 + 2) + "s");
    next.style.transitionDuration = fadeMs + "ms";
    prev.style.transitionDuration = fadeMs + "ms";
    next.classList.remove("drift"); void next.offsetWidth; next.classList.add("drift");
    next.classList.add("is-on");
    prev.classList.remove("is-on");

    activeFrame = 1 - activeFrame;
    showing = i;
    frameNo.textContent = "N° " + String(++shown).padStart(3, "0");
    schedule();
  }

  /* Smart framing: the photo fills the screen, but we choose how much is
     trimmed from the top vs. the bottom. Most of the overflow goes off the
     bottom, but the top is never cut by more than TOP_MAX of the photo height —
     so faces low in the picture still stay in view on wide screens. */
  const TOP_SHARE = 0.5;   // share of the overflow taken from the top
  const TOP_MAX = 0.15;    // never trim more than 15% of the photo from the top
  function place(frame) {
    const ratio = parseFloat(frame.dataset.ratio);
    if (!ratio) return;
    const w = frame.offsetWidth, h = frame.offsetHeight;
    const rh = Math.max(h, w / ratio);          // rendered photo height ("cover")
    const overflow = rh - h;
    const top = Math.min(overflow * TOP_SHARE, rh * TOP_MAX);
    frame.style.backgroundPosition = `center ${-Math.round(top)}px`;
  }
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => frames.forEach(place), 120);
  });

  function schedule() {
    clearTimeout(timer);
    if (photos.length > 1) timer = setTimeout(advance, CFG.photoSeconds * 1000);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(timer); else schedule();
  });

  /* ---------------------------------------------------------
     3. MUSIC PLAYER
     --------------------------------------------------------- */
  const audio = $("#audio");
  const player = $("#player");
  const titleEl = $("#trackTitle");
  const timeEl = $("#trackTime");
  const playBtn = $("#playBtn"), nextBtn = $("#nextBtn"), prevBtn = $("#prevBtn"), shuffleBtn = $("#shuffleBtn");
  const vol = $("#volume");
  const bar = $("#progressBar"), progress = $("#progress");

  let tracks = [];
  let order = [];
  let pos = 0;
  let shuffle = CFG.shuffleOnStart;
  let errors = 0;

  const prettyTitle = (src) => {
    let n = decodeURIComponent(src.split("/").pop());
    n = n.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").replace(/\s*-\s*/g, " — ").replace(/\s+/g, " ").trim();
    n = n.replace(/^\d{1,3}\s*[—.)]?\s+/, "");
    return n || "Untitled";
  };
  const clock = (t) => (isFinite(t) ? Math.floor(t / 60) + ":" + pad(Math.floor(t % 60)) : "0:00");

  function buildOrder() {
    const current = order[pos];
    order = tracks.map((_, i) => i);
    if (shuffle) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      if (current !== undefined) { order.splice(order.indexOf(current), 1); order.unshift(current); }
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
    timeEl.textContent = "0:00";
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: "Boudewijn" });
    }
    if (autoplay) play();
  }

  function play() { wakeAudio(); audio.play().catch(() => {}); }
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
    audio.paused ? play() : audio.pause();
  };

  playBtn.addEventListener("click", toggle);
  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);
  shuffleBtn.addEventListener("click", () => {
    shuffle = !shuffle;
    shuffleBtn.setAttribute("aria-pressed", shuffle);
    buildOrder();
  });

  audio.addEventListener("ended", next);
  audio.addEventListener("playing", () => { errors = 0; document.body.classList.add("is-playing"); playBtn.setAttribute("aria-label", "Pause"); });
  audio.addEventListener("pause", () => { document.body.classList.remove("is-playing"); playBtn.setAttribute("aria-label", "Play"); });
  audio.addEventListener("error", () => { if (++errors < tracks.length) next(); });
  audio.addEventListener("timeupdate", () => {
    if (audio.duration) bar.style.width = (audio.currentTime / audio.duration * 100) + "%";
    timeEl.textContent = clock(audio.currentTime);
  });
  progress.addEventListener("click", (e) => {
    if (!audio.duration) return;
    const r = progress.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, button") || !gate.classList.contains("is-gone")) return;
    if (e.code === "Space") { e.preventDefault(); toggle(); }
    if (e.code === "ArrowRight") next();
    if (e.code === "ArrowLeft") prev();
  });

  /* ---------------------------------------------------------
     4. WEB AUDIO: real-time analyser + volume
     --------------------------------------------------------- */
  let actx = null, analyser = null, gain = null, freq = null, wave = null;

  function wakeAudio() {
    if (!actx && location.protocol !== "file:") {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        actx = new AC();
        const src = actx.createMediaElementSource(audio);
        analyser = actx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.78;
        gain = actx.createGain();
        src.connect(analyser);
        analyser.connect(gain);
        gain.connect(actx.destination);
        freq = new Uint8Array(analyser.frequencyBinCount);
        wave = new Uint8Array(analyser.fftSize);
        audio.volume = 1;                        // volume now handled by the gain node (works on iPhone too)
        applyVolume();
      } catch (e) { actx = null; analyser = null; gain = null; }
    }
    if (actx && actx.state === "suspended") actx.resume();
  }

  function applyVolume() {
    const v = parseFloat(vol.value);
    if (gain) gain.gain.value = v * v;          // perceptual curve
    else audio.volume = v;
  }
  const savedVol = parseFloat(store.get("br:vol"));
  vol.value = isNaN(savedVol) ? CFG.startVolume : savedVol;
  applyVolume();
  vol.addEventListener("input", () => { applyVolume(); store.set("br:vol", vol.value); });

  // ---- canvases
  const specCv = $("#analyser"), scopeCv = $("#scope");
  const specCtx = specCv.getContext("2d"), scopeCtx = scopeCv.getContext("2d");
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function fit(cv) {
    const r = cv.getBoundingClientRect();
    const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }

  const BARS = 36;
  const levels = new Float32Array(BARS);
  const peaks = new Float32Array(BARS);
  let bands = null;

  function makeBands() {
    // log-spaced bands from ~35 Hz to ~15 kHz
    const sr = actx ? actx.sampleRate : 44100;
    const binHz = sr / 2048;
    bands = [];
    for (let b = 0; b < BARS; b++) {
      const f0 = 35 * Math.pow(15000 / 35, b / BARS);
      const f1 = 35 * Math.pow(15000 / 35, (b + 1) / BARS);
      const i0 = Math.max(1, Math.floor(f0 / binHz));
      const i1 = Math.max(i0 + 1, Math.ceil(f1 / binHz));
      bands.push([i0, i1]);
    }
  }

  const css = getComputedStyle(document.documentElement);
  const BRASS = css.getPropertyValue("--brass").trim() || "#c29a5b";

  function drawSpectrum(t) {
    fit(specCv);
    const w = specCv.width, h = specCv.height;
    specCtx.clearRect(0, 0, w, h);
    const live = analyser && !audio.paused;
    if (live) {
      if (!bands) makeBands();
      analyser.getByteFrequencyData(freq);
    }
    const gap = Math.max(1, Math.round(w / BARS * 0.32));
    const bw = (w - gap * (BARS - 1)) / BARS;

    for (let b = 0; b < BARS; b++) {
      let v;
      if (live) {
        const [i0, i1] = bands[b];
        let sum = 0, max = 0;
        for (let i = i0; i < i1 && i < freq.length; i++) { sum += freq[i]; if (freq[i] > max) max = freq[i]; }
        v = ((sum / (i1 - i0)) * 0.55 + max * 0.45) / 255;
        v = Math.pow(v, 1.6) * (1 + b / BARS * 0.6);   // lift the treble a little
      } else {
        v = 0.04 + 0.03 * Math.sin(t / 900 + b * 0.5);  // resting "breath"
      }
      v = Math.min(1, v);
      levels[b] += (v - levels[b]) * 0.5;
      peaks[b] = Math.max(levels[b], peaks[b] - 0.012);

      const x = b * (bw + gap);
      const bh = Math.max(1 * DPR, levels[b] * (h - 4 * DPR));
      const g = specCtx.createLinearGradient(0, h, 0, h - bh);
      g.addColorStop(0, "rgba(235,229,217,.35)");
      g.addColorStop(1, "rgba(235,229,217,.92)");
      specCtx.fillStyle = g;
      specCtx.fillRect(x, h - bh, bw, bh);

      specCtx.fillStyle = BRASS;
      specCtx.fillRect(x, h - Math.max(peaks[b] * (h - 4 * DPR), 1 * DPR) - 2 * DPR, bw, 1.5 * DPR);
    }
  }

  function drawScope(t) {
    fit(scopeCv);
    const w = scopeCv.width, h = scopeCv.height, mid = h / 2;
    scopeCtx.clearRect(0, 0, w, h);
    const live = analyser && !audio.paused;
    if (live) analyser.getByteTimeDomainData(wave);

    const pts = 180;
    // sample the waveform: scale = amplitude, shift = phase offset (fraction of buffer)
    const sample = (scale, shift) => {
      const ys = new Float32Array(pts);
      for (let i = 0; i < pts; i++) {
        const edge = Math.sin(Math.PI * i / (pts - 1));        // taper at both ends
        let v;
        if (live) {
          const k = Math.floor(((i / pts) * 0.8 + shift) * wave.length) % wave.length;
          v = (wave[k] - 128) / 128;
        } else {
          v = 0.025 * Math.sin(i * 0.12 + t / 700 + shift * 40);
        }
        ys[i] = mid + v * mid * scale * edge;
      }
      return ys;
    };

    const line = (ys, color, width, glow) => {
      scopeCtx.beginPath();
      scopeCtx.moveTo(0, ys[0]);
      for (let i = 1; i < pts - 1; i++) {
        const x = i / (pts - 1) * w, nx = (i + 1) / (pts - 1) * w;
        scopeCtx.quadraticCurveTo(x, ys[i], (x + nx) / 2, (ys[i] + ys[i + 1]) / 2);
      }
      scopeCtx.lineTo(w, ys[pts - 1]);
      scopeCtx.strokeStyle = color;
      scopeCtx.lineWidth = width;
      scopeCtx.lineJoin = scopeCtx.lineCap = "round";
      scopeCtx.shadowColor = color;
      scopeCtx.shadowBlur = glow;
      scopeCtx.stroke();
      scopeCtx.shadowBlur = 0;
    };

    // a warm, wider-swinging echo line in colour, then the main line on top
    line(sample(1.2, 0.11), "rgba(206,120,64,.6)", 3 * DPR, 12 * DPR);
    line(sample(0.8, 0.0), "rgba(194,154,91,.35)", 7 * DPR, 0);
    line(sample(0.8, 0.0), "rgba(240,234,222,.95)", 3.6 * DPR, 8 * DPR);
  }

  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function loop(t) {
    if (!document.hidden) {
      drawSpectrum(t);
      if (!reduceMotion) drawScope(t);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------------------------------------------------------
     LANGUAGE (NL | EN)
     --------------------------------------------------------- */
  const lang = () => document.documentElement.lang === "nl" ? "nl" : "en";
  function setLang(l) {
    document.documentElement.lang = l;
    store.set("br:lang", l);
    document.dispatchEvent(new Event("langchange"));
  }
  document.querySelectorAll("[data-set-lang]").forEach((b) => {
    b.addEventListener("click", () => setLang(b.dataset.setLang));
  });

  /* ---------------------------------------------------------
     PRESS QUOTES — one at a time, from config.js
     --------------------------------------------------------- */
  (function press() {
    const list = (CFG.quotes || []).filter((q) => q && (q.text || q.nl || q.en) && q.source);
    if (!list.length) return;
    const section = $("#press"), stage = section.querySelector(".press__stage");
    const quoteEl = $("#pressQuote"), sourceEl = $("#pressSource"), dots = $("#pressDots");
    const seconds = Math.max(4, CFG.quoteSeconds || 7);
    let i = 0, t = null;

    const textFor = (q) => (lang() === "en" ? q.en || q.text || q.nl : q.nl || q.text || q.en);
    function show(n, instant) {
      i = (n + list.length) % list.length;
      const paint = () => {
        quoteEl.textContent = textFor(list[i]);
        sourceEl.textContent = list[i].source;
        [...dots.children].forEach((d, k) => d.classList.toggle("is-on", k === i));
        stage.classList.remove("is-out");
      };
      if (instant) return paint();
      stage.classList.add("is-out");
      setTimeout(paint, 1100);
    }
    function loop() { clearTimeout(t); if (list.length > 1) t = setTimeout(() => { show(i + 1); loop(); }, seconds * 1000); }

    if (list.length > 1) list.forEach((_, k) => {
      const d = document.createElement("button");
      d.type = "button"; d.setAttribute("aria-label", "Quote " + (k + 1));
      d.addEventListener("click", () => { show(k); loop(); });
      dots.appendChild(d);
    });
    section.hidden = false;
    show(0, true);
    loop();
    document.addEventListener("langchange", () => show(i, true));
  })();

  /* ---------------------------------------------------------
     SHARE
     --------------------------------------------------------- */
  (function share() {
    const url = location.href.split("#")[0];
    const title = "Boudewijn";
    const text = () => document.documentElement.lang === "nl"
      ? "Boudewijn: Een halve eeuw ritme. Een leven lang groove."
      : "Boudewijn: Half a Century of Rhythm. A Lifetime of Groove.";
    const e = encodeURIComponent;
    const setLinks = () => {
      const t = text();
      const links = {
        whatsapp: `https://wa.me/?text=${e(t + " " + url)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`,
        x: `https://twitter.com/intent/tweet?text=${e(t)}&url=${e(url)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`,
        email: `mailto:?subject=${e(title)}&body=${e(t + "\n\n" + url)}`
      };
      document.querySelectorAll(".share [data-net]").forEach((a) => { a.href = links[a.dataset.net]; });
    };
    setLinks();
    document.addEventListener("langchange", setLinks);

    const native = $("#shareNative");
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      native.hidden = false;
      native.addEventListener("click", () => navigator.share({ title, text: text(), url }).catch(() => {}));
    }

    const copy = $("#shareCopy");
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(url); }
      catch (err) {
        const t = document.createElement("textarea");
        t.value = url; document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); } catch (e2) {}
        t.remove();
      }
      const before = copy.innerHTML;
      copy.textContent = document.documentElement.lang === "nl" ? "Link gekopieerd" : "Link copied";
      copy.classList.add("is-done");
      setTimeout(() => { copy.innerHTML = before; copy.classList.remove("is-done"); }, 2200);
    });
  })();

  /* ---------------------------------------------------------
     5. ENTER GATE + START
     --------------------------------------------------------- */
  const gate = $("#gate");
  document.body.classList.add("locked");

  $("#enterBtn").addEventListener("click", () => {
    gate.classList.add("is-gone");
    document.body.classList.remove("locked");
    player.classList.add("is-ready");
    wakeAudio();
    if (tracks.length) setTrack(pos, true);
  });

  const revealEls = document.querySelectorAll(".label, .tribute__body p, .chapter, .pull, .share, .foot");
  revealEls.forEach((el) => el.classList.add("reveal"));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    }), { threshold: 0.15 });
    revealEls.forEach((el) => io.observe(el));
  } else revealEls.forEach((el) => el.classList.add("is-in"));

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
    titleEl.textContent = tracks[order[pos]].title;
    if (gate.classList.contains("is-gone") && !audio.src) setTrack(pos, true);
  });
})();
