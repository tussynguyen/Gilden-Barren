// Game state
let gameState = {
    currentScreen: 'menu',
    score: 0,
    health: 100,
    waterCollected: 0,
    timeLeft: 60, // 1 minutes in seconds
    isGameRunning: false,
    isNightMode: false,
    keys: {},
    touchControls: {
        left: false,
        right: false,
        jump: false
    }
};

// Game objects
let player = {
    x: 100,
    y: 300,
    width: 51, // Increased from 30 (70% larger)
    height: 68, // Increased from 40 (70% larger)
    velocityX: 0,
    velocityY: 0,
    speed: 5,
    jumpPower: 15,
    onGround: false,
    color: '#e74c3c'
};

let waterDroplets = [];
let insects = [];
let gameInterval;
let timerInterval;

// Audio context for sound effects
let audioContext;
let isAudioInitialized = false;

// Initialize audio
function initAudio() {
    if (!isAudioInitialized) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        isAudioInitialized = true;
    }
}

// Sound effects
function playSound(frequency, duration, type = 'sine') {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playWaterSound() {
    playSound(800, 0.2, 'sine');
}

function playInsectSound() {
    playSound(200, 0.3, 'sawtooth');
}

// Screen management
function showScreen(screenName) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenName + '-screen').classList.add('active');
    gameState.currentScreen = screenName;
}

// Local storage for scores
function saveScore(score, water, time) {
    let scores = JSON.parse(localStorage.getItem('desertWaterScores') || '[]');
    scores.push({
        score: score,
        water: water,
        time: time,
        date: new Date().toLocaleDateString()
    });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10); // Keep top 10
    localStorage.setItem('desertWaterScores', JSON.stringify(scores));
}

function loadScores() {
    const scores = JSON.parse(localStorage.getItem('desertWaterScores') || '[]');
    const scoresList = document.getElementById('scores-list');
    
    if (scores.length === 0) {
        scoresList.innerHTML = '<p>No scores yet. Play to set a record!</p>';
        return;
    }
    
    scoresList.innerHTML = scores.map((score, index) => `
        <div class="score-item">
            <span>#${index + 1}</span>
            <span>Score: ${score.score}</span>
            <span>Water: ${score.water}</span>
            <span>${score.date}</span>
        </div>
    `).join('');
}

// Game initialization
function initGame() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // Responsive canvas sizing
    resizeCanvas(canvas);
    
    // Reset game state
    gameState.score = 0;
    gameState.health = 100;
    gameState.waterCollected = 0;
    gameState.timeLeft = 60; // Changed from 180 to 60 seconds (1 minute)
    gameState.isGameRunning = true;
    gameState.isNightMode = false;
    
    // Reset player
    player.x = 100;
    player.y = 300;
    player.velocityX = 0;
    player.velocityY = 0;
    player.onGround = false;
    
    // Clear objects
    waterDroplets = [];
    insects = [];
    
    // Update UI
    updateUI();
    
    // Start game loop
    gameInterval = setInterval(() => {
        update();
        draw(ctx, canvas);
    }, 1000 / 60); // 60 FPS
    
    // Start timer
    timerInterval = setInterval(() => {
        gameState.timeLeft--;
        updateUI();
        
        // Switch to night mode at halfway point
        if (gameState.timeLeft === 30 && !gameState.isNightMode) { // Changed from 90 to 30 seconds
            gameState.isNightMode = true;
            canvas.classList.remove('day-mode');
            canvas.classList.add('night-mode');
        }
        
        if (gameState.timeLeft <= 0) {
            endGame();
        }
    }, 1000);
    
    // Spawn objects
    setInterval(spawnWaterDroplet, 2000);
    setInterval(spawnInsect, 3000);
}

function spawnWaterDroplet() {
    if (!gameState.isGameRunning) return;
    
    waterDroplets.push({
        x: Math.random() * 750 + 50,
        y: 50,
        width: 70, // Increased from 50
        height: 70, // Increased from 50
        velocityY: 2,
        collected: false
    });
}

