// app.js
const BASE_WIDTH = 800, BASE_HEIGHT = 600;
const BASE_GRID = 20;
const BASE_COLS = 40;
const BASE_ROWS = 30;

const COLORS = { top: 0x6bffd5, bottom: 0xff6b6b, food: 0xffd56b };

const app = new PIXI.Application({ backgroundColor: 0x181818, antialias: true, resolution: window.devicePixelRatio });
document.getElementById('gameContainer').appendChild(app.view);

const scoreText = document.getElementById('scoreText');

const eatSound = new Audio('eat.mp3');
const dieSound = new Audio('die.mp3');
const winSound = new Audio('win.mp3');
const clickSound = new Audio('click.mp3');

function gridToPixi(x, y, gridSize) { return [x * gridSize, y * gridSize]; }
function randomGrid(cols, rows) { return { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) }; }
function arraysEqual(a, b) { return a.x === b.x && a.y === b.y; }

const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

let WIDTH = BASE_WIDTH;
let HEIGHT = BASE_HEIGHT;
let GRID = BASE_GRID;
let COLS = BASE_COLS;
let ROWS = BASE_ROWS;
let mode = "single";
let running = false;
let currentMenu = null;
let playerNames = { p1: "Player", p2: "AI" };
let snakes = [];
let foods = [];

function resizeGame() {
  let w = window.innerWidth;
  let h = window.innerHeight;
  if (mode === "multi" && isMobile) {
    WIDTH = w;
    HEIGHT = h;
    GRID = Math.floor(Math.min(WIDTH / BASE_COLS, HEIGHT / BASE_ROWS));
    COLS = Math.floor(WIDTH / GRID);
    ROWS = Math.floor(HEIGHT / GRID);
  } else {
    const scale = Math.min(w / BASE_WIDTH, h / BASE_HEIGHT, 1);
    WIDTH = Math.floor(BASE_WIDTH * scale);
    HEIGHT = Math.floor(BASE_HEIGHT * scale);
    GRID = Math.floor(WIDTH / BASE_COLS);
    COLS = BASE_COLS;
    ROWS = BASE_ROWS;
  }
  app.renderer.resize(WIDTH, HEIGHT);
  app.view.style.width = WIDTH + "px";
  app.view.style.height = HEIGHT + "px";
  scoreText.style.left = "50%";
  scoreText.style.top = "10px";
  scoreText.style.transform = "translateX(-50%)";
}
window.addEventListener('resize', resizeGame);

