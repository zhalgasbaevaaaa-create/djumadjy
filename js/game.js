/* ============================================================
   «ТҮРКІ ДӘУІРІ — JUMANJI» — Ойын логикасы (game.js)
   6 команда · 5 өмір · 37 нүктеден тұратын жол · 60 тапсырма
   ============================================================ */
"use strict";

/* ---------------- STATE ---------------- */
const gameState = {
  currentTeam: 0,
  gameStarted: false,
  gameOver: false,
  usedQuestions: [],
  questionPool: [],     // араластырылған, қолданылмаған сұрақтар кезегі
  teams: PLAYERS.map(p => ({
    id: p.id,
    name: p.name,
    position: 0,
    lives: 5,
    active: true,
    figure: p.figure,
    figName: p.figName,
    color: p.color
  })),
  busy: false,          // анимация/сұрақ ашық кезде құлып
  currentCell: -1,      // сұрақ көрсетіліп жатқан клетка индексі
  currentCellType: "normal",
  answered: false       // қазіргі сұраққа жауап берілді ме
};

/* ---------------- DOM көмекшілері ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pathPx = [];        // әр нүктенің px координаты
let figures = {};       // teamId -> .fig элементі
let cellEls = [];       // idx -> cell элементі
let boardEl = null;
let segLayer = null;

/* ---------------- LAYOUT ---------------- */
function computeLayout(){
  const vw = window.innerWidth, vh = window.innerHeight;
  // frame 1.14s × 0.885s, padding 0.014s; жоғары/төмен жолақтар үшін қосымша орын.
  let s = Math.min(vw / 1.18, vh / 1.165);
  document.documentElement.style.setProperty("--s", s.toFixed(1) + "px");
  const boardW = 1.14 * s - 2 * 0.014 * s;
  const boardH = 0.885 * s - 2 * 0.014 * s;
  const centerX = boardW / 2;
  const centerY = boardH / 2;
  pathPx = BOARD_PATH_UNITS.map(([ux, uy]) => ({
    x: centerX + ux * s,
    y: centerY + uy * s
  }));
  window.__step = { s, boardW, boardH };
}

/* ---------------- ТАҚТАНЫ САЛУ ---------------- */
function buildBoard(){
  boardEl = $("#board");
  segLayer = $("#segLayer");
  computeLayout();

  // алдыңғы ойынның динамикалық элементтерін тазалау
  boardEl.querySelectorAll(".cell, .fig").forEach(n => n.remove());
  if (segLayer) segLayer.innerHTML = "";
  for (let i = 0; i <= 36; i++){
    const a = pathPx[i], b = pathPx[i+1];
    const seg = document.createElement("div");
    seg.className = "seg";
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) * 0.94;
    const ang = Math.atan2(dy, dx);
    seg.style.left = ((a.x + b.x) / 2) + "px";
    seg.style.top  = ((a.y + b.y) / 2) + "px";
    seg.style.width = len + "px";
    seg.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
    segLayer.appendChild(seg);

    // көрсеткі
    const ch = document.createElement("div");
    ch.className = "chev";
    ch.style.left = ((a.x*0.45) + (b.x*0.55)) + "px";
    ch.style.top  = ((a.y*0.45) + (b.y*0.55)) + "px";
    ch.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
    segLayer.appendChild(ch);
  }

  /* ---- клеткалар ---- */
  cellEls = [];
  for (let idx = 0; idx <= 37; idx++){
    const p = pathPx[idx];
    const type = CELL_TYPE_BY_INDEX[idx] || "normal";
    const el = document.createElement("div");
    el.className = "cell cell--" + type;
    el.dataset.idx = idx;
    el.style.left = p.x + "px";
    el.style.top  = p.y + "px";

    if (type === "start"){
      el.innerHTML = `<span class="ico">\uD83D\uDEA9</span><span class="n">START</span>`;
    } else if (type === "final"){
      el.innerHTML = `<span class="ico">\uD83C\uDFC6</span><span class="n">ФИНАЛ</span>`;
    } else {
      const t = CELL_TYPES[type] || CELL_TYPES.normal;
      el.innerHTML = `<span class="n">${idx}</span><span class="ico">${t.ico}</span>`;
    }
    boardEl.appendChild(el);
    cellEls[idx] = el;
  }

  /* ---- фигуралар ---- */
  figures = {};
  gameState.teams.forEach(team => {
    const f = document.createElement("div");
    f.className = "fig";
    f.id = "fig-" + team.id;
    f.innerHTML = `<span class="plate" style="background:${team.color}"></span><span class="gl">${team.figure}</span>`;
    boardEl.appendChild(f);
    figures[team.id] = f;
    placeFigure(team, true);
  });
}