function spawnInsect() {
    if (!gameState.isGameRunning) return;
    
    // Generate a random Y position
    let newY = Math.random() * 100 + 250;
    
    // Check if there's already a spider too close to this position
    const minDistance = 80; // Minimum distance between spiders
    const tooClose = insects.some(insect => 
        Math.abs(insect.y - newY) < minDistance && 
        insect.x > 600 // Only check spiders that are still relatively close
    );
    
    // If there's a spider too close, try a different Y position
    if (tooClose) {
        // Try 3 different positions
        for (let attempts = 0; attempts < 3; attempts++) {
            newY = Math.random() * 100 + 250;
            const stillTooClose = insects.some(insect => 
                Math.abs(insect.y - newY) < minDistance && 
                insect.x > 600
            );
            if (!stillTooClose) break;
        }
    }
    
    insects.push({
        x: 850,
        y: newY,
        width: 40, // Reduced from 80 to make spiders smaller
        height: 40, // Reduced from 70 to make spiders smaller
        velocityX: -1.7, // Reduced from -3 to make spiders slower
        hit: false
    });
}

function update() {
    if (!gameState.isGameRunning) return;
    
    // Update player physics
    updatePlayer();
    
    // Update water droplets
    waterDroplets.forEach((droplet, index) => {
        droplet.y += droplet.velocityY;
        
        // Check collision with player
        if (!droplet.collected && 
            player.x < droplet.x + droplet.width &&
            player.x + player.width > droplet.x &&
            player.y < droplet.y + droplet.height &&
            player.y + player.height > droplet.y) {
            
            droplet.collected = true;
            gameState.score += 3;
            gameState.waterCollected++;
            playWaterSound();
            updateUI();
        }
        
        // Remove if off screen
        if (droplet.y > 400) {
            waterDroplets.splice(index, 1);
        }
    });
    
    // Update insects
    insects.forEach((insect, index) => {
        insect.x += insect.velocityX;
        
        // Check collision with player
        if (!insect.hit && 
            player.x < insect.x + insect.width &&
            player.x + player.width > insect.x &&
            player.y < insect.y + insect.height &&
            player.y + player.height > insect.y) {
            
            insect.hit = true;
            gameState.score = Math.max(0, gameState.score - 5);
            gameState.health = Math.max(0, gameState.health - 20);
            playInsectSound();
            updateUI();
            
            if (gameState.health <= 0) {
                endGame();
            }
        }
        
        // Remove if off screen
        if (insect.x < -insect.width) {
            insects.splice(index, 1);
        }
    });
}

function updatePlayer() {
    // Horizontal movement
    if (gameState.keys['ArrowLeft'] || gameState.touchControls.left) {
        player.velocityX = -player.speed;
    } else if (gameState.keys['ArrowRight'] || gameState.touchControls.right) {
        player.velocityX = player.speed;
    } else {
        player.velocityX = 0;
    }
    
    // Jumping
    if ((gameState.keys[' '] || gameState.touchControls.jump) && player.onGround) {
        player.velocityY = -player.jumpPower;
        player.onGround = false;
    }
    
    // Apply gravity
    player.velocityY += 0.6;
    
    // Update position
    player.x += player.velocityX;
    player.y += player.velocityY;
    
    // Boundaries
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > 800) player.x = 800 - player.width;
    
    // Ground collision
    if (player.y + player.height >= 360) {
        player.y = 360 - player.height;
        player.velocityY = 0;
        player.onGround = true;
    }
}

let playerImage = new Image();
playerImage.src = 'images/main character flipped.png'; // Use a flipped image for better visibility

// Add water droplet image
let waterImage = new Image();
waterImage.src = 'images/water.png';

// Add spider image
let spiderImage = new Image();
spiderImage.src = 'images/spider.png';

