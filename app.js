// --- CONFIG ---
const WIDTH = 800, HEIGHT = 600, GRID = 20, COLS = WIDTH / GRID, ROWS = HEIGHT / GRID;
const COLORS = { player: 0xff6b6b, ai: 0x6bffd5, food: 0xffd56b };
const AI_LEVELS = [
  "Novice", "Easy", "Normal", "Smart", "Skilled",
  "Advanced", "Expert", "Master", "Genius", "Impossible"
];

// --- PIXI APP ---
const app = new PIXI.Application({ width: WIDTH, height: HEIGHT, backgroundColor: 0x181818, antialias: true });
document.getElementById('gameContainer').appendChild(app.view);

// --- SOUNDS ---
const eatSound = new Audio('eat.mp3');
const dieSound = new Audio('die.mp3');
const winSound = new Audio('win.mp3');
const clickSound = new Audio('click.mp3');

// --- SCORE DISPLAY ---
const scoreText = new PIXI.Text('', {fontFamily:'Segoe UI', fontSize:28, fill:'#00ffff', fontWeight:'bold', align:'center'});
scoreText.anchor.set(0.5, 0);
scoreText.x = WIDTH / 2;
scoreText.y = 10;
app.stage.addChild(scoreText);

// --- UTILS ---
function gridToPixi(x, y) { return [x * GRID, y * GRID]; }
function randomGrid() { return { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
function arraysEqual(a, b) { return a.x === b.x && a.y === b.y; }
function getUnlockedLevel() { return parseInt(localStorage.getItem('snake_unlocked_level') || '1', 10); }
function setUnlockedLevel(lvl) { localStorage.setItem('snake_unlocked_level', lvl); }

// --- DEVICE DETECTION ---
let isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

// --- ENTITY CLASSES ---
class Food {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.gfx = new PIXI.Graphics();
    this.render();
    app.stage.addChild(this.gfx);
  }
  render() {
    const [px, py] = gridToPixi(this.x, this.y);
    this.gfx.clear();
    this.gfx.beginFill(COLORS.food, 0.92);
    this.gfx.lineStyle(2, 0xffffff, 0.4);
    this.gfx.drawCircle(GRID / 2, GRID / 2, GRID / 2 - 3);
    this.gfx.endFill();
    this.gfx.x = px; this.gfx.y = py;
  }
  destroy() { app.stage.removeChild(this.gfx); }
}

class Snake {
  constructor(color, x, y, controls, isAI = false, aiLevel = 1, name = '') {
    this.color = color;
    this.body = [{ x, y }];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.grow = 3;
    this.isAI = isAI;
    this.aiLevel = aiLevel;
    this.name = name;
    this.controls = controls;
    this.alive = true;
    this.gfx = new PIXI.Container();
    app.stage.addChild(this.gfx);
  }
  setDirection(key) {
    if (!this.alive || this.isAI) return;
    const d = this.controls[key];
    if (!d) return;
    if (d.x === -this.dir.x && d.y === -this.dir.y) return;
    this.nextDir = d;
  }
  move(foodList, snakes) {
    if (!this.alive) return;
    if (this.isAI) this.aiMove(foodList, snakes);
    this.dir = this.nextDir;
    let head = {
      x: (this.body[0].x + this.dir.x + COLS) % COLS,
      y: (this.body[0].y + this.dir.y + ROWS) % ROWS
    };
    this.body.unshift(head);
    if (this.grow > 0) this.grow--;
    else this.body.pop();
  }
  aiMove(foodList, snakes) {
    if (this.aiLevel <= 2) {
      if (foodList.length && Math.random() < (this.aiLevel === 2 ? 0.7 : 0.4)) this.greedyMove(foodList);
      else this.randomMove();
      return;
    }
    this.bfsMove(foodList, snakes);
  }
  greedyMove(foodList) {
    let f = foodList[0], minDist = this.dist(f);
    for (let food of foodList) {
      let d = this.dist(food);
      if (d < minDist) { minDist = d; f = food; }
    }
    let bestDir = this.dir, bestDist = Infinity;
    for (let d of [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}]) {
      let nx = (this.body[0].x + d.x + COLS) % COLS, ny = (this.body[0].y + d.y + ROWS) % ROWS;
      if (this.body.slice(0, -1).some(seg => seg.x === nx && seg.y === ny)) continue;
      let dist = Math.abs(nx - f.x) + Math.abs(ny - f.y);
      if (dist < bestDist) { bestDist = dist; bestDir = d; }
    }
    this.nextDir = bestDir;
  }
  randomMove() {
    let dirs = [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}].filter(d => {
      let nx = (this.body[0].x + d.x + COLS) % COLS, ny = (this.body[0].y + d.y + ROWS) % ROWS;
      return !this.body.slice(0, -1).some(seg => seg.x === nx && seg.y === ny);
    });
    if (dirs.length) this.nextDir = dirs[Math.floor(Math.random() * dirs.length)];
  }
  bfsMove(foodList, snakes) {
    let f = foodList[0], minDist = this.dist(f);
    for (let food of foodList) {
      let d = this.dist(food);
      if (d < minDist) { minDist = d; f = food; }
    }
    let queue = [{x:this.body[0].x, y:this.body[0].y, path:[]}];
    let visited = Array.from({length:COLS},()=>Array(ROWS).fill(false));
    visited[this.body[0].x][this.body[0].y] = true;
    let bodySet = new Set(this.body.slice(0, -1).map(seg => seg.x + ',' + seg.y));
    if (this.aiLevel >= 5) {
      for (let s of snakes) if (s !== this) s.body.forEach(seg => bodySet.add(seg.x+','+seg.y));
    }
    while (queue.length) {
      let {x, y, path} = queue.shift();
      if (x === f.x && y === f.y && path.length) {
        let next = path[0];
        let dx = (next.x - this.body[0].x + COLS) % COLS, dy = (next.y - this.body[0].y + ROWS) % ROWS;
        if (dx === 1 || dx === -(COLS-1)) this.nextDir = {x:1,y:0};
        else if (dx === -1 || dx === COLS-1) this.nextDir = {x:-1,y:0};
        else if (dy === 1 || dy === -(ROWS-1)) this.nextDir = {x:0,y:1};
        else if (dy === -1 || dy === ROWS-1) this.nextDir = {x:0,y:-1};
        return;
      }
      for (let d of [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}]) {
        let nx = (x + d.x + COLS) % COLS, ny = (y + d.y + ROWS) % ROWS;
        if (visited[nx][ny]) continue;
        if (bodySet.has(nx+','+ny)) continue;
        visited[nx][ny] = true;
        queue.push({x:nx, y:ny, path: path.concat({x:nx,y:ny})});
      }
    }
    this.randomMove();
  }
  dist(food) {
    let dx = Math.abs(this.body[0].x - food.x), dy = Math.abs(this.body[0].y - food.y);
    dx = Math.min(dx, COLS - dx); dy = Math.min(dy, ROWS - dy);
    return dx + dy;
  }
  render() {
    this.gfx.removeChildren();
    for (let i = 0; i < this.body.length; ++i) {
      let seg = this.body[i], [px, py] = gridToPixi(seg.x, seg.y);
      let box = new PIXI.Graphics();
      box.beginFill(this.color, 0.9);
      box.lineStyle(i === 0 ? 3 : 1, 0xffffff, i === 0 ? 0.8 : 0.3);
      box.drawRoundedRect(0, 0, GRID, GRID, 6);
      box.endFill();
      box.x = px; box.y = py;
      this.gfx.addChild(box);
    }
  }
  occupies(x, y) {
    return this.body.some(seg => seg.x === x && seg.y === y);
  }
  checkDeath(snakes) {
    if (!this.alive) return false;
    if (this.body.slice(1).some(seg => seg.x === this.body[0].x && seg.y === this.body[0].y)) {
      this.alive = false;
      return true;
    }
    for (let s of snakes) {
      if (s === this) continue;
      if (s.body.slice(1).some(seg => seg.x === this.body[0].x && seg.y === this.body[0].y)) {
        this.alive = false;
        return true;
      }
    }
    return false;
  }
}

