// game.js

// === CONFIGURATION & ASSETS ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const sfxBubble = new Audio('bubble pop 6.ogg');
const sfxShoot = new Audio('shoot02.ogg');
sfxBubble.volume = 0.5; 
sfxShoot.volume = 0.3;

const NUM_TARGETS = 3;
const HIT_ANIM_DURATION = 0.3; 

// === DOM ELEMENTS ===
const titleScreen = document.getElementById('titleScreen');
const setupScreen = document.getElementById('setupScreen'); 
const modeSelectScreen = document.getElementById('modeSelectScreen');
const gameContainer = document.getElementById('gameContainer');
const overlay = document.getElementById('overlay');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const multiplierEl = document.getElementById('multiplier');
const timerEl = document.getElementById('timer');
const timeProgressBar = document.getElementById('timeProgressBar');

const btnDynamic = document.getElementById('btnDynamic');
const btnStatic = document.getElementById('btnStatic');
const btnStartGame = document.getElementById('btnStartGame');

// === GAME STATE ===
let score = 0;
let combo = 0;
let maxCombo = 0;
let totalShots = 0; 
let totalHits = 0;  
let multiplier = 1;

let timeLeft = 60;
let gameDuration = 60;
let running = false;
let isPaused = false;
let isResultsOpen = false;
let movingMode = true; 
let lastTimestamp = 0;
let animationFrameId;

let selectedMode = 'static'; 

// === SETTINGS STATE ===
let osuMode = false;
let useBreakAnim = true; 
let targetColor = "#ff0000ff";
let currentSoundType = 'bubble'; 
let mouseX = 0;
let mouseY = 0;
let settingsOrigin = 'pause'; 

// === CONFETTI MANAGER ===
let confettiManager = null;

// === INITIALIZATION ===
function init() {
    resize();
    window.addEventListener('resize', resize);
    
    const cCanvas = document.getElementById('confettiCanvas');
    if (cCanvas && window.confetti) {
        confettiManager = confetti.create(cCanvas, {
            resize: true,
            useWorker: true
        });
    }
    
    updateModeUI();
}

function resize() {
    canvas.width = 800;
    canvas.height = 600;
}

function resetConfetti() {
    if (confettiManager) {
        confettiManager.reset();
    }
}

function showScreen(screenName) {
    titleScreen.style.display = 'none';
    setupScreen.style.display = 'none';
    modeSelectScreen.style.display = 'none';
    gameContainer.style.display = 'none';
    overlay.style.display = 'none';
    
    resetConfetti();

    if (screenName === 'title') titleScreen.style.display = 'flex';
    if (screenName === 'setup') setupScreen.style.display = 'flex';
    if (screenName === 'mode') modeSelectScreen.style.display = 'flex';
    if (screenName === 'game') gameContainer.style.display = 'block';
}

// === TARGET SYSTEM ===
let targets = [];

function createTarget() {
    const radius = 25;
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = Math.random() * (canvas.height - radius * 2) + radius;
    const speed = Math.random() * 0.9 + 0.3;
    const vx = speed * (Math.random() < 0.5 ? -1 : 1);
    const vy = (Math.random() * 0.9 + 0.3) * (Math.random() < 0.5 ? -1 : 1);
    
    return { 
        x, y, radius, vx, vy,
        state: 'alive', 
        animTime: 0,
        particles: [] 
    };
}

function resetTargets() {
    targets = [];
    for (let i = 0; i < NUM_TARGETS; i++) {
        targets.push(createTarget());
    }
}

function spawnTarget(index) {
    targets[index] = createTarget();
}

function triggerBreakAnimation(t) {
    t.state = 'dying';
    t.animTime = 0;
    t.particles = [];
    
    const numParticles = 12;
    for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 150; 
        t.particles.push({
            x: t.x,
            y: t.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: HIT_ANIM_DURATION
        });
    }
}

function updateTargets(dt) {
    const dtSeconds = dt / 1000;

    targets.forEach((t, index) => {
        if (t.state === 'alive' && movingMode) {
            t.x += t.vx * dt * 0.06;
            t.y += t.vy * dt * 0.06;
            if (t.x - t.radius < 0) { t.x = t.radius; t.vx *= -1; }
            if (t.x + t.radius > canvas.width) { t.x = canvas.width - t.radius; t.vx *= -1; }
            if (t.y - t.radius < 0) { t.y = t.radius; t.vy *= -1; }
            if (t.y + t.radius > canvas.height) { t.y = canvas.height - t.radius; t.vy *= -1; }
        }
        else if (t.state === 'dying') {
            t.animTime += dtSeconds;
            
            t.particles.forEach(p => {
                p.x += p.vx * dtSeconds;
                p.y += p.vy * dtSeconds;
                p.life -= dtSeconds;
            });

            if (t.animTime >= HIT_ANIM_DURATION) {
                spawnTarget(index);
            }
        }
    });
}

