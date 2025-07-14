// Game state
let gameState = {
    currentScreen: 'menu',
    score: 0,
    health: 100,
    waterCollected: 0,
    timeLeft: 60, // Will be set based on difficulty
    isGameRunning: false,
    isNightMode: false,
    difficulty: 'normal',
    lastDitchDamage: 0, // Timestamp of last ditch damage
    keys: {},
    touchControls: {
        left: false,
        right: false,
        jump: false
    }
};

// Difficulty settings
const difficultySettings = {
    easy: {
        timeLimit: 90,
        winCondition: 15,
        waterSpawnRate: 3000, // Every 3 seconds
        insectSpawnRate: 4500, // Every 4.5 seconds
        insectSpeed: -1.2,
        nightModeStart: 45, // At 45 seconds left
        healthPenalty: 15,
        scorePenalty: 3
    },
    normal: {
        timeLimit: 60,
        winCondition: 20,
        waterSpawnRate: 2000, // Every 2 seconds
        insectSpawnRate: 3000, // Every 3 seconds
        insectSpeed: -1.7,
        nightModeStart: 30, // At 30 seconds left
        healthPenalty: 20,
        scorePenalty: 5
    },
    hard: {
        timeLimit: 45,
        winCondition: 25,
        waterSpawnRate: 1500, // Every 1.5 seconds
        insectSpawnRate: 2000, // Every 2 seconds
        insectSpeed: -2.5,
        nightModeStart: 22, // At 22 seconds left
        healthPenalty: 25,
        scorePenalty: 7
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

// Platform system for Mario-style gameplay
let platforms = [
    { x: 0, y: 360, width: 200, height: 40 },      // Starting platform
    { x: 250, y: 360, width: 150, height: 40 },    // Platform with gap
    { x: 450, y: 360, width: 100, height: 40 },    // Small platform
    { x: 600, y: 360, width: 200, height: 40 },    // End platform
];

// Ditch areas (gaps between platforms)
let ditches = [
    { x: 200, y: 360, width: 50, height: 40 },     // First ditch
    { x: 400, y: 360, width: 50, height: 40 },     // Second ditch  
    { x: 550, y: 360, width: 50, height: 40 },     // Third ditch
];

let waterDroplets = [];
let insects = [];
let gameInterval;
let timerInterval;
let waterSpawnInterval;
let insectSpawnInterval;

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

function playVictorySound() {
    // Play a celebratory sound sequence
    if (!audioContext) return;
    
    // Main victory chord
    playSound(523, 0.4, 'sine'); // C
    setTimeout(() => playSound(659, 0.4, 'sine'), 100); // E
    setTimeout(() => playSound(784, 0.4, 'sine'), 200); // G
    setTimeout(() => playSound(1047, 0.6, 'sine'), 300); // High C
    
    // Add some sparkle
    setTimeout(() => {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                playSound(1200 + (i * 100), 0.1, 'sine');
            }, i * 50);
        }
    }, 800);
}