function draw(ctx, canvas) {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    if (gameState.isNightMode) {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#2c3e50');
        gradient.addColorStop(0.5, '#34495e');
        gradient.addColorStop(1, '#2c3e50');
        ctx.fillStyle = gradient;
    } else {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.5, '#F4A460');
        gradient.addColorStop(1, '#DEB887');
        ctx.fillStyle = gradient;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw ground
    ctx.fillStyle = gameState.isNightMode ? '#34495e' : '#8B4513';
    ctx.fillRect(0, 360, canvas.width, 40);
    
    // Draw player - use image instead of pixel art
    ctx.imageSmoothingEnabled = false;
    if (playerImage.complete) {
        ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
    } else {
        // Fallback to simple rectangle if image not loaded
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }
    
    // Draw water droplets - use image instead of circles
    waterDroplets.forEach(droplet => {
        if (!droplet.collected) {
            ctx.imageSmoothingEnabled = false;
            if (waterImage.complete) {
                ctx.drawImage(waterImage, droplet.x, droplet.y, droplet.width, droplet.height);
            } else {
                // Fallback to circle if image not loaded
                ctx.fillStyle = '#3498db';
                ctx.beginPath();
                ctx.arc(droplet.x + droplet.width/2, droplet.y + droplet.height/2, droplet.width/2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });
    
    // Draw insects - use spider image instead of pixel art
    insects.forEach(insect => {
        if (!insect.hit) {
            ctx.imageSmoothingEnabled = false;
            if (spiderImage.complete) {
                ctx.drawImage(spiderImage, insect.x, insect.y, insect.width, insect.height);
            } else {
                // Fallback to rectangle if image not loaded
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(insect.x, insect.y, insect.width, insect.height);
                // Add simple pixel details
                ctx.fillStyle = '#c0392b';
                ctx.fillRect(insect.x + 2, insect.y + 2, insect.width - 4, insect.height - 4);
            }
        }
    });
}

function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('health-text').textContent = gameState.health;
    document.getElementById('health-fill').style.width = gameState.health + '%';
    document.getElementById('water-count').textContent = gameState.waterCollected;
    
    const minutes = Math.floor(gameState.timeLeft / 60);
    const seconds = gameState.timeLeft % 60;
    document.getElementById('timer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function endGame() {
    gameState.isGameRunning = false;
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    
    // Save score
    const timeSurvived = 60 - gameState.timeLeft;
    saveScore(gameState.score, gameState.waterCollected, timeSurvived);
    
    // Check if player won (survived the full minute)
    if (gameState.timeLeft <= 0 && gameState.health > 0) {
        // Player won!
        showWinScreen();
    } else {
        // Player lost
        showGameOverScreen();
    }
}

function showWinScreen() {
    // Update win screen
    document.getElementById('win-final-score').textContent = gameState.score;
    document.getElementById('win-final-water').textContent = gameState.waterCollected;
    document.getElementById('win-time-survived').textContent = '1:00';
    
    // Generate confetti
    generateConfetti();
    
    showScreen('win');
}

function showGameOverScreen() {
    // Update game over screen
    const timeSurvived = 60 - gameState.timeLeft;
    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('final-water').textContent = gameState.waterCollected;
    const minutes = Math.floor(timeSurvived / 60);
    const seconds = timeSurvived % 60;
    document.getElementById('time-survived').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    showScreen('game-over');
}

function generateConfetti() {
    const confettiContainer = document.querySelector('.confetti-container');
    confettiContainer.innerHTML = ''; // Clear existing confetti
    
    // Generate 50 confetti pieces
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Random horizontal position
        confetti.style.left = Math.random() * 100 + '%';
        
        // Random animation delay
        confetti.style.animationDelay = Math.random() * 3 + 's';
        
        // Random animation duration
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        
        // Random size
        const size = Math.random() * 8 + 6;
        confetti.style.width = size + 'px';
        confetti.style.height = size + 'px';
        
        confettiContainer.appendChild(confetti);
    }
    
    // Clean up confetti after 6 seconds
    setTimeout(() => {
        confettiContainer.innerHTML = '';
    }, 6000);
}

// Add responsive canvas function
function resizeCanvas(canvas) {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth - 32; // Account for padding
    const maxWidth = 800;
    const aspectRatio = 400 / 800; // height / width
    
    let canvasWidth = Math.min(containerWidth, maxWidth);
    let canvasHeight = canvasWidth * aspectRatio;
    
    // Ensure minimum playable size
    if (canvasWidth < 320) {
        canvasWidth = 320;
        canvasHeight = 160;
    }
    
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    
    // Adjust game objects for smaller screens
    if (canvasWidth < 600) {
        player.speed = 4; // Slightly slower on mobile
        player.jumpPower = 12;
    } else {
        player.speed = 5;
        player.jumpPower = 15;
    }
}

// Add window resize handler
window.addEventListener('resize', () => {
    const canvas = document.getElementById('game-canvas');
    if (canvas && gameState.isGameRunning) {
        resizeCanvas(canvas);
    }
});

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Menu buttons
    document.getElementById('start-btn').addEventListener('click', () => {
        initAudio();
        showScreen('game');
        initGame();
    });
    
    document.getElementById('instructions-btn').addEventListener('click', () => {
        showScreen('instructions');
    });
    
    document.getElementById('scores-btn').addEventListener('click', () => {
        loadScores();
        showScreen('scores');
    });
    
    document.getElementById('exit-btn').addEventListener('click', () => {
        window.close();
    });
    
    // Back to menu buttons
    document.getElementById('back-to-menu').addEventListener('click', () => {
        showScreen('menu');
    });
    
    document.getElementById('back-to-menu-scores').addEventListener('click', () => {
        showScreen('menu');
    });
    
    // Game over buttons
    document.getElementById('restart-btn').addEventListener('click', () => {
        showScreen('game');
        initGame();
    });
    
    document.getElementById('home-btn').addEventListener('click', () => {
        showScreen('menu');
    });
    
    // Win screen buttons
    document.getElementById('win-restart-btn').addEventListener('click', () => {
        showScreen('game');
        initGame();
    });
    
    document.getElementById('win-home-btn').addEventListener('click', () => {
        showScreen('menu');
    });
    
    // Mobile controls
    document.getElementById('left-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        gameState.touchControls.left = true;
    });
    
    document.getElementById('left-btn').addEventListener('touchend', (e) => {
        e.preventDefault();
        gameState.touchControls.left = false;
    });
    
    document.getElementById('right-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        gameState.touchControls.right = true;
    });
    
    document.getElementById('right-btn').addEventListener('touchend', (e) => {
        e.preventDefault();
        gameState.touchControls.right = false;
    });
    
    document.getElementById('jump-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        gameState.touchControls.jump = true;
    });
    
    document.getElementById('jump-btn').addEventListener('touchend', (e) => {
        e.preventDefault();
        gameState.touchControls.jump = false;
    });
    
    // Mouse controls for desktop
    document.getElementById('left-btn').addEventListener('mousedown', () => {
        gameState.touchControls.left = true;
    });
    
    document.getElementById('left-btn').addEventListener('mouseup', () => {
        gameState.touchControls.left = false;
    });
    
    document.getElementById('right-btn').addEventListener('mousedown', () => {
        gameState.touchControls.right = true;
    });
    
    document.getElementById('right-btn').addEventListener('mouseup', () => {
        gameState.touchControls.right = false;
    });
    
    document.getElementById('jump-btn').addEventListener('mousedown', () => {
        gameState.touchControls.jump = true;
    });
    
    document.getElementById('jump-btn').addEventListener('mouseup', () => {
        gameState.touchControls.jump = false;
    });
    
    // Enhanced mobile controls with haptic feedback
    const mobileControlBtns = document.querySelectorAll('.control-btn');
    
    mobileControlBtns.forEach(btn => {
        // Add visual feedback for touch
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            btn.style.transform = 'scale(0.95)';
            btn.style.opacity = '0.8';
            
            // Haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.style.transform = '';
            btn.style.opacity = '';
        });
        
        // Prevent text selection on mobile
        btn.addEventListener('selectstart', (e) => e.preventDefault());
    });
    
    // Prevent zoom on double tap for game area
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    gameState.keys[e.key] = true;
    if (e.key === ' ') {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.key] = false;
});

// Prevent context menu on mobile controls
document.addEventListener('contextmenu', (e) => {
    if (e.target.classList.contains('control-btn')) {
        e.preventDefault();
    }
});

// Initialize scores on load
loadScores();
        
// Start the game loop
setTimeout(() => {
    initAudio();
    showScreen('menu');
    initGame();
}, 100);