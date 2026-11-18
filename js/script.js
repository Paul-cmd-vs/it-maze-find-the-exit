const $ = (s) => document.querySelector(s),
  $$ = (s) => document.querySelectorAll(s);
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const S = { role: "", name: "", code: "" };

// ---------- Sound: music and effects (volumes are saved in the browser) ----------
// Put your own music in assets/audio/ (see the README.txt there). If a file is
// missing, a small built-in tune plays instead, so the game always has music.
const TRACKS = {
  menu: "assets/audio/menu.mp3", // menus and level select
  game: "assets/audio/game.mp3", // while playing a level
};
const Sound = (() => {
  const KEY = "itmaze-audio";
  const s = { musicOn: true, sfxOn: true, musicVol: 0.5, sfxVol: 0.7 };
  try {
    Object.assign(s, JSON.parse(localStorage.getItem(KEY)) || {});
  } catch {}
  let want = "menu"; // track that should be playing
  let current = null; // track that is playing now
  let unlocked = false; // browsers only allow sound after the first click or key press
  let ctx = null;
  let musicGain = null;
  let sfxGain = null;
  let synth = null;
  const audios = {};

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();
      musicGain.connect(ctx.destination);
      sfxGain.connect(ctx.destination);
      applyVolumes();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function applyVolumes() {
    const mv = s.musicOn ? s.musicVol : 0;
    const sv = s.sfxOn ? s.sfxVol : 0;
    if (musicGain) {
      musicGain.gain.value = mv * 0.35;
      sfxGain.gain.value = sv * 0.6;
    }
    for (const a of Object.values(audios)) a.volume = mv;
  }
  function note(f, t, d, type, vol, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + d + 0.02);
  }

  // Built-in tunes (numbers are semitones above A; null = rest)
  const SONGS = {
    menu: {
      bpm: 80,
      wave: "triangle",
      mel: [
        0,
        null,
        3,
        null,
        7,
        null,
        3,
        null,
        5,
        null,
        3,
        null,
        0,
        null,
        -2,
        null,
        0,
        null,
        3,
        null,
        7,
        null,
        10,
        null,
        8,
        null,
        7,
        null,
        3,
        null,
        null,
        null,
      ],
      bass: [
        -24,
        null,
        null,
        null,
        -17,
        null,
        null,
        null,
        -19,
        null,
        null,
        null,
        -22,
        null,
        null,
        null,
        -24,
        null,
        null,
        null,
        -17,
        null,
        null,
        null,
        -19,
        null,
        null,
        null,
        -22,
        null,
        null,
        null,
      ],
    },
    game: {
      bpm: 132,
      wave: "square",
      mel: [
        0, 3, 7, 3, 10, 7, 3, 7, 0, 3, 7, 3, 12, 10, 7, 3, -2, 2, 5, 2, 9, 5, 2,
        5, -4, 0, 3, 0, 7, 3, 0, 3,
      ],
      bass: [
        -24,
        null,
        -24,
        null,
        -24,
        null,
        -24,
        null,
        -24,
        null,
        -24,
        null,
        -24,
        null,
        -24,
        null,
        -26,
        null,
        -26,
        null,
        -26,
        null,
        -26,
        null,
        -29,
        null,
        -29,
        null,
        -29,
        null,
        -29,
        null,
      ],
    },
  };
  const hz = (semi) => 220 * Math.pow(2, semi / 12);
  function startSynth(id) {
    const c = ac();
    const song = SONGS[id];
    if (!c || !song) return;
    const stepLen = 60 / song.bpm / 2;
    let i = 0;
    let t = c.currentTime + 0.05;
    const tick = () => {
      while (t < c.currentTime + 0.4) {
        const m = song.mel[i % song.mel.length];
        const b = song.bass[i % song.bass.length];
        if (m !== null)
          note(hz(m), t, stepLen * 0.9, song.wave, 0.5, musicGain);
        if (b !== null)
          note(hz(b), t, stepLen * 3.6, "triangle", 0.7, musicGain);
        t += stepLen;
        i++;
      }
    };
    tick();
    synth = setInterval(tick, 120);
  }
  function startFile(id) {
    let a = audios[id];
    if (!a) {
      a = new Audio(TRACKS[id]);
      a.loop = true;
      a.addEventListener("error", () => {
        a.failed = true;
        if (current === id) play(); // file missing: switch to the built-in tune
      });
      audios[id] = a;
      applyVolumes();
    }
    if (a.failed) return false;
    const p = a.play();
    if (p && p.catch) {
      p.catch((err) => {
        if (err && err.name === "NotAllowedError") return;
        a.failed = true;
        if (current === id) play();
      });
    }
    return true;
  }
  function stopMusic() {
    if (synth) clearInterval(synth);
    synth = null;
    current = null;
    for (const a of Object.values(audios)) a.pause();
  }
  function play() {
    stopMusic();
    if (!unlocked || !s.musicOn) return;
    current = want;
    if (!startFile(want)) startSynth(want);
  }
  function music(id) {
    want = id;
    if (current !== id) play();
  }
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    ac();
    play();
  }
  ["click", "keydown", "touchend"].forEach((ev) =>
    window.addEventListener(ev, unlock),
  );

  const FX = {
    click: [[660, 0.05, "square"]],
    unlock: [
      [523, 0.1],
      [659, 0.1],
      [784, 0.2],
    ],
    key: [
      [880, 0.08],
      [1175, 0.18],
    ],
    hit: [
      [220, 0.12, "sawtooth"],
      [110, 0.22, "sawtooth"],
    ],
    wrong: [[180, 0.28, "square"]],
    win: [
      [523, 0.12],
      [659, 0.12],
      [784, 0.12],
      [1047, 0.35],
    ],
    lose: [
      [392, 0.22],
      [330, 0.22],
      [262, 0.45],
    ],
  };
  function fx(name) {
    if (!unlocked || !s.sfxOn) return;
    const c = ac();
    if (!c) return;
    let t = c.currentTime;
    for (const [f, d, type] of FX[name] || []) {
      note(f, t, d, type || "square", 0.8, sfxGain);
      t += d;
    }
  }
  function set(patch) {
    const musicChanged = "musicOn" in patch && patch.musicOn !== s.musicOn;
    Object.assign(s, patch);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
    applyVolumes();
    if (musicChanged) play();
  }
  return { s, set, music, play: fx, unlock };
})();
document.addEventListener("click", (e) => {
  if (e.target.closest("button")) Sound.play("click");
});

