const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const pauseBtn = document.getElementById('pauseBtn');
const soundBtn = document.getElementById('soundBtn');
const SIZES = {
    small: 10,
    normal: 20,
    large: 25
};

const THEMES = {
    night:  { bg: '#141b2d', board: '#1c2640', grid: '#212d4b', snake: '#7ee0b5', head: '#d4ffee', food: '#ff6b81' },
    pink:   { bg: '#2a1830', board: '#37203f', grid: '#402649', snake: '#ff9ec7', head: '#ffe3ef', food: '#ffd166' },
    forest: { bg: '#10231a', board: '#163326', grid: '#1b3d2d', snake: '#9be564', head: '#e9ffc9', food: '#ff6b6b' },
    christmas: { bg: '#0f2a1c', board: '#143a26', grid: '#194630', snake: '#ff5c5c', head: '#ffffff', food: '#ffd54a' }
};

const IMAGES = {};
['food', 'head', 'body'].forEach((name) => {
    const img = new Image();
    img.onload = () => {
        IMAGES[name] = img;
        render();
    };
    img.src = name + '.png';
});

let settings = loadSettings();
let GRID = SIZES[settings.size];
let CELL = canvas.width / GRID;
let theme = THEMES[settings.theme];

let snake;
let direction;
let nextDirection;
let food;
let score = 0;
let best = 0;
let running = false;
let over = false;
let paused = false;
let audioCtx = null;
let timer = null;

function loadSettings() {
    const fallback = { size: 'normal', theme: 'night', sound: true };
    try {
        const saved = JSON.parse(localStorage.getItem('snakeSettings'));
    if (saved && SIZES[saved.size] && THEMES[saved.theme]) return { sound: true, ...saved };
    } catch (e) {}
    return fallback;
}
function saveSettings() {
    try {
        localStorage.setItem('snakeSettings', JSON.stringify(settings));
    } catch (e) {}
}

function loadBest() {
    try {
        return Number(localStorage.getItem('snakeBest-' + settings.size)) || 0;
    } catch (e) {
        return 0;
    }
}

function saveBest() {
    try {
        localStorage.setItem('snakeBest-' + settings.size, best);
    } catch (e) {}
}

function applyTheme(name) {
    settings.theme = name;
    theme = THEMES[name];
    document.documentElement.style.setProperty('--bg', theme.bg);
    document.documentElement.style.setProperty('--board', theme.board);
    saveSettings();
    refreshChips();
    if (snake) render();
}

function applySize(name) {
    running = false;
    paused = false;
    clearTimeout(timer);
    settings.size = name;
    GRID = SIZES[name];
    CELL = canvas.width / GRID;
    best = loadBest();
    saveSettings();
    refreshChips();
    reset();
    render();
}

function refreshChips() {
    document.querySelectorAll('[data-size').forEach((btn) =>{
        btn.classList.toggle('active', btn.dataset.size === settings.size);
    });
    document.querySelectorAll('[data-theme').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });
    soundBtn.textContent = settings.sound ? 'Sound On' : 'Sound Off';
}

document.querySelectorAll('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => { applySize(btn.dataset.size); btn.blur(); });
});
document.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => { applyTheme(btn.dataset.theme); btn.blur(); });
});

function reset() {
    const mid = Math.floor(GRID / 2);
    snake = [
        { x: mid, y: mid },
        { x: mid - 1, y: mid },
        { x: mid - 2, y: mid }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = direction;
    score = 0;
    over = false;
    scoreEl.textContent = score;
    placeFood();
}

function placeFood() {
    let x, y;
    do {
        x = Math.floor(Math.random() * GRID);
        y = Math.floor(Math.random() * GRID);
    } while (snake.some(part => part.x === x && part. y === y));
    food = { x, y};
}

function step () {
    direction = nextDirection;

    const head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
    };

    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        return gameOver();
    }

    if (snake.some(part => part.x === head.x && part.y === head.y)) {
        return gameOver();
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score++;
        scoreEl.textContent = score;
        soundEat();
        placeFood();
    } else {
        snake.pop();
    }

    draw();
}

function loop() {
    step();
    if (running) {
        const delay = Math.max(60, 130 - score * 3);
        timer = setTimeout(loop, delay);
    }
}

const bgm = new Audio('bgm.mp3');
bgm.loop = true;
bgm.volume = 0.3;

function playMusic() {
    if (!settings.sound) return;
    bgm.play().catch(() => {        
    });
}

function stopMusic() {
    bgm.pause();
}