// --- GAME STATE & LOGIC ---
let playerNames = { p1: "Player", p2: "AI" };
let mode = "single", aiLevel = 1, running = false, currentMenu = null;
let snakes = [], foods = [];

function resetGame(singlePlayer = true, level = 1) {
  for (let s of snakes) app.stage.removeChild(s.gfx);
  for (let f of foods) app.stage.removeChild(f.gfx);
  snakes = []; foods = [];
  if (singlePlayer) {
    playerNames = { p1: "Player", p2: "AI" };
    snakes.push(new Snake(COLORS.player, 5, 5, {w:{x:0,y:-1},a:{x:-1,y:0},s:{x:0,y:1},d:{x:1,y:0}}, false, 1, playerNames.p1));
    snakes.push(new Snake(COLORS.ai, COLS-6, ROWS-6, {ArrowUp:{x:0,y:-1},ArrowLeft:{x:-1,y:0},ArrowDown:{x:0,y:1},ArrowRight:{x:1,y:0}}, true, level, playerNames.p2));
    mode = "single"; aiLevel = level;
  } else {
    if (isMobile) {
      playerNames = { p1: "Bottom", p2: "Top" };
    } else {
      playerNames = { p1: "WASD", p2: "Arrows" };
    }
    snakes.push(new Snake(COLORS.player, 5, 5, {w:{x:0,y:-1},a:{x:-1,y:0},s:{x:0,y:1},d:{x:1,y:0}}, false, 1, playerNames.p1));
    snakes.push(new Snake(COLORS.ai, COLS-6, ROWS-6, {ArrowUp:{x:0,y:-1},ArrowLeft:{x:-1,y:0},ArrowDown:{x:0,y:1},ArrowRight:{x:1,y:0}}, false, 1, playerNames.p2));
    mode = "multi";
  }
  for (let i = 0; i < 5; ++i) spawnFood();
  running = true;
  updateScoreDisplay();
  requestAnimationFrame(gameLoop);
  showTouchControls(mode);
}

