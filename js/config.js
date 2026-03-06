/**
 * Configuration file - PUT YOUR API KEY HERE!
 * 
 * INSTRUCTIONS:
 * 1. Replace 'YOUR_API_KEY_HERE' with your actual Gemini API key
 * 2. Adjust level settings below to customize difficulty
 * 3. Save this file
 */

const CONFIG = {
    // 🔑 REPLACE THIS WITH YOUR ACTUAL GEMINI API KEY
    GEMINI_API_KEY: 'AIzaSyCXx37yt1F7isPw5yl5yFsBGX3EFFbRL3Q',
    
    // ===========================================
    // 🎮 LEVEL CUSTOMIZATION
    // Customize each level individually!
    // ===========================================
    LEVELS: [
        // Level 1 - Very Easy (Tutorial)
        {
            wordsToAdvance: 3,        
            baseSpeed: 0.05,            
            maxWordsOnScreen: 1,        
            description: "Tutorial - Take your time!"
        },
        // Level 2 - Easy
        {
            wordsToAdvance: 5,
            baseSpeed: 0.05,
            maxWordsOnScreen: 1,
            description: "Getting comfortable"
        },
        // Level 3 - Still Easy
        {
            wordsToAdvance: 8,
            baseSpeed: 0.055,
            maxWordsOnScreen: 1,
            description: "Building confidence"
        },
        // Level 4 - Medium-Easy
        {
            wordsToAdvance: 10,
            baseSpeed: 0.055,
            maxWordsOnScreen: 2,
            description: "Picking up pace"
        },
        // Level 5 - Medium
        {
            wordsToAdvance: 15,
            baseSpeed: 0.06,
            maxWordsOnScreen: 2,
            description: "Getting interesting"
        },
        // Level 6 - Medium
        {
            wordsToAdvance: 15,
            baseSpeed: 0.06,
            maxWordsOnScreen: 2,
            description: "Finding your rhythm"
        },
        // Level 7 - Medium-Hard
        {
            wordsToAdvance: 15,
            baseSpeed: 0.065,
            maxWordsOnScreen: 3,
            description: "Challenge mode"
        },
        // Level 8 - Hard
        {
            wordsToAdvance: 18,
            baseSpeed: 0.07,
            maxWordsOnScreen: 3,
            description: "Speed demon"
        },
        // Level 9 - Very Hard
        {
            wordsToAdvance: 20,
            baseSpeed: 0.075,
            maxWordsOnScreen: 3,
            description: "Almost there!"
        },
        // Level 10 - Expert
        {
            wordsToAdvance: 50,
            baseSpeed: 0.075,
            maxWordsOnScreen: 4,
            description: "Final challenge!"
        }
    ],
    
    // ===========================================
    // ⚙️ GLOBAL SETTINGS (apply to all levels)
    // ===========================================
    GLOBAL_SETTINGS: {
        INITIAL_LIVES: 3,                // Start with 5 lives
        MAX_LEVEL: 10,                    // Total levels (must match LEVELS array length)
        BASE_SPEED_MULTIPLIER: 1.0,       // Global speed multiplier (1.0 = normal)
        EARN_EXTRA_LIFE_EVERY: 200,       // Get an extra life every 200 correct words
        POINTS_PER_WORD: 10,               // Points for each correct word
        BONUS_POINTS_PER_LEVEL: 100        // Bonus points when leveling up
    },
    
    // ===========================================
    // 🤖 FEATURE FLAGS
    // ===========================================
    FEATURES: {
        USE_AI: true,                       // Use AI for word generation
        SAVE_PROGRESS: true,                 // Save to localStorage
        ADAPTIVE_DIFFICULTY: false,          // Set to false to use manual level settings
        SHOW_LEVEL_DESCRIPTIONS: true,       // Show level descriptions in game
        EXTRA_LIVES_FOR_ACCURACY: true       // Earn extra lives for 100% accuracy streaks
    }
};

// Validation - make sure LEVELS array has 10 levels
if (CONFIG.LEVELS.length !== 10) {
    console.warn('⚠️ LEVELS array should have 10 levels! Currently has', CONFIG.LEVELS.length);
}

// Don't modify this - it ensures the key is available
if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    console.warn('⚠️ Please set your Gemini API key in config.js');
}