function cellCenter(idx){
  return pathPx[idx];
}

/* ---------------- ФИГУРАНЫ КОЮ ---------------- */
function placeFigure(team, instant){
  const p = cellCenter(team.position);
  const f = figures[team.id];
  if (!f) return;
  f.style.left = p.x + "px";
  f.style.top  = p.y + "px";
  if (instant){
    f.style.transition = "none";
    requestAnimationFrame(()=>{ f.style.transition = ""; });
  }
  f.classList.toggle("dead", team.lives <= 0);
  f.style.zIndex = 20 + team.id;
}

function stackFigures(){
  // бір клеткадағы фигураларды итеру (бірін-бірі жасырмауы үшін)
  const groups = {};
  gameState.teams.forEach(t => {
    (groups[t.position] = groups[t.position] || []).push(t);
  });
  Object.values(groups).forEach(list => {
    if (list.length < 2) return;
    const p = cellCenter(list[0].position);
    const r = Math.max(16, Math.min(30, pathPx.length > 0 ? (pathPx[1].x - pathPx[0].x) * 0.5 : 24));
    list.forEach((t, i) => {
      const ang = (i / list.length) * Math.PI * 2 - Math.PI / 2;
      figures[t.id].style.left = (p.x + Math.cos(ang) * r) + "px";
      figures[t.id].style.top  = (p.y + Math.sin(ang) * r * 0.85) + "px";
      figures[t.id].style.zIndex = 30 + i;
    });
  });
}

/* ---------------- КОМАНДАЛАР ТАҚТАСЫ (төмен) ---------------- */
function renderTeams(){
  const bar = $("#teamsBar");
  bar.innerHTML = "";
  gameState.teams.forEach(team => {
    const strip = document.createElement("div");
    strip.className = "teamstrip" + (team.lives <= 0 ? " dead" : "") + (team === gameState.teams[gameState.currentTeam] ? " turn" : "");
    strip.id = "strip-" + team.id;

    const hearts = [];
    for (let i=0;i<5;i++){
      hearts.push(`<span class="heart ${i < team.lives ? "" : "lost"}" data-i="${i}">${i < team.lives ? "\u2764\uFE0F" : "\uD83E\uDD0D"}</span>`);
    }
    const posLabel = team.position === 0 ? "START" : (team.position === 37 ? "ФИНАЛ" : team.position + "-клетка");

    strip.innerHTML = `
      <div class="tfig">${team.figure}</div>
      <div class="nameblock">
        <div class="tname" contenteditable="false" title="Атауын өзгерту үшін басыңыз">${escapeHtml(team.name)}</div>
        <div class="tpos">${posLabel} · ${team.lives <= 0 ? "ойыннан шықты" : (team.figName)}</div>
      </div>
      <div class="hearts">${hearts.join("")}</div>
      <button class="tedit" data-team="${team.id}" title="Команда атауын өзгерту">\u270E</button>
    `;
    bar.appendChild(strip);
  });

  $$(".tedit").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      editName(parseInt(btn.dataset.team));
    });
  });
  $$(".tname").forEach(nm => {
    nm.addEventListener("click", () => {
      if (nm.contentEditable !== "true") nm.setAttribute("contenteditable", "true"), nm.focus();
    });
  });
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function editName(teamId){
  const team = gameState.teams.find(t => t.id === teamId);
  const el = $(`#strip-${teamId} .tname`);
  el.setAttribute("contenteditable", "true");
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);
  const finish = () => {
    el.removeEventListener("blur", finish);
    el.removeEventListener("keydown", onKey);
    const v = el.textContent.trim();
    if (v) team.name = v;
    el.setAttribute("contenteditable", "false");
    renderTeams();
  };
  const onKey = ev => { if (ev.key === "Enter"){ ev.preventDefault(); el.blur(); } };
  el.addEventListener("blur", finish);
  el.addEventListener("keydown", onKey);
}