function spawnFood() {
  let x, y, safe;
  do {
    let pos = randomGrid();
    x = pos.x; y = pos.y;
    safe = !snakes.some(s => s.occupies(x, y)) && !foods.some(f => f.x === x && f.y === y);
  } while (!safe);
  foods.push(new Food(x, y));
}

window.addEventListener('keydown', e => {
  for (let s of snakes) s.setDirection(e.key);
  if (e.key === 'Escape' && running) showPauseMenu();
});

let lastTick = 0;
function gameLoop(ts) {
  if (!running) return;
  if (ts - lastTick > 100) {
    for (let s of snakes) s.move(foods, snakes);
    for (let s of snakes) {
      for (let i = foods.length-1; i >= 0; --i) {
        if (arraysEqual(s.body[0], foods[i])) {
          s.grow++;
          foods[i].destroy();
          foods.splice(i, 1);
          spawnFood();
          eatSound.currentTime = 0; eatSound.play();
        }
      }
    }
    for (let s of snakes) {
      if (s.checkDeath(snakes)) {
        dieSound.currentTime = 0; dieSound.play();
        running = false;
        showGameOverMenu(s);
      }
    }
    for (let s of snakes) s.render();
    for (let f of foods) f.render();
    updateScoreDisplay();
    lastTick = ts;
  }
  if (running) requestAnimationFrame(gameLoop);
}

function updateScoreDisplay() {
  scoreText.text = `${playerNames.p1}: ${snakes[0].body.length - 1}    ${playerNames.p2}: ${snakes[1].body.length - 1}`;
}

