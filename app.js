// --- CONFIG ---
const GRID = 20;
let WIDTH = 400, HEIGHT = 600, COLS = 20, ROWS = 30;
const COLORS = { top: 0x6bffd5, bottom: 0xff6b6b, food: 0xffd56b };

// --- PIXI APP ---
const app = new PIXI.Application({ backgroundColor: 0x181818, antialias: true, resolution: window.devicePixelRatio });
document.getElementById('gameContainer').appendChild(app.view);

// --- DOM UI ---
const scoreTop = document.getElementById('scoreTop');
const scoreBottom = document.getElementById('scoreBottom');
const splitLine = document.getElementById('splitLine');

// --- UTILS ---
function gridToPixi(x, y) { return [x * GRID, y * GRID]; }
function randomGrid() { return { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
function arraysEqual(a, b) { return a.x === b.x && a.y === b.y; }

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
  constructor(color, x, y, controls, name) {
    this.color = color;
    this.body = [{ x, y }];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.grow = 3;
    this.controls = controls;
    this.name = name;
    this.alive = true;
    this.gfx = new PIXI.Container();
    app.stage.addChild(this.gfx);
  }
  setDirection(dir) {
    if (!this.alive) return;
    if (dir.x === -this.dir.x && dir.y === -this.dir.y) return;
    this.nextDir = dir;
  }
  move() {
    if (!this.alive) return;
    this.dir = this.nextDir;
    let head = {
      x: (this.body[0].x + this.dir.x + COLS) % COLS,
      y: (this.body[0].y + this.dir.y + ROWS) % ROWS
    };
    this.body.unshift(head);
    if (this.grow > 0) this.grow--;
    else this.body.pop();
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
}

// --- GAME STATE ---
let snakes = [], foods = [], running = false, currentMenu = null;

// --- GAME LOGIC ---
function resetGame() {
  for (let s of snakes) app.stage.removeChild(s.gfx);
  for (let f of foods) app.stage.removeChild(f.gfx);
  snakes = []; foods = [];
  snakes.push(new Snake(COLORS.top, COLS - 6, 5, {up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}, "Top"));
  snakes.push(new Snake(COLORS.bottom, 5, ROWS - 6, {up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}, "Bottom"));
  for (let i = 0; i < 5; ++i) spawnFood();
  running = true;
  updateScoreDisplay();
  requestAnimationFrame(gameLoop);
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

let lastTick = 0;
function gameLoop(ts) {
  if (!running) return;
  if (ts - lastTick > 100) {
    for (let s of snakes) s.move();
    for (let s of snakes) {
      for (let i = foods.length-1; i >= 0; --i) {
        if (arraysEqual(s.body[0], foods[i])) {
          s.grow++;
          foods[i].destroy();
          foods.splice(i, 1);
          spawnFood();
        }
      }
    }
    for (let s of snakes) {
      if (s.checkDeath(snakes)) {
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
  scoreTop.innerText = `Top: ${snakes[0].body.length - 1}`;
  scoreBottom.innerText = `Bottom: ${snakes[1].body.length - 1}`;
}

// --- RESPONSIVE CANVAS ---
function resizeCanvas() {
  let w = window.innerWidth, h = window.innerHeight;
  let scale = Math.min(w / WIDTH, h / HEIGHT, 1);
  app.renderer.resize(WIDTH, HEIGHT);
  app.view.style.width = (WIDTH * scale) + "px";
  app.view.style.height = (HEIGHT * scale) + "px";
  splitLine.style.top = (h / 2) + "px";
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- SWIPE CONTROLS ---
let touchStartY = 0, touchStartX = 0;
let swipeTarget = null;
app.view.addEventListener('touchstart', e => {
  if (e.touches.length > 0) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    let h = window.innerHeight;
    swipeTarget = (touchStartY < h / 2) ? 0 : 1; // 0=Top, 1=Bottom
  }
});
app.view.addEventListener('touchend', e => {
  if (e.changedTouches.length > 0 && swipeTarget !== null) {
    let dx = e.changedTouches[0].clientX - touchStartX;
    let dy = e.changedTouches[0].clientY - touchStartY;
    let absDx = Math.abs(dx), absDy = Math.abs(dy);
    let dir = null;
    if (absDx > absDy && absDx > 20) dir = dx > 0 ? 'right' : 'left';
    else if (absDy > absDx && absDy > 20) dir = dy > 0 ? 'down' : 'up';
    if (dir) {
      let snake = snakes[swipeTarget];
      let dmap = snake.controls;
      if (dmap[dir]) snake.setDirection(dmap[dir]);
    }
    swipeTarget = null;
  }
});

// --- DESKTOP KEYBOARD CONTROLS (for testing) ---
window.addEventListener('keydown', e => {
  // Top: Arrow keys
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    let dmap = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
    snakes[0].setDirection(snakes[0].controls[dmap[e.key]]);
  }
  // Bottom: WASD
  if (['w','a','s','d'].includes(e.key)) {
    let dmap = {w:'up',a:'left',s:'down',d:'right'};
    snakes[1].setDirection(snakes[1].controls[dmap[e.key]]);
  }
});

// --- MENUS ---
function showMainMenu() {
  running = false;
  if (currentMenu) document.body.removeChild(currentMenu);
  const menu = document.createElement('div');
  menu.className = "menu-overlay";
  menu.innerHTML = `
    <h1 style="color:#00ffff;">Snake Tail Battle</h1>
    <button id="twoPlayerBtn">Two Players (Split Screen)</button>
  `;
  document.body.appendChild(menu);
  currentMenu = menu;
  document.getElementById('twoPlayerBtn').onclick = () => {
    document.body.removeChild(menu); currentMenu = null;
    resetGame();
  };
}
function showGameOverMenu(deadSnake) {
  if (currentMenu) document.body.removeChild(currentMenu);
  const menu = document.createElement('div');
  menu.className = "menu-overlay";
  let winner = deadSnake.name === "Top" ? "Bottom" : "Top";
  menu.innerHTML = `
    <h2 style="color:#00ffff;">${winner} wins!</h2>
    <button id="restartBtn">Restart</button>
    <button id="mainMenuBtn">Main Menu</button>
  `;
  document.body.appendChild(menu);
  currentMenu = menu;
  document.getElementById('restartBtn').onclick = () => {
    document.body.removeChild(menu); currentMenu = null;
    resetGame();
  };
  document.getElementById('mainMenuBtn').onclick = () => {
    document.body.removeChild(menu); showMainMenu();
  };
}

// --- Start ---
showMainMenu();
