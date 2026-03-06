const StorageManager = {
    // Keys for localStorage
    keys: {
        API_KEY: 'geminiApiKey',
        INTERESTS: 'userInterests',
        MISTAKES: 'mistakes',
        MASTERED_WORDS: 'masteredWords',
        TYPING_SPEED: 'typingSpeed',
        DIFFICULTY_LEVEL: 'difficultyLevel',
        GAME_STATS: 'gameStats',
        HIGH_SCORE: 'highScore',
        LEARNING_INSIGHTS: 'learningInsights'
    },

    // Save API key
    saveApiKey(key) {
        try {
            localStorage.setItem(this.keys.API_KEY, key);
            return true;
        } catch (error) {
            console.error('Failed to save API key:', error);
            return false;
        }
    },

    // Get API key
    getApiKey() {
        return localStorage.getItem(this.keys.API_KEY) || '';
    },

    // Save interests
    saveInterests(interests) {
        try {
            localStorage.setItem(this.keys.INTERESTS, JSON.stringify(interests));
            return true;
        } catch (error) {
            console.error('Failed to save interests:', error);
            return false;
        }
    },

    // Get interests
    getInterests() {
        const saved = localStorage.getItem(this.keys.INTERESTS);
        return saved ? JSON.parse(saved) : [];
    },

    // Save mistakes
    saveMistakes(mistakes) {
        try {
            // Keep only last 50 mistakes
            const recentMistakes = mistakes.slice(-50);
            localStorage.setItem(this.keys.MISTAKES, JSON.stringify(recentMistakes));
            return true;
        } catch (error) {
            console.error('Failed to save mistakes:', error);
            return false;
        }
    },

    // Get mistakes
    getMistakes() {
        const saved = localStorage.getItem(this.keys.MISTAKES);
        return saved ? JSON.parse(saved) : [];
    },

    // Save mastered words
    saveMasteredWords(words) {
        try {
            localStorage.setItem(this.keys.MASTERED_WORDS, JSON.stringify(words));
            return true;
        } catch (error) {
            console.error('Failed to save mastered words:', error);
            return false;
        }
    },

    // Get mastered words
    getMasteredWords() {
        const saved = localStorage.getItem(this.keys.MASTERED_WORDS);
        return saved ? JSON.parse(saved) : [];
    },

    // Save typing speed (WPM)
    saveTypingSpeed(wpm) {
        try {
            localStorage.setItem(this.keys.TYPING_SPEED, wpm.toString());
            return true;
        } catch (error) {
            console.error('Failed to save typing speed:', error);
            return false;
        }
    },

    // Get typing speed
    getTypingSpeed() {
        const saved = localStorage.getItem(this.keys.TYPING_SPEED);
        return saved ? parseInt(saved) : 0;
    },

    // Save difficulty level
    saveDifficultyLevel(level) {
        try {
            localStorage.setItem(this.keys.DIFFICULTY_LEVEL, level.toString());
            return true;
        } catch (error) {
            console.error('Failed to save difficulty level:', error);
            return false;
        }
    },

    // Get difficulty level
    getDifficultyLevel() {
        const saved = localStorage.getItem(this.keys.DIFFICULTY_LEVEL);
        return saved ? parseInt(saved) : 1;
    },

    // Save game stats
    saveGameStats(stats) {
        try {
            const currentStats = this.getGameStats();
            const updatedStats = { ...currentStats, ...stats };
            localStorage.setItem(this.keys.GAME_STATS, JSON.stringify(updatedStats));
            return true;
        } catch (error) {
            console.error('Failed to save game stats:', error);
            return false;
        }
    },

    // Get game stats
    getGameStats() {
        const saved = localStorage.getItem(this.keys.GAME_STATS);
        return saved ? JSON.parse(saved) : {
            totalGames: 0,
            totalWordsTyped: 0,
            totalCorrectWords: 0,
            highestLevel: 1,
            bestScore: 0,
            totalPlayTime: 0
        };
    },

    // Save high score
    saveHighScore(score, level) {
        try {
            const highScore = this.getHighScore();
            if (score > highScore.score) {
                localStorage.setItem(this.keys.HIGH_SCORE, JSON.stringify({
                    score,
                    level,
                    date: new Date().toISOString()
                }));
            }
            return true;
        } catch (error) {
            console.error('Failed to save high score:', error);
            return false;
        }
    },

    // Get high score
    getHighScore() {
        const saved = localStorage.getItem(this.keys.HIGH_SCORE);
        return saved ? JSON.parse(saved) : { score: 0, level: 1, date: null };
    },

    // Save learning insights
    saveLearningInsights(insights) {
        try {
            localStorage.setItem(this.keys.LEARNING_INSIGHTS, JSON.stringify(insights));
            return true;
        } catch (error) {
            console.error('Failed to save learning insights:', error);
            return false;
        }
    },

    // Get learning insights
    getLearningInsights() {
        const saved = localStorage.getItem(this.keys.LEARNING_INSIGHTS);
        return saved ? JSON.parse(saved) : {
            weakSpots: [],
            improvedWords: [],
            recommendedTopics: [],
            lastUpdated: null
        };
    },

    // Clear all game data
    clearAllData() {
        try {
            const apiKey = this.getApiKey(); // Preserve API key
            localStorage.clear();
            if (apiKey) {
                this.saveApiKey(apiKey); // Restore API key
            }
            return true;
        } catch (error) {
            console.error('Failed to clear data:', error);
            return false;
        }
    },

    // Export all data (for backup)
    exportData() {
        const data = {};
        Object.keys(this.keys).forEach(key => {
            data[this.keys[key]] = localStorage.getItem(this.keys[key]);
        });
        return data;
    },

    // Import data (from backup)
    importData(data) {
        try {
            Object.entries(data).forEach(([key, value]) => {
                if (value) {
                    localStorage.setItem(key, value);
                }
            });
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    },

    // Get storage usage info
    getStorageInfo() {
        let totalSize = 0;
        Object.keys(localStorage).forEach(key => {
            totalSize += (localStorage[key].length * 2) / 1024 / 1024; // Size in MB
        });
        return {
            itemCount: localStorage.length,
            totalSizeMB: totalSize.toFixed(2),
            percentUsed: ((totalSize / 5) * 100).toFixed(1) // Assuming 5MB limit
        };
    }
};