function updateStrip(team){
  const strip = $("#strip-" + team.id);
  if (!strip) return renderTeams();
  const hearts = strip.querySelectorAll(".heart");
  hearts.forEach((h, i) => {
    if (i < team.lives) h.textContent = "\u2764\uFE0F";
    else h.textContent = "\uD83E\uDD0D";
    h.classList.toggle("lost", i >= team.lives);
  });
  const posLabel = team.position === 0 ? "START" : (team.position === 37 ? "ФИНАЛ" : team.position + "-клетка");
  const tpos = strip.querySelector(".tpos");
  tpos.textContent = posLabel + " · " + (team.lives <= 0 ? "ойыннан шықты" : team.figName);
  strip.classList.toggle("dead", team.lives <= 0);
  const isTurn = gameState.teams[gameState.currentTeam] === team && !gameState.gameOver && gameState.gameStarted;
  strip.classList.toggle("turn", isTurn);
}
function renderAllStrips(){
  gameState.teams.forEach(updateStrip);
}

/* ---------------- БАТЫРМАЛАР / КУБИК / boost ---------------- */
function setDiceDisabled(on){
  const b = $("#rollBtn");
  if (b) b.disabled = on;
}

function setDiceShown(label){
  $("#diceResult").innerHTML = label;
}

/* кубик: n санын алдыңғы бетке келтіру */
function setCube(n){
  const inner = $(".die-inner");
  if (!inner) return;
  const faces = {
    1: "rotateX(-14deg) rotateZ(4deg) rotateY(0deg)",
    2: "rotateX(-14deg) rotateZ(4deg) rotateY(180deg)",
    3: "rotateX(-104deg) rotateZ(4deg) rotateY(0deg)",
    4: "rotateX(76deg) rotateZ(4deg) rotateY(0deg)",
    5: "rotateX(-14deg) rotateZ(4deg) rotateY(-90deg)",
    6: "rotateX(-14deg) rotateZ(4deg) rotateY(90deg)"
  };
  inner.style.transform = faces[n] || faces[1];
}

/* ---------------- КЕЗЕКТІ КӨРСЕТУ (banner) ---------------- */
function showBanner(html, isGood){
  const b = $("#banner");
  b.innerHTML = html;
  b.classList.remove("show");
  void b.offsetWidth;
  b.classList.add("show");
}
function showLifeToast(html, bad){
  const t = $("#lifeToast");
  t.innerHTML = html;
  t.classList.toggle("bad", !!bad);
  t.classList.remove("show");
  void t.offsetWidth;
  t.classList.add("show");
}

/* ---------------- ДЫБЫС ---------------- */
function snd(name){ try { SOUND[name] && SOUND[name](); } catch(e){} }
function syncSoundToggle(){
  const btn = $("#soundBtn");
  if (btn) btn.textContent = SOUND.isEnabled() ? "\uD83D\uDD0A" : "\uD83D\uDD07";
}

/* ---------------- СҰРАҚ ТАҢДАУ ---------------- */
function refillPool(){
  // барлық қолданылмаған сұрақтарды араластыр
  const all = QUESTIONS.filter(q => !gameState.usedQuestions.includes(q.id));
  gameState.questionPool = shuffle(all);
}
function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Өміршең күрделілік: неғұрлым алға жылжыса, соғұрлым күрделі (diff >= 2) сұрақтар басым */
function pickByDiff(pool, position){
  if (!pool.length) return null;
  const progress = Math.min(position / 33, 1);
  const hard = pool.filter(q => q.diff >= 2);
  const soft = pool.filter(q => q.diff < 2);
  const useHard = hard.length && Math.random() < (0.35 + progress * 0.6);
  const source = useHard ? hard : (soft.length ? soft : pool);
  return source[Math.floor(Math.random() * source.length)];
}

function pickQuestion(type){
  // type: 'normal'|'special'|'danger'|'culture'|'history'
  if (!gameState.questionPool.length){
    refillPool();
    // Барлық сұрақ қолданылып болса — база қайта араластырылады (spec #25)
    if (!gameState.questionPool.length){
      gameState.usedQuestions = [];
      refillPool();
    }
  }

  let allowed;
  if (type === "danger"){
    allowed = gameState.questionPool.filter(q => q.type === "danger");
    if (!allowed.length){
      // барлық қауіпті тапсырма қолданылды → қайта араластырып рұқсат ету
      allowed = shuffle(QUESTIONS.filter(q => q.type === "danger"));
    }
  } else if (type === "special"){
    allowed = gameState.questionPool.filter(q => q.type === "special");
    // ерекше сұрақтар таусылса — қайта араластыр
    if (!allowed.length){
      allowed = shuffle(QUESTIONS.filter(q => q.type === "special"));
    }
  } else {
    allowed = gameState.questionPool.filter(q => q.type === "normal" || q.type === type);
  }

  if (!allowed.length){
    // бұл типтен таусылды → жалпы қалған қордан
    allowed = gameState.questionPool.slice();
    if (!allowed.length) return null;
  }
  const chosen = pickByDiff(allowed, gameState.teams[gameState.currentTeam].position);
  // пулдан шығарып, usedQuestions-қа қос
  const idx = gameState.questionPool.findIndex(q => q.id === chosen.id);
  if (idx >= 0) gameState.questionPool.splice(idx, 1);
  gameState.usedQuestions.push(chosen.id);
  return chosen;
}