function go(id) {
  Sound.music(id === "game" ? "game" : "menu");
  $$(".screen").forEach((s) => s.classList.toggle("on", s.id === id));
  const f = { name: "#nameIn", code: "#codeIn" }[id];
  if (f) setTimeout(() => $(f).focus(), 30);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-go]");
  if (b) go(b.dataset.go);
});

// Menu / mode
$("#single").onclick = () => openName("single");
// ---------- Settings (music and sound effects) ----------
const settingsEl = $("#settings");
function syncSettings() {
  const pairs = [
    ["#musicTog", Sound.s.musicOn],
    ["#sfxTog", Sound.s.sfxOn],
  ];
  for (const [id, on] of pairs) {
    $(id).setAttribute("aria-pressed", on);
    $(id).textContent = on ? "ON" : "OFF";
  }
  $("#musicVol").value = Math.round(Sound.s.musicVol * 100);
  $("#sfxVol").value = Math.round(Sound.s.sfxVol * 100);
  $("#musicOut").textContent = $("#musicVol").value + "%";
  $("#sfxOut").textContent = $("#sfxVol").value + "%";
}
function openSettings() {
  syncSettings();
  settingsEl.classList.add("on");
  if ($("#game").classList.contains("on")) Game.setPaused(true); // pause a running level
}
function closeSettings() {
  settingsEl.classList.remove("on");
  Game.setPaused(false);
}
$("#gear").onclick = openSettings;
$("#gameGear").onclick = openSettings;
$("#setOk").onclick = closeSettings;
$("#musicTog").onclick = () => {
  Sound.set({ musicOn: !Sound.s.musicOn });
  syncSettings();
};
$("#sfxTog").onclick = () => {
  Sound.set({ sfxOn: !Sound.s.sfxOn });
  syncSettings();
};
$("#musicVol").oninput = (e) => {
  Sound.set({ musicVol: e.target.value / 100 });
  syncSettings();
};
$("#sfxVol").oninput = (e) => {
  Sound.set({ sfxVol: e.target.value / 100 });
  syncSettings();
};
$("#sfxVol").onchange = () => Sound.play("key"); // preview the effect volume
$("#host").onclick = () => openName("host");
$("#join").onclick = () => openName("join");

