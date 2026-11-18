// game.js: the playable level.
// Sections: 1) puzzles (add your own here)  2) level generation  3) monsters
//           4) input and movement  5) popup  6) game loop  7) drawing  8) public API

const Game = (() => {
  // ---------- Settings ----------
  const CELL = 60; // size of one maze cell (world units, scaled to fit the screen)
  const WALL = 18; // wall thickness
  const FRAME = 16; // brown border around the maze
  const SPEED = 170; // player speed (world units per second)
  const PLAYER_R = (CELL - WALL) * 0.32;
  const MON_R = (CELL - WALL) * 0.3;
  const MAX_HEARTS = 3;
  const INVULN = 2; // seconds of safety after a monster hit
  const WRONG_PENALTY = 10; // seconds lost for a wrong answer
  const PASS_LEVEL = 9; // from this level monsters pass through gates and popups are timed
  const POPUP_LOCK = 5; // seconds a gate stays locked after a timed-out question
  const popupTime = (level) => Math.max(12, 30 - (level - PASS_LEVEL)); // seconds per question
  const TAU = Math.PI * 2;
  // Wall look: "cobble" (grey stone, recommended) or "brick" (red-brown). Try both!
  const WALL_STYLE = "cobble";

  // How smart the monsters are, by level.
  //   speed = fraction of the player's speed, sight = how many cells away
  //   (along the maze path) they notice you and chase. sight 0 = patrol only.
  const AI = [
    { upTo: 4, speed: 0.5, sight: 0 }, // levels 1-4: patrol the corridors
    { upTo: 8, speed: 0.58, sight: 5 }, // levels 5-8: chase you when you are close
    { upTo: 12, speed: 0.65, sight: 9 }, // levels 9-12: notice you from far away
    { upTo: 15, speed: 0.72, sight: 99 }, // levels 13-15: hunt you everywhere
    { upTo: 20, speed: 0.78, sight: 99 }, // levels 16-20: faster hunters
    { upTo: 25, speed: 0.84, sight: 99 }, // levels 21-25: the fastest hunters
  ];
  const aiFor = (level) => AI.find((a) => level <= a.upTo) || AI[AI.length - 1];
  const tierOf = (level) => Math.min(5, Math.ceil(level / 5)); // 1-5 = tier 1, 6-10 = tier 2, ...

  const $ = (s) => document.querySelector(s);
  const canvas = $("#mazeCanvas");
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  let S = null; // state of the level being played
  const sfx = (name) => {
    if (typeof Sound !== "undefined") Sound.play(name); // sound effects live in script.js
  };

  // ---------- 1) Puzzles ----------
  // To add a puzzle, copy one of these and change it. "tier" 1 = levels 1-5,
  // 2 = levels 6-10, 3 = levels 11-15.
  //  type "bug":    lines of code. Put @@ around the faulty word(s). The player
  //                 clicks a word and presses Confirm. Any @@marked@@ word is correct.
  //  type "choice": options list. "answer" is the index of the correct option.
  const PUZZLES = [
    // ----- tier 1: programming basics, hardware and OS -----
    {
      tier: 1,
      subject: "Programming",
      type: "bug",
      title: "Find the variable name that does not match",
      lines: [
        'let @@doorstatus@@ = "LOCKED"',
        'if (@@doorState@@ == "LOCKED") {',
        "  unlock();",
        "}",
      ],
    },
    {
      tier: 1,
      subject: "Programming",
      type: "bug",
      title: "Find the mistake that makes this loop run forever",
      lines: ["for (let i = 0; i < 5; i@@--@@) {", "  console.log(i);", "}"],
    },
    {
      tier: 1,
      subject: "Programming",
      type: "bug",
      title: "Find the operator that is not a comparison",
      lines: [
        "let score = 100;",
        "if (score @@=@@ 100) {",
        '  console.log("Perfect!");',
        "}",
      ],
    },
    {
      tier: 1,
      subject: "Programming",
      type: "bug",
      title: "Find the operator that gives the wrong total",
      lines: [
        "// total = price x quantity",
        "let total = price @@+@@ quantity;",
      ],
    },
    {
      tier: 1,
      subject: "Programming",
      type: "bug",
      title: "Find the index that goes out of range",
      lines: [
        'let items = ["pen", "book", "bag"];',
        "// print the last item",
        "console.log(items[@@3@@]);",
      ],
    },
    {
      tier: 1,
      subject: "Hardware",
      type: "choice",
      title: "Pick the best fix",
      text: "A PC turns on, shows no picture and beeps repeatedly. What do you check first?",
      options: [
        "Reseat the RAM modules",
        "Reinstall the operating system",
        "Replace the keyboard",
        "Update the printer driver",
      ],
      answer: 0,
    },
    {
      tier: 1,
      subject: "Operating system",
      type: "choice",
      title: "Pick the best fix",
      text: "The computer is very slow and the disk light is always on. What is the best first step?",
      options: [
        "Open Task Manager to find the program using the disk",
        "Replace the monitor",
        "Change the wallpaper",
        "Unplug the mouse",
      ],
      answer: 0,
    },
    {
      tier: 1,
      subject: "Hardware",
      type: "choice",
      title: "Pick the best fix",
      text: "A printer shows Offline although it is powered on. What do you try first?",
      options: [
        "Check the cable or network connection and restart the printer",
        "Format the computer",
        "Replace the monitor",
        "Reinstall the web browser",
      ],
      answer: 0,
    },
    {
      tier: 1,
      subject: "Operating system",
      type: "choice",
      title: "Pick the right shortcut",
      text: "Which key combination opens Task Manager directly in Windows?",
      options: ["Ctrl + Shift + Esc", "Alt + F4", "Ctrl + P", "Win + D"],
      answer: 0,
    },
    {
      tier: 1,
      subject: "Hardware",
      type: "choice",
      title: "Pick the best fix",
      text: "A USB flash drive is not detected. What should you try first?",
      options: [
        "Plug it into a different USB port",
        "Format the hard drive",
        "Update the BIOS",
        "Replace the power supply",
      ],
      answer: 0,
    },

    // ----- tier 2: networking, SQL, HTML and CSS -----
    {
      tier: 2,
      subject: "Networking",
      type: "bug",
      title: "Find the invalid IP address",
      lines: [
        "Router: 192.168.1.1",
        "Mask:   255.255.255.0",
        "PC-1:   192.168.1.20",
        "PC-2:   @@192.168.1.300@@",
      ],
    },
    {
      tier: 2,
      subject: "Networking",
      type: "bug",
      title: "Find the PC on a different subnet",
      lines: [
        "Mask:  255.255.255.0",
        "PC-1:  192.168.1.10",
        "PC-2:  192.168.1.11",
        "PC-3:  @@192.168.5.12@@",
      ],
    },
    {
      tier: 2,
      subject: "Networking",
      type: "choice",
      title: "Pick the likely cause",
      text: "You can open websites by IP address but not by name. Which service is most likely failing?",
      options: ["DNS", "DHCP", "VPN", "USB"],
      answer: 0,
    },
    {
      tier: 2,
      subject: "Networking",
      type: "choice",
      title: "Pick the likely cause",
      text: "A PC shows an IP address starting with 169.254 and has no internet. What does this usually mean?",
      options: [
        "It could not get an address from the DHCP server",
        "The monitor cable is loose",
        "The DNS cache is full",
        "The keyboard driver is missing",
      ],
      answer: 0,
    },
    {
      tier: 2,
      subject: "Databases",
      type: "bug",
      title: "Find the misspelled SQL keyword",
      lines: ["SELECT name, grade", "@@FORM@@ students", "WHERE grade > 85;"],
    },
    {
      tier: 2,
      subject: "Databases",
      type: "bug",
      title: "Find the invalid operator",
      lines: ["SELECT * FROM users", "WHERE age @@=>@@ 18;"],
    },
    {
      tier: 2,
      subject: "Databases",
      type: "choice",
      title: "Pick the right statement",
      text: "Which statement deletes only the student with id 5?",
      options: [
        "DELETE FROM students WHERE id = 5;",
        "DELETE FROM students;",
        "DROP TABLE students;",
        "TRUNCATE TABLE students;",
      ],
      answer: 0,
    },
    {
      tier: 2,
      subject: "Web",
      type: "bug",
      title: "Find the closing tag that does not match",
      lines: ["<body>", "  <h1>Welcome</@@h2@@>", "  <p>Hello!</p>", "</body>"],
    },
    {
      tier: 2,
      subject: "Web",
      type: "bug",
      title: "Find the invalid CSS property",
      lines: ["p {", "  @@colour@@: blue;", "  font-size: 16px;", "}"],
    },
    {
      tier: 2,
      subject: "Web",
      type: "choice",
      title: "Pick the right tag",
      text: "Which HTML tag creates a link to another page?",
      options: ["<a>", "<link>", "<href>", "<p>"],
      answer: 0,
    },

    // ----- tier 3: cybersecurity and harder bugs -----
    {
      tier: 3,
      subject: "Cybersecurity",
      type: "choice",
      title: "Pick the safest action",
      text: "An email says your account closes in 1 hour unless you click a link. The sender is support@paypa1-security.com. What do you do?",
      options: [
        "Do not click it and report it as phishing",
        "Click the link quickly before it expires",
        "Reply with your password to verify",
        "Forward it to all your friends",
      ],
      answer: 0,
    },
    {
      tier: 3,
      subject: "Cybersecurity",
      type: "choice",
      title: "Pick the strongest option",
      text: "Which password is the strongest?",
      options: [
        "Tr!ple-Moon_92#Lamp",
        "password123",
        "juandelacruz",
        "12345678",
      ],
      answer: 0,
    },
    {
      tier: 3,
      subject: "Cybersecurity",
      type: "choice",
      title: "Pick the safest action",
      text: "You are on free public Wi-Fi and need to check your bank account. What is the safest choice?",
      options: [
        "Use your mobile data or a trusted VPN",
        "Log in normally on the public Wi-Fi",
        "Share your password with the cafe staff",
        "Turn off your antivirus first",
      ],
      answer: 0,
    },
    {
      tier: 3,
      subject: "Cybersecurity",
      type: "choice",
      title: "Pick the right answer",
      text: "What does a firewall do?",
      options: [
        "Filters incoming and outgoing network traffic using rules",
        "Makes the CPU run faster",
        "Stores backup copies of files",
        "Removes dust from the computer",
      ],
      answer: 0,
    },
    {
      tier: 3,
      subject: "Cybersecurity",
      type: "choice",
      title: "Pick the right example",
      text: "Which is an example of two-factor authentication?",
      options: [
        "A password plus a one-time code sent to your phone",
        "Two different passwords",
        "A very long password",
        "Typing your password twice",
      ],
      answer: 0,
    },
    {
      tier: 3,
      subject: "Cybersecurity",
      type: "choice",
      title: "Pick the safest action",
      text: "A document from an unknown sender asks you to enable macros to see its content. What should you do?",
      options: [
        "Do not enable them and delete or scan the file",
        "Enable macros to read it",
        "Disable your antivirus first",
        "Forward it to your classmates",
      ],
      answer: 0,
    },
    {
      tier: 3,
      subject: "Security",
      type: "bug",
      title: "Find the unsafe value placed directly into the query",
      lines: [
        'let id = request.getParam("id");',
        'let sql = "SELECT * FROM users WHERE id = " + @@id@@;',
        "db.run(sql);",
      ],
    },
    {
      tier: 3,
      subject: "Programming",
      type: "bug",
      title:
        "Find the operator that lets any logged-in user open the admin panel",
      lines: ["if (isAdmin @@||@@ isLoggedIn) {", "  showAdminPanel();", "}"],
    },
    {
      tier: 3,
      subject: "Programming",
      type: "bug",
      title: "Find the call that never reaches the base case",
      lines: [
        "function countdown(n) {",
        "  if (n === 0) return;",
        "  countdown(@@n + 1@@);",
        "}",
      ],
    },
    {
      tier: 3,
      subject: "Networking",
      type: "bug",
      title: "Find the wrong port number",
      lines: ["HTTP  -> port 80", "HTTPS -> port @@80@@", "SSH   -> port 22"],
    },

    // ----- tier 4 (levels 16-20): web, databases, networking, tools -----
    {
      tier: 4,
      subject: "Programming",
      type: "bug",
      title: "Find the mistake that reads past the end of the array",
      lines: [
        'let items = ["a", "b", "c"];',
        "for (let i = 0; i @@<=@@ items.length; i++) {",
        "  console.log(items[i]);",
        "}",
      ],
    },
    {
      tier: 4,
      subject: "Databases",
      type: "bug",
      title: "Find the value that needs quotes",
      lines: ["SELECT * FROM students", "WHERE name = @@Paul@@;"],
    },
    {
      tier: 4,
      subject: "Web",
      type: "bug",
      title: "Find the misspelled attribute",
      lines: ['<img @@scr@@="logo.png" alt="Logo">'],
    },
    {
      tier: 4,
      subject: "Web",
      type: "bug",
      title: "Find the invalid color value",
      lines: ["h1 {", "  color: @@#12345G@@;", "}"],
    },
    {
      tier: 4,
      subject: "Programming",
      type: "bug",
      title: "Find the statement that is not indented correctly",
      lines: ["if score > 50:", '@@print@@("Passed")'],
    },
    {
      tier: 4,
      subject: "Databases",
      type: "choice",
      title: "Pick the right JOIN",
      text: "Which JOIN returns only the rows that have a match in both tables?",
      options: ["INNER JOIN", "LEFT JOIN", "CROSS JOIN", "FULL OUTER JOIN"],
      answer: 0,
    },
    {
      tier: 4,
      subject: "Networking",
      type: "choice",
      title: "Pick the right answer",
      text: "Which port does HTTPS use by default?",
      options: ["443", "80", "22", "25"],
      answer: 0,
    },
    {
      tier: 4,
      subject: "Networking",
      type: "choice",
      title: "Pick the right answer",
      text: "A home network uses 192.168.1.0/24. What is its subnet mask?",
      options: ["255.255.255.0", "255.0.0.0", "255.255.0.0", "255.255.255.255"],
      answer: 0,
    },
    {
      tier: 4,
      subject: "Linux",
      type: "choice",
      title: "Pick the right command",
      text: "Which command shows the folder you are currently in on Linux?",
      options: ["pwd", "ls", "cd", "mkdir"],
      answer: 0,
    },
    {
      tier: 4,
      subject: "Git",
      type: "choice",
      title: "Pick the right command",
      text: "Which Git command saves your staged changes to the project history?",
      options: ["git commit", "git push", "git pull", "git clone"],
      answer: 0,
    },
    {
      tier: 4,
      subject: "Cybersecurity",
      type: "choice",
      title: "Pick the right answer",
      text: "Which attack tricks users into typing their login on a fake website?",
      options: ["Phishing", "DDoS", "Brute force", "Ransomware"],
      answer: 0,
    },
    {
      tier: 4,
      subject: "Hardware",
      type: "choice",
      title: "Pick the right answer",
      text: "Which component keeps your files even when the computer is turned off?",
      options: ["SSD", "RAM", "CPU", "Graphics card"],
      answer: 0,
    },

    // ----- tier 5 (levels 21-25): security, systems and harder bugs -----
    {
      tier: 5,
      subject: "Programming",
      type: "bug",
      title: "Find the statement that stops this loop from ever ending",
      lines: [
        "let n = 10;",
        "while (n > 0) {",
        "  console.log(n);",
        "  n@@++@@;",
        "}",
      ],
    },
    {
      tier: 5,
      subject: "Programming",
      type: "bug",
      title: "Find the line that crashes with 'cannot read properties of null'",
      lines: ["let user = null;", "console.log(@@user.name@@);"],
    },
    {
      tier: 5,
      subject: "Web",
      type: "bug",
      title: "Find the invalid CSS value",
      lines: ["nav {", "  display: @@flexx@@;", "}"],
    },
    {
      tier: 5,
      subject: "Cybersecurity",
      type: "choice",
      title: "Pick the best practice",
      text: "How should a website store its users' passwords?",
      options: [
        "Hashed and salted",
        "In plain text",
        "Encoded with Base64",
        "In a text file on the desktop",
      ],
      answer: 0,
    },
    {
      tier: 5,
      subject: "Cybersecurity",
      type: "choice",
      title: "Pick the likely attack",
      text: "A website shows whatever a visitor types in its comment box without checking it. Which attack does this risk?",
      options: [
        "Cross-site scripting (XSS)",
        "DNS poisoning",
        "Disk fragmentation",
        "Packet loss",
      ],
      answer: 0,
    },
    {
      tier: 5,
      subject: "Cybersecurity",
      type: "choice",
      title: "Pick the right principle",
      text: "What does the principle of least privilege mean?",
      options: [
        "Users get only the access they need",
        "Everyone gets administrator rights",
        "Passwords are never changed",
        "Only the oldest account has access",
      ],
      answer: 0,
    },
    {
      tier: 5,
      subject: "Networking",
      type: "choice",
      title: "Pick the right tool",
      text: "Which tool lets you control a remote Linux server over an encrypted connection?",
      options: ["SSH", "Telnet", "FTP", "HTTP"],
      answer: 0,
    },
    {
      tier: 5,
      subject: "Web",
      type: "choice",
      title: "Pick the right status code",
      text: "Which HTTP status code means the page was not found?",
      options: ["404", "200", "301", "500"],
      answer: 0,
    },
    {
      tier: 5,
      subject: "Hardware",
      type: "choice",
      title: "Pick the right answer",
      text: "What does RAID 1 do?",
      options: [
        "Keeps the same data on two disks (mirroring)",
        "Splits data across disks for speed with no backup",
        "Compresses all files",
        "Scans disks for viruses",
      ],
      answer: 0,
    },
    {
      tier: 5,
      subject: "Git",
      type: "choice",
      title: "Pick the safest action",
      text: "You accidentally pushed a password to a public repository. What should you do first?",
      options: [
        "Change or revoke the password right away",
        "Delete the file in the next commit and do nothing else",
        "Wait to see if anyone notices",
        "Rename the repository",
      ],
      answer: 0,
    },
    {
      tier: 5,
      subject: "Databases",
      type: "choice",
      title: "Pick the right rule",
      text: "What must be true for a primary key in a table?",
      options: [
        "Every row has a unique value that is not empty",
        "Every row has the same value",
        "It must be a number",
        "It must be the first column",
      ],
      answer: 0,
    },
    {
      tier: 5,
      subject: "Programming",
      type: "choice",
      title: "Pick the fastest",
      text: "Which of these grows the slowest as the input gets very large?",
      options: ["O(log n)", "O(n)", "O(n squared)", "O(2 to the power n)"],
      answer: 0,
    },
  ];

  const seenPuzzles = new Set(); // so the same question is not asked twice in a row
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  // Questions for a level: its own difficulty group plus the one before it
  const poolFor = (level) =>
    PUZZLES.filter(
      (p) => p.tier <= tierOf(level) && p.tier >= tierOf(level) - 1,
    );
  // A different question for a gate (used after a wrong answer or a time-out)
  function pickOne(level, avoid) {
    const pool = poolFor(level);
    let fresh = pool.filter((p) => !avoid.includes(p) && !seenPuzzles.has(p));
    if (!fresh.length) fresh = pool.filter((p) => !avoid.includes(p));
    if (!fresh.length) fresh = pool;
    const p = fresh[Math.floor(Math.random() * fresh.length)];
    seenPuzzles.add(p);
    return p;
  }
  function pickPuzzles(level, n) {
    const pool = poolFor(level);
    const picks = [];
    while (picks.length < n) {
      let fresh = pool.filter((p) => !seenPuzzles.has(p) && !picks.includes(p));
      if (!fresh.length) {
        pool.forEach((p) => seenPuzzles.delete(p));
        fresh = pool.filter((p) => !picks.includes(p));
      }
      if (!fresh.length) break;
      const p = fresh[Math.floor(Math.random() * fresh.length)];
      picks.push(p);
      seenPuzzles.add(p);
    }
    for (const p of PUZZLES)
      if (picks.length < n && !picks.includes(p)) picks.push(p); // safety net
    return picks;
  }

  // ---------- 2) Level generation ----------
  // Seeded random numbers: the same seed always gives the same maze
  function mulberry32(a) {
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DIRS = [
    ["top", -1, 0, "bottom"],
    ["right", 0, 1, "left"],
    ["bottom", 1, 0, "top"],
    ["left", 0, -1, "right"],
  ];
  const inGrid = (g, r, c) =>
    r >= 0 && c >= 0 && r < g.length && c < g[0].length;
  const edgeKey = (r1, c1, r2, c2) =>
    r1 < r2 || (r1 === r2 && c1 < c2)
      ? `${r1},${c1}|${r2},${c2}`
      : `${r2},${c2}|${r1},${c1}`;

  // Recursive backtracker: carves a path through every cell (a "perfect" maze)
  function generate(cols, rows, seed) {
    const rand = mulberry32(seed);
    const grid = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        r,
        c,
        seen: false,
        top: true,
        right: true,
        bottom: true,
        left: true,
      })),
    );
    const first = grid[rows - 1][cols - 1];
    first.seen = true;
    const stack = [first];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const opts = [];
      for (const [side, dr, dc, opp] of DIRS) {
        const nr = cur.r + dr;
        const nc = cur.c + dc;
        if (inGrid(grid, nr, nc) && !grid[nr][nc].seen)
          opts.push([side, opp, grid[nr][nc]]);
      }
      if (!opts.length) {
        stack.pop();
        continue;
      }
      const [side, opp, next] = opts[Math.floor(rand() * opts.length)];
      cur[side] = false;
      next[opp] = false;
      next.seen = true;
      stack.push(next);
    }
    return grid;
  }

  // Breadth-first search over open sides. isBlocked(r, c, nr, nc) can block an edge (closed gates).
  function bfs(grid, from, isBlocked) {
    const rows = grid.length;
    const cols = grid[0].length;
    const dist = Array.from({ length: rows }, () => Array(cols).fill(-1));
    const prev = Array.from({ length: rows }, () => Array(cols).fill(null));
    const queue = [from];
    dist[from.r][from.c] = 0;
    for (let i = 0; i < queue.length; i++) {
      const { r, c } = queue[i];
      for (const [side, dr, dc] of DIRS) {
        if (grid[r][c][side]) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (!inGrid(grid, nr, nc) || dist[nr][nc] >= 0) continue;
        if (isBlocked && isBlocked(r, c, nr, nc)) continue;
        dist[nr][nc] = dist[r][c] + 1;
        prev[nr][nc] = { r, c };
        queue.push({ r: nr, c: nc });
      }
    }
    return { dist, prev };
  }

  function levelConfig(level) {
    return {
      cols: Math.min(8 + level, 26), // level 1 = 9x6 cells, level 18 and up = 26x14 (maze stops growing)
      rows: Math.min(5 + Math.ceil(level / 2), 14),
      seed: level * 7919 + 1337,
      gates: Math.min(5, Math.ceil(level / 5)), // 1 to 5 troubleshooting rounds
      monsters:
        Math.min(5, 1 + Math.floor((level - 1) / 4)) -
        (level === PASS_LEVEL ? 1 : 0), // 1 to 5 (one fewer on level 9)
      loops: 0.1 + 0.005 * level, // share of extra walls opened to make side routes
    };
  }

  // Builds everything about a level that does not need the screen
  function buildLevel(level, seedOverride) {
    const cfg = levelConfig(level);
    const { cols, rows } = cfg;
    const seed = seedOverride ?? cfg.seed;
    const grid = generate(cols, rows, seed);
    const rand = mulberry32(seed ^ 0x5bd1e995);
    const start = { r: rows - 1, c: cols - 1 }; // player: bottom-right
    const exit = { r: 0, c: 0 }; // exit door: top-left

    // The key sits far from the start and away from the exit
    const fromStart = bfs(grid, start);
    const fromExit = bfs(grid, exit);
    let key = null;
    let far = -1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (fromExit.dist[r][c] >= 6 && fromStart.dist[r][c] > far) {
          far = fromStart.dist[r][c];
          key = { r, c };
        }
      }
    }
    const route = [];
    for (let p = key; p; p = fromStart.prev[p.r][p.c]) route.unshift(p);

    // Gates are placed one after another on the only route from the start to the key
    const edges = route.length - 1;
    const count = Math.max(1, Math.min(cfg.gates, Math.floor(edges / 6)));
    const gateEdges = [];
    for (let j = 1; j <= count; j++) {
      let i = Math.round((edges * j) / (count + 1)) - 1;
      i = Math.max(
        i,
        gateEdges.length ? gateEdges[gateEdges.length - 1].i + 3 : 1,
      );
      i = Math.min(i, edges - 2);
      gateEdges.push({ i, a: route[i], b: route[i + 1] });
    }
    const gateSet = new Set(
      gateEdges.map((e) => edgeKey(e.a.r, e.a.c, e.b.r, e.b.c)),
    );
    const isGate = (r, c, nr, nc) => gateSet.has(edgeKey(r, c, nr, nc));

    // The gates split the maze into zones
    const zone = Array.from({ length: rows }, () => Array(cols).fill(-1));
    let zones = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (zone[r][c] >= 0) continue;
        const { dist } = bfs(grid, { r, c }, isGate);
        for (let rr = 0; rr < rows; rr++)
          for (let cc = 0; cc < cols; cc++)
            if (dist[rr][cc] >= 0) zone[rr][cc] = zones;
        zones++;
      }
    }

    // Alternative routes: open dead ends, then some extra walls, but only inside a
    // zone, so every gate stays a real chokepoint.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const openSides = DIRS.filter(([side]) => !cell[side]).length;
        if (openSides !== 1 || rand() > 0.9) continue;
        const opts = DIRS.filter(
          ([side, dr, dc]) =>
            cell[side] &&
            inGrid(grid, r + dr, c + dc) &&
            zone[r + dr][c + dc] === zone[r][c],
        );
        if (!opts.length) continue;
        const [side, dr, dc, opp] = opts[Math.floor(rand() * opts.length)];
        cell[side] = false;
        grid[r + dr][c + dc][opp] = false;
      }
    }
    const closed = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (const [side, dr, dc, opp] of [DIRS[1], DIRS[2]]) {
          const nr = r + dr;
          const nc = c + dc;
          if (
            inGrid(grid, nr, nc) &&
            grid[r][c][side] &&
            zone[nr][nc] === zone[r][c]
          )
            closed.push([grid[r][c], side, grid[nr][nc], opp]);
        }
      }
    }
    for (let i = closed.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [closed[i], closed[j]] = [closed[j], closed[i]];
    }
    closed
      .slice(0, Math.floor(closed.length * cfg.loops))
      .forEach(([a, side, b, opp]) => {
        a[side] = false;
        b[opp] = false;
      });

    // The blocking piece of each gate (fills the gap in the wall)
    const gates = gateEdges.map(({ a, b }) => {
      const rect =
        a.r === b.r
          ? {
              x: Math.max(a.c, b.c) * CELL - WALL / 2,
              y: a.r * CELL,
              w: WALL,
              h: CELL,
            }
          : {
              x: a.c * CELL,
              y: Math.max(a.r, b.r) * CELL - WALL / 2,
              w: CELL,
              h: WALL,
            };
      return {
        a,
        b,
        rect,
        cx: rect.x + rect.w / 2,
        cy: rect.y + rect.h / 2,
        open: false,
      };
    });

    // Timer: travel time start -> key -> exit, plus time for each puzzle
    const d1 = bfs(grid, start).dist[key.r][key.c];
    const d2 = bfs(grid, key).dist[exit.r][exit.c];
    const time = Math.round((d1 + d2) * 0.35 * 2.2 + gates.length * 25 + 30);

    // Monsters: spread over the zones, never close to the player's start
    const startZone = zone[start.r][start.c];
    const dStart = bfs(grid, start, level >= PASS_LEVEL ? null : isGate).dist; // monsters pass gates from level 9
    const used = new Set([
      `${key.r},${key.c}`,
      `${exit.r},${exit.c}`,
      `${start.r},${start.c}`,
    ]);
    gateEdges.forEach((e) => {
      used.add(`${e.a.r},${e.a.c}`);
      used.add(`${e.b.r},${e.b.c}`);
    });
    const spawns = [];
    for (let i = 0; i < cfg.monsters; i++) {
      const ok = (r, c) =>
        !used.has(`${r},${c}`) && !(dStart[r][c] >= 0 && dStart[r][c] < 7);
      let pool = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (ok(r, c) && zone[r][c] === i % zones) pool.push({ r, c });
      if (!pool.length)
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) if (ok(r, c)) pool.push({ r, c });
      if (!pool.length) break;
      const s = pool[Math.floor(rand() * pool.length)];
      used.add(`${s.r},${s.c}`);
      spawns.push({ r: s.r, c: s.c, type: i % 2 ? "eye" : "crab" });
    }
    return {
      cfg,
      seed,
      cols,
      rows,
      grid,
      start,
      exit,
      key,
      gates,
      zone,
      zones,
      time,
      spawns,
    };
  }

  // Turns the grid into thick wall rectangles (used for drawing and collision)
  function buildWalls(grid, cols, rows) {
    const t = WALL / 2;
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell.right && c < cols - 1)
          out.push({
            x: (c + 1) * CELL - t,
            y: r * CELL - t,
            w: WALL,
            h: CELL + WALL,
          });
        if (cell.bottom && r < rows - 1)
          out.push({
            x: c * CELL - t,
            y: (r + 1) * CELL - t,
            w: CELL + WALL,
            h: WALL,
          });
      }
    }
    return out;
  }

  // ---------- 3) Monsters ----------
  const closedBlock = (r, c, nr, nc) =>
    S.closedEdges.has(edgeKey(r, c, nr, nc));
  function openNeighbors(r, c) {
    const out = [];
    for (const [side, dr, dc] of DIRS) {
      if (S.grid[r][c][side]) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (
        inGrid(S.grid, nr, nc) &&
        (S.level >= PASS_LEVEL || !closedBlock(r, c, nr, nc))
      )
        out.push({ r: nr, c: nc });
    }
    return out;
  }
  const playerCell = () => ({
    r: Math.max(0, Math.min(S.rows - 1, Math.floor(S.p.y / CELL))),
    c: Math.max(0, Math.min(S.cols - 1, Math.floor(S.p.x / CELL))),
  });
  // Distance from every cell to the player (closed gates count as walls)
  function refreshDist(force) {
    const pc = playerCell();
    const id = `${pc.r},${pc.c}`;
    if (!force && S.distCell === id) return;
    S.distCell = id;
    S.dist = bfs(S.grid, pc, S.level >= PASS_LEVEL ? null : closedBlock).dist; // monsters pass gates from level 9
  }
  function chooseTarget(m, ai) {
    const opts = openNeighbors(m.r, m.c);
    if (!opts.length) {
      m.tr = m.r;
      m.tc = m.c;
      return;
    }
    let pick = null;
    const d = S.dist[m.r][m.c];
    if (ai.sight > 0 && d >= 0 && d <= ai.sight) {
      // chase: step along the shortest route to the player
      let best = Infinity;
      let bests = [];
      for (const o of opts) {
        const od = S.dist[o.r][o.c];
        if (od < 0) continue;
        if (od < best) {
          best = od;
          bests = [o];
        } else if (od === best) bests.push(o);
      }
      if (bests.length) pick = bests[Math.floor(S.rand() * bests.length)];
    }
    if (!pick) {
      // patrol: keep going, only turn back at a dead end
      const fwd = opts.filter((o) => !(o.r === m.pr && o.c === m.pc));
      const list = fwd.length ? fwd : opts;
      pick = list[Math.floor(S.rand() * list.length)];
    }
    m.tr = pick.r;
    m.tc = pick.c;
  }
  function stepMonsters(dt) {
    const ai = aiFor(S.level);
    for (const m of S.monsters) {
      m.t += (SPEED * ai.speed * dt) / CELL;
      while (m.t >= 1) {
        m.t -= 1;
        m.pr = m.r;
        m.pc = m.c;
        m.r = m.tr;
        m.c = m.tc;
        chooseTarget(m, ai);
      }
      m.x = (m.c + 0.5 + (m.tc - m.c) * m.t) * CELL;
      m.y = (m.r + 0.5 + (m.tr - m.r) * m.t) * CELL;
    }
  }

  // ---------- 4) Input and movement ----------
  const keys = { up: false, down: false, left: false, right: false };
  const KEYMAP = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };
  const clearKeys = () => Object.keys(keys).forEach((k) => (keys[k] = false));
  window.addEventListener("keydown", (e) => {
    if (!S || !S.running) return;
    if (e.key === "Escape" && S.activeGate) return dismissPuzzle();
    if ((e.key === "e" || e.key === "E") && !e.repeat) return interact();
    const k = KEYMAP[e.key];
    if (k) {
      keys[k] = true;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = KEYMAP[e.key];
    if (k) keys[k] = false;
  });
  window.addEventListener("blur", clearKeys);
  document.querySelectorAll("#dpad [data-dir]").forEach((b) => {
    const dir = b.dataset.dir;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      keys[dir] = true;
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
      b.addEventListener(ev, () => (keys[dir] = false)),
    );
  });
  $("#actBtn").addEventListener("click", () => interact());

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function hitsRect(x, y, w, r) {
    const dx = x - clamp(x, w.x, w.x + w.w);
    const dy = y - clamp(y, w.y, w.y + w.h);
    return dx * dx + dy * dy < r * r;
  }
  function collides(x, y) {
    for (const w of S.walls) if (hitsRect(x, y, w, PLAYER_R)) return true;
    for (const g of S.gates)
      if (!g.open && hitsRect(x, y, g.rect, PLAYER_R)) return true;
    return false;
  }
  // Small steps, one axis at a time: the player slides along walls and never jumps through one
  function move(dx, dy) {
    const p = S.p;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4) || 1;
    for (let i = 0; i < steps; i++) {
      const nx = clamp(p.x + dx / steps, PLAYER_R, S.W - PLAYER_R);
      if (!collides(nx, p.y)) p.x = nx;
      const ny = clamp(p.y + dy / steps, PLAYER_R, S.H - PLAYER_R);
      if (!collides(p.x, ny)) p.y = ny;
    }
  }

  // ---------- 5) Troubleshooting popup ----------
  const TOKEN = /"[^"]*"|\d+(?:\.\d+)+|\w+|\s+|[^\w\s]/g;
  const CLICKABLE = /^("[^"]*"|\d+(\.\d+)+|\w+)$/;
  function nearestGate() {
    let best = null;
    let bd = CELL * 0.95;
    for (const g of S.gates) {
      if (g.open) continue;
      const d = Math.hypot(S.p.x - g.cx, S.p.y - g.cy);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    return best;
  }
  function interact() {
    if (!S || !S.running || S.paused || S.won || S.over) return;
    const g = nearestGate();
    if (!g) return;
    if (g.lock > 0)
      return toast(`This gate is locked for ${Math.ceil(g.lock)} more seconds`);
    openPuzzle(g);
  }
  function openPuzzle(gate) {
    S.paused = true; // the timer and the monsters freeze while the popup is open
    S.activeGate = gate;
    clearKeys();
    renderPuzzle(gate);
    $("#puzzleBox").hidden = false;
    startPopupTimer();
  }
  // Fills the popup with the gate's question
  function renderPuzzle(gate) {
    const pz = gate.puzzle;
    S.choice = null;
    $("#puzzleSubject").textContent = pz.subject;
    $("#puzzleTitle").textContent = pz.title;
    $("#puzzleText").textContent = pz.text || "";
    $("#puzzleFeedback").textContent = "";
    $("#puzzleConfirm").disabled = true;
    const body = $("#puzzleBody");
    body.textContent = "";
    body.className = pz.type === "bug" ? "code" : "opts";
    const pick = (el, correct) => {
      body
        .querySelectorAll(".sel")
        .forEach((n) => n.classList.remove("sel", "wrong"));
      el.classList.add("sel");
      S.choice = { el, correct };
      $("#puzzleConfirm").disabled = false;
    };
    if (pz.type === "bug") {
      pz.lines.forEach((line, i) => {
        const row = document.createElement("div");
        row.className = "line";
        const num = document.createElement("span");
        num.className = "num";
        num.textContent = `${i + 1}.`;
        row.append(num);
        const add = (text, correct) => {
          const el = document.createElement(
            correct || CLICKABLE.test(text) ? "button" : "span",
          );
          el.textContent = text;
          if (el.tagName === "BUTTON") {
            el.className = "tok";
            el.type = "button";
            el.onclick = () => pick(el, correct);
          } else el.className = "plain";
          row.append(el);
        };
        line.split(/(@@.+?@@)/).forEach((part) => {
          if (/^@@.+@@$/.test(part)) add(part.slice(2, -2), true);
          else (part.match(TOKEN) || []).forEach((t) => add(t, false));
        });
        body.append(row);
      });
    } else {
      shuffle(
        pz.options.map((text, i) => ({ text, correct: i === pz.answer })),
      ).forEach((o) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "opt";
        b.textContent = o.text;
        b.onclick = () => pick(b, o.correct);
        body.append(b);
      });
    }
    $("#puzzleBox").hidden = false;
  }
  function closePuzzle() {
    stopPopupTimer();
    $("#puzzleBox").hidden = true;
    if (S) {
      S.paused = !!S.userPaused;
      S.activeGate = null;
    }
    clearKeys();
  }
  // ----- Timed questions (level 9 and up) -----
  function startPopupTimer() {
    stopPopupTimer();
    const timed = S.level >= PASS_LEVEL;
    ["#puzzleTimer", "#puzzleBarWrap", "#puzzleWarn"].forEach(
      (id) => ($(id).hidden = !timed),
    );
    if (!timed) return;
    S.popupMs = popupTime(S.level) * 1000;
    S.popupEnd = Date.now() + S.popupMs; // real clock: switching tabs cannot pause it
    S.popupTick = setInterval(tickPopup, 100);
    tickPopup();
  }
  function stopPopupTimer() {
    if (S) {
      clearInterval(S.popupTick);
      S.popupTick = null;
    }
  }
  function tickPopup() {
    if (!S || !S.activeGate) return stopPopupTimer();
    const left = Math.max(0, S.popupEnd - Date.now());
    $("#puzzleSecs").textContent = Math.ceil(left / 1000);
    $("#puzzleBar").style.width = (left / S.popupMs) * 100 + "%";
    const low = left <= 5000;
    $("#puzzleTimer").classList.toggle("low", low);
    $("#puzzleBar").classList.toggle("low", low);
    if (left <= 0) giveUp("Time's up!");
  }
  // Out of time (or the popup was closed) on a timed level:
  // the popup closes, -10 seconds, the gate gets a new question and is locked for a moment.
  function giveUp(reason) {
    const g = S.activeGate;
    if (!g) return;
    g.puzzle = pickOne(
      S.level,
      S.gates.map((x) => x.puzzle),
    );
    g.lock = POPUP_LOCK;
    closePuzzle();
    S.timeLeft = Math.max(0, S.timeLeft - WRONG_PENALTY);
    updateTimer();
    sfx("wrong");
    toast(
      `${reason} -${WRONG_PENALTY} seconds. The gate is locked for ${POPUP_LOCK}s and will ask a new question.`,
      4000,
    );
    if (S.timeLeft <= 0) lose("Time's up!");
  }
  // The X button and Esc: on timed levels closing counts as running out of time
  function dismissPuzzle() {
    if (S && S.activeGate && S.level >= PASS_LEVEL)
      giveUp("You closed the question.");
    else closePuzzle();
  }

  function confirmPuzzle() {
    if (!S || !S.choice || !S.activeGate) return;
    if (S.choice.correct) {
      const g = S.activeGate;
      g.open = true;
      S.closedEdges.delete(edgeKey(g.a.r, g.a.c, g.b.r, g.b.c));
      refreshDist(true);
      sfx("unlock");
      closePuzzle();
      toast(
        S.gates.every((x) => x.open)
          ? "Last gate unlocked! Grab the key."
          : "Gate unlocked!",
      );
    } else {
      S.timeLeft = Math.max(0, S.timeLeft - WRONG_PENALTY);
      updateTimer();
      S.choice.el.classList.add("wrong");
      sfx("wrong");
      S.choice = null;
      $("#puzzleConfirm").disabled = true;
      $("#puzzleFeedback").textContent =
        `Not quite! -${WRONG_PENALTY} seconds. Try again.`;
      if (S.level >= PASS_LEVEL && S.timeLeft > 0) {
        // timed levels: a wrong answer brings a new question (no trial and error)
        S.activeGate.puzzle = pickOne(
          S.level,
          S.gates.map((x) => x.puzzle),
        );
        renderPuzzle(S.activeGate);
        $("#puzzleFeedback").textContent =
          `Not quite! -${WRONG_PENALTY} seconds. Here is a new question.`;
        startPopupTimer();
      }
      if (S.timeLeft <= 0) {
        closePuzzle();
        lose("Time's up!");
      }
    }
  }
  $("#puzzleConfirm").onclick = confirmPuzzle;
  $("#puzzleClose").onclick = dismissPuzzle;

  // ---------- 6) Game loop ----------
  function formatTime(sec) {
    const s = Math.ceil(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  function updateTimer() {
    const text = formatTime(S.timeLeft);
    const el = $("#gameTimer");
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle("low", S.timeLeft <= 10);
  }
  function renderHearts() {
    const el = $("#hearts");
    el.textContent = "";
    for (let i = 0; i < MAX_HEARTS; i++) {
      const h = document.createElement("span");
      h.className = i < S.hearts ? "h" : "h off";
      h.textContent = "\u2665";
      el.append(h);
    }
    $("#keyIcon").classList.toggle("have", S.hasKey);
  }
  function toast(msg, ms = 2600) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(S.toastTimer);
    S.toastTimer = setTimeout(() => (el.hidden = true), ms);
  }

  function step(dt) {
    if (!S || S.won || S.over || S.paused) return;
    if (S.countdown > 0) {
      // race countdown 3-2-1: nobody can move yet
      S.countdown = Math.max(0, S.countdown - dt);
      if (S.countdown === 0) {
        S.started = true; // in a race the timer and monsters start together with "GO!"
        S.goFlash = 0.8;
      }
      return;
    }
    if (S.goFlash > 0) S.goFlash = Math.max(0, S.goFlash - dt);
    const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (ix || iy) {
      S.started = true; // the timer and the monsters wake up on the first move
      const len = Math.hypot(ix, iy);
      move((ix / len) * SPEED * dt, (iy / len) * SPEED * dt);
    }
    if (!S.started) return;
    S.time += dt;
    S.timeLeft = Math.max(0, S.timeLeft - dt);
    S.invuln = Math.max(0, S.invuln - dt);
    S.doorCool = Math.max(0, S.doorCool - dt);
    for (const gt of S.gates) gt.lock = Math.max(0, (gt.lock || 0) - dt);
    updateTimer();

    if (
      !S.hasKey &&
      Math.hypot(S.p.x - S.keyPos.x, S.p.y - S.keyPos.y) < CELL * 0.4
    ) {
      S.hasKey = true;
      renderHearts();
      toast("You got the key! Head to the exit door.");
      sfx("key");
    }
    if (Math.hypot(S.p.x - S.exitPos.x, S.p.y - S.exitPos.y) < CELL * 0.35) {
      if (S.hasKey) return win();
      if (S.doorCool <= 0) {
        S.doorCool = 3;
        toast("The door is locked. Find the key first!");
      }
    }

    refreshDist(false);
    stepMonsters(dt);
    if (S.invuln <= 0) {
      for (const m of S.monsters) {
        if (Math.hypot(m.x - S.p.x, m.y - S.p.y) < PLAYER_R + MON_R * 0.8) {
          hit();
          break;
        }
      }
    }
    if (!S.over && S.timeLeft <= 0) lose("Time's up!");
  }

  function hit() {
    sfx("hit");
    S.hearts--;
    S.invuln = INVULN;
    renderHearts();
    const board = $("#board");
    board.classList.remove("hit");
    void board.offsetWidth;
    board.classList.add("hit");
    if (S.hearts <= 0) lose("A monster got you!");
  }
  function win() {
    sfx("win");
    S.won = true;
    clearKeys();
    S.stars = Math.max(1, S.hearts);
    if (S.multi) {
      $("#winText").textContent =
        "You reached the exit! Waiting for the other players...";
      $("#winStars").textContent = "";
      $("#winBox").hidden = false;
      if (S.opts.onFinish) S.opts.onFinish(Math.round(S.time * 10) / 10);
      return;
    }
    $("#winText").textContent = `Level ${S.level} complete!`;
    $("#winStars").textContent =
      "\u2605".repeat(S.stars) + "\u2606".repeat(3 - S.stars);
    $("#winBox").hidden = false;
    $("#winContinue").focus();
  }
  function lose(reason) {
    sfx("lose");
    S.over = true;
    clearKeys();
    $("#loseText").textContent = S.multi
      ? `${reason} You are out of the race. Waiting for the others...`
      : reason;
    $("#loseBox").hidden = false;
    if (S.multi) {
      if (S.opts.onFail) S.opts.onFail(reason);
      $("#loseLevels").focus();
    } else $("#loseRetry").focus();
  }

  function frame(t) {
    if (!S || !S.running) return;
    const dt = Math.min((t - S.last) / 1000 || 0, 0.05);
    S.last = t;
    step(dt);
    for (const r of S.remotes.values()) {
      // slide the other players smoothly towards their latest position
      const k = Math.min(1, dt * 12);
      r.x += (r.tx - r.x) * k;
      r.y += (r.ty - r.y) * k;
    }
    if (S.multi && S.opts.onTick) {
      S.sendAcc += dt;
      if (S.sendAcc >= 0.1) {
        S.sendAcc = 0;
        S.opts.onTick({
          x: Math.round(S.p.x * 10) / 10,
          y: Math.round(S.p.y * 10) / 10,
        });
      }
    }
    draw();
    S.raf = requestAnimationFrame(frame);
  }

  // ---------- 7) Drawing ----------
  function fit() {
    const board = $("#board");
    const availW = board.clientWidth || 900;
    const availH = board.clientHeight || 520;
    const totalW = S.W + FRAME * 2;
    const totalH = S.H + FRAME * 2;
    S.scale = Math.min(availW / totalW, availH / totalH);
    S.dpr = window.devicePixelRatio || 1;
    const cssW = Math.floor(totalW * S.scale);
    const cssH = Math.floor(totalH * S.scale);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * S.dpr);
    canvas.height = Math.floor(cssH * S.dpr);
  }

  // ---------- Ground and wall textures ----------
  // Drawn once per level (and again if the window is resized), then reused every frame.
  const WALL_STYLES = {
    cobble: {
      mortar: "#3b3e43",
      shades: ["#8b8f95", "#7f838a", "#979ba1", "#868a90"],
      minW: 11,
      maxW: 17,
    },
    brick: {
      mortar: "#d7c8aa",
      shades: ["#9b4a37", "#a85640", "#8c3f2e", "#b0614a"],
      minW: 18,
      maxW: 24,
    },
  };

  function paintGrass(g, W, H, rand) {
    g.fillStyle = "#6fae3b";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < (W * H) / 2200; i++) {
      // soft light and dark patches
      g.fillStyle =
        rand() < 0.5 ? "rgba(35,95,20,.15)" : "rgba(170,220,95,.16)";
      g.beginPath();
      g.ellipse(
        rand() * W,
        rand() * H,
        10 + rand() * 24,
        8 + rand() * 18,
        0,
        0,
        TAU,
      );
      g.fill();
    }
    g.lineCap = "round";
    g.lineWidth = 1.6;
    for (let i = 0; i < (W * H) / 480; i++) {
      // grass tufts
      const x = rand() * W;
      const y = rand() * H;
      g.strokeStyle = rand() < 0.5 ? "#4d9025" : "#93cc58";
      g.beginPath();
      g.moveTo(x - 2.5, y);
      g.lineTo(x - 3.5, y - 4.5);
      g.moveTo(x, y);
      g.lineTo(x, y - 5.5);
      g.moveTo(x + 2.5, y);
      g.lineTo(x + 3.5, y - 4.5);
      g.stroke();
    }
    for (let i = 0; i < (W * H) / 11000; i++) {
      // a few small flowers
      const x = rand() * W;
      const y = rand() * H;
      g.fillStyle = "#fff";
      for (const [dx, dy] of [
        [-2.4, 0],
        [2.4, 0],
        [0, -2.4],
        [0, 2.4],
      ]) {
        g.beginPath();
        g.arc(x + dx, y + dy, 1.8, 0, TAU);
        g.fill();
      }
      g.fillStyle = "#f2c230";
      g.beginPath();
      g.arc(x, y, 1.5, 0, TAU);
      g.fill();
    }
    g.fillStyle = "rgba(255,255,230,.8)"; // sparkles
    for (let i = 0; i < (W * H) / 9000; i++)
      g.fillRect(rand() * W, rand() * H, 1.6, 1.6);
  }

  function paintWalls(g, walls, W, H, rand) {
    const st = WALL_STYLES[WALL_STYLE] || WALL_STYLES.cobble;
    g.save();
    g.beginPath();
    g.rect(0, 0, W, H);
    g.clip();
    g.fillStyle = "rgba(0,0,0,.25)"; // soft shadow on the grass
    for (const w of walls) g.fillRect(w.x + 2, w.y + 5, w.w, w.h);
    g.fillStyle = "#000"; // outline (drawn first so joints have no inner lines)
    for (const w of walls) g.fillRect(w.x - 2, w.y - 2, w.w + 4, w.h + 4);
    g.beginPath();
    for (const w of walls) g.rect(w.x, w.y, w.w, w.h);
    g.clip(); // from here on, only the walls get painted
    g.fillStyle = st.mortar;
    g.fillRect(0, 0, W, H);
    for (let row = 0, y = -3; y < H + 9; y += 9, row++) {
      let x = -(row % 2) * 7;
      while (x < W) {
        const w = st.minW + rand() * (st.maxW - st.minW);
        g.fillStyle = st.shades[Math.floor(rand() * st.shades.length)];
        g.fillRect(x + 0.7, y + 0.7, w - 1.4, 7.6);
        g.fillStyle = "rgba(255,255,255,.2)"; // light top edge
        g.fillRect(x + 0.7, y + 0.7, w - 1.4, 1.3);
        g.fillStyle = "rgba(0,0,0,.2)"; // dark bottom edge
        g.fillRect(x + 0.7, y + 7, w - 1.4, 1.3);
        x += w;
      }
    }
    g.restore();
  }

  function buildBackdrop() {
    const k = Math.min(S.dpr * S.scale, 3);
    const el = document.createElement("canvas");
    el.width = Math.max(1, Math.ceil(S.W * k));
    el.height = Math.max(1, Math.ceil(S.H * k));
    const g = el.getContext ? el.getContext("2d") : null;
    if (!g) {
      S.backdrop = null;
      return;
    }
    g.scale(k, k);
    const rand = mulberry32(S.level * 131 + 17);
    paintGrass(g, S.W, S.H, rand);
    paintWalls(g, S.walls, S.W, S.H, rand);
    S.backdrop = el;
  }

  function drawDoor() {
    const { x, y } = S.exitPos;
    const w = CELL * 0.55;
    const h = CELL * 0.72;
    const locked = !S.hasKey;
    const arch = (ww, hh, fill, line) => {
      ctx.beginPath();
      ctx.moveTo(x - ww / 2, y + hh / 2);
      ctx.lineTo(x - ww / 2, y - hh / 2 + ww / 2);
      ctx.arc(x, y - hh / 2 + ww / 2, ww / 2, Math.PI, 0);
      ctx.lineTo(x + ww / 2, y + hh / 2);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = line;
      ctx.stroke();
    };
    arch(w, h, locked ? "#5f5f5f" : "#7b5a96", locked ? "#1e1e1e" : "#2b1a3a");
    arch(
      w - 8,
      h - 5,
      locked ? "#8a8a8a" : "#8a4b2a",
      locked ? "#2a2a2a" : "#3a1a0a",
    );
    ctx.fillStyle = locked ? "#cfcfcf" : "#e6b422";
    ctx.beginPath();
    ctx.arc(x + w * 0.2, y + h * 0.1, 2.5, 0, TAU);
    ctx.fill();
  }

  function drawGate(g, near) {
    const { x, y, w, h } = g.rect;
    ctx.fillStyle = "#a9794f";
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = near ? "#fff" : "#000";
    ctx.strokeRect(x, y, w, h);
    const s = 15 * (1 + 0.07 * Math.sin(S.time * 6));
    ctx.save();
    ctx.lineJoin = "round";
    ctx.fillStyle = "#e53935";
    ctx.strokeStyle = "#7a0f0f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.cx, g.cy - s);
    ctx.lineTo(g.cx + s, g.cy + s * 0.8);
    ctx.lineTo(g.cx - s, g.cy + s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillRect(g.cx - 1.6, g.cy - s * 0.45, 3.2, s * 0.7);
    ctx.fillRect(g.cx - 1.6, g.cy + s * 0.38, 3.2, 3.2);
    ctx.restore();
  }

  function drawKey() {
    if (S.hasKey) return;
    const bob = Math.sin(S.time * 3 + 1) * 1.5;
    ctx.save();
    ctx.translate(S.keyPos.x, S.keyPos.y + bob);
    ctx.rotate(-0.6);
    ctx.fillStyle = "#f2b705";
    ctx.strokeStyle = "#7a5a00";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-8, 0, 6.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-2, -1.8, 20, 3.6);
    ctx.fillRect(10, 1.8, 3, 5);
    ctx.fillRect(15, 1.8, 3, 4);
    ctx.fillStyle = "#bde03a";
    ctx.beginPath();
    ctx.arc(-8, 0, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawMonster(m) {
    const R = MON_R * 1.3;
    const wob = Math.sin(S.time * 9 + m.phase);
    ctx.save();
    ctx.translate(m.x, m.y + wob * 1.2);
    ctx.lineCap = "round";
    if (m.type === "crab") {
      ctx.strokeStyle = "#7a3a0a";
      ctx.lineWidth = 2;
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(sx * R * 0.5, R * (0.1 + i * 0.25));
          ctx.lineTo(sx * R * (1 + wob * 0.12), R * (0.35 + i * 0.28));
          ctx.stroke();
        }
      }
      ctx.fillStyle = "#e8832a";
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.95, R * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-R * 1.0, -R * 0.55 - wob, R * 0.34, 0, TAU);
      ctx.arc(R * 1.0, -R * 0.55 + wob, R * 0.34, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-R * 0.3, -R * 0.3, R * 0.2, 0, TAU);
      ctx.arc(R * 0.3, -R * 0.3, R * 0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillRect(-R * 0.34, -R * 0.32, R * 0.1, R * 0.16);
      ctx.fillRect(R * 0.26, -R * 0.32, R * 0.1, R * 0.16);
    } else {
      ctx.strokeStyle = "#173f44";
      ctx.lineWidth = 2.4;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * R * 0.25, R * 0.3);
        ctx.quadraticCurveTo(
          i * R * 0.4 + wob * 3,
          R * 0.9,
          i * R * 0.34 - wob * 2,
          R * 1.2,
        );
        ctx.stroke();
      }
      ctx.fillStyle = "#1f5f66";
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.85, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, -R * 0.1, R * 0.45, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(0, -R * 0.1, R * 0.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, shirt) {
    const R = PLAYER_R;
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.ellipse(x, y + R * 0.95, R * 0.8, R * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#5a3a1e";
    ctx.fillRect(x - R * 0.55, y + R * 0.2, R * 1.1, R * 0.8);
    ctx.fillStyle = shirt;
    ctx.fillRect(x - R * 0.7, y - R * 0.55, R * 1.4, R * 0.85);
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(x, y - R * 0.95, R * 0.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#6b3b1b";
    ctx.beginPath();
    ctx.arc(x, y - R * 1.05, R * 0.62, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillRect(x - R * 0.28, y - R * 0.95, R * 0.14, R * 0.2);
    ctx.fillRect(x + R * 0.14, y - R * 0.95, R * 0.14, R * 0.2);
  }

  function drawPlayer() {
    if (S.invuln > 0 && Math.floor(S.time * 10) % 2 === 0) return; // blink while safe
    drawPerson(S.p.x, S.p.y, "#3d8fd6");
  }

  function drawLabel(text, x0, y0, fill, size) {
    ctx.font = `bold ${size}px 'Pixelify Sans', monospace`;
    ctx.textAlign = "center";
    const half = ctx.measureText(text).width / 2 + 3;
    const x = clamp(x0, half, S.W - half);
    const y = Math.max(y0 - PLAYER_R * 2.0, 14);
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }
  const drawName = () => drawLabel(S.name, S.p.x, S.p.y, "#ffe14a", 13);
  const drawRemotes = () =>
    S.remotes.forEach((r) => drawPerson(r.x, r.y, r.color));
  const drawRemoteNames = () =>
    S.remotes.forEach((r) => drawLabel(r.name, r.x, r.y, "#ffffff", 12));

  function drawCountdown() {
    if (S.countdown <= 0 && S.goFlash <= 0) return;
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.fillRect(0, 0, S.W, S.H);
    ctx.textAlign = "center";
    ctx.font = "bold 110px 'Pixelify Sans', monospace";
    ctx.lineJoin = "round";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#000";
    const text = S.countdown > 0 ? String(Math.ceil(S.countdown)) : "GO!";
    ctx.strokeText(text, S.W / 2, S.H / 2 + 36);
    ctx.fillStyle = S.countdown > 0 ? "#ffe14a" : "#5be37d";
    ctx.fillText(text, S.W / 2, S.H / 2 + 36);
  }

  function drawPrompt(text) {
    ctx.font = "bold 11px 'Pixelify Sans', monospace";
    ctx.textAlign = "center";
    const w = ctx.measureText(text).width + 10;
    const x = clamp(S.p.x, w / 2 + 2, S.W - w / 2 - 2);
    const y = Math.max(S.p.y - PLAYER_R * 4.1, 14);
    ctx.fillStyle = "rgba(255,255,255,.88)";
    ctx.fillRect(x - w / 2, y - 11, w, 16);
    ctx.fillStyle = "#000";
    ctx.fillText(text, x, y);
  }

  function draw() {
    if (!ctx || !S) return;
    const k = S.dpr * S.scale;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = "#ab7d5a";
    ctx.fillRect(0, 0, S.W + FRAME * 2, S.H + FRAME * 2);
    ctx.translate(FRAME, FRAME);
    if (S.backdrop) ctx.drawImage(S.backdrop, 0, 0, S.W, S.H);
    else {
      ctx.fillStyle = "#6fae3b";
      ctx.fillRect(0, 0, S.W, S.H);
    }
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, S.W, S.H);
    const near = S.paused || S.won || S.over ? null : nearestGate();
    S.gates.forEach((g) => !g.open && drawGate(g, g === near));
    drawKey();
    drawDoor();
    S.monsters.forEach(drawMonster);
    drawRemotes();
    drawPlayer();
    drawRemoteNames();
    drawName();
    if (near)
      drawPrompt(
        near.lock > 0
          ? `Locked: ${Math.ceil(near.lock)}s`
          : "Press [E] to troubleshoot",
      );
    drawCountdown();
  }

  // ---------- Other players (multiplayer) ----------
  const REMOTE_COLORS = ["#e0524d", "#e8a33d", "#7a54c9", "#2fa37a"];
  function setRemote(id, name, x, y) {
    if (!S) return;
    let r = S.remotes.get(id);
    if (!r) {
      const px = x ?? S.startPos.x;
      const py = y ?? S.startPos.y;
      r = {
        name: name || "Player",
        x: px,
        y: py,
        tx: px,
        ty: py,
        color: REMOTE_COLORS[S.remotes.size % REMOTE_COLORS.length],
      };
      S.remotes.set(id, r);
    }
    if (name) r.name = name;
    if (x !== undefined && y !== undefined) {
      r.tx = x;
      r.ty = y;
    }
  }
  const removeRemote = (id) => S && S.remotes.delete(id);
  const say = (msg) => S && toast(msg);

  // ---------- 8) Public API ----------
  function start(level, opts = {}) {
    stop();
    const L = buildLevel(level, opts.seed);
    const { cols, rows } = L;
    const puzzles = pickPuzzles(level, L.gates.length);
    const mid = (cell) => ({
      x: (cell.c + 0.5) * CELL,
      y: (cell.r + 0.5) * CELL,
    });
    S = {
      level,
      opts,
      cols,
      rows,
      grid: L.grid,
      zone: L.zone,
      W: cols * CELL,
      H: rows * CELL,
      walls: buildWalls(L.grid, cols, rows),
      gates: L.gates.map((g, i) => ({ ...g, puzzle: puzzles[i] })),
      closedEdges: new Set(
        L.gates.map((g) => edgeKey(g.a.r, g.a.c, g.b.r, g.b.c)),
      ),
      p: mid(L.start),
      exitPos: mid(L.exit),
      keyPos: mid(L.key),
      keyCell: L.key,
      hasKey: false,
      hearts: MAX_HEARTS,
      invuln: 0,
      doorCool: 0,
      timeLeft: L.time,
      totalTime: L.time,
      time: 0,
      started: false,
      paused: false,
      won: false,
      over: false,
      running: true,
      last: 0,
      raf: 0,
      activeGate: null,
      choice: null,
      stars: 0,
      dist: null,
      distCell: "",
      rand: mulberry32(L.seed ^ 0xabcdef),
      onComplete: opts.onComplete,
      onQuit: opts.onQuit,
      name: opts.name || "Player",
      multi: !!opts.multi,
      countdown: opts.countdown || 0,
      goFlash: 0,
      sendAcc: 0,
      remotes: new Map(),
      startPos: { x: mid(L.start).x, y: mid(L.start).y },
      userPaused: false,
      backdrop: null,
    };
    S.monsters = L.spawns.map((s, i) => ({
      ...mid(s),
      r: s.r,
      c: s.c,
      tr: s.r,
      tc: s.c,
      pr: -1,
      pc: -1,
      t: 0,
      type: s.type,
      phase: i * 1.7,
    }));
    refreshDist(true);
    S.monsters.forEach((m) => chooseTarget(m, aiFor(level)));
    clearKeys();
    ["#winBox", "#loseBox", "#puzzleBox", "#toast"].forEach(
      (id) => ($(id).hidden = true),
    );
    $("#winContinue").hidden = !!opts.multi; // in a race nobody continues on their own
    $("#loseRetry").hidden = !!opts.multi;
    $("#loseLevels").textContent = opts.multi ? "Leave race" : "Levels";
    $("#gameLevel").textContent = `Level ${level}`;
    renderHearts();
    fit();
    buildBackdrop();
    updateTimer();
    draw();
    S.raf = requestAnimationFrame(frame);
    if (level === PASS_LEVEL)
      toast(
        "Level 9: monsters can now pass through gates, and troubleshooting is timed!",
        5000,
      );
  }

  function stop() {
    if (S) {
      S.running = false;
      cancelAnimationFrame(S.raf);
      clearTimeout(S.toastTimer);
      clearInterval(S.popupTick);
    }
    clearKeys();
    S = null;
  }

  window.addEventListener("resize", () => {
    if (S) {
      fit();
      buildBackdrop();
      draw();
    }
  });
  $("#winContinue").onclick = () => {
    if (!S) return;
    const { level, stars, onComplete } = S;
    stop();
    if (onComplete) onComplete(level, stars);
  };
  $("#loseRetry").onclick = () => {
    if (!S) return;
    const { level, opts } = S;
    start(level, opts);
  };
  // Used by the settings window while a level is open
  function setPaused(v) {
    if (!S || S.won || S.over || S.multi) return; // a race cannot be paused
    S.userPaused = v;
    if (v) {
      S.paused = true;
      clearKeys();
    } else if (!S.activeGate) S.paused = false;
  }
  const quit = () => {
    if (!S) return;
    if (S.opts && S.opts.confirmQuit) return S.opts.confirmQuit(); // in a race: ask first
    const { onQuit } = S;
    stop();
    if (onQuit) onQuit();
  };
  $("#gameQuit").onclick = quit;
  $("#loseLevels").onclick = quit;

  return {
    start,
    stop,
    setPaused,
    setRemote,
    removeRemote,
    say,
    levelConfig,
    buildLevel,
    buildWalls,
    bfs,
    PUZZLES,
    // used by tests
    _state: () => S,
    _step: step,
    _draw: draw,
    _collides: collides,
    _interact: interact,
    _tickPopup: tickPopup,
    _openNeighbors: openNeighbors,
    popupTime,
    PASS_LEVEL,
  };
})();
