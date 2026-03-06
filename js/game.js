/**
 * Main Game Class - Complete version with level customization
 * UPDATED: Fixed life regain logic (max 3 lives, only gain when below max)
 * UPDATED: Fixed Recommended Words, Common Mistakes, and Vocabulary Growth display
 * UPDATED: Progressive word length distribution based on level
 * UPDATED: Life regain based on correct letters in a row (50 letters = 1 life)
 * FIXED: Game over now properly shows modal inside canvas with blue theme
 * FIXED: Performance analysis now shows real data instead of placeholders
 */
class TypingGame {
    constructor() {
        // Check if API key is set
        if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
            alert('⚠️ Please set your Gemini API key in js/config.js first!\n\nInstructions:\n1. Open js/config.js\n2. Replace YOUR_API_KEY_HERE with your actual key\n3. Save the file and refresh this page');
        }
        
        // Initialize services with hardcoded key
        this.aiService = new AIService(CONFIG.GEMINI_API_KEY);
        
        // Get current level settings (level 1)
        const currentLevelSettings = CONFIG.LEVELS[0];
        
        // Game state
        this.state = {
            gameActive: false,
            paused: false,
            level: 1,
            lives: CONFIG.GLOBAL_SETTINGS.INITIAL_LIVES,
            score: 0,
            wordsTyped: 0,
            correctWords: 0,
            totalCorrectWords: 0,
            speedMultiplier: 1.0,
            wordList: [],
            activeWords: [],
            mistakes: [],
            masteredWords: [],
            reactionTimes: [],
            startTime: null,
            lastFrameTime: null,
            interests: [],
            targetWordsForLevel: currentLevelSettings.wordsToAdvance,
            wordsThisLevel: 0,
            accuracyStreak: 0,
            maxWordsOnScreen: currentLevelSettings.maxWordsOnScreen,
            baseSpeed: currentLevelSettings.baseSpeed,
            levelDescription: currentLevelSettings.description,
            lastSpawnTime: 0,
            spawnCooldown: 1000,
            gameTime: 0,
            combo: 0,
            highestCombo: 0,
            isGeneratingWords: false,
            
            // NEW: Track correct letters for life regain
            correctLettersStreak: 0,        // Count of correct letters typed in a row
            totalCorrectLetters: 0,          // Total correct letters ever typed
            LIVES_PER_LETTERS: 50,           // Gain 1 life every 50 correct letters
            
            // Canvas dimensions - Native resolution 1366x768
            canvasWidth: 1366,
            canvasHeight: 768
        };

        // Track session start mastered words count
        this.sessionStartMasteredCount = StorageManager.getMasteredWords().length;
        
        // Store last analysis for updates
        this.lastAnalysis = null;

        // Maximum lives constant
        this.MAX_LIVES = CONFIG.GLOBAL_SETTINGS.INITIAL_LIVES; // Should be 3

        // DOM Elements
        this.elements = {};
        this.cacheDOMElements();
        
        // Bind methods
        this.bindMethods();
        
        // Animation frame
        this.animationFrame = null;
        
        // Initialize
        this.init();