// Night mode announcement
function showNightModeAnnouncement() {
    const announcement = document.getElementById('night-mode-announcement');
    announcement.classList.remove('hidden');
    
    // Hide after 2 seconds
    setTimeout(() => {
        announcement.style.animation = 'nightModeSlideOut 0.5s ease-in';
        setTimeout(() => {
            announcement.classList.add('hidden');
            announcement.style.animation = ''; // Reset animation
        }, 500);
    }, 2000);
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
        difficulty: gameState.difficulty,
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
            <span>${score.difficulty ? score.difficulty.charAt(0).toUpperCase() + score.difficulty.slice(1) : 'Normal'}</span>
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
    
    // Get current difficulty settings
    const settings = difficultySettings[gameState.difficulty];
    
    // Reset game state
    gameState.score = 0;
    gameState.health = 100;
    gameState.waterCollected = 0;
    gameState.timeLeft = settings.timeLimit;
    gameState.isGameRunning = true;
    gameState.isNightMode = false;
    gameState.lastDitchDamage = 0;
    
    // Reset player
    player.x = 100;
    player.y = 300;
    player.velocityX = 0;
    player.velocityY = 0;
    player.onGround = false;
    
    // Clear objects
    waterDroplets = [];
    insects = [];
    
    // Clear any existing intervals
    if (waterSpawnInterval) clearInterval(waterSpawnInterval);
    if (insectSpawnInterval) clearInterval(insectSpawnInterval);
    
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
        
        // Switch to night mode based on difficulty
        if (gameState.timeLeft === settings.nightModeStart && !gameState.isNightMode) {
            gameState.isNightMode = true;
            canvas.classList.remove('day-mode');
            canvas.classList.add('night-mode');
            showNightModeAnnouncement();
        }
        
        if (gameState.timeLeft <= 0) {
            endGame();
        }
    }, 1000);
    
    // Spawn objects based on difficulty
    waterSpawnInterval = setInterval(spawnWaterDroplet, settings.waterSpawnRate);
    insectSpawnInterval = setInterval(spawnInsect, settings.insectSpawnRate);
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
    
    // Choose a random platform for the spider to walk on
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const spiderY = platform.y - 40; // Position spider on top of platform
    
    // Check if there's already a spider too close to this position
    const minDistance = 80;
    const tooClose = insects.some(insect => 
        Math.abs(insect.y - spiderY) < minDistance && 
        insect.x > 600
    );
    
    if (tooClose) return; // Skip spawning if too close to another spider
    
    const settings = difficultySettings[gameState.difficulty];
    
    insects.push({
        x: 850,
        y: spiderY,
        width: 40,
        height: 40,
        velocityX: settings.insectSpeed,
        platformY: platform.y, // Track which platform spider is on
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
            
            // Check for immediate win condition
            const settings = difficultySettings[gameState.difficulty];
            if (gameState.waterCollected >= settings.winCondition) {
                setTimeout(() => {
                    endGame();
                }, 100); // Small delay to let the sound play
            }
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
            const settings = difficultySettings[gameState.difficulty];
            gameState.score = Math.max(0, gameState.score - settings.scorePenalty);
            gameState.health = Math.max(0, gameState.health - settings.healthPenalty);
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
    
    // Platform collision detection
    player.onGround = false;
    
    // Check collision with platforms
    for (let platform of platforms) {
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height >= platform.y &&
            player.y + player.height <= platform.y + platform.height + 10 &&
            player.velocityY >= 0) {
            
            player.y = platform.y - player.height;
            player.velocityY = 0;
            player.onGround = true;
            break;
        }
    }
    
    // Check if player is in a ditch (more reliable detection)
    const currentTime = Date.now();
    const ditchDamageCooldown = 1000; // 1 second cooldown between ditch damage
    
    for (let ditch of ditches) {
        if (player.x + player.width > ditch.x &&
            player.x < ditch.x + ditch.width &&
            player.y + player.height >= ditch.y &&
            player.y < ditch.y + ditch.height &&
            currentTime - gameState.lastDitchDamage > ditchDamageCooldown) {
            
            // Player is touching a ditch! Damage health
            const settings = difficultySettings[gameState.difficulty];
            gameState.health = Math.max(0, gameState.health - settings.healthPenalty);
            gameState.lastDitchDamage = currentTime;
            playInsectSound(); // Use same sound as insect damage
            updateUI();
            
            // Add visual damage flash effect
            const canvas = document.getElementById('game-canvas');
            canvas.classList.add('damage-flash');
            setTimeout(() => {
                canvas.classList.remove('damage-flash');
            }, 500);
            
            // Push player out of ditch area more forcefully
            if (player.x < ditch.x + ditch.width / 2) {
                player.x = ditch.x - player.width - 10; // Push left
                player.velocityX = -3; // Add some push velocity
            } else {
                player.x = ditch.x + ditch.width + 10; // Push right
                player.velocityX = 3; // Add some push velocity
            }
            
            // Add visual feedback - make player bounce up slightly
            if (player.velocityY >= 0) {
                player.velocityY = -5; // Small bounce
            }
            
            if (gameState.health <= 0) {
                endGame();
            }
            break; // Only hit one ditch at a time
        }
    }
    
    // Fall death (if player falls below all platforms)
    if (player.y > 450) {
        gameState.health = 0;
        endGame();
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
    
    // Draw platforms
    ctx.fillStyle = gameState.isNightMode ? '#34495e' : '#8B4513';
    for (let platform of platforms) {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        
        // Add platform highlight
        ctx.fillStyle = gameState.isNightMode ? '#4a5a6e' : '#A0522D';
        ctx.fillRect(platform.x, platform.y, platform.width, 8);
        ctx.fillStyle = gameState.isNightMode ? '#34495e' : '#8B4513';
    }
    
    // Draw ditches/gaps (visual indication) 
    ctx.fillStyle = gameState.isNightMode ? '#1a1a1a' : '#654321';
    for (let ditch of ditches) {
        ctx.fillRect(ditch.x, ditch.y, ditch.width, ditch.height);
        
        // Add danger visual effect
        ctx.fillStyle = gameState.isNightMode ? '#8b0000' : '#cc4125'; // Dark red
        ctx.fillRect(ditch.x + 5, ditch.y + 30, ditch.width - 10, 8);
        
        // Add spikes or danger indicators
        ctx.fillStyle = gameState.isNightMode ? '#ff4444' : '#ff6b47';
        for (let i = 0; i < 3; i++) {
            const spikeX = ditch.x + 10 + (i * 12);
            ctx.beginPath();
            ctx.moveTo(spikeX, ditch.y + 35);
            ctx.lineTo(spikeX + 5, ditch.y + 25);
            ctx.lineTo(spikeX + 10, ditch.y + 35);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.fillStyle = gameState.isNightMode ? '#1a1a1a' : '#654321';
    }
    
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
    const settings = difficultySettings[gameState.difficulty];
    
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('health-text').textContent = gameState.health;
    document.getElementById('health-fill').style.width = gameState.health + '%';
    document.getElementById('water-count').textContent = gameState.waterCollected;
    document.getElementById('water-goal').textContent = settings.winCondition;
    document.getElementById('current-difficulty').textContent = gameState.difficulty.charAt(0).toUpperCase() + gameState.difficulty.slice(1);
    
    const minutes = Math.floor(gameState.timeLeft / 60);
    const seconds = gameState.timeLeft % 60;
    document.getElementById('timer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function endGame() {
    gameState.isGameRunning = false;
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    if (waterSpawnInterval) clearInterval(waterSpawnInterval);
    if (insectSpawnInterval) clearInterval(insectSpawnInterval);
    
    // Save score
    const settings = difficultySettings[gameState.difficulty];
    const timeSurvived = settings.timeLimit - gameState.timeLeft;
    saveScore(gameState.score, gameState.waterCollected, timeSurvived);
    
    // Check win conditions
    if (gameState.waterCollected >= settings.winCondition) {
        // Player won by collecting enough water!
        playVictorySound();
        showWinScreen('water');
    } else if (gameState.timeLeft <= 0 && gameState.health > 0) {
        // Player survived the full time with health - that's also a win!
        playVictorySound();
        showWinScreen('survival');
    } else {
        // Player lost (health reached 0 or failed to meet conditions)
        showGameOverScreen();
    }
}

function showWinScreen(winType = 'water') {
    // Update win screen based on win type
    const settings = difficultySettings[gameState.difficulty];
    document.getElementById('win-final-score').textContent = gameState.score;
    document.getElementById('win-final-water').textContent = gameState.waterCollected;
    
    const timeSurvived = settings.timeLimit - gameState.timeLeft;
    const minutes = Math.floor(timeSurvived / 60);
    const seconds = timeSurvived % 60;
    document.getElementById('win-time-survived').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Update message based on win type
    const winMessage = document.querySelector('.win-message');
    if (winType === 'water') {
        document.getElementById('win-title').textContent = '🎉 Victory! 🎉';
        winMessage.textContent = 'Amazing! You collected enough water to win!';
    } else if (winType === 'survival') {
        document.getElementById('win-title').textContent = '🏆 Survivor! 🏆';
        winMessage.textContent = 'Incredible! You survived the entire desert challenge!';
    }
    
    // Generate confetti
    generateConfetti();
    
    showScreen('win');
}

function showGameOverScreen() {
    // Update game over screen for death
    document.getElementById('game-over-title').textContent = 'You Have Died!';
    const settings = difficultySettings[gameState.difficulty];
    const timeSurvived = settings.timeLimit - gameState.timeLeft;
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
    
    // Generate 80 confetti pieces for more celebration
    for (let i = 0; i < 80; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Random horizontal position
        confetti.style.left = Math.random() * 100 + '%';
        
        // Random animation delay
        confetti.style.animationDelay = Math.random() * 3 + 's';
        
        // Random animation duration
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        
        // Random size
        const size = Math.random() * 10 + 8;
        confetti.style.width = size + 'px';
        confetti.style.height = size + 'px';
        
        // Add more colors
        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#f39c12', '#e74c3c', '#9b59b6'];
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        
        confettiContainer.appendChild(confetti);
    }
    
    // Clean up confetti after 8 seconds
    setTimeout(() => {
        confettiContainer.innerHTML = '';
    }, 8000);
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
        showScreen('difficulty');
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
    
    // Difficulty selection
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const difficulty = e.target.getAttribute('data-difficulty');
            gameState.difficulty = difficulty;
            showScreen('game');
            initGame();
        });
    });
    
    // Back to menu buttons
    document.getElementById('back-to-menu').addEventListener('click', () => {
        showScreen('menu');
    });
    
    document.getElementById('back-to-menu-difficulty').addEventListener('click', () => {
        showScreen('menu');
    });
    
    document.getElementById('back-to-menu-scores').addEventListener('click', () => {
        showScreen('menu');
    });
    
    // Game over buttons
    document.getElementById('restart-btn').addEventListener('click', () => {
        showScreen('difficulty');
    });
    
    document.getElementById('home-btn').addEventListener('click', () => {
        showScreen('menu');
    });
    
    // Win screen buttons
    document.getElementById('win-restart-btn').addEventListener('click', () => {
        showScreen('difficulty');
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
        
// Start at menu screen
setTimeout(() => {
    initAudio();
    showScreen('menu');
}, 100);