// Name
const nameIn = $("#nameIn"),
  nameHint = $("#nameHint");
function checkName() {
  const raw = nameIn.value,
    clean = raw.replace(/[^A-Za-z0-9 ]/g, "");
  nameIn.value = clean;
  const bad = raw !== clean,
    n = clean.trim().length;
  nameHint.textContent = bad
    ? "Use letters, numbers and spaces only"
    : `Up to 10 characters (${clean.length}/10)`;
  nameHint.classList.toggle("err", bad);
  $("#nameOk").disabled = n === 0;
}
nameIn.oninput = checkName;
nameIn.onkeydown = (e) => {
  if (e.key === "Enter" && !$("#nameOk").disabled) $("#nameOk").click();
};
function savedName() {
  try {
    return localStorage.getItem("itmaze-name") || "";
  } catch {
    return "";
  }
}
function saveName(n) {
  try {
    localStorage.setItem("itmaze-name", n);
  } catch {}
}
// Opens the name screen for "single", "host" or "join" (the last name is filled in)
function openName(role) {
  S.role = role;
  nameIn.value = S.name || savedName();
  checkName();
  go("name");
}
$("#nameBack").onclick = () => go(S.role === "single" ? "mode" : "multi");
$("#nameOk").onclick = () => {
  S.name = nameIn.value.trim();
  saveName(S.name);
  if (S.role === "host") {
    hostRoom();
  } else if (S.role === "single") {
    openLevels("single");
  } else {
    $("#codeIn").value = "";
    $("#codeOk").disabled = true;
    setHint("Ask the host for the 5-character code");
    go("code");
  }
};

// Join code
const codeIn = $("#codeIn");
function setHint(t, err) {
  const h = $("#codeHint");
  h.textContent = t;
  h.classList.toggle("err", !!err);
}
codeIn.oninput = () => {
  codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  $("#codeOk").disabled = codeIn.value.length !== 5;
  setHint("Ask the host for the 5-character code");
};
codeIn.onkeydown = (e) => {
  if (e.key === "Enter" && !$("#codeOk").disabled) $("#codeOk").click();
};
$("#codeOk").onclick = joinRoom;

// ---------- Multiplayer (talks to the game server in the /server folder) ----------
const MAX_PLAYERS = 5;
const Net = { socket: null, room: null };
const NO_SERVER =
  "Can't reach the game server. Start it with 'npm start' in the server folder, then open the address it prints (for example http://localhost:3000) instead of Live Server.";
const ERRORS = {
  not_found: "Room not found. Check the code and try again.",
  full: "This room is full.",
  started: "This game has already started.",
  bad_name: "Please use a name with letters, numbers and spaces only.",
  timeout: "The server did not answer. Try again.",
  need_players: "You need at least one other player to start.",
  not_host: "Only the host can start the game.",
};
const myId = () => (Net.socket ? Net.socket.id : "");
const nameOf = (id) => {
  const p = Net.room && Net.room.players.find((x) => x.id === id);
  return p ? p.name : undefined;
};

