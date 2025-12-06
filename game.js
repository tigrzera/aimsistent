// game.js

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// sounds
const popSound = new Audio('bubble pop 6.ogg');
const shotSound = new Audio('shoot02.ogg');
popSound.volume = 0.5; 
shotSound.volume = 0.3;

// dom stuff
const titleScrn = document.getElementById('title-screen');
const setupScrn = document.getElementById('setup-screen'); 
const modeScrn = document.getElementById('mode-screen');
const gameWrap = document.getElementById('main-wrap');
const overlayBg = document.getElementById('overlay-bg');
const scoreTxt = document.getElementById('score-val');
const comboTxt = document.getElementById('combo-val');
const multTxt = document.getElementById('mult-val');
const timerTxt = document.getElementById('timer-val');
const barFill = document.getElementById('bar-fill');

const dynBtn = document.getElementById('mode-dynamic');
const staBtn = document.getElementById('mode-static');
const startBtn = document.getElementById('start-btn');

// vars
let score = 0;
let combo = 0;
let bestCombo = 0;
let shots = 0; 
let hits = 0;  
let mult = 1;

let timeLeft = 60;
let maxTime = 60;
let gameActive = false;
let paused = false;
let moving = true; 
let lastTime = 0;
let loopId;

let currentMode = 'static'; 

// settings
let osuKeys = false;
let doBreakAnim = false; 
let ballColor = "#ff0000ff";
let soundType = 'bubble'; 
let mx = 0;
let my = 0;
let fromMenu = 'pause'; 

let confettiObj = null;

function setup() {
    doResize();
    window.addEventListener('resize', doResize);
    
    const pCanvas = document.getElementById('particles');
    if (pCanvas && window.confetti) {
        confettiObj = confetti.create(pCanvas, {
            resize: true,
            useWorker: true
        });
    }
    
    uiUpdate();
    showSlides(1); // init carousel
}

function doResize() {
    canvas.width = 800;
    canvas.height = 600;
}

function clearConfetti() {
    if (confettiObj) {
        confettiObj.reset();
    }
}

function switchScreen(name) {
    titleScrn.style.display = 'none';
    setupScrn.style.display = 'none';
    modeScrn.style.display = 'none';
    gameWrap.style.display = 'none';
    overlayBg.style.display = 'none';
    
    clearConfetti();

    if (name === 'title') titleScrn.style.display = 'flex';
    if (name === 'setup') setupScrn.style.display = 'flex';
    if (name === 'mode') modeScrn.style.display = 'flex';
    if (name === 'game') gameWrap.style.display = 'block';
}

// balls
let balls = [];

function makeBall() {
    const r = 25;
    const x = Math.random() * (canvas.width - r * 2) + r;
    const y = Math.random() * (canvas.height - r * 2) + r;
    const s = Math.random() * 0.9 + 0.3;
    const vx = s * (Math.random() < 0.5 ? -1 : 1);
    const vy = (Math.random() * 0.9 + 0.3) * (Math.random() < 0.5 ? -1 : 1);
    
    return { 
        x, y, r, vx, vy,
        status: 'alive', 
        t: 0,
        parts: [] 
    };
}

function resetBalls() {
    balls = [];
    for (let i = 0; i < 3; i++) {
        balls.push(makeBall());
    }
}

function respawn(i) {
    balls[i] = makeBall();
}

function breakBall(b) {
    b.status = 'dying';
    b.t = 0;
    b.parts = [];
    
    for (let i = 0; i < 12; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 100 + Math.random() * 150; 
        b.parts.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.3
        });
    }
}

function moveBalls(dt) {
    const sec = dt / 1000;

    balls.forEach((b, i) => {
        if (b.status === 'alive' && moving) {
            b.x += b.vx * dt * 0.06;
            b.y += b.vy * dt * 0.06;
            // bounce
            if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; }
            if (b.x + b.r > canvas.width) { b.x = canvas.width - b.r; b.vx *= -1; }
            if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }
            if (b.y + b.r > canvas.height) { b.y = canvas.height - b.r; b.vy *= -1; }
        }
        else if (b.status === 'dying') {
            b.t += sec;
            
            b.parts.forEach(p => {
                p.x += p.vx * sec;
                p.y += p.vy * sec;
                p.life -= sec;
            });

            if (b.t >= 0.3) {
                respawn(i);
            }
        }
    });
}

function render() {
    balls.forEach(b => {
        if (b.status === 'alive') {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = ballColor;
            ctx.fill();
            ctx.lineWidth = 2;
        } 
        else if (b.status === 'dying') {
            const prog = b.t / 0.3;
            const alph = Math.max(0, 1 - prog);

            ctx.save();
            ctx.globalAlpha = alph;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r * (1 + prog * 0.3), 0, Math.PI * 2);
            ctx.fillStyle = ballColor;
            ctx.fill();
            
            b.parts.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); 
                ctx.fillStyle = ballColor;
                ctx.fill();
            });
            ctx.restore();
        }
    });
}