        // Performance analysis timer
        this.analysisTimer = null;
    }

    // Cache DOM elements
    cacheDOMElements() {
        const elementIds = [
            'interestsPlaceholder',
            'interestsContainer',
            'gameCanvas', 'gameCanvasContainer', 'gameOverlay', 'wordInput', 'startGameBtn',
            'refreshInsightsBtn',
            'toggleInsightsBtn', 'insightsContent', 'aiLoading', 'performanceInsight',
            'avgReaction', 'wpmDisplay', 'recommendedTags', 'mistakeTags',
            'masteredCount', 'vocabProgress', 'growthText',
            'victoryModal', 'gameOverModal', 'victoryWords', 'victoryAccuracy',
            'gameOverLevel', 'gameOverWords',
            'textBoxContainer', 'pauseMenu', 'resumeGameBtn', 'restartGameBtn', 'pauseTip',
            'levelCompleteOverlay', 'nextLevelNumber', 'nextLevelDifficulty', 'nextLevelDescription',
            'nextLevelSpeed', 'nextLevelWordsPerScreen', 'nextLevelWordsNeeded', 'continueToNextLevelBtn',
            'gameStatusIndicator', 'aiInsightsPlaceholder', 'aiInsightsContainer'
        ];

        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
        
        // Cache the new elements
        this.elements.pauseMenu = document.getElementById('pauseMenu');
        this.elements.resumeGameBtn = document.getElementById('resumeGameBtn');
        this.elements.restartGameBtn = document.getElementById('restartGameBtn');
        this.elements.pauseTip = document.getElementById('pauseTip');
        this.elements.gameStatusIndicator = document.getElementById('gameStatusIndicator');
    }

    // Bind methods
    bindMethods() {
        this.gameLoop = this.gameLoop.bind(this);
        this.checkWord = this.checkWord.bind(this);
        this.spawnWord = this.spawnWord.bind(this);
        this.updateStats = this.updateStats.bind(this);
        this.togglePause = this.togglePause.bind(this);
        this.resetGame = this.resetGame.bind(this);
        this.refreshInsights = this.refreshInsights.bind(this);
        this.toggleCustomInterest = this.toggleCustomInterest.bind(this);
        this.showTextBox = this.showTextBox.bind(this);
        this.hideTextBox = this.hideTextBox.bind(this);
        this.updateLowestWordHighlight = this.updateLowestWordHighlight.bind(this);
        this.updateLifeSprites = this.updateLifeSprites.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.continueToNextLevel = this.continueToNextLevel.bind(this);
        this.showStatus = this.showStatus.bind(this);
        this.handleGameOverRestart = this.handleGameOverRestart.bind(this);
        this.resetToNewGame = this.resetToNewGame.bind(this);
        this.updatePerformanceAnalysis = this.updatePerformanceAnalysis.bind(this);
        this.removeExistingGameOverModal = this.removeExistingGameOverModal.bind(this);
        this.showGameOverModal = this.showGameOverModal.bind(this);
        this.showVictoryModal = this.showVictoryModal.bind(this);
        this.createConfetti = this.createConfetti.bind(this);
    }

    // Handle window resize
    handleResize() {
        // Just update UI elements that need it
        this.updateLifeSprites();
        this.updateLowestWordHighlight();
    }

    // Initialize
    init() {
        // Load saved data
        this.loadSavedData();
        
        // Create in-playfield UI elements
        this.createInPlayfieldUI();
        
        // Initialize life sprites
        setTimeout(() => {
            this.updateLifeSprites();
        }, 100);
        
        // Initialize event listeners
        this.initEventListeners();
        
        // Render interests
        this.renderInterests();
        
        // Start game loop
        this.gameLoop();
        
        // Auto-generate words on startup - pass interests
        setTimeout(() => {
            if (CONFIG.FEATURES.USE_AI) {
                this.generateNewWords();
            } else {
                // Even without AI, use interest-specific fallback
                this.state.wordList = this.aiService.getFallbackWords(this.state.level, this.state.interests);
                console.log('Using interest-specific fallback words:', this.state.wordList.slice(0, 10));
            }
        }, 1000);
        
        console.log('Game initialized with 1366x768 resolution');
        console.log(`Level 1: ${this.state.levelDescription}`);
        console.log('Selected interests:', this.state.interests);
    }

    // Show status message (replaces toast notifications)
    showStatus(message, type = 'info') {
        const statusElement = this.elements.gameStatusIndicator;
        if (!statusElement) return;
        
        statusElement.textContent = message;
        statusElement.className = 'game-status ' + type;
        
        // Auto-hide only for success messages after 3 seconds
        if (type === 'success') {
            clearTimeout(this.statusTimeout);
            this.statusTimeout = setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'game-status';
            }, 3000);
        }
    }

    // Create in-playfield UI elements
    createInPlayfieldUI() {
        // Create in-playfield start button container
        const startContainer = document.createElement('div');
        startContainer.className = 'in-playfield-start';
        startContainer.id = 'inPlayfieldStart';
        startContainer.innerHTML = `
            <div class="start-title"></div>
            <button class="btn-start-large" id="playfieldStartBtn">START GAME</button>
            <div class="start-hint">Choose your interests above, then begin!</div>
        `;
        
        // Create playfield input container - BORDERLESS
        const inputContainer = document.createElement('div');
        inputContainer.className = 'playfield-input-container hidden';
        inputContainer.id = 'playfieldInputContainer';
        inputContainer.innerHTML = `
            <input type="text" id="playfieldWordInput" class="playfield-word-input" 
                   placeholder="Type the word here..." 
                   autocomplete="off" 
                   disabled>
        `;
        
        // Create top progress bar container
        const topProgressContainer = document.createElement('div');
        topProgressContainer.className = 'top-progress-container';
        topProgressContainer.id = 'topProgressContainer';
        topProgressContainer.innerHTML = `
            <div class="level-text-above" id="topLevelText">Level 1</div>
            <div class="progress-bar-top">
                <div class="progress-fill-top" id="topProgressFill"></div>
                <div class="progress-text-top" id="topProgressText">0/${this.state.targetWordsForLevel}</div>
            </div>
        `;
        
        // Create life sprites container
        const lifeSpritesContainer = document.createElement('div');
        lifeSpritesContainer.className = 'life-sprites-container';
        lifeSpritesContainer.id = 'lifeSpritesContainer';
        lifeSpritesContainer.innerHTML = `
            <img src="images/life_alive.png" alt="Life" class="life-sprite" id="life1">
            <img src="images/life_alive.png" alt="Life" class="life-sprite" id="life2">
            <img src="images/life_alive.png" alt="Life" class="life-sprite" id="life3">
        `;
        
        // Create pause tip
        const pauseTip = document.createElement('div');
        pauseTip.className = 'pause-tip';
        pauseTip.id = 'pauseTip';
        pauseTip.textContent = 'Press ` to pause (Desktop)';
        
        // Add all elements to game canvas container
        this.elements.gameCanvasContainer.appendChild(startContainer);
        this.elements.gameCanvasContainer.appendChild(inputContainer);
        this.elements.gameCanvasContainer.appendChild(topProgressContainer);
        this.elements.gameCanvasContainer.appendChild(lifeSpritesContainer);
        this.elements.gameCanvasContainer.appendChild(pauseTip);
        
        // Cache the new elements
        this.elements.inPlayfieldStart = document.getElementById('inPlayfieldStart');
        this.elements.playfieldStartBtn = document.getElementById('playfieldStartBtn');
        this.elements.playfieldInputContainer = document.getElementById('playfieldInputContainer');
        this.elements.playfieldWordInput = document.getElementById('playfieldWordInput');
        this.elements.topProgressContainer = document.getElementById('topProgressContainer');
        this.elements.topLevelText = document.getElementById('topLevelText');
        this.elements.topProgressFill = document.getElementById('topProgressFill');
        this.elements.topProgressText = document.getElementById('topProgressText');
        
        // Cache life sprite elements
        this.elements.lifeSpritesContainer = document.getElementById('lifeSpritesContainer');
        this.elements.lifeSprites = [
            document.getElementById('life1'),
            document.getElementById('life2'),
            document.getElementById('life3')
        ];
        
        // Cache pause tip
        this.elements.pauseTip = document.getElementById('pauseTip');
        
        // Add event listener for the new start button
        if (this.elements.playfieldStartBtn) {
            this.elements.playfieldStartBtn.addEventListener('click', () => this.startGame());
        }
    }

    // Update life sprites based on current lives
    updateLifeSprites() {
        if (!this.elements.lifeSprites || this.elements.lifeSprites.length === 0) return;
        
        const maxLives = this.MAX_LIVES;
        const currentLives = this.state.lives;
        
        // Update each sprite based on its position (right to left order)
        for (let i = 0; i < maxLives; i++) {
            const sprite = this.elements.lifeSprites[i];
            if (!sprite) continue;
            
            const lifeNumber = i + 1;
            const shouldBeAlive = lifeNumber <= currentLives;
            
            if (shouldBeAlive) {
                if (sprite.src.includes('broken')) {
                    sprite.src = 'images/life_alive.png';
                    sprite.classList.remove('lost');
                    sprite.classList.add('gained');
                    setTimeout(() => {
                        sprite.classList.remove('gained');
                    }, 500);
                }
            } else {
                if (!sprite.src.includes('broken')) {
                    sprite.src = 'images/life_broken.png';
                    sprite.classList.remove('gained');
                    sprite.classList.add('lost');
                    setTimeout(() => {
                        sprite.classList.remove('lost');
                    }, 500);
                }
            }
        }
        
        // Add warning class when only 1 life left
        if (this.elements.lifeSpritesContainer) {
            if (currentLives === 1) {
                this.elements.lifeSpritesContainer.classList.add('warning');
            } else {
                this.elements.lifeSpritesContainer.classList.remove('warning');
            }
        }
    }

    // Show text box
    showTextBox() {
        if (this.elements.textBoxContainer) {
            this.elements.textBoxContainer.classList.remove('hidden');
        }
    }

    // Hide text box
    hideTextBox() {
        if (this.elements.textBoxContainer) {
            this.elements.textBoxContainer.classList.add('hidden');
        }
    }

    // Initialize event listeners
    initEventListeners() {
        // Game controls
        if (this.elements.startGameBtn) {
            this.elements.startGameBtn.addEventListener('click', () => this.startGame());
        }
        
        // Word input (playfield input)
        if (this.elements.playfieldWordInput) {
            this.elements.playfieldWordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.checkWord();
            });
        }
        
        // Insights panel
        if (this.elements.refreshInsightsBtn) {
            this.elements.refreshInsightsBtn.addEventListener('click', this.refreshInsights);
        }
        
        if (this.elements.toggleInsightsBtn) {
            this.elements.toggleInsightsBtn.addEventListener('click', () => this.toggleInsights());
        }
        
        // Pause menu buttons
        if (this.elements.resumeGameBtn) {
            this.elements.resumeGameBtn.addEventListener('click', () => this.togglePause());
        }
        if (this.elements.restartGameBtn) {
            this.elements.restartGameBtn.addEventListener('click', () => this.resetGame());
        }
        
        // Level complete continue button
        if (this.elements.continueToNextLevelBtn) {
            this.elements.continueToNextLevelBtn.addEventListener('click', () => this.continueToNextLevel());
        }
        
        // Listen for keydown events on the whole window for pause
        window.addEventListener('keydown', (e) => {
            if (e.key === '`' || e.key === '~' || e.code === 'Backquote') {
                e.preventDefault();
                this.togglePause();
            }
        });

        // Add resize event listener
        window.addEventListener('resize', this.handleResize);
    }

    // Handle game over restart
    handleGameOverRestart() {
        console.log('Handling game over restart without page reload'); // Debug log
        
        // Remove in-canvas modal
        this.removeExistingGameOverModal();
        
        // Hide original modals if they exist
        if (this.elements.gameOverModal) {
            this.elements.gameOverModal.classList.add('hidden');
        }
        if (this.elements.victoryModal) {
            this.elements.victoryModal.classList.add('hidden');
        }
        
        // Reset to new game state (preserve AI insights data)
        this.resetToNewGame();
    }

    // Reset to new game without page reload
    resetToNewGame() {
        // Remove any existing game over modal
        this.removeExistingGameOverModal();
        
        console.log('Resetting to new game state...'); // Debug log
        
        if (this.elements.pauseMenu) {
            this.elements.pauseMenu.classList.add('hidden');
        }
        
        // Hide level complete overlay if visible
        if (this.elements.levelCompleteOverlay) {
            this.elements.levelCompleteOverlay.classList.add('hidden');
        }
        
        // Hide game over and victory modals (already hidden, but just to be sure)
        if (this.elements.gameOverModal) {
            this.elements.gameOverModal.classList.add('hidden');
        }
        if (this.elements.victoryModal) {
            this.elements.victoryModal.classList.add('hidden');
        }
        
        // Remove all active words from DOM
        this.state.activeWords.forEach(word => {
            const element = document.getElementById(word.id);
            if (element) element.remove();
        });
        
        const level1Settings = CONFIG.LEVELS[0];
        
        // PRESERVE AI INSIGHTS DATA - Keep mistakes and mastered words for AI insights
        const persistentData = {
            mistakes: [...this.state.mistakes],
            masteredWords: [...this.state.masteredWords],
            interests: [...this.state.interests],
            wordList: [...this.state.wordList]  // Keep the existing word list
        };
        
        // Create a new state object but preserve AI insights data
        this.state = {
            // Game status
            gameActive: false,
            paused: false,
            level: 1,  // Explicitly set to level 1
            lives: CONFIG.GLOBAL_SETTINGS.INITIAL_LIVES,
            score: 0,
            wordsTyped: 0,
            correctWords: 0,
            totalCorrectWords: 0,
            speedMultiplier: 1.0,
            
            // Preserved data (AI insights)
            wordList: persistentData.wordList,
            activeWords: [],
            mistakes: persistentData.mistakes,          // Keep mistakes for AI
            masteredWords: persistentData.masteredWords, // Keep mastered words for AI
            reactionTimes: [],
            startTime: null,
            lastFrameTime: null,
            interests: persistentData.interests,
            
            // Level progression
            targetWordsForLevel: level1Settings.wordsToAdvance,
            wordsThisLevel: 0,
            accuracyStreak: 0,
            maxWordsOnScreen: level1Settings.maxWordsOnScreen,
            baseSpeed: level1Settings.baseSpeed,
            levelDescription: level1Settings.description,
            
            // Timing
            lastSpawnTime: 0,
            spawnCooldown: 1000,
            gameTime: 0,
            
            // Combo tracking
            combo: 0,
            highestCombo: 0,
            
            // Word generation
            isGeneratingWords: false,
            
            // Letter-based life regain
            correctLettersStreak: 0,
            totalCorrectLetters: 0,
            LIVES_PER_LETTERS: 50,
            
            // Canvas dimensions
            canvasWidth: 1366,
            canvasHeight: 768
        };
        
        console.log('Game reset. Current level:', this.state.level); // Debug log
        
        // Reset session start count but keep mastered words count for growth tracking
        this.sessionStartMasteredCount = this.state.masteredWords.length;
        this.lastAnalysis = null;
        
        this.updateLifeSprites();
        
        // Show the start button AFTER reset is complete
        if (this.elements.inPlayfieldStart) {
            this.elements.inPlayfieldStart.classList.remove('hidden');
        }
        
        if (this.elements.playfieldInputContainer) {
            this.elements.playfieldInputContainer.classList.add('hidden');
        }
        
        if (this.elements.gameOverlay) {
            this.elements.gameOverlay.classList.add('hidden');
        }
        
        if (this.elements.topProgressFill) {
            this.elements.topProgressFill.style.width = '0%';
        }
        if (this.elements.topProgressText) {
            this.elements.topProgressText.textContent = `0/${this.state.targetWordsForLevel}`;
        }
        if (this.elements.topLevelText) {
            this.elements.topLevelText.textContent = 'Level 1';
        }
        
        if (this.elements.playfieldWordInput) {
            this.elements.playfieldWordInput.disabled = true;
            this.elements.playfieldWordInput.value = '';
        }
        
        if (this.elements.wordInput) {
            this.elements.wordInput.disabled = true;
            this.elements.wordInput.value = '';
        }
        
        this.hideTextBox();
        
        this.renderInterests();
        
        // Update insights with preserved data - THIS KEEPS THE AI INSIGHTS SECTION INTACT
        this.updateInsights(this.lastAnalysis);
        this.updateStats();
        this.showStatus('New game started! Keep practicing!', 'success');
        
        // Generate new words if needed, but keep existing ones if available
        if (CONFIG.FEATURES.USE_AI && this.state.wordList.length === 0) {
            setTimeout(() => this.generateNewWords(), 500);
        } else if (!CONFIG.FEATURES.USE_AI && this.state.wordList.length === 0) {
            // Even without AI, use interest-specific fallback
            this.state.wordList = this.aiService.getFallbackWords(this.state.level, this.state.interests);
        }
    }

    // Load saved data from storage
    loadSavedData() {
        if (!CONFIG.FEATURES.SAVE_PROGRESS) return;
        
        this.state.mistakes = StorageManager.getMistakes();
        this.state.masteredWords = StorageManager.getMasteredWords();
        
        const savedInterests = StorageManager.getInterests();
        if (savedInterests.length > 0) {
            this.state.interests = savedInterests;
        }
        
        this.updateStats();
    }

    // Render interests in the custom UI with overlay
    renderInterests() {
        const interests = [
            'Science', 'Technology', 'Nature', 'Space', 
            'Animals', 'Food', 'Music', 'Sports', 'History'
        ];
        
        const container = this.elements.interestsContainer;
        if (!container) return;
        
        container.innerHTML = '';
        
        interests.forEach((interest) => {
            const item = document.createElement('div');
            item.className = 'interest-item';
            
            if (this.state.interests.includes(interest.toLowerCase())) {
                item.classList.add('selected');
            }
            
            item.innerHTML = `
                <span class="interest-text">${interest}</span>
                <span class="interest-overlay"></span>
            `;
            
            item.addEventListener('click', () => this.toggleCustomInterest(interest));
            
            container.appendChild(item);
        });
    }

    // Toggle custom interest selection
    toggleCustomInterest(interest) {
        const interestLower = interest.toLowerCase();
        const items = this.elements.interestsContainer.children;
        
        let clickedItem = null;
        for (let item of items) {
            if (item.querySelector('.interest-text').textContent === interest) {
                clickedItem = item;
                break;
            }
        }
        
        if (this.state.interests.includes(interestLower)) {
            this.state.interests = this.state.interests.filter(i => i !== interestLower);
            if (clickedItem) {
                clickedItem.classList.remove('selected');
            }
        } else {
            this.state.interests.push(interestLower);
            if (clickedItem) {
                clickedItem.classList.add('selected');
            }
        }
        
        if (CONFIG.FEATURES.SAVE_PROGRESS) {
            StorageManager.saveInterests(this.state.interests);
        }
        
        console.log('Selected interests:', this.state.interests);
        
        // Generate new words based on updated interests
        clearTimeout(this.generateWordsTimeout);
        this.generateWordsTimeout = setTimeout(() => {
            if (CONFIG.FEATURES.USE_AI) {
                this.generateNewWords();
            } else {
                // Even without AI, update word list with interest-specific words
                this.state.wordList = this.aiService.getFallbackWords(this.state.level, this.state.interests);
                console.log('Updated interest-specific words:', this.state.wordList.slice(0, 10));
                this.showStatus('Words updated based on your interests!', 'success');
            }
        }, 300);
    }

    // Start game
    startGame() {
        if (this.state.wordList.length === 0) {
            this.showStatus('Generating words first...', 'info');
            this.generateNewWords().then(() => {
                this.activateGame();
            });
        } else {
            this.activateGame();
        }
    }

    activateGame() {
        this.state.gameActive = true;
        this.state.paused = false;
        this.state.startTime = Date.now();
        this.state.lastSpawnTime = Date.now();
        this.state.lives = CONFIG.GLOBAL_SETTINGS.INITIAL_LIVES;
        this.state.correctLettersStreak = 0; // Reset letter streak on game start
        this.updateLifeSprites();
        
        if (this.elements.inPlayfieldStart) {
            this.elements.inPlayfieldStart.classList.add('hidden');
        }
        
        if (this.elements.playfieldInputContainer) {
            this.elements.playfieldInputContainer.classList.remove('hidden');
        }
        
        if (this.elements.playfieldWordInput) {
            this.elements.playfieldWordInput.disabled = false;
            this.elements.playfieldWordInput.focus();
        }
        
        if (this.elements.wordInput) {
            this.elements.wordInput.disabled = false;
        }
        
        this.showTextBox();
        
        this.showStatus(`Level 1: ${this.state.levelDescription}`, 'info', 3000);
        
        this.updateStats();
        
        // Start performance analysis timer (analyze every 30 seconds)
        this.startPerformanceAnalysisTimer();
    }

    // Start performance analysis timer
    startPerformanceAnalysisTimer() {
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
        }
        
        // Analyze every 30 seconds while game is active
        this.analysisTimer = setInterval(() => {
            if (this.state.gameActive && !this.state.paused && this.state.wordsTyped >= 5) {
                this.updatePerformanceAnalysis();
            }
        }, 30000); // 30 seconds
    }

    // Toggle pause
    togglePause() {
        if (!this.state.gameActive) return;
        
        this.state.paused = !this.state.paused;
        
        if (this.elements.playfieldWordInput) {
            this.elements.playfieldWordInput.disabled = this.state.paused;
        }
        
        if (this.elements.wordInput) {
            this.elements.wordInput.disabled = this.state.paused;
        }
        
        if (this.elements.pauseMenu) {
            if (this.state.paused) {
                this.elements.pauseMenu.classList.remove('hidden');
            } else {
                this.elements.pauseMenu.classList.add('hidden');
            }
        }
        
        if (this.elements.gameOverlay) {
            this.elements.gameOverlay.classList.toggle('hidden', !this.state.paused);
        }
        
        if (!this.state.paused) {
            if (this.elements.playfieldWordInput) {
                this.elements.playfieldWordInput.focus();
            } else if (this.elements.wordInput) {
                this.elements.wordInput.focus();
            }
            this.state.lastSpawnTime = Date.now();
        }
    }

    // Check typed word
    checkWord() {
        if (!this.state.gameActive || this.state.paused) return;

        const input = this.elements.playfieldWordInput ? 
            this.elements.playfieldWordInput.value.trim().toLowerCase() : 
            this.elements.wordInput.value.trim().toLowerCase();
            
        if (!input) return;

        const activeWord = this.state.activeWords[0];
        if (!activeWord) return;

        const reactionTime = Date.now() - activeWord.startTime;
        
        if (activeWord.word === input) {
            this.handleCorrectWord(activeWord, reactionTime);
        } else {
            this.handleWrongWord(activeWord, input);
        }

        if (this.elements.playfieldWordInput) {
            this.elements.playfieldWordInput.value = '';
        }
        
        if (this.elements.wordInput) {
            this.elements.wordInput.value = '';
        }
        
        this.updateStats();
        
        // Update performance analysis after every 5 words
        if (this.state.wordsTyped % 5 === 0 && this.state.wordsTyped > 0) {
            this.updatePerformanceAnalysis();
        }
    }

    /**
     * Handle correct word - UPDATED with letter-based life regain
     */
    handleCorrectWord(activeWord, reactionTime) {
        this.state.reactionTimes.push(reactionTime);
        this.state.correctWords++;
        this.state.totalCorrectWords++;
        this.state.score += CONFIG.GLOBAL_SETTINGS.POINTS_PER_WORD;
        this.state.wordsTyped++;
        this.state.wordsThisLevel++;
        this.state.accuracyStreak++;
        this.state.combo++;
        
        if (this.state.combo > this.state.highestCombo) {
            this.state.highestCombo = this.state.combo;
        }

        // ===========================================
        // LETTER-BASED LIFE REGAIN SYSTEM
        // Count correct letters from the typed word
        // ===========================================
        const wordLength = activeWord.word.length;
        this.state.correctLettersStreak += wordLength;
        this.state.totalCorrectLetters += wordLength;
        
        // Check if we've reached the threshold for a new life
        const lettersNeeded = this.state.LIVES_PER_LETTERS;
        const lettersProgress = this.state.correctLettersStreak;
        
        // Award lives for every 50 correct letters
        if (lettersProgress >= lettersNeeded && this.state.lives < this.MAX_LIVES) {
            // Calculate how many lives to award (floor division)
            const livesToAward = Math.floor(lettersProgress / lettersNeeded);
            const actualLivesToAward = Math.min(livesToAward, this.MAX_LIVES - this.state.lives);
            
            if (actualLivesToAward > 0) {
                this.state.lives = Math.min(this.state.lives + actualLivesToAward, this.MAX_LIVES);
                this.updateLifeSprites();
                
                // Calculate remaining letters for next life
                const remainingLetters = lettersProgress % lettersNeeded;
                this.state.correctLettersStreak = remainingLetters;
                
                this.showStatus(`❤️ +${actualLivesToAward} life for ${actualLivesToAward * lettersNeeded} correct letters!`, 'success');
            }
        }
        
        // Optional: Show letter progress in status occasionally
        if (this.state.correctLettersStreak > 0 && this.state.correctLettersStreak % 10 === 0) {
            const remainingForNext = lettersNeeded - this.state.correctLettersStreak;
            if (this.state.lives < this.MAX_LIVES) {
                this.showStatus(`📝 ${remainingForNext} more letters for next life`, 'info', 1500);
            }
        }
        
        // FIXED: Bonus life for total correct words - only when below max
        if (CONFIG.GLOBAL_SETTINGS.EARN_EXTRA_LIFE_EVERY > 0) {
            if (this.state.totalCorrectWords % CONFIG.GLOBAL_SETTINGS.EARN_EXTRA_LIFE_EVERY === 0 && 
                this.state.lives < this.MAX_LIVES) {
                this.state.lives = Math.min(this.state.lives + 1, this.MAX_LIVES);
                this.updateLifeSprites();
                this.showStatus('❤️ Bonus life for word milestone!', 'success');
            }
        }

        // Check if this is a new mastered word
        if (!this.state.masteredWords.includes(activeWord.word)) {
            this.state.masteredWords.push(activeWord.word);
            if (CONFIG.FEATURES.SAVE_PROGRESS) {
                StorageManager.saveMasteredWords(this.state.masteredWords);
            }
            // Update insights when new words are mastered
            this.updateInsights(this.lastAnalysis);
        }

        const wordElement = document.getElementById(activeWord.id);
        if (wordElement) {
            wordElement.classList.add('correct');
            setTimeout(() => {
                wordElement.remove();
            }, 300);
        }

        this.state.activeWords.shift();

        if (this.state.wordsThisLevel >= this.state.targetWordsForLevel) {
            this.levelUp();
        }
    }

    /**
     * Handle wrong word - UPDATED to reset letter streak
     */
    handleWrongWord(activeWord, typedWord) {
        this.state.accuracyStreak = 0;
        this.state.combo = 0;
        
        // Reset the correct letters streak on a mistake
        this.state.correctLettersStreak = 0;
        
        this.state.lives = Math.max(0, this.state.lives - 1); // Prevent going below 0
        this.updateLifeSprites();
        
        
        // Track the mistake
        if (!this.state.mistakes.includes(typedWord)) {
            this.state.mistakes.push(typedWord);
            if (this.state.mistakes.length > 50) {
                this.state.mistakes = this.state.mistakes.slice(-50);
            }
            if (CONFIG.FEATURES.SAVE_PROGRESS) {
                StorageManager.saveMistakes(this.state.mistakes);
            }
            // Update insights when new mistakes occur
            this.updateInsights(this.lastAnalysis);
        }

        const wordElement = document.getElementById(activeWord.id);
        if (wordElement) {
            wordElement.classList.add('wrong');
            wordElement.textContent = `❌ ${activeWord.word}`;
            
            setTimeout(() => {
                wordElement.remove();
            }, 800);
        }

        this.state.activeWords.shift();

        if (this.state.lives <= 0) {
            this.endGame('gameover');
        }
    }

    // Level up
    async levelUp() {
        if (this.state.level >= CONFIG.GLOBAL_SETTINGS.MAX_LEVEL) {
            this.endGame('victory');
            return;
        }

        // Store level completion stats
        const completedLevel = this.state.level;

        // Pause the game
        this.state.gameActive = false;
        this.state.paused = true;
        
        // Disable input
        if (this.elements.playfieldWordInput) {
            this.elements.playfieldWordInput.disabled = true;
        }
        if (this.elements.wordInput) {
            this.elements.wordInput.disabled = true;
        }

        // Get next level settings
        const nextLevelIndex = this.state.level; // Current level is 1-based, next level index = current level
        const nextLevelSettings = CONFIG.LEVELS[nextLevelIndex] || CONFIG.LEVELS[this.state.level - 1];

        // Determine difficulty based on next level
        let difficulty = 'easy';
        if (nextLevelSettings) {
            const levelNum = this.state.level + 1;
            if (levelNum >= 9) difficulty = 'expert';
            else if (levelNum >= 7) difficulty = 'advanced';
            else if (levelNum >= 5) difficulty = 'hard';
            else if (levelNum >= 3) difficulty = 'medium';
            else difficulty = 'easy';
        }

        // Calculate display multiplier based on level groups
        const nextLevelNum = this.state.level + 1;
        let displayMultiplier = 1.00;
        
        if (nextLevelNum <= 2) displayMultiplier = 1.00;      // Levels 1-2: 1.00x
        else if (nextLevelNum <= 4) displayMultiplier = 1.10; // Levels 3-4: 1.10x
        else if (nextLevelNum <= 6) displayMultiplier = 1.20; // Levels 5-6: 1.20x
        else if (nextLevelNum <= 7) displayMultiplier = 1.30; // Level 7: 1.30x
        else if (nextLevelNum <= 8) displayMultiplier = 1.40; // Level 8: 1.40x
        else if (nextLevelNum <= 10) displayMultiplier = 1.50; // Levels 9-10: 1.50x

        // Update next level info
        if (this.elements.nextLevelNumber) {
            this.elements.nextLevelNumber.textContent = this.state.level + 1;
        }
        if (this.elements.nextLevelDifficulty) {
            this.elements.nextLevelDifficulty.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
            this.elements.nextLevelDifficulty.setAttribute('data-difficulty', difficulty);
        }
        if (this.elements.nextLevelDescription) {
            this.elements.nextLevelDescription.textContent = nextLevelSettings?.description || 'Ready for the next challenge!';
        }
        if (this.elements.nextLevelSpeed) {
            // Display the grouped multiplier
            this.elements.nextLevelSpeed.textContent = displayMultiplier.toFixed(2) + 'x';
        }
        if (this.elements.nextLevelWordsPerScreen) {
            this.elements.nextLevelWordsPerScreen.textContent = nextLevelSettings?.maxWordsOnScreen || 2;
        }
        if (this.elements.nextLevelWordsNeeded) {
            this.elements.nextLevelWordsNeeded.textContent = nextLevelSettings?.wordsToAdvance || 15;
        }

        // Show level complete overlay (in game container)
        if (this.elements.levelCompleteOverlay) {
            this.elements.levelCompleteOverlay.classList.remove('hidden');
        }

        // Clear any existing active words
        this.state.activeWords.forEach(word => {
            const element = document.getElementById(word.id);
            if (element) element.remove();
        });
        this.state.activeWords = [];

        // Update stats display
        this.updateStats();
        
        this.state.score += CONFIG.GLOBAL_SETTINGS.BONUS_POINTS_PER_LEVEL;
        
        console.log(`Level ${completedLevel} complete! Ready for level ${completedLevel + 1} (${difficulty} difficulty)`);
    }

    // Continue to next level
    async continueToNextLevel() {
        // Hide the level complete overlay
        if (this.elements.levelCompleteOverlay) {
            this.elements.levelCompleteOverlay.classList.add('hidden');
        }

        // Increment level
        this.state.level++;
        
        const levelSettings = CONFIG.LEVELS[this.state.level - 1];
        this.state.targetWordsForLevel = levelSettings.wordsToAdvance;
        this.state.maxWordsOnScreen = levelSettings.maxWordsOnScreen;
        this.state.baseSpeed = levelSettings.baseSpeed;
        this.state.levelDescription = levelSettings.description;
        this.state.wordsThisLevel = 0;
        
        // Calculate display multiplier based on current level groups
        let displayMultiplier = 1.00;
        
        if (this.state.level <= 2) displayMultiplier = 1.00;      // Levels 1-2: 1.00x
        else if (this.state.level <= 4) displayMultiplier = 1.10; // Levels 3-4: 1.10x
        else if (this.state.level <= 6) displayMultiplier = 1.20; // Levels 5-6: 1.20x
        else if (this.state.level <= 7) displayMultiplier = 1.30; // Level 7: 1.30x
        else if (this.state.level <= 8) displayMultiplier = 1.40; // Level 8: 1.40x
        else if (this.state.level <= 10) displayMultiplier = 1.50; // Levels 9-10: 1.50x
        
        this.state.speedMultiplier = displayMultiplier;
        
        if (CONFIG.FEATURES.SAVE_PROGRESS) {
            StorageManager.saveDifficultyLevel(this.state.level);
        }
        
        // Generate new words for the next level
        if (CONFIG.FEATURES.USE_AI) {
            await this.generateNewWords();
            if (CONFIG.FEATURES.ADAPTIVE_DIFFICULTY) {
                await this.analyzePerformance();
            }
        } else {
            // Even without AI, update word list for new level
            this.state.wordList = this.aiService.getFallbackWords(this.state.level, this.state.interests);
        }
        
        // Resume game
        this.state.gameActive = true;
        this.state.paused = false;
        this.state.lastSpawnTime = Date.now();
        
        // Re-enable input
        if (this.elements.playfieldWordInput) {
            this.elements.playfieldWordInput.disabled = false;
            this.elements.playfieldWordInput.focus();
        }
        if (this.elements.wordInput) {
            this.elements.wordInput.disabled = false;
        }
        
        // Update stats display
        this.updateStats();
    }

    /**
     * Spawn new word - UPDATED with progressive word length distribution
     */
    spawnWord() {
        if (!this.state.gameActive || this.state.paused) return;
        
        if (this.state.activeWords.length >= this.state.maxWordsOnScreen) return;

        const now = Date.now();
        const minSpawnInterval = 800 / (1 + (this.state.level * 0.1));
        
        if (now - this.state.lastSpawnTime < minSpawnInterval) return;
        
        const wordList = this.state.wordList.length > 0 ? 
            this.state.wordList : 
            this.aiService?.getFallbackWords(this.state.level, this.state.interests) || 
            ['cat', 'dog', 'sun', 'run', 'book', 'fish', 'tree', 'bird'];

        // ===========================================
        // WORD LENGTH DISTRIBUTION BASED ON LEVEL
        // ===========================================
        let eligibleWords = [];
        const level = this.state.level;
        
        // Define length ranges and probabilities for each level tier
        if (level <= 2) {
            // Level 1-2: Mostly 3-4 letter words, occasional 5 letter words
            eligibleWords = wordList.filter(w => {
                const len = w.length;
                return len >= 3 && len <= 5; // Allow up to 5, but...
            });
            
            // Bias heavily toward shorter words
            if (eligibleWords.length > 0 && Math.random() < 0.8) {
                // 80% chance to pick only from 3-4 letter words
                const shortWords = eligibleWords.filter(w => w.length <= 4);
                if (shortWords.length > 0) {
                    eligibleWords = shortWords;
                }
            }
        } 
        else if (level <= 4) {
            // Level 3-4: Mix of 4-6 letter words, with 5 being most common
            eligibleWords = wordList.filter(w => {
                const len = w.length;
                return len >= 4 && len <= 6;
            });
            
            // Slight bias toward 5 letter words (most common in this tier)
            if (eligibleWords.length > 0 && Math.random() < 0.5) {
                const mediumWords = eligibleWords.filter(w => w.length === 5);
                if (mediumWords.length > 0) {
                    eligibleWords = mediumWords;
                }
            }
        } 
        else if (level <= 6) {
            // Level 5-6: Mix of 5-7 letter words, with 6 being most common
            eligibleWords = wordList.filter(w => {
                const len = w.length;
                return len >= 5 && len <= 7;
            });
            
            // Slight bias toward 6 letter words
            if (eligibleWords.length > 0 && Math.random() < 0.5) {
                const longerWords = eligibleWords.filter(w => w.length === 6);
                if (longerWords.length > 0) {
                    eligibleWords = longerWords;
                }
            }
        } 
        else if (level <= 8) {
            // Level 7-8: Mix of 5-8 letter words, with 7 being most common
            eligibleWords = wordList.filter(w => {
                const len = w.length;
                return len >= 5 && len <= 8;
            });
            
            // Allow some variety but prefer 7 letter words
            if (eligibleWords.length > 0 && Math.random() < 0.4) {
                const longerWords = eligibleWords.filter(w => w.length === 7);
                if (longerWords.length > 0) {
                    eligibleWords = longerWords;
                }
            }
        } 
        else {
            // Level 9-10: Full range, with longer words becoming more common
            eligibleWords = wordList.filter(w => {
                const len = w.length;
                return len >= 6 && len <= 12; // Allow up to 12 letters
            });
            
            // In expert levels, sometimes challenge with very long words
            if (eligibleWords.length > 0 && Math.random() < 0.3) {
                const expertWords = eligibleWords.filter(w => w.length >= 8);
                if (expertWords.length > 0) {
                    eligibleWords = expertWords;
                }
            }
        }
        
        // Fallback if filtering removed all words
        let word;
        if (eligibleWords.length === 0) {
            // Just use the full word list as fallback
            word = wordList[Math.floor(Math.random() * wordList.length)];
        } else {
            word = eligibleWords[Math.floor(Math.random() * eligibleWords.length)];
        }
        
        // ===========================================
        // END OF WORD LENGTH DISTRIBUTION
        // ===========================================
        
        const wordId = `word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const wordElement = document.createElement('div');
        wordElement.className = 'word';
        wordElement.id = wordId;
        
        wordElement.innerHTML = `
            ${word}
            <span class="word-indicator"></span>
        `;
        
        // Set data-length attribute for styling
        if (word.length <= 4) {
            wordElement.setAttribute('data-length', 'short');
        } else if (word.length >= 10) {
            wordElement.setAttribute('data-length', 'very-long');
        } else if (word.length >= 7) {
            wordElement.setAttribute('data-length', 'long');
        } else {
            wordElement.setAttribute('data-length', 'medium');
        }
        
        // ===========================================
        // MARGIN SETTINGS - ADJUST THESE VALUES
        // ===========================================
        const LEFT_MARGIN_PERCENT = 5;      // % from left edge (increase to move words right)
        const RIGHT_MARGIN_PERCENT = 5;     // % from right edge (increase to move words left)
        // ===========================================
        
        // Calculate approximate width percentage based on word length
        let fontSize = 3.5;
        if (word.length <= 4) fontSize = 4;
        else if (word.length >= 10) fontSize = 2.5;
        else if (word.length >= 7) fontSize = 3;
        
        const remToPx = 16;
        const avgCharWidth = fontSize * remToPx * 0.6;
        const wordWidth = word.length * avgCharWidth;
        
        // Get canvas width
        const canvas = this.elements.gameCanvas;
        const canvasWidth = canvas.clientWidth;
        
        // Calculate word width as percentage of canvas
        const wordWidthPercent = (wordWidth / canvasWidth) * 100;
        
        // Calculate safe boundaries with margins
        const minLeftPercent = LEFT_MARGIN_PERCENT;
        const maxLeftPercent = 100 - RIGHT_MARGIN_PERCENT - wordWidthPercent;
        
        // Ensure we have a valid range (if word is too wide, center it)
        let leftPercent;
        if (maxLeftPercent <= minLeftPercent) {
            // Word is too wide, center it
            leftPercent = (100 - wordWidthPercent) / 2;
            console.warn(`Word "${word}" is too wide, centering at ${leftPercent.toFixed(1)}%`);
        } else {
            // Random percentage between min and max
            leftPercent = minLeftPercent + Math.random() * (maxLeftPercent - minLeftPercent);
        }
        
        // Position using percentage
        wordElement.style.left = leftPercent + '%';
        wordElement.style.top = '0px';
        
        wordElement.title = `Level ${this.state.level}: ${this.state.levelDescription}`;
        
        this.elements.gameCanvas.appendChild(wordElement);
        
        this.state.activeWords.push({
            id: wordId,
            word: word,
            element: wordElement,
            startTime: now,
            top: 0,
            leftPercent: leftPercent,
            length: word.length,
            fontSize: fontSize
        });
        
        this.state.lastSpawnTime = now;
    }

    // Update highlight for the lowest word
    updateLowestWordHighlight() {
        document.querySelectorAll('.word').forEach(word => {
            word.classList.remove('lowest-word');
        });
        
        if (this.state.activeWords.length > 0) {
            let lowestWord = this.state.activeWords[0];
            let maxTop = lowestWord.top;
            
            for (let i = 1; i < this.state.activeWords.length; i++) {
                if (this.state.activeWords[i].top > maxTop) {
                    maxTop = this.state.activeWords[i].top;
                    lowestWord = this.state.activeWords[i];
                }
            }
            
            const element = document.getElementById(lowestWord.id);
            if (element) {
                element.classList.add('lowest-word');
            }
        }
    }

    // Game loop
    gameLoop(timestamp) {
        if (!this.state.lastFrameTime) {
            this.state.lastFrameTime = timestamp;
            this.animationFrame = requestAnimationFrame(this.gameLoop);
            return;
        }

        if (this.state.gameActive && !this.state.paused) {
            const deltaTime = Math.min(timestamp - this.state.lastFrameTime, 100);
            
            this.state.gameTime += deltaTime;
            
            const canvas = this.elements.gameCanvas;
            const canvasHeight = canvas.clientHeight;
            
            // Bottom threshold (100px from bottom)
            const bottomThreshold = canvasHeight - 100;
            
            this.state.activeWords.forEach((word, index) => {
                const speed = (this.state.baseSpeed * this.state.speedMultiplier) * 
                             (word.length > 7 ? 0.9 : 1.0);
                
                word.top += speed * deltaTime;
                
                const element = document.getElementById(word.id);
                if (element) {
                    element.style.top = word.top + 'px';
                    
                    // Add slight sway
                    if (word.length > 6) {
                        const sway = Math.sin(this.state.gameTime / 200 + index) * 0.5;
                        const newLeft = word.leftPercent + sway;
                        const boundedLeft = Math.max(1, Math.min(99, newLeft));
                        element.style.left = boundedLeft + '%';
                    }
                    
                    if (word.top > bottomThreshold) {
                        this.handleMissedWord(word, index);
                    }
                }
            });

            this.updateLowestWordHighlight();

            this.spawnWord();
        }

        this.state.lastFrameTime = timestamp;
        this.animationFrame = requestAnimationFrame(this.gameLoop);
    }

    /**
     * Handle missed word - UPDATED to reset letter streak
     */
    handleMissedWord(word, index) {
        // Reset the correct letters streak on a missed word
        this.state.correctLettersStreak = 0;
        
        this.state.lives = Math.max(0, this.state.lives - 1); // Prevent going below 0
        this.updateLifeSprites();
        this.state.accuracyStreak = 0;
        this.state.combo = 0;
        this.state.activeWords.splice(index, 1);
        
        // Show how many letters were lost
        this.showStatus(`💔 Missed! Lost ${word.length} letter progress`, 'warning', 2000);
        
        const element = document.getElementById(word.id);
        if (element) {
            element.classList.add('wrong');
            element.textContent = `💔 ${word.word}`;
            
            setTimeout(() => {
                element.remove();
            }, 500);
        }

        if (!this.state.mistakes.includes(word.word)) {
            this.state.mistakes.push(word.word);
            if (CONFIG.FEATURES.SAVE_PROGRESS) {
                StorageManager.saveMistakes(this.state.mistakes);
            }
            // Update insights when new mistakes occur
            this.updateInsights(this.lastAnalysis);
        }

        this.updateStats();

        if (this.state.lives <= 0) {
            this.endGame('gameover');
        }
    }

    // Update stats
    updateStats() {
        const accuracy = this.state.wordsTyped > 0 
            ? Math.round((this.state.correctWords / this.state.wordsTyped) * 100) 
            : 100;
        
        if (this.state.startTime && this.state.wordsTyped > 0) {
            const minutes = (Date.now() - this.state.startTime) / 60000;
            const wpm = Math.round((this.state.wordsTyped / 5) / Math.max(minutes, 0.1));
            if (this.elements.wpmDisplay) {
                this.elements.wpmDisplay.textContent = wpm;
            }
        }
        
        if (this.state.reactionTimes.length > 0 && this.elements.avgReaction) {
            const avgReaction = Math.round(
                this.state.reactionTimes.reduce((a, b) => a + b, 0) / 
                this.state.reactionTimes.length
            );
            this.elements.avgReaction.textContent = avgReaction + 'ms';
        }
        
        if (this.elements.masteredCount) {
            this.elements.masteredCount.textContent = this.state.masteredWords.length;
        }
        
        if (this.elements.vocabProgress) {
            const progress = (this.state.wordsThisLevel / this.state.targetWordsForLevel) * 100;
            this.elements.vocabProgress.style.width = Math.min(progress, 100) + '%';
        }
        
        if (this.elements.topProgressFill && this.elements.topProgressText && this.elements.topLevelText) {
            const progressPercent = (this.state.wordsThisLevel / this.state.targetWordsForLevel) * 100;
            this.elements.topProgressFill.style.width = Math.min(progressPercent, 100) + '%';
            this.elements.topProgressText.textContent = `${this.state.wordsThisLevel}/${this.state.targetWordsForLevel}`;
            this.elements.topLevelText.textContent = `Level ${this.state.level}`;
            
            if (CONFIG.FEATURES.SHOW_LEVEL_DESCRIPTIONS && this.state.levelDescription) {
                this.elements.topLevelText.title = this.state.levelDescription;
            }
        }
    }

    // Generate new words with AI
    async generateNewWords() {
        if (this.state.isGeneratingWords) {
            console.log('Already generating words, skipping...');
            return;
        }

        if (!CONFIG.FEATURES.USE_AI) {
            // Pass interests to fallback even when AI is disabled
            this.state.wordList = this.aiService.getFallbackWords(this.state.level, this.state.interests);
            this.showStatus('Words loaded!', 'success');
            return;
        }

        this.state.isGeneratingWords = true;
        if (this.elements.aiLoading) {
            this.elements.aiLoading.classList.remove('hidden');
        }
        
        // Show generating status
        this.showStatus('Generating related words...', 'info');

        try {
            const userData = {
                level: this.state.level,
                interests: this.state.interests,  // Pass interests
                mistakes: this.state.mistakes,
                masteredWords: this.state.masteredWords,
                wpm: this.calculateWPM()
            };

            const words = await this.aiService.generateWordList(userData);
            
            if (words && words.length > 0) {
                this.state.wordList = words;
                this.showStatus('Ready to Play!', 'success');
                console.log('Sample words:', words.slice(0, 5));
                
                // Analyze performance after getting new words
                if (CONFIG.FEATURES.ADAPTIVE_DIFFICULTY) {
                    await this.analyzePerformance();
                }
            } else {
                // Already handled in generateWordList fallback
                this.state.wordList = this.aiService.getFallbackWords(this.state.level, this.state.interests);
                this.showStatus('Using fallback word list', 'info');
            }
        } catch (error) {
            console.error('AI generation failed:', error);
            // Use interest-specific fallback
            this.state.wordList = this.aiService.getFallbackWords(this.state.level, this.state.interests);
            this.showStatus('⚠️ Using fallback words', 'warning');
        } finally {
            this.state.isGeneratingWords = false;
            if (this.elements.aiLoading) {
                this.elements.aiLoading.classList.add('hidden');
            }
        }
    }

    // Analyze performance
    async analyzePerformance() {
        if (!CONFIG.FEATURES.ADAPTIVE_DIFFICULTY || !this.aiService) return;

        try {
            const performanceData = {
                level: this.state.level,
                accuracy: this.state.wordsTyped > 0 
                    ? Math.round((this.state.correctWords / this.state.wordsTyped) * 100) 
                    : 100,
                wpm: this.calculateWPM(),
                reactionTime: this.state.reactionTimes.length > 0 
                    ? Math.round(this.state.reactionTimes.reduce((a, b) => a + b, 0) / 
                      this.state.reactionTimes.length)
                    : 0,
                mistakes: this.state.mistakes.slice(-5),
                masteredWords: this.state.masteredWords.slice(-10),
                speedMultiplier: this.state.speedMultiplier,
                interests: this.state.interests // Pass interests
            };

            const analysis = await this.aiService.analyzePerformance(performanceData);
            
            if (analysis) {
                this.lastAnalysis = analysis; // Store the analysis
                const targetSpeed = Math.min(2.0, Math.max(0.8, analysis.newSpeed));
                this.state.speedMultiplier = targetSpeed;
                
                this.updateInsights(analysis);
                
                console.log('Performance analysis applied:', analysis);
            }
        } catch (error) {
            console.error('Performance analysis failed:', error);
        }
    }

    // Update performance analysis - NEW METHOD for real-time updates
    updatePerformanceAnalysis() {
        if (!this.state.gameActive || this.state.wordsTyped < 3) {
            // Not enough data yet
            if (this.elements.performanceInsight) {
                this.elements.performanceInsight.innerHTML = `
                    <p class="insight-text">⏳ Type at least 3 words to see performance analysis...</p>
                    <div class="metrics">
                        <div class="metric">
                            <span class="metric-label">Current WPM:</span>
                            <span class="metric-value">${this.calculateWPM() || '-'}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Accuracy:</span>
                            <span class="metric-value">${this.state.wordsTyped > 0 ? Math.round((this.state.correctWords / this.state.wordsTyped) * 100) : 0}%</span>
                        </div>
                    </div>
                `;
            }
            return;
        }

        // Calculate performance metrics
        const accuracy = this.state.wordsTyped > 0 
            ? Math.round((this.state.correctWords / this.state.wordsTyped) * 100) 
            : 0;
        
        const wpm = this.calculateWPM();
        
        const avgReaction = this.state.reactionTimes.length > 0 
            ? Math.round(this.state.reactionTimes.reduce((a, b) => a + b, 0) / this.state.reactionTimes.length)
            : 0;
        
        // Generate strengths and weaknesses based on actual data
        let strengths = [];
        let weaknesses = [];
        let focusArea = '';

        // Analyze accuracy
        if (accuracy >= 90) {
            strengths.push('Excellent accuracy!');
        } else if (accuracy >= 75) {
            strengths.push('Good accuracy');
            weaknesses.push('Room for accuracy improvement');
        } else {
            weaknesses.push('Low accuracy - focus on typing correctly');
        }

        // Analyze speed
        if (wpm >= 60) {
            strengths.push('Lightning fast typing!');
        } else if (wpm >= 40) {
            strengths.push('Good typing speed');
        } else if (wpm >= 20) {
            weaknesses.push('Speed could be faster');
        } else if (wpm > 0) {
            weaknesses.push('Slow typing speed - practice more');
        }

        // Analyze reaction time
        if (avgReaction > 0) {
            if (avgReaction <= 1000) {
                strengths.push('Quick reactions!');
            } else if (avgReaction <= 2000) {
                strengths.push('Decent reaction time');
            } else {
                weaknesses.push('Slow reaction time - try to type faster');
            }
        }

        // Analyze combo
        if (this.state.highestCombo >= 10) {
            strengths.push(`Amazing ${this.state.highestCombo} word combo!`);
        } else if (this.state.highestCombo >= 5) {
            strengths.push(`Good ${this.state.highestCombo} word combo`);
        }

        // Determine focus area
        if (accuracy < 80) {
            focusArea = 'Improve accuracy - type more carefully';
        } else if (wpm < 30) {
            focusArea = 'Increase typing speed';
        } else if (avgReaction > 2000) {
            focusArea = 'React faster to falling words';
        } else {
            focusArea = 'Keep up the great work!';
        }

        // Format strengths and weaknesses
        const strengthsText = strengths.length > 0 ? strengths.join(' ') : 'Keep practicing!';
        const weaknessesText = weaknesses.length > 0 ? weaknesses.join(', ') : 'No major weaknesses detected';

        // Update the performance insight display
        if (this.elements.performanceInsight) {
            this.elements.performanceInsight.innerHTML = `
                <div class="metrics">
                    <div class="metric">
                        <span class="metric-label">Accuracy:</span>
                        <span class="metric-value">${accuracy}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">WPM:</span>
                        <span class="metric-value">${wpm}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Reaction:</span>
                        <span class="metric-value">${avgReaction}ms</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Combo:</span>
                        <span class="metric-value">${this.state.highestCombo}</span>
                    </div>
                </div>
            `;
        }

        // Also update recommended words based on performance and interests
        if (this.elements.recommendedTags) {
            // Generate word recommendations based on performance and interests
            let recommendedWords = [];
            
            if (accuracy < 70) {
                // Recommend shorter words from interest sets for accuracy practice
                const shortWords = this.state.wordList.filter(w => w.length <= 4);
                recommendedWords = shortWords.slice(0, 3);
            } else if (wpm < 30) {
                // Recommend common words from interests for speed practice
                recommendedWords = this.state.wordList.slice(0, 3);
            } else {
                // Recommend some interesting words from the word list
                recommendedWords = this.state.wordList.slice(0, 3);
            }
            
            if (recommendedWords.length > 0) {
                this.elements.recommendedTags.innerHTML = recommendedWords
                    .map(word => `<span class="tag tag-suggestion">${word}</span>`)
                    .join('');
            }
        }

        // Store this analysis
        this.lastAnalysis = {
            strengths: strengthsText,
            weaknesses: weaknessesText,
            focusArea: focusArea
        };
    }

    // Update insights - FIXED VERSION
    updateInsights(analysis) {
        // Use the new performance analysis method for real data
        this.updatePerformanceAnalysis();

        // Update recommended words if analysis has them (for AI-generated recommendations)
        if (this.elements.recommendedTags) {
            if (analysis && analysis.practiceWords && analysis.practiceWords.length > 0) {
                this.elements.recommendedTags.innerHTML = analysis.practiceWords
                    .map(word => `<span class="tag tag-suggestion">${word}</span>`)
                    .join('');
            } else if (this.state.wordList.length > 0) {
                // Show some default suggestions from current word list
                const defaultWords = this.state.wordList.slice(0, 3);
                if (defaultWords.length > 0) {
                    this.elements.recommendedTags.innerHTML = defaultWords
                        .map(word => `<span class="tag tag-suggestion">${word}</span>`)
                        .join('');
                }
            }
        }

        // ALWAYS update common mistakes from state.mistakes
        if (this.elements.mistakeTags) {
            if (this.state.mistakes.length > 0) {
                // Count frequency of mistakes
                const mistakeFrequency = {};
                this.state.mistakes.forEach(word => {
                    mistakeFrequency[word] = (mistakeFrequency[word] || 0) + 1;
                });
                
                // Get top 5 most frequent mistakes
                const frequentMistakes = Object.entries(mistakeFrequency)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([word, count]) => ({ word, count }));
                
                this.elements.mistakeTags.innerHTML = frequentMistakes
                    .map(m => `<span class="tag tag-mistake">${m.word} (${m.count}x)</span>`)
                    .join('');
            } else {
                this.elements.mistakeTags.innerHTML = '<span class="tag tag-mistake">No mistakes yet</span>';
            }
        }

        // Update vocabulary growth
        if (this.elements.growthText) {
            const masteredThisSession = this.state.masteredWords.length - this.sessionStartMasteredCount;
            
            if (masteredThisSession > 0) {
                this.elements.growthText.textContent = `✨ +${masteredThisSession} new words this session!`;
                this.elements.growthText.style.color = '#48bb78';
            } else {
                this.elements.growthText.textContent = 'Keep typing to learn new words!';
                this.elements.growthText.style.color = '';
            }
        }

        // Update mastered count
        if (this.elements.masteredCount) {
            this.elements.masteredCount.textContent = this.state.masteredWords.length;
        }
        
        // Update progress bar based on mastered words vs total words
        if (this.elements.vocabProgress) {
            const totalWordsInList = this.state.wordList.length || 30; // Fallback to 30
            const progressPercent = Math.min((this.state.masteredWords.length / totalWordsInList) * 100, 100);
            this.elements.vocabProgress.style.width = progressPercent + '%';
        }
    }

    // Refresh insights
    async refreshInsights() {
        if (this.elements.aiLoading) {
            this.elements.aiLoading.classList.remove('hidden');
        }
        
        // Force a performance analysis update
        this.updatePerformanceAnalysis();
        
        // Also try to get AI analysis if available
        if (CONFIG.FEATURES.ADAPTIVE_DIFFICULTY) {
            await this.analyzePerformance();
        }
        
        if (this.elements.aiLoading) {
            this.elements.aiLoading.classList.add('hidden');
        }
        this.showStatus('Insights refreshed!', 'success');
    }

    // Toggle insights
    toggleInsights() {
        const content = this.elements.insightsContent;
        const toggleBtn = this.elements.toggleInsightsBtn;
        
        if (content && toggleBtn) {
            if (content.classList.contains('hidden')) {
                content.classList.remove('hidden');
                toggleBtn.textContent = '▼';
            } else {
                content.classList.add('hidden');
                toggleBtn.textContent = '▶';
            }
        }
    }

    // Calculate WPM
    calculateWPM() {
        if (!this.state.startTime || this.state.wordsTyped === 0) return 0;
        const minutes = (Date.now() - this.state.startTime) / 60000;
        return Math.round((this.state.wordsTyped / 5) / Math.max(minutes, 0.1));
    }

    // End game - UPDATED with in-canvas modal
    endGame(type) {
        console.log('Game ended with type:', type); // Debug log
        
        if (this.elements.pauseMenu) {
            this.elements.pauseMenu.classList.add('hidden');
        }
        
        // Hide level complete overlay if visible
        if (this.elements.levelCompleteOverlay) {
            this.elements.levelCompleteOverlay.classList.add('hidden');
        }
        
        this.state.gameActive = false;
        this.state.paused = false;
        
        // Clear analysis timer
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
        
        if (this.elements.playfieldInputContainer) {
            this.elements.playfieldInputContainer.classList.add('hidden');
        }
        
        if (this.elements.playfieldWordInput) {
            this.elements.playfieldWordInput.disabled = true;
        }
        
        if (this.elements.wordInput) {
            this.elements.wordInput.disabled = true;
        }
        
        this.hideTextBox();
        
        if (CONFIG.FEATURES.SAVE_PROGRESS) {
            const stats = StorageManager.getGameStats();
            stats.totalGames++;
            stats.totalWordsTyped += this.state.wordsTyped;
            stats.totalCorrectWords += this.state.correctWords;
            stats.highestLevel = Math.max(stats.highestLevel, this.state.level);
            stats.bestScore = Math.max(stats.bestScore, this.state.score);
            stats.highestCombo = Math.max(stats.highestCombo || 0, this.state.highestCombo);
            StorageManager.saveGameStats(stats);
            
            StorageManager.saveHighScore(this.state.score, this.state.level);
        }
        
        // Calculate accuracy
        const accuracy = this.state.wordsTyped > 0 
            ? Math.round((this.state.correctWords / this.state.wordsTyped) * 100) 
            : 0;
        
        if (type === 'victory') {
            this.showVictoryModal(accuracy);
        } else {
            this.showGameOverModal(accuracy);
        }
    }

    // Show game over modal inside canvas
    showGameOverModal(accuracy) {
        // Remove any existing modal first
        this.removeExistingGameOverModal();
        
        // Create dark overlay
        const overlay = document.createElement('div');
        overlay.className = 'game-overlay-dark';
        overlay.id = 'gameOverOverlay';
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'game-over-modal';
        modal.id = 'gameOverModalCanvas';
        
        // Generate tip based on performance
        let tip = '';
        if (accuracy < 50) {
            tip = 'Focus on accuracy before speed!';
        } else if (this.state.level < 3) {
            tip = 'Keep practicing the basics!';
        } else if (this.state.highestCombo > 10) {
            tip = `Great combo of ${this.state.highestCombo}! Keep it up!`;
        } else {
            tip = 'Try to type the lowest word first!';
        }
        
        modal.innerHTML = `
            <h2 class="game-over-title">Game Over</h2>
            <div class="game-over-stats">
                <div class="stat-row">
                    <span class="stat-label"> Level Reached</span>
                    <span class="stat-value">${this.state.level}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"> Words Typed</span>
                    <span class="stat-value">${this.state.wordsTyped}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"> Best Combo</span>
                    <span class="stat-value">${this.state.highestCombo}</span>
                </div>
            </div>
            <div class="game-over-actions">
                <button class="btn-game-over primary" id="tryAgainBtnCanvas">Try Again</button>
                <button class="btn-game-over secondary" id="menuBtnCanvas">Main Menu</button>
            </div>
        `;
        
        // Add to game canvas container
        this.elements.gameCanvasContainer.appendChild(overlay);
        this.elements.gameCanvasContainer.appendChild(modal);
        
        // Add event listeners
        document.getElementById('tryAgainBtnCanvas').addEventListener('click', () => {
            this.removeExistingGameOverModal();
            this.resetToNewGame();
        });
        
        document.getElementById('menuBtnCanvas').addEventListener('click', () => {
            this.removeExistingGameOverModal();
            this.resetToNewGame();
            // Show start button
            if (this.elements.inPlayfieldStart) {
                this.elements.inPlayfieldStart.classList.remove('hidden');
            }
        });
    }

    // Show victory modal inside canvas
    showVictoryModal(accuracy) {
        // Remove any existing modal first
        this.removeExistingGameOverModal();
        
        // Create dark overlay
        const overlay = document.createElement('div');
        overlay.className = 'game-overlay-dark';
        overlay.id = 'gameOverOverlay';
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'game-over-modal';
        modal.id = 'victoryModalCanvas';
        
        modal.innerHTML = `
            <div class="game-over-icon">🏆</div>
            <h2 class="game-over-title">Victory!</h2>
            <div class="game-over-stats">
                <div class="stat-row">
                    <span class="stat-label"><span>📊</span> All Levels Complete</span>
                    <span class="stat-value">10/10</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><span>📝</span> Total Words</span>
                    <span class="stat-value">${this.state.wordsTyped}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><span>⚡</span> Best Combo</span>
                    <span class="stat-value">${this.state.highestCombo}</span>
                </div>
                <div class="accuracy-bar-container">
                    <div class="accuracy-label">
                        <span>Accuracy</span>
                        <span>${accuracy}%</span>
                    </div>
                    <div class="accuracy-bar-bg">
                        <div class="accuracy-bar-fill" style="width: ${accuracy}%"></div>
                    </div>
                </div>
                <div class="game-over-tips">
                    <div class="tip-text">
                        <span class="tip-icon">🌟</span>
                        Words Mastered: ${this.state.masteredWords.length}
                    </div>
                    <div class="tip-text">
                        <span class="tip-icon">🎮</span>
                        Amazing performance! Play again?
                    </div>
                </div>
            </div>
            <div class="game-over-actions">
                <button class="btn-game-over primary" id="playAgainBtnCanvas">Play Again</button>
                <button class="btn-game-over secondary" id="menuBtnCanvas">Main Menu</button>
            </div>
        `;
        
        // Add to game canvas container
        this.elements.gameCanvasContainer.appendChild(overlay);
        this.elements.gameCanvasContainer.appendChild(modal);
        
        // Add confetti effect for victory
        this.createConfetti();
        
        // Add event listeners
        document.getElementById('playAgainBtnCanvas').addEventListener('click', () => {
            this.removeExistingGameOverModal();
            this.resetToNewGame();
        });
        
        document.getElementById('menuBtnCanvas').addEventListener('click', () => {
            this.removeExistingGameOverModal();
            this.resetToNewGame();
            if (this.elements.inPlayfieldStart) {
                this.elements.inPlayfieldStart.classList.remove('hidden');
            }
        });
    }

    // Remove existing game over modal
    removeExistingGameOverModal() {
        const existingOverlay = document.getElementById('gameOverOverlay');
        const existingModal = document.getElementById('gameOverModalCanvas');
        const existingVictory = document.getElementById('victoryModalCanvas');
        
        if (existingOverlay) existingOverlay.remove();
        if (existingModal) existingModal.remove();
        if (existingVictory) existingVictory.remove();
    }

    // Create confetti effect for victory
    createConfetti() {
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.background = `hsl(${Math.random() * 360}, 70%, 60%)`;
                confetti.style.width = Math.random() * 10 + 5 + 'px';
                confetti.style.height = confetti.style.width;
                
                this.elements.gameCanvasContainer.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 3000);
            }, i * 50);
        }
    }

    // Reset game - Kept for backward compatibility, but now uses resetToNewGame
    resetGame() {
        console.log('Resetting game via old method...'); // Debug log
        
        // Clear analysis timer
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
        
        this.resetToNewGame();
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new TypingGame();
});