function showNotice(text, title = "Notice") {
  $("#noticeTitle").textContent = title;
  $("#noticeText").textContent = text;
  $("#notice").classList.add("on");
}
$("#noticeOk").onclick = () => $("#notice").classList.remove("on");

// Opens (or reuses) the connection to the server
function netReady() {
  return new Promise((resolve, reject) => {
    if (typeof io === "undefined") return reject(new Error("noserver")); // page not opened from the server
    if (!Net.socket) {
      Net.socket = io();
      wire(Net.socket);
    }
    const s = Net.socket;
    if (s.connected) return resolve(s);
    const t = setTimeout(() => reject(new Error("timeout")), 4000);
    s.once("connect", () => {
      clearTimeout(t);
      resolve(s);
    });
  });
}
// Sends a request and waits for the server's answer (gives up after 5 seconds)
function ask(sock, event, payload) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, error: "timeout" }), 5000);
    sock.emit(event, payload, (res) => {
      clearTimeout(t);
      resolve(res || { ok: false });
    });
  });
}
function resetNet() {
  Net.room = null;
  S.code = "";
}
function leaveRoom() {
  if (Net.socket && Net.room) Net.socket.emit("leave");
  resetNet();
}

// Messages from the server
function wire(sock) {
  sock.on("room", (r) => {
    Net.room = r;
    if ($("#room").classList.contains("on")) renderRoom();
  });
  sock.on("begin", beginRace);
  sock.on("pos", (p) => Game.setRemote(p.id, nameOf(p.id), p.x, p.y));
  sock.on("finished", (f) => {
    if (f.id !== myId()) Game.say(`${f.name} finished #${f.rank}!`);
  });
  sock.on("out", (o) => {
    if (o.id !== myId()) Game.say(`${o.name} is out of the race`);
  });
  sock.on("left", (l) => Game.removeRemote(l.id));
  sock.on("results", showResults);
  sock.on("closed", () => {
    Game.stop();
    resetNet();
    go("multi");
    showNotice("The host closed the room.", "Room closed");
  });
  sock.on("disconnect", () => {
    if (!Net.room) return;
    Game.stop();
    resetNet();
    go("multi");
    showNotice("Lost the connection to the game server.", "Disconnected");
  });
}

async function hostRoom() {
  try {
    const sock = await netReady();
    const res = await ask(sock, "host", { name: S.name });
    if (!res.ok)
      return showNotice(ERRORS[res.error] || "Could not create the room.");
    Net.room = res.room;
    S.name = res.name;
    S.code = res.room.code;
    renderRoom();
    go("room");
  } catch {
    showNotice(NO_SERVER, "No game server");
  }
}

async function joinRoom() {
  const btn = $("#codeOk");
  btn.disabled = true;
  btn.textContent = "Joining...";
  const reset = () => {
    btn.textContent = "Join game";
    btn.disabled = codeIn.value.length !== 5;
  };
  try {
    const sock = await netReady();
    const res = await ask(sock, "join", { name: S.name, code: codeIn.value });
    reset();
    if (!res.ok)
      return setHint(ERRORS[res.error] || "Could not join the room.", true);
    Net.room = res.room;
    S.name = res.name;
    S.code = res.room.code;
    renderRoom();
    go("room");
  } catch {
    reset();
    setHint("Can't reach the game server.", true);
    showNotice(NO_SERVER, "No game server");
  }
}