function play(mode) {
    if (mode === 'static') moving = false;
    else moving = true;

    score = 0;
    combo = 0;
    bestCombo = 0;
    shots = 0;
    hits = 0;
    mult = 1;
    timeLeft = maxTime; 
    
    gameActive = true;
    paused = false;
    
    clearConfetti();

    if (barFill) barFill.style.width = "0%";

    scoreTxt.innerText = score;
    comboTxt.innerText = combo;
    if (multTxt) multTxt.innerText = "1x";
    timerTxt.innerText = timeLeft;

    resetBalls();
    switchScreen('game');
    
    lastTime = performance.now();
    cancelAnimationFrame(loopId);
    loop(lastTime);
}

function loop(ts) {
    if (!gameActive) return;
    if (paused) {
        lastTime = ts;
        loopId = requestAnimationFrame(loop);
        return; 
    }
    const dt = ts - lastTime;
    lastTime = ts;

    timeLeft -= dt / 1000;

    if (maxTime > 0) {
        const elap = maxTime - timeLeft;
        const per = (elap / maxTime) * 100;
        if (barFill) {
            barFill.style.width = Math.min(100, per) + "%";
        }
    }

    if (timeLeft <= 0) {
        gameOver();
        return;
    }
    timerTxt.innerText = Math.ceil(timeLeft);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    moveBalls(dt);
    render();

    loopId = requestAnimationFrame(loop);
}

function gameOver() {
    gameActive = false;

    const acc = shots > 0 ? ((hits / shots) * 100).toFixed(1) : "0.0";
    
    document.getElementById('end-score').innerText = score;
    document.getElementById('end-combo').innerText = bestCombo;
    document.getElementById('end-acc').innerText = acc + "%";

    overlayBg.style.display = 'flex';
    document.getElementById('end-menu').style.display = 'flex';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('settings-menu').style.display = 'none';
    document.getElementById('credits-panel').style.display = 'none';
    
    if (confettiObj) {
        confettiObj.reset(); 
        confettiObj({ 
            particleCount: 150, 
            spread: 100, 
            origin: { y: 0.6 }, 
            zIndex: 1 
        });
    }
}

// input
function checkHit(x, y) {
    if (!gameActive || paused) return;
    
    shots++; 
    let gotOne = false;
    
    for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        
        if (b.status === 'dying') continue; 

        const d = Math.hypot(x - b.x, y - b.y);
        if (d < b.r) {
            gotOne = true;
            
            let snd = (soundType === 'bubble') ? popSound : shotSound;
            snd.currentTime = 0; 
            snd.play();

            hits++; 
            
            combo++;
            if (combo > bestCombo) bestCombo = combo;
            
            mult = 1 + Math.floor(combo / 5);
            
            score += 2 * mult;
            
            if (doBreakAnim) {
                breakBall(b);
            } else {
                respawn(i);
            }
            
            break; 
        }
    }
    
    if (!gotOne) {
        combo = 0;
        mult = 1;
        score = Math.max(0, score - 1);
    }
    
    scoreTxt.innerText = score;
    comboTxt.innerText = combo;
    if (multTxt) multTxt.innerText = mult + "x";
}

canvas.addEventListener('mousedown', () => checkHit(mx, my));
canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
});
window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && gameActive) togglePause();
    if (osuKeys && gameActive && !paused && (e.code === 'KeyZ' || e.code === 'KeyX')) checkHit(mx, my);
});

// intro
document.addEventListener('DOMContentLoaded', () => {
    const v1 = document.getElementById('vid-intro');
    const img = document.getElementById('img-idle');
    const v2 = document.getElementById('vid-outro');
    const playBtn = document.getElementById('play-now');
    
    function doneIntro() {
        v1.style.display = 'none';
        if (img) img.style.display = 'block'; 
        titleScrn.style.display = 'flex'; 
    }

    if (v1) {
        v1.addEventListener('ended', doneIntro);
        if (v1.ended) doneIntro();
    }

    if (playBtn) {
        playBtn.onclick = () => {
            titleScrn.style.display = 'none';
            if (img) img.style.display = 'none'; 
            
            if (v2) {
                v2.style.display = 'block'; 
                v2.play();
            } else {
                switchScreen('setup');
            }
        };
    }

    if (v2) {
        v2.addEventListener('ended', () => {
            v2.style.display = 'none';
            switchScreen('setup');
        });
    }
});

// credits
document.getElementById('credit-link').onclick = () => {
    overlayBg.style.display = 'flex';
    document.getElementById('credits-panel').style.display = 'flex';
    document.getElementById('settings-menu').style.display = 'none';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('end-menu').style.display = 'none';
};

document.getElementById('close-creds').onclick = () => {
    document.getElementById('credits-panel').style.display = 'none';
    overlayBg.style.display = 'none';
};

