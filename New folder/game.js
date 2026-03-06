/**
 * Main Game Class - Complete version with level customization
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
            interests: ['technology', 'science'],
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
            highestCombo: 0
        };

        // DOM Elements
        this.elements = {};
        this.cacheDOMElements();
        
        // Bind methods
        this.bindMethods();
        
        // Animation frame
        this.animationFrame = null;
        
        // Initialize
        this.init();
    }

    // Cache DOM elements
    cacheDOMElements() {
        const elementIds = [
            'interestsPlaceholder',
            'interestsContainer',
            'levelDisplay', 'livesDisplay',
            'scoreDisplay', 'speedDisplay', 'accuracyDisplay', 'wordsDisplay',
            'gameCanvas', 'gameOverlay', 'wordInput', 'startGameBtn',
            'pauseGameBtn', 'generateWordsBtn', 'resetGameBtn', 'refreshInsightsBtn',
            'toggleInsightsBtn', 'insightsContent', 'aiLoading', 'performanceInsight',
            'avgReaction', 'wpmDisplay', 'recommendedTags', 'mistakeTags',
            'masteredCount', 'vocabProgress', 'growthText', 'toastContainer',
            'victoryModal', 'gameOverModal', 'victoryWords', 'victoryAccuracy',
            'gameOverLevel', 'gameOverWords'
        ];

        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }

    // Bind methods
    bindMethods() {
        this.gameLoop = this.gameLoop.bind(this);
        this.checkWord = this.checkWord.bind(this);
        this.spawnWord = this.spawnWord.bind(this);
        this.updateStats = this.updateStats.bind(this);
        this.togglePause = this.togglePause.bind(this);
        this.resetGame = this.resetGame.bind(this);
        this.generateNewWords = this.generateNewWords.bind(this);
        this.refreshInsights = this.refreshInsights.bind(this);
        this.toggleCustomInterest = this.toggleCustomInterest.bind(this);
    }

    // Initialize
    init() {
        // Load saved data
        this.loadSavedData();
        
        // Initialize event listeners
        this.initEventListeners();
        
        // Render interests
        this.renderInterests();
        
        // Start game loop
        this.gameLoop();
        
        // Auto-generate words on startup
        setTimeout(() => {
            if (CONFIG.FEATURES.USE_AI) {
                this.generateNewWords();
            }
        }, 1000);
        
        console.log('Game initialized with hardcoded API key');
        console.log(`Level 1: ${this.state.levelDescription}`);
    }

    // Initialize event listeners
    initEventListeners() {
        // Game controls
        this.elements.startGameBtn.addEventListener('click', () => this.startGame());
        this.elements.pauseGameBtn.addEventListener('click', this.togglePause);
        this.elements.resetGameBtn.addEventListener('click', this.resetGame);
        this.elements.generateWordsBtn.addEventListener('click', this.generateNewWords);
        
        // Word input
        this.elements.wordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkWord();
        });
        
        // Insights panel
        this.elements.refreshInsightsBtn.addEventListener('click', this.refreshInsights);
        this.elements.toggleInsightsBtn.addEventListener('click', () => this.toggleInsights());
    }

    // Load saved data from storage
    loadSavedData() {
        if (!CONFIG.FEATURES.SAVE_PROGRESS) return;
        
        this.state.mistakes = StorageManager.getMistakes();
        this.state.masteredWords = StorageManager.getMasteredWords();
        
        // Load interests if saved
        const savedInterests = StorageManager.getInterests();
        if (savedInterests.length > 0) {
            this.state.interests = savedInterests;
        }
        
        this.updateStats();
    }

    // Render interests in the custom UI
    renderInterests() {
        const interests = [
            'Science', 'Technology', 'Nature', 'Space', 
            'Animals', 'Food', 'Music', 'Sports', 'History'
        ];
        
        const container = this.elements.interestsContainer;
        if (!container) return;
        
        container.innerHTML = '';
        
        interests.forEach(interest => {
            const item = document.createElement('div');
            item.className = 'interest-item';
            if (this.state.interests.includes(interest.toLowerCase())) {
                item.classList.add('selected');
            }
            
            item.innerHTML = `
                <span class="interest-text">${interest}</span>
                <span class="interest-indicator"></span>
            `;
            
            item.addEventListener('click', () => this.toggleCustomInterest(interest));
            
            container.appendChild(item);
        });
    }

    // Toggle custom interest selection
    toggleCustomInterest(interest) {
        const interestLower = interest.toLowerCase();
        const items = this.elements.interestsContainer.children;
        
        // Find the clicked item
        let clickedItem = null;
        for (let item of items) {
            if (item.querySelector('.interest-text').textContent === interest) {
                clickedItem = item;
                break;
            }
        }
        
        if (this.state.interests.includes(interestLower)) {
            // Remove interest
            this.state.interests = this.state.interests.filter(i => i !== interestLower);
            if (clickedItem) {
                clickedItem.classList.remove('selected');
            }
        } else {
            // Add interest
            this.state.interests.push(interestLower);
            if (clickedItem) {
                clickedItem.classList.add('selected');
            }
        }
        
        // Save to storage
        if (CONFIG.FEATURES.SAVE_PROGRESS) {
            StorageManager.saveInterests(this.state.interests);
        }
        
        console.log('Selected interests:', this.state.interests);
    }

    // Start game
    startGame() {
        if (this.state.wordList.length === 0) {
            this.showToast('Generating words first...', 'info');
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
        
        this.elements.wordInput.disabled = false;
        this.elements.wordInput.focus();
        this.elements.startGameBtn.disabled = true;
        this.elements.pauseGameBtn.disabled = false;
        this.elements.generateWordsBtn.disabled = false;
        
        // Show level description
        this.showToast(`Level 1: ${this.state.levelDescription}`, 'info', 3000);
        
        this.updateStats();
    }

    // Toggle pause
    togglePause() {
        this.state.paused = !this.state.paused;
        this.elements.pauseGameBtn.textContent = this.state.paused ? '▶️ Resume' : '⏸️ Pause';
        this.elements.wordInput.disabled = this.state.paused;
        this.elements.gameOverlay.classList.toggle('hidden', !this.state.paused);
        
        if (!this.state.paused) {
            this.elements.wordInput.focus();
            this.state.lastSpawnTime = Date.now(); // Reset spawn timer
        }
    }

    // Check typed word
    checkWord() {
        if (!this.state.gameActive || this.state.paused) return;

        const input = this.elements.wordInput.value.trim().toLowerCase();
        if (!input) return;

        // Find the closest word (first active word)
        const activeWord = this.state.activeWords[0];
        if (!activeWord) return;

        const reactionTime = Date.now() - activeWord.startTime;
        
        if (activeWord.word === input) {
            this.handleCorrectWord(activeWord, reactionTime);
        } else {
            this.handleWrongWord(activeWord, input);
        }

        this.elements.wordInput.value = '';
        this.updateStats();
    }

    // Handle correct word
    handleCorrectWord(activeWord, reactionTime) {
        // Update stats
        this.state.reactionTimes.push(reactionTime);
        this.state.correctWords++;
        this.state.totalCorrectWords++;
        this.state.score += CONFIG.GLOBAL_SETTINGS.POINTS_PER_WORD;
        this.state.wordsTyped++;
        this.state.wordsThisLevel++;
        this.state.accuracyStreak++;
        this.state.combo++;
        
        // Update highest combo
        if (this.state.combo > this.state.highestCombo) {
            this.state.highestCombo = this.state.combo;
        }

        // Check for extra life based on streak
        if (CONFIG.FEATURES.EXTRA_LIVES_FOR_ACCURACY) {
            if (this.state.accuracyStreak === 20) {
                this.state.lives++;
                this.showToast('❤️ Extra life for 20 correct in a row!', 'success');
            } else if (this.state.accuracyStreak === 50) {
                this.state.lives += 2;
                this.showToast('❤️❤️ Amazing! 50 streak! +2 lives!', 'success');
            }
        }
        
        // Check for extra life based on total words
        if (CONFIG.GLOBAL_SETTINGS.EARN_EXTRA_LIFE_EVERY > 0) {
            if (this.state.totalCorrectWords % CONFIG.GLOBAL_SETTINGS.EARN_EXTRA_LIFE_EVERY === 0) {
                this.state.lives++;
                this.showToast('❤️ Bonus life!', 'success');
            }
        }

        // Track mastered words
        if (!this.state.masteredWords.includes(activeWord.word)) {
            this.state.masteredWords.push(activeWord.word);
            if (CONFIG.FEATURES.SAVE_PROGRESS) {
                StorageManager.saveMasteredWords(this.state.masteredWords);
            }
        }

        // Animate and remove word
        const wordElement = document.getElementById(activeWord.id);
        if (wordElement) {
            wordElement.classList.add('correct');
            setTimeout(() => {
                wordElement.remove();
            }, 300);
        }

        this.state.activeWords.shift();

        // Check level up
        if (this.state.wordsThisLevel >= this.state.targetWordsForLevel) {
            this.levelUp();
        }
    }

    // Handle wrong word
    handleWrongWord(activeWord, typedWord) {
        // Reset streak
        this.state.accuracyStreak = 0;
        this.state.combo = 0;
        
        // Track mistake
        if (!this.state.mistakes.includes(typedWord)) {
            this.state.mistakes.push(typedWord);
            if (this.state.mistakes.length > 50) {
                this.state.mistakes = this.state.mistakes.slice(-50);
            }
            if (CONFIG.FEATURES.SAVE_PROGRESS) {
                StorageManager.saveMistakes(this.state.mistakes);
            }
        }

        // Animate word as wrong
        const wordElement = document.getElementById(activeWord.id);
        if (wordElement) {
            wordElement.classList.add('wrong');
            
            // Show correct word on the word itself
            wordElement.textContent = `❌ ${activeWord.word}`;
            
            setTimeout(() => {
                wordElement.remove();
            }, 800);
        }

        this.state.activeWords.shift();
        
        // Show hint
        this.showToast(`❌ It was "${activeWord.word}"`, 'error', 1500);
    }

    // Level up
    async levelUp() {
        if (this.state.level >= CONFIG.GLOBAL_SETTINGS.MAX_LEVEL) {
            this.endGame('victory');
            return;
        }

        // Add bonus points
        this.state.score += CONFIG.GLOBAL_SETTINGS.BONUS_POINTS_PER_LEVEL;
        
        // Move to next level
        this.state.level++;
        
        // Get settings for new level
        const levelSettings = CONFIG.LEVELS[this.state.level - 1];
        this.state.targetWordsForLevel = levelSettings.wordsToAdvance;
        this.state.maxWordsOnScreen = levelSettings.maxWordsOnScreen;
        this.state.baseSpeed = levelSettings.baseSpeed;
        this.state.levelDescription = levelSettings.description;
        this.state.wordsThisLevel = 0;
        
        // Small speed multiplier increase (can be adjusted)
        this.state.speedMultiplier += 0.1;
        
        // Show level up message
        this.showToast(
            `🎉 Level ${this.state.level}! ${levelSettings.description}`, 
            'success',
            5000
        );
        
        if (CONFIG.FEATURES.SAVE_PROGRESS) {
            StorageManager.saveDifficultyLevel(this.state.level);
        }
        
        // Clear existing words
        this.state.activeWords.forEach(word => {
            const element = document.getElementById(word.id);
            if (element) element.remove();
        });
        this.state.activeWords = [];
        
        // Generate new words for next level
        if (CONFIG.FEATURES.USE_AI) {
            await this.generateNewWords();
            if (CONFIG.FEATURES.ADAPTIVE_DIFFICULTY) {
                await this.analyzePerformance();
            }
        }
        
        this.updateStats();
    }

    // Spawn new word
    spawnWord() {
        if (!this.state.gameActive || this.state.paused) return;
        
        // Check max words limit
        if (this.state.activeWords.length >= this.state.maxWordsOnScreen) return;

        // Rate limiting based on level
        const now = Date.now();
        const minSpawnInterval = 800 / (1 + (this.state.level * 0.1)); // Faster spawns at higher levels
        
        if (now - this.state.lastSpawnTime < minSpawnInterval) return;
        
        // Get word list
        const wordList = this.state.wordList.length > 0 ? 
            this.state.wordList : 
            this.aiService?.getFallbackWords(this.state.level) || 
            ['cat', 'dog', 'sun', 'run', 'book', 'fish', 'tree', 'bird'];

        // Select word based on level (harder words more frequent in higher levels)
        let word;
        if (this.state.level > 7) {
            // Higher levels: random from whole list
            word = wordList[Math.floor(Math.random() * wordList.length)];
        } else {
            // Lower levels: prefer shorter words
            const shortWords = wordList.filter(w => w.length <= 5);
            if (shortWords.length > 0 && Math.random() < 0.7) {
                word = shortWords[Math.floor(Math.random() * shortWords.length)];
            } else {
                word = wordList[Math.floor(Math.random() * wordList.length)];
            }
        }
        
        // Create word element
        const wordId = `word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const wordElement = document.createElement('div');
        wordElement.className = 'word';
        wordElement.id = wordId;
        wordElement.textContent = word;
        wordElement.style.top = '0px';
        
        // Random horizontal position (avoid edges)
        const leftPos = 10 + Math.random() * 60;
        wordElement.style.left = `${leftPos}%`;
        
        // Add level description as tooltip
        wordElement.title = `Level ${this.state.level}: ${this.state.levelDescription}`;
        
        // Add visual indicator for word length
        if (word.length > 8) {
            wordElement.style.fontSize = '1em'; // Slightly smaller for long words
            wordElement.style.padding = '10px 20px';
        }
        
        this.elements.gameCanvas.appendChild(wordElement);
        
        this.state.activeWords.push({
            id: wordId,
            word: word,
            element: wordElement,
            startTime: now,
            top: 0,
            left: leftPos,
            length: word.length
        });
        
        this.state.lastSpawnTime = now;
    }

    // Game loop
    gameLoop(timestamp) {
        if (!this.state.lastFrameTime) {
            this.state.lastFrameTime = timestamp;
            this.animationFrame = requestAnimationFrame(this.gameLoop);
            return;
        }

        if (this.state.gameActive && !this.state.paused) {
            const deltaTime = Math.min(timestamp - this.state.lastFrameTime, 100); // Cap delta time
            
            // Update game time
            this.state.gameTime += deltaTime;
            
            // Move active words
            this.state.activeWords.forEach((word, index) => {
                // Use level-specific base speed
                const speed = (this.state.baseSpeed * this.state.speedMultiplier) * 
                             (word.length > 7 ? 0.9 : 1.0); // Long words fall slightly slower
                
                word.top += speed * deltaTime;
                
                const element = document.getElementById(word.id);
                if (element) {
                    element.style.top = word.top + 'px';
                    
                    // Add slight sway based on word length
                    if (word.length > 6) {
                        const sway = Math.sin(this.state.gameTime / 200 + index) * 2;
                        element.style.left = `calc(${word.left}% + ${sway}px)`;
                    }
                    
                    // Check if word hit bottom
                    if (word.top > this.elements.gameCanvas.clientHeight - 70) {
                        this.handleMissedWord(word, index);
                    }
                }
            });

            // Spawn new words
            this.spawnWord();
        }

        this.state.lastFrameTime = timestamp;
        this.animationFrame = requestAnimationFrame(this.gameLoop);
    }

    // Handle missed word
    handleMissedWord(word, index) {
        this.state.lives--;
        this.state.accuracyStreak = 0;
        this.state.combo = 0;
        this.state.activeWords.splice(index, 1);
        
        const element = document.getElementById(word.id);
        if (element) {
            element.classList.add('wrong');
            element.textContent = `💔 ${word.word}`;
            element.style.backgroundColor = '#f56565';
            
            setTimeout(() => {
                element.remove();
            }, 500);
        }

        // Track mistake
        if (!this.state.mistakes.includes(word.word)) {
            this.state.mistakes.push(word.word);
            if (CONFIG.FEATURES.SAVE_PROGRESS) {
                StorageManager.saveMistakes(this.state.mistakes);
            }
        }

        this.updateStats();

        // Check game over
        if (this.state.lives <= 0) {
            this.endGame('gameover');
        }
    }

    // Update stats
    updateStats() {
        // Basic stats
        this.elements.levelDisplay.textContent = this.state.level;
        
        // Add level description as tooltip
        if (CONFIG.FEATURES.SHOW_LEVEL_DESCRIPTIONS) {
            this.elements.levelDisplay.parentElement.title = this.state.levelDescription;
        }
        
        this.elements.livesDisplay.textContent = this.state.lives;
        this.elements.scoreDisplay.textContent = this.state.score;
        this.elements.speedDisplay.textContent = (this.state.baseSpeed * this.state.speedMultiplier).toFixed(2) + 'x';
        this.elements.wordsDisplay.textContent = `${this.state.wordsThisLevel}/${this.state.targetWordsForLevel}`;
        
        // Calculate accuracy
        const accuracy = this.state.wordsTyped > 0 
            ? Math.round((this.state.correctWords / this.state.wordsTyped) * 100) 
            : 100;
        this.elements.accuracyDisplay.textContent = accuracy + '%';
        
        // Show streak if > 0
        if (this.state.accuracyStreak > 5) {
            this.elements.accuracyDisplay.innerHTML += ` 🔥 ${this.state.accuracyStreak}`;
        }
        
        // Show combo if > 1
        if (this.state.combo > 1) {
            this.elements.accuracyDisplay.innerHTML += ` ⚡ ${this.state.combo}x`;
        }
        
        // Calculate WPM
        if (this.state.startTime && this.state.wordsTyped > 0) {
            const minutes = (Date.now() - this.state.startTime) / 60000;
            const wpm = Math.round((this.state.wordsTyped / 5) / Math.max(minutes, 0.1)); // Standard WPM formula
            this.elements.wpmDisplay.textContent = wpm;
        }
        
        // Calculate average reaction time
        if (this.state.reactionTimes.length > 0) {
            const avgReaction = Math.round(
                this.state.reactionTimes.reduce((a, b) => a + b, 0) / 
                this.state.reactionTimes.length
            );
            this.elements.avgReaction.textContent = avgReaction + 'ms';
        }
        
        // Update mastered words count
        this.elements.masteredCount.textContent = this.state.masteredWords.length;
        
        // Update progress bar
        const progress = (this.state.wordsThisLevel / this.state.targetWordsForLevel) * 100;
        this.elements.vocabProgress.style.width = Math.min(progress, 100) + '%';
        
        // Warning for low lives
        if (this.state.lives === 1) {
            this.elements.livesDisplay.classList.add('warning');
        } else {
            this.elements.livesDisplay.classList.remove('warning');
        }
    }

    // Generate new words with AI
    async generateNewWords() {
        if (!CONFIG.FEATURES.USE_AI) {
            this.state.wordList = this.aiService.getFallbackWords(this.state.level);
            return;
        }

        this.elements.aiLoading.classList.remove('hidden');
        this.elements.generateWordsBtn.disabled = true;

        try {
            const userData = {
                level: this.state.level,
                interests: this.state.interests,
                mistakes: this.state.mistakes,
                masteredWords: this.state.masteredWords,
                wpm: this.calculateWPM()
            };

            const words = await this.aiService.generateWordList(userData);
            
            if (words && words.length > 0) {
                this.state.wordList = words;
                this.showToast(`✨ Generated ${words.length} AI-powered words for Level ${this.state.level}!`, 'success');
                
                // Log first few words for debugging
                console.log('Sample words:', words.slice(0, 5));
            } else {
                this.state.wordList = this.aiService.getFallbackWords(this.state.level);
                this.showToast('Using fallback word list', 'info');
            }
        } catch (error) {
            console.error('AI generation failed:', error);
            this.state.wordList = this.aiService.getFallbackWords(this.state.level);
            this.showToast('⚠️ Using fallback words (AI unavailable)', 'warning');
        } finally {
            this.elements.aiLoading.classList.add('hidden');
            this.elements.generateWordsBtn.disabled = false;
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
                speedMultiplier: this.state.speedMultiplier
            };

            const analysis = await this.aiService.analyzePerformance(performanceData);
            
            if (analysis) {
                // Adjust speed multiplier based on performance (but respect level caps)
                const targetSpeed = Math.min(2.0, Math.max(0.8, analysis.newSpeed));
                this.state.speedMultiplier = targetSpeed;
                
                this.updateInsights(analysis);
                
                console.log('Performance analysis applied:', analysis);
            }
        } catch (error) {
            console.error('Performance analysis failed:', error);
        }
    }

    // Update insights
    updateInsights(analysis) {
        if (!analysis) return;

        // Update performance insight
        if (this.elements.performanceInsight) {
            let strengths = analysis.strengths || 'Keep practicing!';
            let weaknesses = analysis.weaknesses || 'Focus on accuracy';
            let focus = analysis.focusArea || 'Continue playing';
            
            // Add combo info if available
            if (this.state.highestCombo > 5) {
                strengths += ` Best combo: ${this.state.highestCombo}!`;
            }
            
            this.elements.performanceInsight.innerHTML = `
                <p class="insight-text">✅ ${strengths}</p>
                <p class="insight-text">⚠️ ${weaknesses}</p>
                <p class="insight-text"><strong>🎯 Focus:</strong> ${focus}</p>
            `;
        }

        // Update recommended words
        if (analysis.practiceWords && this.elements.recommendedTags) {
            this.elements.recommendedTags.innerHTML = analysis.practiceWords
                .map(word => `<span class="tag tag-suggestion">${word}</span>`)
                .join('');
        }

        // Update mistake tags
        if (this.state.mistakes.length > 0 && this.elements.mistakeTags) {
            // Count frequency of mistakes
            const mistakeFrequency = {};
            this.state.mistakes.forEach(word => {
                mistakeFrequency[word] = (mistakeFrequency[word] || 0) + 1;
            });
            
            // Sort by frequency
            const frequentMistakes = Object.entries(mistakeFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([word, count]) => ({ word, count }));
            
            this.elements.mistakeTags.innerHTML = frequentMistakes
                .map(m => `<span class="tag tag-mistake">${m.word} (${m.count}x)</span>`)
                .join('');
        }

        // Update growth text
        if (this.elements.growthText) {
            const masteredThisSession = this.state.masteredWords.length - 
                (StorageManager.getMasteredWords().length || 0);
            
            if (masteredThisSession > 0) {
                this.elements.growthText.textContent = `✨ +${masteredThisSession} new words this session!`;
                this.elements.growthText.style.color = '#48bb78';
            } else {
                this.elements.growthText.textContent = 'Keep typing to learn new words!';
                this.elements.growthText.style.color = '';
            }
        }
    }

    // Refresh insights
    async refreshInsights() {
        this.elements.aiLoading.classList.remove('hidden');
        await this.analyzePerformance();
        this.elements.aiLoading.classList.add('hidden');
        this.showToast('Insights refreshed!', 'success');
    }

    // Toggle insights
    toggleInsights() {
        const content = this.elements.insightsContent;
        const toggleBtn = this.elements.toggleInsightsBtn;
        
        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            toggleBtn.textContent = '▼';
        } else {
            content.classList.add('hidden');
            toggleBtn.textContent = '▶';
        }
    }

    // Calculate WPM
    calculateWPM() {
        if (!this.state.startTime || this.state.wordsTyped === 0) return 0;
        const minutes = (Date.now() - this.state.startTime) / 60000;
        // Standard WPM: (characters / 5) / minutes
        return Math.round((this.state.wordsTyped / 5) / Math.max(minutes, 0.1));
    }

    // End game
    endGame(type) {
        this.state.gameActive = false;
        this.state.paused = false;
        
        this.elements.wordInput.disabled = true;
        this.elements.startGameBtn.disabled = false;
        this.elements.pauseGameBtn.disabled = true;
        this.elements.pauseGameBtn.textContent = '⏸️ Pause';
        
        // Save stats
        if (CONFIG.FEATURES.SAVE_PROGRESS) {
            const stats = StorageManager.getGameStats();
            stats.totalGames++;
            stats.totalWordsTyped += this.state.wordsTyped;
            stats.totalCorrectWords += this.state.correctWords;
            stats.highestLevel = Math.max(stats.highestLevel, this.state.level);
            stats.bestScore = Math.max(stats.bestScore, this.state.score);
            stats.highestCombo = Math.max(stats.highestCombo || 0, this.state.highestCombo);
            StorageManager.saveGameStats(stats);
            
            // Save high score
            StorageManager.saveHighScore(this.state.score, this.state.level);
        }
        
        if (type === 'victory') {
            this.elements.victoryWords.textContent = this.state.wordsTyped;
            const accuracy = this.state.wordsTyped > 0 
                ? Math.round((this.state.correctWords / this.state.wordsTyped) * 100) 
                : 0;
            this.elements.victoryAccuracy.textContent = accuracy;
            this.elements.victoryModal.classList.remove('hidden');
            
            // Show combo if impressive
            if (this.state.highestCombo > 20) {
                this.showToast(`🏆 Amazing ${this.state.highestCombo} word combo!`, 'success', 5000);
            }
        } else {
            this.elements.gameOverLevel.textContent = this.state.level;
            this.elements.gameOverWords.textContent = this.state.wordsTyped;
            this.elements.gameOverModal.classList.remove('hidden');
            
            // Encouraging message
            if (this.state.level > 5) {
                this.showToast('Great effort! You made it to level ' + this.state.level, 'info', 3000);
            }
        }
    }

    // Reset game
    resetGame() {
        // Clear active words
        this.state.activeWords.forEach(word => {
            const element = document.getElementById(word.id);
            if (element) element.remove();
        });
        
        // Get level 1 settings
        const level1Settings = CONFIG.LEVELS[0];
        
        // Reset state
        this.state = {
            ...this.state,
            gameActive: false,
            paused: false,
            level: 1,
            lives: CONFIG.GLOBAL_SETTINGS.INITIAL_LIVES,
            score: 0,
            wordsTyped: 0,
            correctWords: 0,
            totalCorrectWords: 0,
            speedMultiplier: 1.0,
            activeWords: [],
            reactionTimes: [],
            wordsThisLevel: 0,
            accuracyStreak: 0,
            combo: 0,
            highestCombo: 0,
            targetWordsForLevel: level1Settings.wordsToAdvance,
            maxWordsOnScreen: level1Settings.maxWordsOnScreen,
            baseSpeed: level1Settings.baseSpeed,
            levelDescription: level1Settings.description,
            startTime: null,
            lastSpawnTime: 0,
            gameTime: 0
        };
        
        // Update UI
        this.elements.gameOverlay.classList.add('hidden');
        this.elements.wordInput.disabled = true;
        this.elements.startGameBtn.disabled = false;
        this.elements.pauseGameBtn.disabled = true;
        this.elements.pauseGameBtn.textContent = '⏸️ Pause';
        
        // Hide modals
        this.elements.victoryModal.classList.add('hidden');
        this.elements.gameOverModal.classList.add('hidden');
        
        // Re-render interests with reset state
        this.renderInterests();
        
        this.updateStats();
        this.showToast('Game reset! Ready to play!', 'success');
        
        // Regenerate words for level 1
        if (CONFIG.FEATURES.USE_AI) {
            setTimeout(() => this.generateNewWords(), 500);
        }
    }

    // Show toast
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">×</button>
        `;
        
        this.elements.toastContainer.appendChild(toast);
        
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    // Get current level settings (utility method)
    getCurrentLevelSettings() {
        return CONFIG.LEVELS[this.state.level - 1];
    }

    // Preview next level (utility method)
    previewNextLevel() {
        if (this.state.level < CONFIG.GLOBAL_SETTINGS.MAX_LEVEL) {
            const nextLevel = CONFIG.LEVELS[this.state.level];
            return {
                level: this.state.level + 1,
                description: nextLevel.description,
                wordsNeeded: nextLevel.wordsToAdvance,
                speed: nextLevel.baseSpeed
            };
        }
        return null;
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new TypingGame();
});