// ---------- Room (lobby) ----------
function renderRoom() {
  const r = Net.room;
  if (!r) return;
  const host = r.hostId === myId();
  const admin = r.players.find((p) => p.isHost);
  const guests = r.players.filter((p) => !p.isHost);
  $("#admin").textContent = `${admin ? admin.name : ""} (Room admin)`;
  $("#roomCode").textContent = r.code;
  $("#status").textContent = host
    ? guests.length
      ? `${r.players.length} players in the room`
      : "Waiting for other players to join"
    : "Waiting for the host to start";
  const list = $("#plist");
  list.textContent = "";
  if (!guests.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No one has joined yet";
    list.append(li);
  }
  guests.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.name;
    list.append(li);
  });
  $("#start").style.display = host ? "" : "none";
  $("#start").disabled = guests.length < 1;
  $("#roomX").setAttribute("aria-label", host ? "Close room" : "Leave room");
}
$("#start").onclick = () => openLevels("multi");
$("#copy").onclick = async () => {
  const b = $("#copy");
  try {
    await navigator.clipboard.writeText(S.code);
    b.textContent = "Copied!";
  } catch {
    b.textContent = "Copy failed";
  }
  setTimeout(() => (b.textContent = "Copy code"), 1500);
};

function askConfirm(title, msg, onYes) {
  S.onYes = onYes;
  $("#cTitle").textContent = title;
  $("#cMsg").textContent = msg;
  $("#confirm").classList.add("on");
}
$("#roomX").onclick = () => {
  const host = Net.room && Net.room.hostId === myId();
  askConfirm(
    host ? "Close room?" : "Leave room?",
    host
      ? "All players will be removed from this room."
      : "You will return to the multiplayer menu.",
    () => {
      leaveRoom();
      go("multi");
    },
  );
};
$("#cNo").onclick = () => $("#confirm").classList.remove("on");
$("#cYes").onclick = () => {
  $("#confirm").classList.remove("on");
  const f = S.onYes;
  S.onYes = null;
  if (f) f();
};

// ---------- The race ----------
function beginRace(b) {
  settingsEl.classList.remove("on");
  $("#confirm").classList.remove("on");
  S.level = b.level;
  go("game");
  Game.start(b.level, {
    seed: b.seed, // everybody builds the same maze from the same seed
    name: S.name,
    multi: true,
    countdown: b.delay / 1000,
    onTick: (p) => Net.socket && Net.socket.emit("pos", p),
    onFinish: (time) => Net.socket && Net.socket.emit("finish", { time }),
    onFail: () => Net.socket && Net.socket.emit("out", {}),
    confirmQuit: () =>
      askConfirm(
        "Leave the race?",
        "You will be removed from this room.",
        () => {
          Game.stop();
          leaveRoom();
          go("multi");
        },
      ),
  });
  b.players.forEach((p) => {
    if (p.id !== myId()) Game.setRemote(p.id, p.name);
  });
}

function showResults(r) {
  Game.stop();
  const list = $("#rankList");
  list.textContent = "";
  r.ranking.forEach((p) => {
    const li = document.createElement("li");
    if (p.id === myId()) li.className = "me";
    const a = document.createElement("span");
    a.textContent =
      p.status === "finished" ? `${p.rank}. ${p.name}` : `- ${p.name}`;
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = p.status === "finished" ? `${p.time.toFixed(1)}s` : "Out";
    li.append(a, t);
    list.append(li);
  });
  go("results");
}
$("#resLobby").onclick = () => {
  renderRoom();
  go("room");
};
$("#resLeave").onclick = () => {
  leaveRoom();
  go("multi");
};

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (settingsEl.classList.contains("on")) closeSettings();
  $("#confirm").classList.remove("on");
});

// ---------- Select Level ----------
const TOTAL_LEVELS = 25;
const PER_PAGE = 15; // 5 per row x 3 rows
// ---- Level progress (saved in the browser) ----
// progress = { levelNumber: starsEarned }. A level is unlocked once the one
// before it has been finished, so only level 1 is open at the start.
const SAVE_KEY = "itmaze-progress";
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {}
}
let progress = loadProgress();
function unlockedUpTo() {
  const done = Object.keys(progress).map(Number);
  return Math.min(TOTAL_LEVELS, (done.length ? Math.max(...done) : 0) + 1);
}
// Call this when the player finishes a level (game.js will use it later)
function completeLevel(level, stars) {
  progress[level] = Math.max(progress[level] || 0, stars);
  saveProgress();
}
const LOCK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="#c9c9c9" stroke-width="2.6"/><rect x="4" y="10" width="16" height="12" rx="2.5" fill="#ffd400" stroke="#1c0f08" stroke-width="1.2"/><circle cx="12" cy="15.5" r="1.8" fill="#1c0f08"/><rect x="11.2" y="16" width="1.6" height="3.5" fill="#1c0f08"/></svg>';
S.level = 0;
S.popped = 0; // level that was just unlocked (for the pop animation)
S.lvPage = 0;
S.mode = "";