// nav
document.getElementById('next-btn').onclick = () => {
    switchScreen('mode');
};

document.getElementById('setup-back').onclick = () => {
    switchScreen('setup');
};

document.getElementById('setup-settings').onclick = () => {
    fromMenu = 'setup';
    overlayBg.style.display = 'flex';
    document.getElementById('settings-menu').style.display = 'flex';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('end-menu').style.display = 'none';
};

// mode ui
function uiUpdate() {
    if (currentMode === 'static') {
        staBtn.classList.add('active');
        dynBtn.classList.remove('active');
    } else {
        dynBtn.classList.add('active');
        staBtn.classList.remove('active');
    }
}

dynBtn.onclick = () => {
    currentMode = 'dynamic';
    uiUpdate();
};

staBtn.onclick = () => {
    currentMode = 'static';
    uiUpdate();
};

startBtn.onclick = () => {
    play(currentMode);
};

const timeBtn = document.getElementById('time-toggle');
const tTitle = document.getElementById('time-title');
const tDesc = document.getElementById('time-desc');

if (timeBtn) {
    timeBtn.onclick = () => {
        if (maxTime === 60) {
            maxTime = 30;
            tTitle.innerText = "⚡ QUICK PLAY";
            tDesc.innerText = "Time: 30s";
            timeBtn.classList.remove('card-purp');
            timeBtn.classList.add('card-gold');
        } else {
            maxTime = 60;
            tTitle.innerText = "⏱️ STANDARD";
            tDesc.innerText = "Time: 60s";
            timeBtn.classList.remove('card-gold');
            timeBtn.classList.add('card-purp');
        }
    };
}

// pause
function togglePause() {
    paused = !paused;
    const pMenu = document.getElementById('pause-menu');
    const sMenu = document.getElementById('settings-menu');
    const eMenu = document.getElementById('end-menu');
    
    clearConfetti();

    if (paused) {
        overlayBg.style.display = 'flex';
        pMenu.style.display = 'flex';
        sMenu.style.display = 'none';
        eMenu.style.display = 'none'; 
        document.getElementById('credits-panel').style.display = 'none';
    } else {
        overlayBg.style.display = 'none';
    }
}
document.getElementById('resume-btn').onclick = togglePause;
document.getElementById('restart-btn').onclick = () => { togglePause(); play(currentMode); }; 
document.getElementById('quit-btn').onclick = () => { togglePause(); gameActive = false; switchScreen('mode'); };

// settings
const modeSetBtn = document.getElementById('mode-set-btn');
if (modeSetBtn) {
    modeSetBtn.onclick = () => {
        fromMenu = 'mode';
        overlayBg.style.display = 'flex';
        document.getElementById('settings-menu').style.display = 'flex';
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('end-menu').style.display = 'none';
    };
}
document.getElementById('open-set').onclick = () => {
    fromMenu = 'pause';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('settings-menu').style.display = 'flex';
};
document.getElementById('task-set').onclick = () => {
    fromMenu = 'task';
    document.getElementById('end-menu').style.display = 'none';
    document.getElementById('settings-menu').style.display = 'flex';
};

document.getElementById('back-set').onclick = () => {
    document.getElementById('settings-menu').style.display = 'none';
    overlayBg.style.display = 'none'; 
    
    if (fromMenu === 'pause') {
        overlayBg.style.display = 'flex';
        document.getElementById('pause-menu').style.display = 'flex';
    } else if (fromMenu === 'task') {
        overlayBg.style.display = 'flex';
        document.getElementById('end-menu').style.display = 'flex';
    } 
};

document.getElementById('retry-btn').onclick = () => {
    overlayBg.style.display = 'none';
    clearConfetti(); 
    play(currentMode);
};
document.getElementById('menu-btn').onclick = () => {
    overlayBg.style.display = 'none';
    clearConfetti(); 
    switchScreen('mode');
};

document.getElementById('osu-box').onchange = (e) => osuKeys = e.target.checked;
document.getElementById('col-pick').oninput = (e) => ballColor = e.target.value;
document.getElementById('snd-pick').onchange = (e) => {
    soundType = e.target.value;
    let s = (soundType === 'bubble') ? popSound : shotSound;
    s.currentTime = 0;
    s.play();
};
document.getElementById('brk-box').onchange = (e) => {
    doBreakAnim = e.target.checked;
};

// carousel logic
let slideIdx = 1;

function moveSlide(n) {
  showSlides(slideIdx += n);
}

function currentSlide(n) {
  showSlides(slideIdx = n);
}

function showSlides(n) {
  let i;
  let slides = document.getElementsByClassName("my-slide");
  let dots = document.getElementsByClassName("dot");
  
  if (n > slides.length) {slideIdx = 1}
  if (n < 1) {slideIdx = slides.length}
  
  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active-dot", "");
  }
  
  slides[slideIdx-1].style.display = "block";
  dots[slideIdx-1].className += " active-dot";
}

setup();