// 1hr

function start() {
    if (running) return;
    const resuming = paused;
    if (over) reset();
    paused = false;
    running = true;
    playMusic();
    if (resuming) {
        render();
        timer = setTimeout(loop, 400);
    } else {
        loop();
    }
}

function pause() {
    if (!running) return;
    running = false;
    paused = true;
    clearTimeout(timer);
    stopMusic();
    render();
}

function togglePause() {
    if (running) pause();
    else if (paused) start();
}

function beep(freq, duration, type = 'square', volume = 0.08, when = 0) {
    if (!settings.sound) return;
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t = audioCtx.currentTime + when;

        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + duration);
    } catch (e) {
    }
}

function soundEat() {
    beep(660, 0.08);
    beep(880, 0.12, 'square', 0.08, 0.07);
}

function soundOver() {
    beep(330, 0.15, 'sawtooth');
    beep(247, 0.15, 'sawtooth', 0.08, 0.15);
    beep(196, 0.3, 'sawtooth', 0.08, 0.3);
}

function gameOver() {
    running = false;
    paused = false;
    over = true;
    clearTimeout(timer);
    stopMusic();
    soundOver();
    if (score > best) {
        best = score;
        bestEl.textContent = best;
        saveBest();
    }
    render();
}

function draw() {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = theme.grid;
    for (let x = 0; x < GRID; x++) {
        for (let y = 0; y < GRID; y++) {
            if ((x + y) % 2 === 0) {
                ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
            }
        }
    }

    if (IMAGES.food) {
        ctx.drawImage(IMAGES.food, food.x * CELL, food.y * CELL, CELL, CELL);
    } else {
        ctx.fillStyle = theme.food;
        ctx.beginPath();
        ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.38, 0, Math.PI * 2);
        ctx.fill();
    }

    snake.forEach((part, i) => {
        const img = i === 0 ? IMAGES.head : IMAGES.body;
        if (img) {
            ctx.drawImage(img, part.x * CELL, part.y * CELL, CELL, CELL);
        } else {
            ctx.fillStyle = i === 0 ? theme.head : theme.snake;
            ctx.beginPath();
            ctx.roundRect(part.x * CELL + 1, part.y * CELL + 1, CELL - 2, CELL - 2, CELL * 0.3);
            ctx.fill();
        }
    });
}

function drawMessage(title, sub) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 6);
    ctx.font = '16px sans-serif';
    ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 24);
}

function render() {
    draw();
    pauseBtn.textContent = paused ? 'Continue' : 'Pause';
    if (!running) {
        if (paused) {
            drawMessage('Pause', 'Continue with Tap or Spacebar');
        } else if (over) {
            drawMessage('Game over', 'Score ' + score + ' Push tap to restart');
        } else {
            drawMessage('Snake', 'Start with Tap or Spacebar');
        }
    }
}

function setDirection(dx, dy) {
    if (dx === -direction.x && dy === -direction.y) return;
    nextDirection = { x: dx, y: dy };
}

const DIRECTIONS = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
};

document.addEventListener('keydown', (e) => {
    const keyMap = {
        ArrowUp: 'up', w: 'up', W: 'up',
        ArrowDown: 'down', s: 'down', S: 'down',
        ArrowLeft: 'left', a: 'left', A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right'
    };
    if (keyMap[e.key]) {
        e.preventDefault();
        setDirection(...DIRECTIONS[keyMap[e.key]]);
        start();
    } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (running) pause();
        else start();
    } else if (e.key === 'p' || e.key === 'p') {
        togglePause();
    }
});

document.querySelectorAll('.pad button').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setDirection(...DIRECTIONS[btn.dataset.dir]);
        start();
    });
});

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
        start();
    } else if (Math.abs(dx) > Math.abs(dy)) {
        setDirection(dx > 0 ? 1 : -1, 0);
        start();
    } else {
        setDirection(0, dy > 0 ? 1 : -1);
        start();
    }
}, { passive: false });

canvas.addEventListener('click', start);

pauseBtn.addEventListener('click', () => {
    togglePause();
    pauseBtn.blur();
});

soundBtn.addEventListener('click', () => {
    settings.sound = !settings.sound;
    saveSettings();
    refreshChips();
    beep(660, 0.1);
    if (settings.sound && running) playMusic();
    else stopMusic();
    soundBtn.blur();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
});

best = loadBest();
bestEl.textContent = best;
reset();
applyTheme(settings.theme);
refreshChips();

// 1:42 hr -- finish
// 1: 55 hr -- fix error