function renderLevels() {
  const first = S.lvPage * PER_PAGE;
  const unlocked = S.mode === "multi" ? TOTAL_LEVELS : unlockedUpTo(); // a race can use any level
  $("#lvGrid").innerHTML = Array.from({ length: PER_PAGE }, (_, i) => {
    const n = first + i + 1;
    if (n > TOTAL_LEVELS) return '<div class="lvcell"></div>'; // empty slot on the last page
    const locked = n > unlocked;
    const sel = n === S.level;
    return `<div class="lvcell"><div class="stars" aria-hidden="true">${S.mode === "multi" ? "" : "★".repeat(progress[n] || 0)}</div><button class="lv${locked ? " locked" : ""}${sel ? " sel" : ""}${n === S.popped ? " pop" : ""}" data-lv="${n}" aria-pressed="${sel}" aria-label="Level ${n}${locked ? ", locked" : ""}">${locked ? LOCK : n}</button></div>`;
  }).join("");
  $("#lvPrev").disabled = S.lvPage === 0;
  $("#lvNext").disabled = (S.lvPage + 1) * PER_PAGE >= TOTAL_LEVELS;
  $("#lvStart").disabled = !S.level;
  S.popped = 0;
}

function openLevels(mode) {
  S.mode = mode;
  const cap = mode === "multi" ? TOTAL_LEVELS : unlockedUpTo();
  if (!S.level) S.level = mode === "multi" ? 1 : cap; // preselect the latest unlocked level
  if (S.level > cap) S.level = cap;
  S.lvPage = Math.floor((S.level - 1) / PER_PAGE);
  renderLevels();
  go("levels");
}

$("#lvGrid").onclick = (e) => {
  const b = e.target.closest(".lv");
  if (!b) return;
  const n = Number(b.dataset.lv);
  if (n > (S.mode === "multi" ? TOTAL_LEVELS : unlockedUpTo())) {
    b.classList.remove("shake");
    void b.offsetWidth; // restart the shake animation
    b.classList.add("shake");
    return;
  }
  S.level = n;
  renderLevels();
};
$("#lvPrev").onclick = () => {
  S.lvPage--;
  renderLevels();
};
$("#lvNext").onclick = () => {
  S.lvPage++;
  renderLevels();
};
$("#lvBack").onclick = () => go(S.mode === "single" ? "mode" : "room");
$("#lvStart").onclick = async () => {
  if (S.mode === "multi") {
    const res = await ask(Net.socket, "start", { level: S.level });
    if (!res.ok) showNotice(ERRORS[res.error] || "Could not start the game.");
    return; // the server sends "begin" to everyone, including you
  }
  go("game");
  Game.start(S.level, {
    name: S.name,
    onComplete: finishLevel,
    onQuit: () => openLevels(S.mode),
  });
};

// Called by the game when the player reaches the exit
function finishLevel(level, stars) {
  const before = unlockedUpTo();
  completeLevel(level, stars); // stars = hearts left when the player reached the exit
  const after = unlockedUpTo();
  S.popped = after > before ? after : 0;
  S.level = after;
  openLevels(S.mode);
}

// ---- Demo helper ----
$("#lvReset").onclick = () => {
  progress = {};
  saveProgress();
  S.level = 0;
  openLevels(S.mode);
};