/* ============================================================
   ОЙЫН АҒЫМЫ
   ============================================================ */

function startGame(){
  SOUND.resume();
  gameState.gameStarted = true;
  gameState.gameOver = false;
  gameState.currentTeam = 0;
  gameState.usedQuestions = [];
  gameState.questionPool = shuffle(QUESTIONS.slice());
  gameState.busy = false;
  gameState.currentCell = -1;
  gameState.currentCellType = "normal";
  gameState.answered = false;
  clearDangerTimer();

  gameState.teams.forEach(t => { t.position = 0; t.lives = 5; t.active = true; });
  buildBoard();
  renderTeams();
  hideQPanel();
  setOrbHome();
  setDiceShown("");
  setDiceDisabled(false);
  clearBigMessages();
  boardEl.style.filter = "";

  $("#splash").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#winScreen").classList.add("hidden");
  $("#confirmModal").classList.add("hidden");

  setTimeout(() => {
    showBanner(`\uD83D\uDC3A \uD83E\uDD85 \uD83D\uDC0E \uD83D\uDC06 \uD83E\uDD8C \uD83C\uDFF9<br><span style="font-size:.5em">ОЙЫН БАСТАЛДЫ!</span>`);
    snd("turn");
    setTimeout(() => announceTurn(), 1500);
  }, 350);
}

function clearBigMessages(){
  const b = $("#banner"), t = $("#lifeToast");
  if (b){ b.classList.remove("show"); }
  if (t){ t.classList.remove("show"); }
}

function restartGame(){
  $("#winScreen").classList.add("hidden");
  $("#confirmModal").classList.add("hidden");
  startGame();
}

function nextTeam(){
  if (gameState.gameOver) return;
  const aliveCount = gameState.teams.filter(t => t.active).length;
  if (!aliveCount){ gameState.gameOver = true; return; }
  let next = (gameState.currentTeam + 1) % gameState.teams.length;
  let guard = 0;
  while (!gameState.teams[next].active && guard < gameState.teams.length){
    next = (next + 1) % gameState.teams.length;
    guard++;
  }
  gameState.currentTeam = next;
  renderAllStrips();
}

function announceTurn(){
  if (gameState.gameOver) return;
  const alive = gameState.teams.filter(t => t.active);
  if (!alive.length){ gameState.gameOver = true; return; }
  let team = gameState.teams[gameState.currentTeam];
  if (!team.active){ nextTeam(); team = gameState.teams[gameState.currentTeam]; }
  snd("turn");
  showBanner(`<span style="font-size:.8em">${team.figure}</span> ${escapeHtml(team.name)}<br><span style="font-size:.5em">КЕЗЕГІ · \uD83C\uDFB2 КУБИКТІ ЛАҚТЫР</span>`);
  highlightTeam(team);
  setDiceDisabled(false);
}

function highlightTeam(team){
  $$(".teamstrip").forEach(s => s.classList.remove("turn"));
  const strip = $("#strip-" + team.id);
  if (strip) strip.classList.add("turn");
}

/* ---------------- КУБИКТІ ЛАҚТЫРУ ---------------- */
async function rollDice(){
  if (gameState.busy || gameState.gameOver) return;
  if (!gameState.gameStarted) return;
  const team = gameState.teams[gameState.currentTeam];
  if (!team.active){ nextTeam(); announceTurn(); return; }

  gameState.busy = true;
  setDiceDisabled(true);
  hideQPanel();

  const inner = $(".die-inner");
  inner.classList.add("rolling");
  snd("dice");

  const result = Math.floor(Math.random() * 6) + 1;

  await sleep(1000); // кубик айналсын (0.8–1.2 сек)

  inner.classList.remove("rolling");
  setCube(result);
  setDiceShown(`\uD83C\uDFB2 <b>${result}</b><span class="cells-ahead">${result} КЛЕТКА АЛҒА</span>`);
  snd("hop");

  await sleep(400);
  await moveTeam(team, result);
}