// --- RESPONSIVE CANVAS ---
function resizeCanvas() {
  let w = window.innerWidth, h = window.innerHeight;
  let scale = Math.min(w / WIDTH, h / HEIGHT, 1);
  app.view.style.width = (WIDTH * scale) + "px";
  app.view.style.height = (HEIGHT * scale) + "px";
  app.view.style.maxWidth = "100vw";
  app.view.style.maxHeight = "100vh";
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- TOUCH CONTROLS SETUP ---
const touchControls = document.getElementById('touchControls');
const dpadWasd = document.getElementById('dpad-wasd');
const dpadArrows = document.getElementById('dpad-arrows');

function showTouchControls(mode) {
  if (!isMobile) { touchControls.style.display = "none"; return; }
  touchControls.style.display = "block";
  if (mode === "multi") {
    dpadWasd.style.display = "block";
    dpadWasd.style.bottom = "20px";
    dpadArrows.style.display = "block";
    dpadArrows.style.top = "20px";
  } else {
    dpadWasd.style.display = "block";
    dpadWasd.style.bottom = "20px";
    dpadArrows.style.display = "none";
    dpadArrows.style.top = "";
  }
}
function hideTouchControls() { touchControls.style.display = "none"; }

function setupDpad(dpad) {
  Array.from(dpad.querySelectorAll('.dpad-btn')).forEach(btn => {
    const key = btn.getAttribute('data-key');
    btn.addEventListener('touchstart', e => {
      e.preventDefault();
      btn.classList.add('active');
      triggerVirtualKey(key);
    }, {passive:false});
    btn.addEventListener('touchend', e => {
      e.preventDefault();
      btn.classList.remove('active');
    }, {passive:false});
    btn.addEventListener('touchcancel', e => {
      btn.classList.remove('active');
    });
  });
}
setupDpad(dpadWasd);
setupDpad(dpadArrows);

function triggerVirtualKey(key) {
  const e = new KeyboardEvent('keydown', {key});
  window.dispatchEvent(e);
}

// --- MENUS ---
function showMainMenu() {
  running = false;
  if (currentMenu) {
    try { document.body.removeChild(currentMenu); } catch(e){}
    currentMenu = null;
  }
  const menu = document.createElement('div');
  menu.style.position = "absolute";
  menu.style.top = "0";
  menu.style.left = "0";
  menu.style.width = "100vw";
  menu.style.height = "100vh";
  menu.style.display = "flex";
  menu.style.flexDirection = "column";
  menu.style.alignItems = "center";
  menu.style.justifyContent = "center";
  menu.style.background = "rgba(18,18,18,0.92)";
  menu.style.zIndex = "20";
  menu.innerHTML = `
    <h1 style="color:#00ffff;">Snake Tail Battle</h1>
    <button id="singleBtn" style="margin:10px 0;font-size:1.3rem;">Single Player</button>
    <button id="multiBtn" style="margin:10px 0;font-size:1.3rem;">Two Players</button>
    <div style="margin-top:30px;color:#00ffff;font-size:1.1rem;">
      ${isMobile ? "Touch the arrows below to play on mobile!" : "Use keyboard or touch controls."}
    </div>
  `;
  document.body.appendChild(menu);
  currentMenu = menu;
  document.getElementById('singleBtn').onclick = () => {
    clickSound.currentTime = 0; clickSound.play();
    document.body.removeChild(menu); currentMenu = null;
    showLevelSelect();
  };
  document.getElementById('multiBtn').onclick = () => {
    clickSound.currentTime = 0; clickSound.play();
    document.body.removeChild(menu); currentMenu = null;
    resetGame(false, 1);
    showTouchControls("multi");
  };
  hideTouchControls();
}

function showLevelSelect() {
  if (currentMenu) document.body.removeChild(currentMenu);
  const menu = document.createElement('div');
  menu.style.position = "absolute";
  menu.style.top = "0";
  menu.style.left = "0";
  menu.style.width = "100vw";
  menu.style.height = "100vh";
  menu.style.display = "flex";
  menu.style.flexDirection = "column";
  menu.style.alignItems = "center";
  menu.style.justifyContent = "center";
  menu.style.background = "rgba(18,18,18,0.92)";
  menu.style.zIndex = "20";
  let boxes = '';
  const unlocked = getUnlockedLevel();
  for (let i = 1; i <= 10; ++i) {
    boxes += `<button class="levelBox" data-level="${i}" style="width:70px;height:70px;margin:0 8px;${i>unlocked?'background:#333;color:#888;pointer-events:none;opacity:0.5;':''}">${i}<div style="font-size:0.9rem;">${AI_LEVELS[i-1]}</div></button>`;
  }
  menu.innerHTML = `
    <div style="color:#00ffff;font-size:2rem;margin-bottom:12px;">Select Level</div>
    <div style="display:flex;flex-direction:row;gap:8px;margin-bottom:18px;">${boxes}</div>
    <button id="backBtn" style="margin-top:10px;">Back</button>
  `;
  document.body.appendChild(menu);
  currentMenu = menu;
  document.querySelectorAll('.levelBox').forEach(btn => {
    if (!btn.disabled) {
      btn.onclick = () => {
        clickSound.currentTime=0; clickSound.play();
        document.body.removeChild(menu); currentMenu = null;
        resetGame(true, parseInt(btn.getAttribute('data-level')));
        showTouchControls("single");
      };
    }
  });
  document.getElementById('backBtn').onclick = () => { clickSound.currentTime=0; clickSound.play(); document.body.removeChild(menu); showMainMenu(); };
  hideTouchControls();
}

function showPauseMenu() {
  running = false;
  if (currentMenu) document.body.removeChild(currentMenu);
  const menu = document.createElement('div');
  menu.style.position = "absolute";
  menu.style.top = "0";
  menu.style.left = "0";
  menu.style.width = "100vw";
  menu.style.height = "100vh";
  menu.style.display = "flex";
  menu.style.flexDirection = "column";
  menu.style.alignItems = "center";
  menu.style.justifyContent = "center";
  menu.style.background = "rgba(18,18,18,0.92)";
  menu.style.zIndex = "20";
  menu.innerHTML = `
    <h2 style="color:#00ffff;">Game Paused</h2>
    <button id="continueBtn" style="margin:10px 0;">Continue</button>
    <button id="mainMenuBtn" style="margin:10px 0;">Main Menu</button>
  `;
  document.body.appendChild(menu);
  currentMenu = menu;
  document.getElementById('continueBtn').onclick = () => {
    clickSound.currentTime=0; clickSound.play();
    document.body.removeChild(menu); currentMenu = null;
    running = true; requestAnimationFrame(gameLoop);
    showTouchControls(mode);
  };
  document.getElementById('mainMenuBtn').onclick = () => {
    clickSound.currentTime=0; clickSound.play();
    document.body.removeChild(menu); showMainMenu();
  };
  hideTouchControls();
}

function showGameOverMenu(deadSnake) {
  if (currentMenu) document.body.removeChild(currentMenu);
  const menu = document.createElement('div');
  menu.style.position = "absolute";
  menu.style.top = "0";
  menu.style.left = "0";
  menu.style.width = "100vw";
  menu.style.height = "100vh";
  menu.style.display = "flex";
  menu.style.flexDirection = "column";
  menu.style.alignItems = "center";
  menu.style.justifyContent = "center";
  menu.style.background = "rgba(18,18,18,0.92)";
  menu.style.zIndex = "20";
  let winner = '';
  let nextLevelBtn = '';
  if (mode === 'single') {
    if (deadSnake.isAI) {
      winner = 'You won!';
      winSound.currentTime=0; winSound.play();
      if (aiLevel < 10 && getUnlockedLevel() < aiLevel + 1) setUnlockedLevel(aiLevel + 1);
      if (aiLevel < 10) {
        nextLevelBtn = `<button id="nextLevelBtn" style="margin:10px 0;">Next Level</button>`;
      }
    } else {
      winner = 'AI won!';
      dieSound.currentTime=0; dieSound.play();
    }
  } else {
    winner = (deadSnake.name === playerNames.p1)
      ? `${playerNames.p2} won!`
      : `${playerNames.p1} won!`;
    winSound.currentTime=0; winSound.play();
  }
  menu.innerHTML = `
    <h2 style="color:#00ffff;">${winner}</h2>
    ${nextLevelBtn}
    <button id="restartBtn" style="margin:10px 0;">Restart</button>
    <button id="mainMenuBtn" style="margin:10px 0;">Main Menu</button>
  `;
  document.body.appendChild(menu);
  currentMenu = menu;
  if (nextLevelBtn) {
    document.getElementById('nextLevelBtn').onclick = () => {
      clickSound.currentTime=0; clickSound.play();
      document.body.removeChild(menu); currentMenu = null;
      resetGame(true, aiLevel + 1);
      showTouchControls("single");
    };
  }
  document.getElementById('restartBtn').onclick = () => {
    clickSound.currentTime=0; clickSound.play();
    document.body.removeChild(menu); currentMenu = null;
    if (mode === 'single') resetGame(true, aiLevel);
    else resetGame(false, 1);
    showTouchControls(mode);
  };
  document.getElementById('mainMenuBtn').onclick = () => {
    clickSound.currentTime=0; clickSound.play();
    document.body.removeChild(menu); showMainMenu();
  };
  hideTouchControls();
}

// --- Start ---
showMainMenu();