function drawTargets() {
    targets.forEach(t => {
        if (t.state === 'alive') {
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fillStyle = targetColor;
            ctx.fill();
            ctx.lineWidth = 2;
        } 
        else if (t.state === 'dying') {
            const progress = t.animTime / HIT_ANIM_DURATION;
            const alpha = Math.max(0, 1 - progress);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius * (1 + progress * 0.3), 0, Math.PI * 2);
            ctx.fillStyle = targetColor;
            ctx.fill();
            
            t.particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); 
                ctx.fillStyle = targetColor;
                ctx.fill();
            });
            ctx.restore();
        }
    });
}

// === GAME LOOP ===
function startGame(modeType) {
    if (modeType === 'static') movingMode = false;
    else movingMode = true;

    score = 0;
    combo = 0;
    maxCombo = 0;
    totalShots = 0;
    totalHits = 0;
    multiplier = 1;
    timeLeft = gameDuration; 
    
    running = true;
    isPaused = false;
    isResultsOpen = false;
    
    resetConfetti();

    if (timeProgressBar) timeProgressBar.style.width = "0%";

    scoreEl.innerText = score;
    comboEl.innerText = combo;
    if (multiplierEl) multiplierEl.innerText = "1x";
    timerEl.innerText = timeLeft;

    resetTargets();
    showScreen('game');
    
    lastTimestamp = performance.now();
    cancelAnimationFrame(animationFrameId);
    loop(lastTimestamp);
}

function loop(timestamp) {
    if (!running) return;
    if (isPaused) {
        lastTimestamp = timestamp;
        animationFrameId = requestAnimationFrame(loop);
        return; 
    }
    const dt = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    timeLeft -= dt / 1000;

    if (gameDuration > 0) {
        const timeElapsed = gameDuration - timeLeft;
        const percent = (timeElapsed / gameDuration) * 100;
        if (timeProgressBar) {
            timeProgressBar.style.width = Math.min(100, percent) + "%";
        }
    }

    if (timeLeft <= 0) {
        endGame();
        return;
    }
    timerEl.innerText = Math.ceil(timeLeft);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateTargets(dt);
    drawTargets();

    animationFrameId = requestAnimationFrame(loop);
}

function endGame() {
    running = false;
    isResultsOpen = true;

    const accuracy = totalShots > 0 ? ((totalHits / totalShots) * 100).toFixed(1) : "0.0";
    
    document.getElementById('finalScore').innerText = score;
    document.getElementById('finalCombo').innerText = maxCombo;
    document.getElementById('finalAccuracy').innerText = accuracy + "%";

    overlay.style.display = 'flex';
    document.getElementById('taskCompleteMenu').style.display = 'flex';
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('settingsMenu').style.display = 'none';
    
    if (confettiManager) {
        confettiManager.reset(); 
        confettiManager({ 
            particleCount: 150, 
            spread: 100, 
            origin: { y: 0.6 }, 
            zIndex: 1 
        });
    }
}

// === INPUT HANDLING ===
function attemptHit(inputX, inputY) {
    if (!running || isPaused) return;
    
    totalShots++; 
    let hit = false;
    
    for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        
        if (t.state === 'dying') continue; 

        const dist = Math.hypot(inputX - t.x, inputY - t.y);
        if (dist < t.radius) {
            hit = true;
            
            let soundToPlay = (currentSoundType === 'bubble') ? sfxBubble : sfxShoot;
            soundToPlay.currentTime = 0; 
            soundToPlay.play();

            totalHits++; 
            
            combo++;
            if (combo > maxCombo) maxCombo = combo;
            
            multiplier = 1 + Math.floor(combo / 5);
            
            score += 2 * multiplier;
            
            if (useBreakAnim) {
                triggerBreakAnimation(t);
            } else {
                spawnTarget(i);
            }
            
            break; 
        }
    }
    
    if (!hit) {
        combo = 0;
        multiplier = 1;
        score = Math.max(0, score - 1);
    }
    
    scoreEl.innerText = score;
    comboEl.innerText = combo;
    if (multiplierEl) multiplierEl.innerText = multiplier + "x";
}

canvas.addEventListener('mousedown', () => attemptHit(mouseX, mouseY));
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});
window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && running) togglePause();
    if (osuMode && running && !isPaused && (e.code === 'KeyZ' || e.code === 'KeyX')) attemptHit(mouseX, mouseY);
});

// === INTRO & NAVIGATION ===
document.addEventListener('DOMContentLoaded', () => {
    const vidIntro = document.getElementById('vidIntro');
    const imgIdle = document.getElementById('imgIdle');
    const vidOutro = document.getElementById('vidOutro');
    const mediaContainer = document.getElementById('mediaSequence');
    const mainPlayBtn = document.getElementById('mainPlayBtn');
    
    function onIntroComplete() {
        vidIntro.style.display = 'none';
        if (imgIdle) imgIdle.style.display = 'block'; 
        titleScreen.style.display = 'flex'; 
    }

    if (vidIntro) {
        vidIntro.addEventListener('ended', onIntroComplete);
        if (vidIntro.ended) onIntroComplete();
    }

    if (mainPlayBtn) {
        mainPlayBtn.onclick = () => {
            titleScreen.style.display = 'none';
            if (imgIdle) imgIdle.style.display = 'none'; 
            
            if (vidOutro) {
                vidOutro.style.display = 'block'; 
                vidOutro.play();
            } else {
                showScreen('setup');
            }
        };
    }

    if (vidOutro) {
        vidOutro.addEventListener('ended', () => {
            vidOutro.style.display = 'none';
            showScreen('setup');
        });
    }
});