/* ---------------- ФИГУРАНЫ ҚОЗҒАЛТУ ---------------- */
async function moveTeam(team, steps){
  for (let i = 0; i < steps; i++){
    if (team.position >= FINAL_INDEX) break;
    team.position += 1;
    placeFigure(team, false);
    updateStrip(team);
    snd("step");
    await sleep(STEP_MS);
  }
  stackFigures();
  snd("hop");
  await sleep(320);

  // қай клеткаға келді
  if (team.position >= FINAL_INDEX){
    team.position = FINAL_INDEX;
    placeFigure(team, false);
    updateStrip(team);
    return winGame(team);
  }
  await onLand(team);
}
const STEP_MS = 280;

/* ---------------- КЛЕТКАҒА ТОҚТАҒАНДА ---------------- */
async function onLand(team){
  const idx = team.position;
  const type = CELL_TYPE_BY_INDEX[idx] || "normal";

  // клетка жарқырайды
  const cell = cellEls[idx];
  cell.classList.add("flash");

  if (type === "danger"){
    snd("danger");
    $("#dangerFlash").classList.add("show");
    setTimeout(()=> $("#dangerFlash").classList.remove("show"), 1100);
    showBanner(`\u26A0\uFE0F \uD83D\uDEA8 ${escapeHtml(team.name)} — ҚАУІПТІ КЛЕТКА!`);
    await sleep(1150);
  } else {
    showBanner(`\uD83D\uDCCC ${idx}-КЛЕТКА — ${CELL_TYPES[type].label}`);
    await sleep(680);
  }

  cell.classList.remove("flash");

  // сұрақ таңдау
  const q = pickQuestion(type);
  if (!q){
    cell.classList.remove("flash");
    gameState.busy = false;
    nextTeam();
    announceTurn();
    return;
  }

  gameState.currentCell = idx;
  gameState.currentCellType = type;
  gameState.answered = false;
  if (type === "danger") showDangerTask(q, idx);
  else showNormalQuestion(q, idx, type);
}

/* ---------------- ЖАСЫЛ ШАР: СҰРАҚ РЕЖИМІ ---------------- */
function showNormalQuestion(q, idx, cellType){
  const panel = $("#qPanel");
  panel.classList.remove("danger");
  const tag = CELL_TYPES[cellType] ? CELL_TYPES[cellType].label : "СҰРАҚ";
  $("#qTag").textContent = tag;
  $("#qCellLabel").textContent = idx + "-КЛЕТКА";
  $("#qText").innerHTML = nl2br(escapeHtml(q.q));
  $("#answerBox").classList.add("hidden");
  $("#answerBox .answer-text").innerHTML = nl2br(escapeHtml(q.a));
  $("#btnReveal").classList.remove("hidden");
  $("#btnCorrect").classList.add("hidden");
  $("#btnWrong").classList.add("hidden");
  $("#btnSkip").classList.add("hidden");
  $("#dangerArea").classList.add("hidden");
  $("#timerBig").classList.add("hidden");
  panel.classList.add("show");
  $("#orb").classList.add("big");
  orbZoom();
}
function showDangerTask(q, idx){
  const panel = $("#qPanel");
  panel.classList.add("danger");
  $("#qTag").textContent = "ҚАУІПТІ БЕЛСЕНДІЛІК";
  $("#qCellLabel").textContent = idx + "-КЛЕТКА";
  $("#qText").innerHTML = nl2br(escapeHtml(q.q));
  const steps = q.steps || "";
  if (steps){
    $("#dangerArea").classList.remove("hidden");
    $("#dangerSteps").innerHTML = nl2br(escapeHtml(steps));
  } else {
    $("#dangerArea").classList.add("hidden");
  }
  $("#answerBox").classList.add("hidden");
  $("#btnReveal").classList.add("hidden"); // қауіптіде жауап btn жоқ
  $("#btnCorrect").classList.remove("hidden");
  $("#btnWrong").classList.remove("hidden");
  $("#btnSkip").classList.remove("hidden"); // мұғалім өткізіп жібере алады
  panel.classList.add("show");
  $("#orb").classList.add("big");

  // таймер (wall sit / қаған)
  runDangerTimer(q.timer);
  orbZoomDanger();
}