class Food {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.gfx = new PIXI.Graphics();
    this.render();
    app.stage.addChild(this.gfx);
  }
  render() {
    const [px, py] = gridToPixi(this.x, this.y, GRID);
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
  constructor(color, x, y, controls, isAI = false, name = '') {
    this.color = color;
    this.body = [{ x, y }];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.grow = 3;
    this.isAI = isAI;
    this.name = name;
    this.controls = controls;
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
    if (this.isAI) this.aiMove();
    this.dir = this.nextDir;
    let head = {
      x: (this.body[0].x + this.dir.x + COLS) % COLS,
      y: (this.body[0].y + this.dir.y + ROWS) % ROWS
    };
    this.body.unshift(head);
    if (this.grow > 0) this.grow--;
    else this.body.pop();
  }
  aiMove() {
    // Simple AI: random movement (can be enhanced)
    const directions = [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
    this.nextDir = directions[Math.floor(Math.random() * directions.length)];
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
      let seg = this.body[i], [px, py] = gridToPixi(seg.x, seg.y, GRID);
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

const controlsWASD = { w: {x:0,y:-1}, a: {x:-1,y:0}, s: {x:0,y:1}, d: {x:1,y:0} };
const controlsArrows = { ArrowUp: {x:0,y:-1}, ArrowLeft: {x:-1,y:0}, ArrowDown: {x:0,y:1}, ArrowRight: {x:1,y:0} };

function resetGame(isSingle) {
  for (let s of snakes) app.stage.removeChild(s.gfx);
  for (let f of foods) app.stage.removeChild(f.gfx);
  snakes = []; foods = [];
  if (isSingle) {
    playerNames = { p1: "Player", p2: "AI" };
    snakes.push(new Snake(COLORS.top, 5, 5, controlsWASD, false, playerNames.p1));
    snakes.push(new Snake(COLORS.bottom, COLS - 6, ROWS - 6, controlsArrows, true, playerNames.p2));
    mode = "single";
  } else {
    if (isMobile) {
      playerNames = { p1: "Bottom", p2: "Top" };
    } else {
      playerNames = { p1: "WASD", p2: "Arrows" };
    }
    snakes.push(new Snake(COLORS.bottom, 5, ROWS - 6, controlsWASD, false, playerNames.p1));
    snakes.push(new Snake(COLORS.top, COLS - 6, 5, controlsArrows, false, playerNames.p2));
    mode = "multi";
  }
  for (let i = 0; i < 5; ++i) spawnFood();
  running = true;
  updateScoreDisplay();
  resizeGame();
  requestAnimationFrame(gameLoop);
}

function spawnFood() {
  let x, y, safe;
  do {
    let pos = randomGrid(COLS, ROWS);
    x = pos.x; y = pos.y;
    safe = !snakes.some(s => s.occupies(x, y)) && !foods.some(f => f.x === x && f.y === y);
  } while (!safe);
  foods.push(new Food(x, y));
}

window.addEventListener('keydown', e => {
  if (!running) return;
  if (controlsWASD[e.key]) snakes[0].setDirection(controlsWASD[e.key]);
  if (controlsArrows[e.key]) snakes[1].setDirection(controlsArrows[e.key]);
  if (e.key === 'Escape') showPauseMenu();
});

let touchStartX = 0, touchStartY = 0, activePlayer = null;
app.view.addEventListener('touchstart', e => {
  if (!running) return;
  if (e.touches.length > 0) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    const h = window.innerHeight;
    if (mode === "multi") {
      activePlayer = (touchStartY < h / 2) ? 1 : 0;
    } else {
      activePlayer = 0;
    }
  }
});
app.view.addEventListener('touchend', e => {
  if (!running || activePlayer === null) return;
  if (e.changedTouches.length > 0) {
    let dx = e.changedTouches[0].clientX - touchStartX;
    let dy = e.changedTouches[0].clientY - touchStartY;
    let absDx = Math.abs(dx), absDy = Math.abs(dy);
    let direction = null;
    if (absDx > absDy && absDx > 20) direction = dx > 0 ? 'right' : 'left';
    else if (absDy > absDx && absDy > 20) direction = dy > 0 ? 'down' : 'up';
    if (direction) {
      const player = snakes[activePlayer];
      const ctrl = player.controls;
      if (direction === 'up' && ctrl.w) player.setDirection(ctrl.w);
      else if (direction === 'down' && ctrl.s) player.setDirection(ctrl.s);
      else if (direction === 'left' && ctrl.a) player.setDirection(ctrl.a);
      else if (direction === 'right' && ctrl.d) player.setDirection(ctrl.d);
    }
    activePlayer = null;
  }
});

let lastTick = 0;
function gameLoop(ts) {
  if (!running) return;
  if (ts - lastTick > 100) {
    for (let s of snakes) s.move();
    for (let s of snakes) {
      for (let i = foods.length - 1; i >= 0; i--) {
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
        running = false;
        dieSound.currentTime = 0; dieSound.play();
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
  if (mode === "single") {
    scoreText.textContent = `${playerNames.p1}: ${snakes[0].body.length - 1}    ${playerNames.p2}: ${snakes[1].body.length - 1}`;
  } else if (isMobile) {
    scoreText.textContent = `Top: ${snakes[1].body.length - 1}    Bottom: ${snakes[0].body.length - 1}`;
  } else {
    scoreText.textContent = `${playerNames.p1}: ${snakes[0].body.length - 1}    ${playerNames.p2}: ${snakes[1].body.length - 1}`;
  }
}

function showMainMenu() {
  running = false;
  if (currentMenu) document.body.removeChild(currentMenu);
  const menu = document.createElement('div');
  menu.className = "menu-overlay";
  menu.innerHTML = `
    <h1 style="color:#00ffff;">Snake Tail Battle</h1>
    <button id="singleBtn">Single Player</button>
    <button id="multiBtn">Two Players</button>
  `;
  document.body.appendChild(menu);
  currentMenu = menu;
  document.getElementById('singleBtn').onclick = () => {
    clickSound.currentTime = 0; clickSound.play();
    document.body.removeChild(menu);
    currentMenu = null;
    resetGame(true);
  };
  document.getElementById('multiBtn').onclick = () => {
    clickSound.currentTime = 0; clickSound.play();
    document.body.removeChild(menu);
    currentMenu = null;
    resetGame(false);
  };
}

function showGameOverMenu(deadSnake) {
  if (currentMenu) document.body.removeChild(currentMenu);
  const menu = document.createElement('div');
  menu.className = "menu-overlay";
  let winner;
  if (mode === "single") {
    winner = (deadSnake.name === playerNames.p1) ? playerNames.p2 : playerNames.p1;
  } else if (isMobile) {
    winner = (deadSnake.name === "Bottom") ? "Top" : "Bottom";
  } else {
    winner = (deadSnake.name === playerNames.p1) ? playerNames.p2 : playerNames.p1;
  }
  menu.innerHTML = `
    <h2 style="color:#00ffff;">${winner} wins!</h2>
    <button id="restartBtn">Restart</button>
    <button id="mainMenuBtn">Main Menu</button>
  `;
  document.body.appendChild(menu);
  currentMenu = menu;
  document.getElementById('restartBtn').onclick = () => {
    clickSound.currentTime = 0; clickSound.play();
    document.body.removeChild(menu);
    currentMenu = null;
    resetGame(mode === "single");
  };
  document.getElementById('mainMenuBtn').onclick = () => {
    clickSound.currentTime = 0; clickSound.play();
    document.body.removeChild(menu);
    showMainMenu();
  };
}

showMainMenu();
