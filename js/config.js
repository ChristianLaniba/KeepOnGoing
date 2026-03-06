const CONFIG = {
    GEMINI_API_KEY: 'AIzaSyCXx37yt1F7isPw5yl5yFsBGX3EFFbRL3Q',
    
    LEVELS: [
        //Level 1
        {
            wordsToAdvance: 3,        
            baseSpeed: 0.05,            
            maxWordsOnScreen: 1,        
            description: "Tutorial - Take your time!"
        },
        //Level 2
        {
            wordsToAdvance: 5,
            baseSpeed: 0.05,
            maxWordsOnScreen: 1,
            description: "Getting comfortable"
        },
        //Level 3
        {
            wordsToAdvance: 8,
            baseSpeed: 0.054,
            maxWordsOnScreen: 1,
            description: "Building confidence"
        },
        //Level 4
        {
            wordsToAdvance: 10,
            baseSpeed: 0.054,
            maxWordsOnScreen: 2,
            description: "Picking up pace"
        },
        //Level 5
        {
            wordsToAdvance: 15,
            baseSpeed: 0.058,
            maxWordsOnScreen: 2,
            description: "Getting interesting"
        },
        //Level 6
        {
            wordsToAdvance: 15,
            baseSpeed: 0.058,
            maxWordsOnScreen: 2,
            description: "Finding your rhythm"
        },
        //Level 7
        {
            wordsToAdvance: 15,
            baseSpeed: 0.062,
            maxWordsOnScreen: 3,
            description: "Challenge mode"
        },
        //Level 8
        {
            wordsToAdvance: 18,
            baseSpeed: 0.066,
            maxWordsOnScreen: 3,
            description: "Speed demon"
        },
        //Level 9
        {
            wordsToAdvance: 20,
            baseSpeed: 0.07,
            maxWordsOnScreen: 3,
            description: "Almost there!"
        },
        //Level 10
        {
            wordsToAdvance: 25,
            baseSpeed: 0.07,
            maxWordsOnScreen: 4,
            description: "Final challenge!"
        }
    ],
    



    GLOBAL_SETTINGS: {
        INITIAL_LIVES: 3,                
        MAX_LEVEL: 10,                    
        BASE_SPEED_MULTIPLIER: 1.0,       
        EARN_EXTRA_LIFE_EVERY: 200,       
        POINTS_PER_WORD: 10,              
        BONUS_POINTS_PER_LEVEL: 100      
    },
    

    

    FEATURES: {
        USE_AI: true,                       
        SAVE_PROGRESS: true,                 
        ADAPTIVE_DIFFICULTY: false,          
        SHOW_LEVEL_DESCRIPTIONS: true,       
        EXTRA_LIVES_FOR_ACCURACY: true      
    }
};


// Validation - make sure LEVELS array has 10 levels
if (CONFIG.LEVELS.length !== 10) {
    console.warn('LEVELS array should have 10 levels! Currently has', CONFIG.LEVELS.length);
}


if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'AIzaSyCXx37yt1F7isPw5yl5yFsBGX3EFFbRL3Q') {
    console.warn('Please set your Gemini API key in config.js');
}