function runDangerTimer(sec){
  const timerEl = $("#timerBig");
  if (!sec) { timerEl.classList.add("hidden"); return; }
  timerEl.classList.remove("hidden");
  let left = sec;
  timerEl.textContent = left;
  timerEl.classList.remove("warn");
  const t = setInterval(() => {
    left--;
    timerEl.textContent = Math.max(0, left);
    if (left <= 5) timerEl.classList.add("warn");
    if (left <= 0) clearInterval(t);
  }, 1000);
  window.__dangerTimer = t;
}

function nl2br(s){ return String(s).replace(/\n/g, "<br>"); }

function clearDangerTimer(){
  if (window.__dangerTimer){ clearInterval(window.__dangerTimer); window.__dangerTimer = null; }
}

/* ---------------- ЖАУАПТЫ АШУ ---------------- */
function revealAnswer(){
  if (gameState.answered) return;
  $("#answerBox").classList.remove("hidden");
  $("#btnReveal").classList.add("hidden");
  $("#btnCorrect").classList.remove("hidden");
  $("#btnWrong").classList.remove("hidden");
  snd("reveal");
}

/* ---------------- ҚАУІПТІ ТАПСЫРМАНЫ ӨТКІЗУ (мұғалімге) ---------------- */
async function skipDangerTask(){
  if (gameState.answered || gameState.currentCellType !== "danger") return;
  gameState.answered = true;
  clearDangerTimer();
  snd("dangerPass");
  const team = gameState.teams[gameState.currentTeam];
  const cell = cellEls[gameState.currentCell];
  if (cell) cell.classList.add("good", "goodFlash");
  showLifeToast(`⏭ Тапсырма өткізілді — ${escapeHtml(team.name)} клеткада қалды`, true);
  await sleep(1000);
  if (cell) setTimeout(()=> cell.classList.remove("good", "goodFlash"), 900);
  closeQuestion();
  gameState.busy = false;
  nextTeam();
  announceTurn();
}

/* ---------------- ДҰРЫС ---------------- */
async function correctAnswer(){
  if (gameState.answered || gameState.gameOver) return;
  gameState.answered = true;
  snd("correct");

  const team = gameState.teams[gameState.currentTeam];
  const idx = gameState.currentCell;
  const cell = cellEls[idx];

  // клетка жасыл жарқырайды + тақта да жасылданады
  cell.classList.add("good", "goodFlash");
  boardEl.classList.add("board-good");
  setTimeout(()=> boardEl.classList.remove("board-good"), 900);

  if (gameState.currentCellType === "danger"){
    showLifeToast(`\u2705 ҚАУІПТЕН ӨТТІ!`);
  } else {
    showBanner(`\u2705 ДҰРЫС ЖАУАП!`);
  }
  await sleep(1000);

  cell.classList.remove("flash");
  setTimeout(()=> cell.classList.remove("good", "goodFlash"), 900);

  closeQuestion();
  gameState.busy = false;
  nextTeam();
  announceTurn();
}

/* ---------------- БҰРЫС ---------------- */
async function wrongAnswer(){
  if (gameState.answered || gameState.gameOver) return;
  gameState.answered = true;

  const team = gameState.teams[gameState.currentTeam];

  snd("wrong");

  // қызыл анимация: клетка + бүкіл тақта қызарады
  const cell = cellEls[gameState.currentCell];
  if (cell) cell.classList.add("wrongFlash");
  boardEl.classList.add("board-wrong");
  setTimeout(()=> boardEl.classList.remove("board-wrong"), 900);

  if (gameState.currentCellType === "danger"){
    showLifeToast(`\u274C ҚАУІПТЕН ӨТЕ АЛМАДЫ!`, true);
  } else {
    showBanner(`\u274C БҰРЫС ЖАУАП!`);
  }
  await sleep(750);
  if (cell) cell.classList.remove("wrongFlash");

  closeQuestion();

  // 1 өмір күйді
  await loseLife(team);

  if (team.active){
    // START-қа қайту
    await teleportToStart(team);
  }
  gameState.busy = false;
  if (!gameState.gameOver){
    nextTeam();
    announceTurn();
  }
}