// === MENU INTERACTION ===
document.getElementById('btnGoToModes').onclick = () => {
    showScreen('mode');
};

document.getElementById('backToSetupBtn').onclick = () => {
    showScreen('setup');
};

document.getElementById('btnOpenSettingsFromSetup').onclick = () => {
    settingsOrigin = 'setup';
    overlay.style.display = 'flex';
    document.getElementById('settingsMenu').style.display = 'flex';
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('taskCompleteMenu').style.display = 'none';
};

function updateModeUI() {
    if (selectedMode === 'static') {
        btnStatic.classList.add('selected-mode');
        btnDynamic.classList.remove('selected-mode');
    } else {
        btnDynamic.classList.add('selected-mode');
        btnStatic.classList.remove('selected-mode');
    }
}

btnDynamic.onclick = () => {
    selectedMode = 'dynamic';
    updateModeUI();
};

btnStatic.onclick = () => {
    selectedMode = 'static';
    updateModeUI();
};

btnStartGame.onclick = () => {
    startGame(selectedMode);
};

const btnTimeToggle = document.getElementById('btnTimeToggle');
const timeTitle = document.getElementById('timeTitle');
const timeDesc = document.getElementById('timeDesc');

if (btnTimeToggle) {
    btnTimeToggle.onclick = () => {
        if (gameDuration === 60) {
            gameDuration = 30;
            timeTitle.innerText = "⚡ QUICK PLAY";
            timeDesc.innerText = "Time: 30s";
            btnTimeToggle.classList.remove('purple-card');
            btnTimeToggle.classList.add('gold-card');
        } else {
            gameDuration = 60;
            timeTitle.innerText = "⏱️ STANDARD";
            timeDesc.innerText = "Time: 60s";
            btnTimeToggle.classList.remove('gold-card');
            btnTimeToggle.classList.add('purple-card');
        }
    };
}

// === PAUSE SYSTEM ===
function togglePause() {
    isPaused = !isPaused;
    const pauseMenu = document.getElementById('pauseMenu');
    const settingsMenu = document.getElementById('settingsMenu');
    const taskCompleteMenu = document.getElementById('taskCompleteMenu');
    
    resetConfetti();

    if (isPaused) {
        overlay.style.display = 'flex';
        pauseMenu.style.display = 'flex';
        settingsMenu.style.display = 'none';
        taskCompleteMenu.style.display = 'none'; 
    } else {
        overlay.style.display = 'none';
    }
}
document.getElementById('resumeBtn').onclick = togglePause;
document.getElementById('btnPauseRestart').onclick = () => { togglePause(); startGame(selectedMode); }; 
document.getElementById('quitBtn').onclick = () => { togglePause(); running = false; showScreen('mode'); };

// === SETTINGS & RESULTS NAVIGATION ===
const modeSettingsBtn = document.getElementById('modeSettingsBtn');
if (modeSettingsBtn) {
    modeSettingsBtn.onclick = () => {
        settingsOrigin = 'mode';
        overlay.style.display = 'flex';
        document.getElementById('settingsMenu').style.display = 'flex';
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('taskCompleteMenu').style.display = 'none';
    };
}
document.getElementById('settingsBtn').onclick = () => {
    settingsOrigin = 'pause';
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('settingsMenu').style.display = 'flex';
};
document.getElementById('btnTaskSettings').onclick = () => {
    settingsOrigin = 'task';
    document.getElementById('taskCompleteMenu').style.display = 'none';
    document.getElementById('settingsMenu').style.display = 'flex';
};

document.getElementById('backBtn').onclick = () => {
    document.getElementById('settingsMenu').style.display = 'none';
    overlay.style.display = 'none'; 
    
    if (settingsOrigin === 'pause') {
        overlay.style.display = 'flex';
        document.getElementById('pauseMenu').style.display = 'flex';
    } else if (settingsOrigin === 'task') {
        overlay.style.display = 'flex';
        document.getElementById('taskCompleteMenu').style.display = 'flex';
    } 
};

document.getElementById('btnTaskRetry').onclick = () => {
    overlay.style.display = 'none';
    resetConfetti(); 
    startGame(selectedMode);
};
document.getElementById('btnTaskMode').onclick = () => {
    overlay.style.display = 'none';
    resetConfetti(); 
    showScreen('mode');
};

document.getElementById('osuToggle').onchange = (e) => osuMode = e.target.checked;
document.getElementById('colorPicker').oninput = (e) => targetColor = e.target.value;
document.getElementById('soundPicker').onchange = (e) => {
    currentSoundType = e.target.value;
    let preview = (currentSoundType === 'bubble') ? sfxBubble : sfxShoot;
    preview.currentTime = 0;
    preview.play();
};
document.getElementById('breakAnimToggle').onchange = (e) => {
    useBreakAnim = e.target.checked;
};

init();
