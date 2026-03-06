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
            return this.getFallbackWords(userData.level || 1);
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
        
        // Ultimate fallback
        console.log('Using fallback words');
        return this.getFallbackWords(1);
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
     * Get fallback words based on level - UPDATED with progressive difficulty
     */
    getFallbackWords(level) {
        // Word lists organized by difficulty/length
        const wordLists = {
            // Level 1-2: Short, simple words (3-4 letters)
            beginner: [
                'cat', 'dog', 'sun', 'run', 'book', 'fish', 'tree', 'bird', 'star', 'moon',
                'happy', 'fast', 'blue', 'red', 'big', 'small', 'hot', 'cold', 'wet', 'dry',
                'ball', 'jump', 'play', 'read', 'sing', 'food', 'milk', 'cake', 'sweet', 'water'
            ],
            
            // Level 3-4: Mostly 4-5 letter words
            intermediate: [
                'apple', 'beach', 'cloud', 'dream', 'earth', 'flower', 'grass', 'house', 
                'light', 'music', 'night', 'ocean', 'peace', 'queen', 'river', 'smile',
                'thunder', 'wonder', 'bright', 'clever', 'friendly', 'garden', 'happiness'
            ],
            
            // Level 5-6: Mix of 5-6 letter words
            advanced: [
                'adventure', 'butterfly', 'challenge', 'discover', 'elephant', 'fantastic',
                'gorgeous', 'harmony', 'imagination', 'journey', 'knowledge', 'mountain',
                'notebook', 'oxygen', 'penguin', 'quantum', 'rainbow', 'science', 'telescope'
            ],
            
            // Level 7-8: 6-7 letter words with some longer ones
            expert: [
                'absolute', 'brilliant', 'chemistry', 'diamond', 'eclipse', 'fractal',
                'galaxy', 'horizon', 'infinity', 'jupiter', 'kingdom', 'lightning',
                'mysterious', 'neutron', 'observe', 'paradox', 'quantum', 'radiation',
                'satellite', 'tornado', 'universe', 'volcano', 'wavelength'
            ],
            
            // Level 9-10: Longer, more complex words
            master: [
                'atmosphere', 'biodiversity', 'catastrophe', 'democracy', 'extraordinary',
                'fundamental', 'generation', 'hypothesis', 'independent', 'justification',
                'kilometer', 'laboratory', 'mathematics', 'noteworthy', 'opportunity',
                'philosophy', 'qualification', 'revolutionary', 'sophisticated', 'technology',
                'understanding', 'validation', 'wonderful', 'xenophobia', 'yesterday', 'zenith'
            ]
        };
        
        if (level <= 2) return wordLists.beginner;
        else if (level <= 4) return wordLists.intermediate;
        else if (level <= 6) return wordLists.advanced;
        else if (level <= 8) return wordLists.expert;
        else return wordLists.master;
    }

    // Get default performance analysis
    getDefaultPerformanceAnalysis(data) {
        return {
            newSpeed: data.speedMultiplier || 1.0,
            complexity: data.level > 5 ? 'hard' : data.level > 2 ? 'medium' : 'easy',
            practiceWords: this.getFallbackWords(data.level).slice(0, 3),
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