/* ---------------- ӨМІР ЖОҒАЛТУ (анимациямен) ---------------- */
async function loseLife(team){
  team.lives -= 1;
  snd("lifeLost");

  // жүрек анимациясы
  const strip = $("#strip-" + team.id);
  const hearts = strip ? strip.querySelectorAll(".heart") : [];
  const target = team.lives; // күйіп кеткен жүректің индексі
  if (hearts[target]){
    hearts[target].classList.add("burn");
    setTimeout(()=> { updateStrip(team); placeFigure(team, true); }, 650);
  } else {
    updateStrip(team);
  }
  await sleep(650);

  // ❤️ 1 ӨМІР КҮЙДІ! хабарламасы — барлық жағдайда көрсетіледі
  const prevLives = team.lives + 1;
  if (prevLives > 0){
    showLifeToast(`\u2764\uFE0F 1 ӨМІР КҮЙДІ! \uD83D\uDD25`, true);
    await sleep(1250);
  }

  if (team.lives <= 0){
    team.active = false;
    figures[team.id].classList.add("dead");
    renderAllStrips();
    showLifeToast(`\u2620\uFE0F ${escapeHtml(team.name)} — ОЙЫННАН ШЫҚТЫ!`, true);
    await sleep(1600);
  }
}

/* ---------------- START-ҚА ҚАЙТУ ---------------- */
async function teleportToStart(team){
  const target = 0;
  let cur = team.position;
  if (cur === target) return;
  // кері анимация: біртіндеп кему
  const step = cur > target ? -1 : 1;
  while (cur !== target){
    cur += step;
    team.position = cur;
    placeFigure(team, false);
    updateStrip(team);
    snd("step");
    await sleep(180);
  }
  stackFigures();
  await sleep(250);
}

/* ---------------- ЖЕҢІС ---------------- */
async function winGame(team){
  gameState.gameOver = true;
  setDiceDisabled(true);
  snd("victory");

  // тақта күңгірттенеді
  boardEl.style.filter = "brightness(.55)";
  const winnerFig = figures[team.id];
  winnerFig.style.transition = "transform .7s ease";
  winnerFig.style.zIndex = 200;
  winnerFig.style.transform = `translate(-50%,-50%) scale(2.6)`;
  const big = document.createElement("div");
  big.className = "fig";
  big.style.cssText = `left:50%;top:50%;z-index:201;font-size:${Math.min(120, window.innerWidth*0.11)}px;`;
  big.innerHTML = `\uD83C\uDFC6`;
  boardEl.appendChild(big);

  showBanner(`\uD83C\uDFC6 ЖЕҢІМПАЗ!`);
  await sleep(1300);

  boardEl.style.filter = "";
  winnerFig.style.transform = "";
  winnerFig.style.transition = "";
  if (big.parentNode) big.parentNode.removeChild(big);

  confetti();
  showWinScreen(team);
}

function showWinScreen(team){
  const w = $("#winScreen");
  const s = $("#winStats");
  w.classList.remove("hidden");

  $("#winTeamName").textContent = team.name;
  $("#winFig").textContent = team.figure;
  $("#winLives").textContent = team.lives;
  $("#winPos").textContent = team.position === FINAL_INDEX ? "ФИНАЛ" : team.position;

  // статистика карточкалары
  s.innerHTML = "";
  gameState.teams.forEach(t => {
    const card = document.createElement("div");
    card.className = "statcard" + (t.id === team.id ? " win" : "") + (t.lives <= 0 ? " dead" : "");
    const hearts = "\u2764\uFE0F".repeat(Math.max(0, t.lives)) + (t.lives <= 0 ? "\u2620\uFE0F" : "");
    const cup = t.id === team.id ? " \uD83C\uDFC6" : "";
    const posL = t.position === 0 ? "START" : (t.position === 37 ? "ФИНАЛ" : t.position + "-клетка");
    card.innerHTML = `
      <div class="sf">${t.figure}</div>
      <div class="nameblock"><div class="sn">${escapeHtml(t.name)}${cup}</div><span class="pos">${posL}</span></div>
      <div class="sh">${hearts || "\u2014"}</div>
    `;
    s.appendChild(card);
  });
}

function confetti(){
  const colors = ["#e9b44c","#ffd98a","#2f9b5c","#3f7fe0","#e03131","#ffffff"];
  for (let i=0;i<120;i++){
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random()*100 + "vw";
    c.style.width = (6+Math.random()*8)+"px";
    c.style.height = (10+Math.random()*10)+"px";
    c.style.background = colors[Math.floor(Math.random()*colors.length)];
    c.style.animationDuration = (2.2 + Math.random()*2.5)+"s";
    c.style.animationDelay = (Math.random()*0.8)+"s";
    document.body.appendChild(c);
    setTimeout(()=> c.remove(), 5500);
  }
}

