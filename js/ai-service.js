/**
 * AI Service - Handles all Gemini API interactions
 */
class AIService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        // Updated to use gemini-2.5-flash which we verified works
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.cache = new Map();
    }

    // Set API key
    setApiKey(key) {
        this.apiKey = key;
    }

    // Generate word list based on user preferences
    async generateWordList(userData) {
        const cacheKey = this.generateCacheKey(userData);
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            console.log('Returning cached word list');
            return this.cache.get(cacheKey);
        }

        const prompt = this.buildWordListPrompt(userData);
        
        try {
            const response = await this.makeAPIRequest(prompt);
            const words = this.parseWordListResponse(response);
            
            // Cache the result
            this.cache.set(cacheKey, words);
            
            return words;
        } catch (error) {
            console.error('Word generation failed:', error);
            // Pass interests to fallback
            return this.getFallbackWords(userData.level || 1, userData.interests);
        }
    }

    // Analyze performance and suggest adjustments
    async analyzePerformance(performanceData) {
        const prompt = `
            Analyze this typing game performance and provide insights:

            Performance Metrics:
            - Level: ${performanceData.level}
            - Accuracy: ${performanceData.accuracy}%
            - Words per minute: ${performanceData.wpm}
            - Average reaction time: ${performanceData.reactionTime}ms
            - Common mistakes: ${performanceData.mistakes?.join(', ') || 'none'}
            - Mastered words: ${performanceData.masteredWords?.length || 0} words
            - Current speed multiplier: ${performanceData.speedMultiplier}

            Please provide a JSON response with:
            1. New speed multiplier (0.5-2.0 based on performance)
            2. Word complexity (easy/medium/hard)
            3. Three specific words to practice
            4. Brief analysis of strengths
            5. Brief analysis of weaknesses
            6. Recommended focus area

            Format as JSON:
            {
                "newSpeed": number,
                "complexity": string,
                "practiceWords": [string, string, string],
                "strengths": string,
                "weaknesses": string,
                "focusArea": string
            }
        `;

        try {
            const response = await this.makeAPIRequest(prompt);
            return this.parsePerformanceResponse(response);
        } catch (error) {
            console.error('Performance analysis failed:', error);
            return this.getDefaultPerformanceAnalysis(performanceData);
        }
    }

    // Generate learning insights
    async generateInsights(userHistory) {
        const prompt = `
            Based on this player's 7-day history:
            ${JSON.stringify(userHistory)}

            Provide learning insights including:
            1. Top 5 words they've likely mastered
            2. Top 3 patterns they struggle with
            3. Recommended theme for next session
            4. Progress summary
            5. Suggested practice exercises

            Format as JSON:
            {
                "masteredWords": [string],
                "strugglePatterns": [string],
                "recommendedTheme": string,
                "progressSummary": string,
                "suggestedExercises": [string]
            }
        `;

        try {
            const response = await this.makeAPIRequest(prompt);
            return this.parseInsightsResponse(response);
        } catch (error) {
            console.error('Insights generation failed:', error);
            return this.getDefaultInsights();
        }
    }

    // Make API request with retry logic
    async makeAPIRequest(prompt, retryCount = 0) {
        if (!this.apiKey) {
            throw new Error('API key not set');
        }

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 800,
                        topP: 0.8,
                        topK: 10
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0]) {
                throw new Error('Invalid API response structure');
            }

            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.log(`Retrying API request (${retryCount + 1}/${this.maxRetries})...`);
                await this.delay(this.retryDelay * Math.pow(2, retryCount));
                return this.makeAPIRequest(prompt, retryCount + 1);
            }
            throw error;
        }
    }

    // Build prompt for word list generation
    buildWordListPrompt(userData) {
        const level = userData.level || 1;
        const interests = userData.interests?.join(', ') || 'general';
        const mistakes = userData.mistakes?.slice(-5).join(', ') || 'none';
        const mastered = userData.masteredWords?.slice(-10).join(', ') || 'none';
        const wpm = userData.wpm || 0;

        let difficulty = 'simple';
        if (level > 6) difficulty = 'advanced';
        else if (level > 3) difficulty = 'intermediate';

        return `
            Generate 30 vocabulary words for a typing game with these specifications:

            Player Profile:
            - Current level: ${level} (${difficulty} difficulty)
            - Interests: ${interests}
            - Recently mistyped: ${mistakes}
            - Recently mastered: ${mastered}
            - Typing speed: ${wpm} WPM

            Requirements:
            1. Words should be ${difficulty} difficulty
            2. Include 5 words related to each of their interests
            3. Include 5 words that address their common mistakes
            4. Avoid words they've already mastered: ${mastered}
            5. Mix of short and long words appropriate for level ${level}
            6. Words should be common enough for a typing game

            Return ONLY a JSON array of strings. Do not include any markdown formatting, code blocks, or explanations.
            Just the raw JSON array like this: ["word1", "word2", "word3"]
            
            Make sure all words are appropriate for all ages.
        `;
    }

    // Parse word list response - FIXED VERSION
    parseWordListResponse(response) {
        try {
            console.log('Raw AI response:', response); // For debugging
            
            // Remove markdown code blocks and clean the response
            let cleanedResponse = response
                .replace(/```json\s*/g, '')  // Remove ```json
                .replace(/```\s*/g, '')       // Remove any remaining ```
                .replace(/^\s*\[\s*|\s*\]\s*$/g, match => match) // Keep brackets
                .trim();
            
            // Try to extract JSON array
            const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                // Clean up the matched JSON string
                let jsonStr = jsonMatch[0]
                    .replace(/```/g, '')        // Remove any remaining backticks
                    .replace(/\n/g, ' ')         // Replace newlines with spaces
                    .replace(/\s+/g, ' ')        // Collapse multiple spaces
                    .trim();
                
                const words = JSON.parse(jsonStr);
                
                // Validate and clean words
                const cleanWords = words
                    .filter(word => word && typeof word === 'string' && word.length > 1)
                    .map(word => word.toLowerCase().trim()
                        .replace(/[^a-zA-Z\s-]/g, '') // Remove special chars but keep letters, spaces, hyphens
                        .trim()
                    )
                    .filter(word => word.length > 1); // Remove empty or single char words
                
                console.log('Parsed words:', cleanWords.slice(0, 10));
                
                if (cleanWords.length > 0) {
                    return cleanWords.slice(0, 30);
                }
            }
        } catch (error) {
            console.error('Failed to parse word list:', error);
        }
        
        // If parsing fails, try manual extraction
        try {
            // Remove markdown and split by commas or newlines
            const words = response
                .replace(/```json\s*|```/g, '') // Remove code blocks
                .replace(/[\[\]"']/g, '')        // Remove brackets and quotes
                .split(/[,\n]/)                   // Split by commas or newlines
                .map(w => w.trim())
                .filter(w => w && w.length > 1 && /^[a-zA-Z\s-]+$/.test(w)) // Only keep valid words
                .map(w => w.toLowerCase());
            
            if (words.length > 0) {
                console.log('Manually extracted words:', words.slice(0, 10));
                return words.slice(0, 30);
            }
        } catch (error) {
            console.error('Manual extraction failed:', error);
        }
        
        // Ultimate fallback - use interest-specific fallback
        console.log('Using interest-specific fallback words');
        return this.getFallbackWords(1, ['general']);
    }

    // Parse performance response
    parsePerformanceResponse(response) {
        try {
            // Clean the response first
            const cleaned = response
                .replace(/```json\s*|```/g, '')
                .trim();
            
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('Failed to parse performance response:', error);
        }
        
        return null;
    }

    // Parse insights response
    parseInsightsResponse(response) {
        try {
            // Clean the response first
            const cleaned = response
                .replace(/```json\s*|```/g, '')
                .trim();
            
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('Failed to parse insights response:', error);
        }
        
        return null;
    }

    /**
     * Get fallback words based on level and interests - IMPROVED with strict interest filtering
     */
    getFallbackWords(level, interests = []) {
        // Interest-specific word collections
        const interestWordSets = {
            // Science words
            science: [
                'atom', 'cell', 'gene', 'lab', 'theory', 'experiment', 'data', 'energy',
                'molecule', 'gravity', 'force', 'motion', 'physics', 'chemistry', 'biology',
                'microscope', 'telescope', 'planet', 'star', 'galaxy', 'orbit', 'gravity',
                'evolution', 'species', 'habitat', 'ecosystem', 'climate', 'temperature',
                'velocity', 'acceleration', 'momentum', 'friction', 'density', 'volume'
            ],
            
            // Technology words
            technology: [
                'code', 'app', 'web', 'data', 'cloud', 'server', 'python', 'javascript',
                'algorithm', 'software', 'hardware', 'robot', 'ai', 'machine', 'learning',
                'computer', 'keyboard', 'screen', 'digital', 'network', 'internet',
                'browser', 'website', 'database', 'security', 'encryption', 'password',
                'interface', 'user', 'experience', 'design', 'development', 'programming',
                'function', 'variable', 'array', 'object', 'class', 'method',
                'cpu', 'gpu', 'ram', 'ssd', 'motherboard', 'processor', 'memory',
                'bluetooth', 'wifi', 'ethernet', 'router', 'modem', 'firewall'
            ],
            
            // Nature words
            nature: [
                'tree', 'leaf', 'root', 'branch', 'forest', 'jungle', 'desert', 'ocean',
                'river', 'lake', 'mountain', 'valley', 'hill', 'cave', 'beach', 'coast',
                'flower', 'grass', 'plant', 'seed', 'soil', 'water', 'air', 'wind',
                'rain', 'snow', 'ice', 'sun', 'moon', 'sky', 'cloud', 'storm',
                'animal', 'bird', 'fish', 'insect', 'mammal', 'reptile', 'amphibian'
            ],
            
            // Space words
            space: [
                'star', 'moon', 'sun', 'planet', 'mars', 'earth', 'venus', 'jupiter',
                'saturn', 'uranus', 'neptune', 'pluto', 'galaxy', 'universe', 'cosmos',
                'asteroid', 'comet', 'meteor', 'orbit', 'gravity', 'telescope', 'astronaut',
                'rocket', 'spacecraft', 'satellite', 'station', 'mission', 'launch',
                'solar', 'lunar', 'eclipse', 'constellation', 'nebula', 'blackhole',
                'lightyear', 'astronomy', 'celestial', 'interstellar'
            ],
            
            // Animals words
            animals: [
                'cat', 'dog', 'fish', 'bird', 'rabbit', 'hamster', 'turtle', 'frog',
                'lion', 'tiger', 'bear', 'wolf', 'fox', 'deer', 'moose', 'elk',
                'elephant', 'giraffe', 'zebra', 'rhino', 'hippo', 'monkey', 'gorilla',
                'kangaroo', 'koala', 'panda', 'sloth', 'otter', 'dolphin', 'whale',
                'shark', 'octopus', 'crab', 'lobster', 'eagle', 'hawk', 'owl', 'crow',
                'snake', 'lizard', 'crocodile', 'dinosaur', 'butterfly', 'dragonfly'
            ],
            
            // Food words
            food: [
                'apple', 'banana', 'orange', 'grape', 'berry', 'lemon', 'lime', 'peach',
                'pizza', 'pasta', 'bread', 'cheese', 'milk', 'eggs', 'butter', 'yogurt',
                'chicken', 'beef', 'fish', 'shrimp', 'rice', 'beans', 'corn', 'peas',
                'carrot', 'potato', 'tomato', 'onion', 'garlic', 'lettuce', 'spinach',
                'chocolate', 'cookie', 'cake', 'pie', 'icecream', 'donut', 'candy',
                'coffee', 'tea', 'juice', 'water', 'soup', 'salad', 'sandwich'
            ],
            
            // Music words
            music: [
                'song', 'note', 'beat', 'rhythm', 'melody', 'harmony', 'tune', 'lyrics',
                'guitar', 'piano', 'drums', 'bass', 'violin', 'cello', 'flute', 'trumpet',
                'saxophone', 'clarinet', 'harp', 'organ', 'singer', 'band', 'orchestra',
                'concert', 'festival', 'performance', 'stage', 'audience', 'applause',
                'album', 'single', 'track', 'playlist', 'genre', 'rock', 'jazz', 'blues',
                'classical', 'pop', 'hiphop', 'electronic', 'folk', 'country', 'reggae'
            ],
            
            // Sports words
            sports: [
                'ball', 'goal', 'game', 'team', 'player', 'coach', 'referee', 'stadium',
                'football', 'soccer', 'basketball', 'baseball', 'tennis', 'golf', 'hockey',
                'swimming', 'running', 'jumping', 'throwing', 'catching', 'dribbling',
                'score', 'win', 'lose', 'tie', 'champion', 'tournament', 'medal', 'trophy',
                'practice', 'training', 'exercise', 'fitness', 'health', 'athlete',
                'volleyball', 'rugby', 'cricket', 'badminton', 'tabletennis', 'boxing'
            ],
            
            // History words
            history: [
                'past', 'time', 'date', 'year', 'century', 'decade', 'era', 'age',
                'ancient', 'medieval', 'modern', 'war', 'battle', 'peace', 'treaty',
                'king', 'queen', 'emperor', 'president', 'leader', 'ruler', 'government',
                'revolution', 'independence', 'freedom', 'rights', 'democracy', 'empire',
                'civilization', 'culture', 'society', 'tradition', 'custom', 'heritage',
                'discovery', 'invention', 'exploration', 'voyage', 'expedition', 'pioneer'
            ]
        };

        // If no interests selected, use a mix of general/common words
        if (!interests || interests.length === 0) {
            const generalWords = [
                'cat', 'dog', 'sun', 'run', 'book', 'fish', 'tree', 'bird', 'star', 'moon',
                'happy', 'fast', 'blue', 'red', 'big', 'small', 'hot', 'cold', 'wet', 'dry',
                'ball', 'jump', 'play', 'read', 'sing', 'food', 'milk', 'cake', 'sweet', 'water',
                'friend', 'family', 'home', 'school', 'car', 'bus', 'train', 'plane',
                'morning', 'night', 'day', 'week', 'month', 'year', 'time', 'clock'
            ];
            return this.filterWordsByLevel(generalWords, level);
        }

        // Build a custom word list based ONLY on selected interests (NO general words)
        let selectedWords = [];
        
        // Add words ONLY from selected interests
        interests.forEach(interest => {
            const normalizedInterest = interest.toLowerCase().trim();
            
            // Direct matching
            if (interestWordSets[normalizedInterest]) {
                selectedWords = [...selectedWords, ...interestWordSets[normalizedInterest]];
            } else {
                // Try partial matching
                for (const [key, words] of Object.entries(interestWordSets)) {
                    if (normalizedInterest.includes(key) || key.includes(normalizedInterest)) {
                        selectedWords = [...selectedWords, ...words];
                        break; // Only match the first relevant category
                    }
                }
            }
        });
        
        // Remove duplicates
        selectedWords = [...new Set(selectedWords)];
        
        // If somehow we ended up with no words (shouldn't happen), use the specific interest's words
        if (selectedWords.length === 0 && interests.length > 0) {
            // Try to get the first matching interest set
            const firstInterest = interests[0].toLowerCase();
            for (const [key, words] of Object.entries(interestWordSets)) {
                if (firstInterest.includes(key) || key.includes(firstInterest)) {
                    selectedWords = words;
                    break;
                }
            }
        }

        // Filter by level-appropriate word lengths
        return this.filterWordsByLevel(selectedWords, level);
    }

    /**
     * Helper method to filter words by level-appropriate lengths
     */
    filterWordsByLevel(words, level) {
        let filteredWords = [];
        
        if (level <= 2) {
            // Level 1-2: Short words only (3-4 letters)
            filteredWords = words.filter(w => w.length >= 3 && w.length <= 4);
        } 
        else if (level <= 4) {
            // Level 3-4: Short to medium (3-5 letters)
            filteredWords = words.filter(w => w.length >= 3 && w.length <= 5);
        } 
        else if (level <= 6) {
            // Level 5-6: Medium words (4-6 letters)
            filteredWords = words.filter(w => w.length >= 4 && w.length <= 6);
        } 
        else if (level <= 8) {
            // Level 7-8: Medium to long (5-7 letters)
            filteredWords = words.filter(w => w.length >= 5 && w.length <= 7);
        } 
        else {
            // Level 9-10: All lengths
            filteredWords = words.filter(w => w.length >= 4);
        }
        
        // If filtering removed too many words, expand the range slightly
        if (filteredWords.length < 15) {
            if (level <= 2) {
                filteredWords = words.filter(w => w.length >= 3 && w.length <= 5);
            } else if (level <= 4) {
                filteredWords = words.filter(w => w.length >= 3 && w.length <= 6);
            } else if (level <= 6) {
                filteredWords = words.filter(w => w.length >= 4 && w.length <= 7);
            } else if (level <= 8) {
                filteredWords = words.filter(w => w.length >= 4 && w.length <= 8);
            }
        }
        
        // If STILL too few words (unlikely with our rich word sets), use all words from the set
        if (filteredWords.length < 10) {
            filteredWords = words;
        }
        
        // Remove duplicates and shuffle
        filteredWords = [...new Set(filteredWords)];
        const shuffled = filteredWords.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 30);
    }

    // Get default performance analysis
    getDefaultPerformanceAnalysis(data) {
        return {
            newSpeed: data.speedMultiplier || 1.0,
            complexity: data.level > 5 ? 'hard' : data.level > 2 ? 'medium' : 'easy',
            practiceWords: this.getFallbackWords(data.level, data.interests).slice(0, 3),
            strengths: 'Keep practicing to see AI analysis!',
            weaknesses: 'Play more games for personalized insights',
            focusArea: 'Continue playing to identify patterns'
        };
    }

    // Get default insights
    getDefaultInsights() {
        return {
            masteredWords: [],
            strugglePatterns: [],
            recommendedTheme: 'general',
            progressSummary: 'Play more games to generate AI insights',
            suggestedExercises: ['Practice regularly', 'Try different word categories']
        };
    }

    // Generate cache key
    generateCacheKey(data) {
        const relevantData = {
            level: data.level,
            interests: data.interests?.sort(),
            mistakes: data.mistakes?.slice(-5),
            masteredCount: data.masteredWords?.length
        };
        return JSON.stringify(relevantData);
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Delay helper
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Validate API key
    async validateApiKey() {
        try {
            const testPrompt = 'Generate a single word: "test"';
            await this.makeAPIRequest(testPrompt);
            return true;
        } catch (error) {
            console.error('API key validation failed:', error);
            return false;
        }
    }
}