/* ============================================================
   СҰРАҚ ПАНЕЛІН ЖАБУ / ОРБ
   ============================================================ */
function closeQuestion(){
  const panel = $("#qPanel");
  panel.classList.remove("show", "danger");
  hideQPanel();
  clearDangerTimer();
  setOrbHome();
}
function hideQPanel(){
  $("#qPanel").classList.remove("show");
}
function setOrbHome(){
  $("#orb").classList.remove("big");
  $("#orb .orb-title").textContent = "ТҮРКІ ДӘУІРІ";
  $("#orb .orb-sub").textContent = "VI–XII ғасырлар";
}
function orbZoom(){
  const orb = $("#orb");
  orb.animate([
    { transform: "translate(-50%,-50%) scale(1)" },
    { transform: "translate(-50%,-50%) scale(1.05)" },
    { transform: "translate(-50%,-50%) scale(1)" }
  ], { duration: 500, easing: "ease-in-out" });
}
function orbZoomDanger(){
  const orb = $("#orb");
  orb.animate([
    { transform: "translate(-50%,-50%) scale(1)",  filter: "hue-rotate(0deg)" },
    { transform: "translate(-50%,-50%) scale(1.06)", filter: "hue-rotate(-28deg) saturate(2)" },
    { transform: "translate(-50%,-50%) scale(1)",  filter: "hue-rotate(0deg)" }
  ], { duration: 600, easing: "ease-in-out" });
}

/* ---------------- FULLSCREEN ---------------- */
function toggleFullscreen(){
  if (!document.fullscreenElement){
    document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(()=>{});
  } else {
    document.exitFullscreen && document.exitFullscreen();
  }
}

/* ---------------- РЕСТАРТ РАСТАУ ---------------- */
function confirmRestart(){
  $("#confirmModal").classList.remove("hidden");
}

/* ============================================================
   БАСТАПҚЫ ІСКЕ ҚОСУ
   ============================================================ */
function init(){
  document.documentElement.style.setProperty("--s", "800px");

  // алғашқы splash
  $("#btnStart").addEventListener("click", startGame);
  $("#btnReveal").addEventListener("click", revealAnswer);
  $("#btnCorrect").addEventListener("click", correctAnswer);
  $("#btnWrong").addEventListener("click", wrongAnswer);
  $("#rollBtn").addEventListener("click", rollDice);
  $("#fullscreenBtn").addEventListener("click", toggleFullscreen);
  $("#soundBtn").addEventListener("click", () => { SOUND.setEnabled(!SOUND.isEnabled()); syncSoundToggle(); });
  $("#restartTop").addEventListener("click", confirmRestart);
  $("#btnRestartWin").addEventListener("click", restartGame);
  $("#btnConfirmYes").addEventListener("click", restartGame);
  $("#btnConfirmNo").addEventListener("click", () => $("#confirmModal").classList.add("hidden"));
  $("#btnSkip").addEventListener("click", skipDangerTask);

  window.addEventListener("resize", () => {
    computeLayout();
    // клеткалар мен фигуралардың орнын жаңарту
    if (boardEl && cellEls.length){
      cellEls.forEach((el, idx) => {
        const p = pathPx[idx];
        el.style.left = p.x + "px"; el.style.top = p.y + "px";
      });
      gameState.teams.forEach(t => placeFigure(t, true));
      stackFigures();
      // сегменттер қайта
      buildSegmentsOnly();
    }
  });

  syncSoundToggle();
  setOrbHome();
}

function buildSegmentsOnly(){
  if (!segLayer || !boardEl) return;
  const old = segLayer.querySelectorAll(".seg, .chev");
  old.forEach(n => n.remove());
  for (let i = 0; i <= 36; i++){
    const a = pathPx[i], b = pathPx[i+1];
    const seg = document.createElement("div");
    seg.className = "seg";
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) * 0.94;
    const ang = Math.atan2(dy, dx);
    seg.style.left = ((a.x + b.x) / 2) + "px";
    seg.style.top  = ((a.y + b.y) / 2) + "px";
    seg.style.width = len + "px";
    seg.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
    segLayer.appendChild(seg);
    const ch = document.createElement("div");
    ch.className = "chev";
    ch.style.left = ((a.x*0.45) + (b.x*0.55)) + "px";
    ch.style.top  = ((a.y*0.45) + (b.y*0.55)) + "px";
    ch.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
    segLayer.appendChild(ch);
  }
}

document.addEventListener("DOMContentLoaded", init);
