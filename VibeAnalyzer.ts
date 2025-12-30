/**
 * Vibe Analyzer - Advanced Tone, Style, and Communication Pattern Analysis
 * Enables ULYSSES-OS to match user communication style and adapt personality dynamically
 */

import { logger } from '../utils/Logger';

export interface MessageAnalysis {
  tone: ToneProfile;
  style: StyleProfile;
  sentiment: SentimentProfile;
  patterns: CommunicationPatterns;
  timestamp: number;
}

export interface ToneProfile {
  formality: number; // 0-1: casual to formal
  friendliness: number; // 0-1: distant to warm
  assertiveness: number; // 0-1: passive to assertive
  enthusiasm: number; // 0-1: subdued to energetic
  professionalism: number; // 0-1: casual to professional
  humor: number; // 0-1: serious to humorous
}

export interface StyleProfile {
  verbosity: number; // 0-1: concise to verbose
  technicality: number; // 0-1: simple to technical
  creativity: number; // 0-1: literal to creative
  directness: number; // 0-1: indirect to direct
  emotiveness: number; // 0-1: reserved to expressive
  complexity: number; // 0-1: simple to complex
}

export interface SentimentProfile {
  polarity: number; // -1 to 1: negative to positive
  subjectivity: number; // 0-1: objective to subjective
  confidence: number; // 0-1: uncertain to confident
  intensity: number; // 0-1: mild to intense
}

export interface CommunicationPatterns {
  avgMessageLength: number;
  emojiFrequency: number;
  questionFrequency: number;
  exclamationFrequency: number;
  slangUsage: number;
  acronymUsage: number;
  punctuationStyle: string; // 'minimal' | 'moderate' | 'expressive'
  paragraphStructure: string; // 'single-block' | 'multi-paragraph' | 'fragmented'
}

export interface PersonalityProfile {
  name: string;
  description: string;
  tone: ToneProfile;
  style: StyleProfile;
  traits: string[];
  responseTemplates?: {
    greeting?: string;
    acknowledgment?: string;
    thinking?: string;
    conclusion?: string;
  };
}

export interface ConversationTrends {
  toneShift: {
    direction: 'more_formal' | 'more_casual' | 'stable';
    magnitude: number;
  };
  engagementLevel: {
    current: number; // 0-1
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  topicProgression: string[];
  adaptationScore: number; // How well Uly is matching the user's vibe
}

export interface VibeProfile {
  sessionId: string;
  userVibe: {
    currentTone: ToneProfile;
    currentStyle: StyleProfile;
    currentSentiment: SentimentProfile;
    patterns: CommunicationPatterns;
  };
  conversationHistory: MessageAnalysis[];
  trends: ConversationTrends;
  personalityOverride?: PersonalityProfile;
  lastUpdated: number;
}

export class VibeAnalyzer {
  private vibeProfiles: Map<string, VibeProfile> = new Map();
  private defaultPersonality: PersonalityProfile;
  private readonly HISTORY_LIMIT = 50;
  private readonly ADAPTATION_WEIGHT = 0.7; // How much to weigh recent messages

  constructor() {
    this.defaultPersonality = this.createDefaultPersonality();
  }

  /**
   * Analyze a user message and update their vibe profile
   */
  analyzeMessage(
    message: string,
    sessionId: string = 'default'
  ): MessageAnalysis {
    const analysis: MessageAnalysis = {
      tone: this.analyzeTone(message),
      style: this.analyzeStyle(message),
      sentiment: this.analyzeSentiment(message),
      patterns: this.analyzeCommunicationPatterns(message),
      timestamp: Date.now()
    };

    this.updateVibeProfile(sessionId, analysis);

    logger.debug('Message analyzed for vibe', {
      sessionId,
      tone: analysis.tone,
      style: analysis.style
    });

    return analysis;
  }

  /**
   * Get recommended communication style for responding to user
   */
  getRecommendedStyle(sessionId: string = 'default'): {
    personality: PersonalityProfile;
    adaptations: string[];
    confidence: number;
  } {
    const profile = this.getVibeProfile(sessionId);

    // Check for personality override
    if (profile.personalityOverride) {
      return {
        personality: profile.personalityOverride,
        adaptations: ['Using custom personality override'],
        confidence: 1.0
      };
    }

    // Create adapted personality based on user's vibe
    const adaptedPersonality = this.adaptPersonalityToUser(profile);
    const adaptations = this.generateAdaptationSuggestions(profile);
    const confidence = this.calculateAdaptationConfidence(profile);

    return {
      personality: adaptedPersonality,
      adaptations,
      confidence
    };
  }

  /**
   * Set a custom personality override
   */
  setPersonality(
    sessionId: string,
    personality: Partial<PersonalityProfile>
  ): void {
    const profile = this.getVibeProfile(sessionId);

    profile.personalityOverride = {
      ...this.defaultPersonality,
      ...personality,
      tone: { ...this.defaultPersonality.tone, ...personality.tone },
      style: { ...this.defaultPersonality.style, ...personality.style }
    };

    profile.lastUpdated = Date.now();

    logger.info('Personality override set', {
      sessionId,
      personality: personality.name || 'Custom'
    });
  }

  /**
   * Clear personality override and return to adaptive mode
   */
  clearPersonalityOverride(sessionId: string): void {
    const profile = this.getVibeProfile(sessionId);
    profile.personalityOverride = undefined;
    profile.lastUpdated = Date.now();

    logger.info('Personality override cleared, returning to adaptive mode', {
      sessionId
    });
  }

  /**
   * Get conversation trends analysis
   */
  getConversationTrends(sessionId: string = 'default'): ConversationTrends {
    const profile = this.getVibeProfile(sessionId);
    return profile.trends;
  }

  /**
   * Get complete vibe profile for a session
   */
  getVibeProfile(sessionId: string = 'default'): VibeProfile {
    if (!this.vibeProfiles.has(sessionId)) {
      this.vibeProfiles.set(sessionId, this.createNewVibeProfile(sessionId));
    }
    return this.vibeProfiles.get(sessionId)!;
  }

  /**
   * Get vibe statistics and insights
   */
  getVibeInsights(sessionId: string = 'default'): {
    summary: string;
    userPreferences: string[];
    communicationTips: string[];
    vibeMatch: number; // 0-1 score of how well we're matching
  } {
    const profile = this.getVibeProfile(sessionId);

    if (profile.conversationHistory.length === 0) {
      return {
        summary: 'No conversation history yet',
        userPreferences: [],
        communicationTips: ['Start a conversation to analyze vibe'],
        vibeMatch: 0
      };
    }

    const summary = this.generateVibeSummary(profile);
    const userPreferences = this.extractUserPreferences(profile);
    const communicationTips = this.generateCommunicationTips(profile);
    const vibeMatch = profile.trends.adaptationScore;

    return {
      summary,
      userPreferences,
      communicationTips,
      vibeMatch
    };
  }

  /**
   * Clear session data
   */
  clearSession(sessionId: string): void {
    this.vibeProfiles.delete(sessionId);
    logger.info('Vibe profile cleared', { sessionId });
  }

  // ============================================================================
  // Private Analysis Methods
  // ============================================================================

  private analyzeTone(message: string): ToneProfile {
    const lowerMessage = message.toLowerCase();

    // Formality indicators
    const formalWords = ['please', 'kindly', 'regards', 'furthermore', 'therefore', 'however'];
    const casualWords = ['yeah', 'nah', 'gonna', 'wanna', 'hey', 'cool', 'awesome'];
    const formalCount = formalWords.filter(w => lowerMessage.includes(w)).length;
    const casualCount = casualWords.filter(w => lowerMessage.includes(w)).length;
    const formality = Math.max(0, Math.min(1, 0.5 + (formalCount - casualCount) * 0.1));

    // Friendliness indicators
    const friendlyWords = ['thanks', 'appreciate', 'love', 'great', 'wonderful', 'nice'];
    const friendlyCount = friendlyWords.filter(w => lowerMessage.includes(w)).length;
    const hasGreeting = /^(hi|hello|hey|greetings)/i.test(message);
    const friendliness = Math.min(1, 0.5 + friendlyCount * 0.1 + (hasGreeting ? 0.2 : 0));

    // Assertiveness indicators
    const assertiveWords = ['must', 'need', 'require', 'should', 'will', 'expect'];
    const passiveWords = ['maybe', 'perhaps', 'might', 'could', 'possibly'];
    const assertiveCount = assertiveWords.filter(w => lowerMessage.includes(w)).length;
    const passiveCount = passiveWords.filter(w => lowerMessage.includes(w)).length;
    const assertiveness = Math.max(0, Math.min(1, 0.5 + (assertiveCount - passiveCount) * 0.15));

    // Enthusiasm indicators
    const exclamationCount = (message.match(/!/g) || []).length;
    const enthusiasticWords = ['amazing', 'awesome', 'fantastic', 'love', 'excited'];
    const enthusiasticCount = enthusiasticWords.filter(w => lowerMessage.includes(w)).length;
    const enthusiasm = Math.min(1, 0.3 + exclamationCount * 0.15 + enthusiasticCount * 0.1);

    // Professionalism
    const professionalWords = ['project', 'analysis', 'implementation', 'strategy', 'objective'];
    const professionalCount = professionalWords.filter(w => lowerMessage.includes(w)).length;
    const hasProperCapitalization = /^[A-Z]/.test(message);
    const professionalism = Math.min(1, 0.4 + professionalCount * 0.1 + (hasProperCapitalization ? 0.1 : 0));

    // Humor indicators
    const humorMarkers = ['lol', 'haha', 'lmao', 'funny', '😂', '😄', '🤣'];
    const humorCount = humorMarkers.filter(m => message.includes(m)).length;
    const humor = Math.min(1, humorCount * 0.3);

    return {
      formality,
      friendliness,
      assertiveness,
      enthusiasm,
      professionalism,
      humor
    };
  }

  private analyzeStyle(message: string): StyleProfile {
    const words = message.split(/\s+/).filter(w => w.length > 0);
    const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Verbosity
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : words.length;
    const verbosity = Math.min(1, avgWordsPerSentence / 20); // 20+ words = verbose;

    // Technicality
    const technicalWords = ['algorithm', 'implementation', 'architecture', 'infrastructure',
                           'optimization', 'configuration', 'parameters', 'function', 'module'];
    const technicalCount = technicalWords.filter(w => message.toLowerCase().includes(w)).length;
    const technicality = Math.min(1, technicalCount * 0.2);

    // Creativity
    const creativeMarkers = ['imagine', 'creative', 'innovative', 'unique', 'artistic'];
    const hasMetaphor = /like a|as if|similar to/i.test(message);
    const creativeCount = creativeMarkers.filter(w => message.toLowerCase().includes(w)).length;
    const creativity = Math.min(1, 0.2 + creativeCount * 0.2 + (hasMetaphor ? 0.2 : 0));

    // Directness
    const directMarkers = ['do this', 'need to', 'want', 'create', 'make', 'build'];
    const indirectMarkers = ['would you', 'could you', 'maybe', 'perhaps', 'possibly'];
    const directCount = directMarkers.filter(m => message.toLowerCase().includes(m)).length;
    const indirectCount = indirectMarkers.filter(m => message.toLowerCase().includes(m)).length;
    const directness = Math.max(0, Math.min(1, 0.5 + (directCount - indirectCount) * 0.2));

    // Emotiveness
    const emojiCount = (message.match(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}]/gu) || []).length;
    const emotiveWords = ['feel', 'love', 'hate', 'amazing', 'terrible', 'wonderful'];
    const emotiveCount = emotiveWords.filter(w => message.toLowerCase().includes(w)).length;
    const emotiveness = Math.min(1, 0.2 + emojiCount * 0.2 + emotiveCount * 0.15);

    // Complexity
    const longWords = words.filter(w => w.length > 7).length;
    const complexity = Math.min(1, longWords / words.length);

    return {
      verbosity,
      technicality,
      creativity,
      directness,
      emotiveness,
      complexity
    };
  }

  private analyzeSentiment(message: string): SentimentProfile {
    const lowerMessage = message.toLowerCase();

    // Polarity (positive/negative)
    const positiveWords = ['good', 'great', 'excellent', 'love', 'happy', 'wonderful', 'amazing', 'thanks', 'perfect'];
    const negativeWords = ['bad', 'terrible', 'hate', 'angry', 'sad', 'awful', 'horrible', 'wrong', 'error'];
    const positiveCount = positiveWords.filter(w => lowerMessage.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerMessage.includes(w)).length;
    const polarity = Math.max(-1, Math.min(1, (positiveCount - negativeCount) * 0.3));

    // Subjectivity
    const subjectiveWords = ['i think', 'i feel', 'i believe', 'in my opinion', 'personally'];
    const objectiveWords = ['according to', 'research shows', 'data indicates', 'fact'];
    const subjectiveCount = subjectiveWords.filter(w => lowerMessage.includes(w)).length;
    const objectiveCount = objectiveWords.filter(w => lowerMessage.includes(w)).length;
    const subjectivity = Math.max(0, Math.min(1, 0.5 + (subjectiveCount - objectiveCount) * 0.2));

    // Confidence
    const confidentWords = ['definitely', 'certainly', 'absolutely', 'sure', 'clearly'];
    const uncertainWords = ['maybe', 'perhaps', 'possibly', 'might', 'unsure', '?'];
    const confidentCount = confidentWords.filter(w => lowerMessage.includes(w)).length;
    const uncertainCount = uncertainWords.filter(w => lowerMessage.includes(w)).length;
    const confidence = Math.max(0, Math.min(1, 0.5 + (confidentCount - uncertainCount) * 0.15));

    // Intensity
    const intensifiers = ['very', 'extremely', 'absolutely', 'really', 'totally'];
    const capsWords = (message.match(/\b[A-Z]{2,}\b/g) || []).length;
    const intensifierCount = intensifiers.filter(w => lowerMessage.includes(w)).length;
    const intensity = Math.min(1, 0.3 + intensifierCount * 0.15 + capsWords * 0.2);

    return {
      polarity,
      subjectivity,
      confidence,
      intensity
    };
  }

  private analyzeCommunicationPatterns(message: string): CommunicationPatterns {
    const words = message.split(/\s+/).filter(w => w.length > 0);

    // Average message length
    const avgMessageLength = words.length;

    // Emoji frequency
    const emojiCount = (message.match(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}]/gu) || []).length;
    const emojiFrequency = words.length > 0 ? emojiCount / words.length : 0;

    // Question frequency
    const questionCount = (message.match(/\?/g) || []).length;
    const questionFrequency = questionCount / Math.max(1, message.length / 100);

    // Exclamation frequency
    const exclamationCount = (message.match(/!/g) || []).length;
    const exclamationFrequency = exclamationCount / Math.max(1, message.length / 100);

    // Slang usage
    const slangWords = ['lol', 'omg', 'btw', 'imo', 'tbh', 'ngl', 'gonna', 'wanna', 'yeah', 'nah'];
    const slangCount = slangWords.filter(w => message.toLowerCase().includes(w)).length;
    const slangUsage = words.length > 0 ? slangCount / words.length : 0;

    // Acronym usage
    const acronyms = message.match(/\b[A-Z]{2,}\b/g) || [];
    const acronymUsage = words.length > 0 ? acronyms.length / words.length : 0;

    // Punctuation style
    const totalPunctuation = (message.match(/[.,!?;:]/g) || []).length;
    const punctuationStyle = totalPunctuation === 0 ? 'minimal' :
                            totalPunctuation < 3 ? 'moderate' : 'expressive';

    // Paragraph structure
    const lineBreaks = (message.match(/\n/g) || []).length;
    const paragraphStructure = lineBreaks === 0 ? 'single-block' :
                              lineBreaks < 3 ? 'multi-paragraph' : 'fragmented';

    return {
      avgMessageLength,
      emojiFrequency,
      questionFrequency,
      exclamationFrequency,
      slangUsage,
      acronymUsage,
      punctuationStyle,
      paragraphStructure
    };
  }

  private updateVibeProfile(sessionId: string, analysis: MessageAnalysis): void {
    const profile = this.getVibeProfile(sessionId);

    // Add to history
    profile.conversationHistory.push(analysis);
    if (profile.conversationHistory.length > this.HISTORY_LIMIT) {
      profile.conversationHistory.shift();
    }

    // Update current vibe (weighted average favoring recent messages)
    const recentMessages = profile.conversationHistory.slice(-5);
    profile.userVibe.currentTone = this.averageToneProfile(recentMessages.map(m => m.tone));
    profile.userVibe.currentStyle = this.averageStyleProfile(recentMessages.map(m => m.style));
    profile.userVibe.currentSentiment = this.averageSentimentProfile(recentMessages.map(m => m.sentiment));
    profile.userVibe.patterns = this.averageCommunicationPatterns(recentMessages.map(m => m.patterns));

    // Update trends
    profile.trends = this.calculateTrends(profile);
    profile.lastUpdated = Date.now();
  }

  private calculateTrends(profile: VibeProfile): ConversationTrends {
    const history = profile.conversationHistory;

    if (history.length < 2) {
      return {
        toneShift: { direction: 'stable', magnitude: 0 },
        engagementLevel: { current: 0.5, trend: 'stable' },
        topicProgression: [],
        adaptationScore: 0.5
      };
    }

    // Analyze tone shift
    const oldTones = history.slice(0, Math.floor(history.length / 2));
    const newTones = history.slice(Math.floor(history.length / 2));
    const oldFormality = this.averageToneProfile(oldTones.map(m => m.tone)).formality;
    const newFormality = this.averageToneProfile(newTones.map(m => m.tone)).formality;
    const formalityDiff = newFormality - oldFormality;

    const toneShift = {
      direction: formalityDiff > 0.1 ? 'more_formal' as const :
                 formalityDiff < -0.1 ? 'more_casual' as const : 'stable' as const,
      magnitude: Math.abs(formalityDiff)
    };

    // Analyze engagement level
    const recentEngagement = history.slice(-5);
    const avgEnthusiasm = recentEngagement.reduce((sum, m) => sum + m.tone.enthusiasm, 0) / recentEngagement.length;
    const avgMessageLength = recentEngagement.reduce((sum, m) => sum + m.patterns.avgMessageLength, 0) / recentEngagement.length;
    const engagementCurrent = (avgEnthusiasm + Math.min(1, avgMessageLength / 50)) / 2;

    const oldEngagement = history.slice(0, Math.max(1, history.length - 5));
    const oldAvgEnthusiasm = oldEngagement.reduce((sum, m) => sum + m.tone.enthusiasm, 0) / Math.max(1, oldEngagement.length);
    const engagementDiff = avgEnthusiasm - oldAvgEnthusiasm;

    const engagementLevel = {
      current: engagementCurrent,
      trend: engagementDiff > 0.1 ? 'increasing' as const :
             engagementDiff < -0.1 ? 'decreasing' as const : 'stable' as const
    };

    // Calculate adaptation score (how well we're matching the user)
    const adaptationScore = this.calculateAdaptationScore(profile);

    return {
      toneShift,
      engagementLevel,
      topicProgression: [], // Could be enhanced with topic modeling
      adaptationScore
    };
  }

  private calculateAdaptationScore(profile: VibeProfile): number {
    // This would ideally compare Uly's responses with user's vibe
    // For now, return a baseline score that improves with history
    const historyBonus = Math.min(0.5, profile.conversationHistory.length * 0.05);
    return 0.5 + historyBonus;
  }

  private adaptPersonalityToUser(profile: VibeProfile): PersonalityProfile {
    const userTone = profile.userVibe.currentTone;
    const userStyle = profile.userVibe.currentStyle;

    // Create adapted personality that mirrors user's vibe
    const adaptedTone: ToneProfile = {
      formality: userTone.formality * this.ADAPTATION_WEIGHT + this.defaultPersonality.tone.formality * (1 - this.ADAPTATION_WEIGHT),
      friendliness: Math.max(0.6, userTone.friendliness), // Always maintain some friendliness
      assertiveness: userTone.assertiveness * this.ADAPTATION_WEIGHT + this.defaultPersonality.tone.assertiveness * (1 - this.ADAPTATION_WEIGHT),
      enthusiasm: userTone.enthusiasm * this.ADAPTATION_WEIGHT + this.defaultPersonality.tone.enthusiasm * (1 - this.ADAPTATION_WEIGHT),
      professionalism: userTone.professionalism * this.ADAPTATION_WEIGHT + this.defaultPersonality.tone.professionalism * (1 - this.ADAPTATION_WEIGHT),
      humor: userTone.humor * this.ADAPTATION_WEIGHT + this.defaultPersonality.tone.humor * (1 - this.ADAPTATION_WEIGHT)
    };

    const adaptedStyle: StyleProfile = {
      verbosity: userStyle.verbosity * this.ADAPTATION_WEIGHT + this.defaultPersonality.style.verbosity * (1 - this.ADAPTATION_WEIGHT),
      technicality: userStyle.technicality * this.ADAPTATION_WEIGHT + this.defaultPersonality.style.technicality * (1 - this.ADAPTATION_WEIGHT),
      creativity: userStyle.creativity * this.ADAPTATION_WEIGHT + this.defaultPersonality.style.creativity * (1 - this.ADAPTATION_WEIGHT),
      directness: userStyle.directness * this.ADAPTATION_WEIGHT + this.defaultPersonality.style.directness * (1 - this.ADAPTATION_WEIGHT),
      emotiveness: Math.min(userStyle.emotiveness, 0.5), // Don't be too emotive
      complexity: userStyle.complexity * this.ADAPTATION_WEIGHT + this.defaultPersonality.style.complexity * (1 - this.ADAPTATION_WEIGHT)
    };

    return {
      name: 'Adaptive Uly',
      description: `Personality adapted to match user's communication style (${this.describeTone(adaptedTone)})`,
      tone: adaptedTone,
      style: adaptedStyle,
      traits: this.generateAdaptiveTraits(adaptedTone, adaptedStyle)
    };
  }

  private generateAdaptationSuggestions(profile: VibeProfile): string[] {
    const suggestions: string[] = [];
    const tone = profile.userVibe.currentTone;
    const style = profile.userVibe.currentStyle;
    const patterns = profile.userVibe.patterns;

    if (tone.formality > 0.7) {
      suggestions.push('Use formal language and professional terminology');
    } else if (tone.formality < 0.3) {
      suggestions.push('Keep it casual and conversational');
    }

    if (style.verbosity < 0.3) {
      suggestions.push('Be concise and get to the point quickly');
    } else if (style.verbosity > 0.7) {
      suggestions.push('Provide detailed, comprehensive responses');
    }

    if (tone.enthusiasm > 0.7) {
      suggestions.push('Match their energy and enthusiasm');
    }

    if (style.technicality > 0.7) {
      suggestions.push('Use technical terms and detailed explanations');
    } else if (style.technicality < 0.3) {
      suggestions.push('Simplify technical concepts, use analogies');
    }

    if (patterns.emojiFrequency > 0.1) {
      suggestions.push('Emojis are welcome in responses');
    }

    if (tone.humor > 0.5) {
      suggestions.push('Light humor and wit are appreciated');
    }

    return suggestions;
  }

  private generateVibeSummary(profile: VibeProfile): string {
    const tone = profile.userVibe.currentTone;
    const style = profile.userVibe.currentStyle;

    const toneDesc = this.describeTone(tone);
    const styleDesc = this.describeStyle(style);

    return `User communicates with ${toneDesc} tone and ${styleDesc} style. ${profile.conversationHistory.length} messages analyzed.`;
  }

  private describeTone(tone: ToneProfile): string {
    const descriptors: string[] = [];

    if (tone.formality > 0.7) descriptors.push('formal');
    else if (tone.formality < 0.3) descriptors.push('casual');

    if (tone.friendliness > 0.7) descriptors.push('friendly');
    if (tone.enthusiasm > 0.7) descriptors.push('enthusiastic');
    if (tone.professionalism > 0.7) descriptors.push('professional');
    if (tone.humor > 0.5) descriptors.push('humorous');

    return descriptors.length > 0 ? descriptors.join(', ') : 'balanced';
  }

  private describeStyle(style: StyleProfile): string {
    const descriptors: string[] = [];

    if (style.verbosity > 0.7) descriptors.push('verbose');
    else if (style.verbosity < 0.3) descriptors.push('concise');

    if (style.technicality > 0.7) descriptors.push('technical');
    if (style.creativity > 0.7) descriptors.push('creative');
    if (style.directness > 0.7) descriptors.push('direct');
    else if (style.directness < 0.3) descriptors.push('diplomatic');

    return descriptors.length > 0 ? descriptors.join(', ') : 'moderate';
  }

  private extractUserPreferences(profile: VibeProfile): string[] {
    const prefs: string[] = [];
    const tone = profile.userVibe.currentTone;
    const style = profile.userVibe.currentStyle;
    const patterns = profile.userVibe.patterns;

    if (tone.formality > 0.6) prefs.push('Prefers formal communication');
    if (style.technicality > 0.6) prefs.push('Comfortable with technical details');
    if (style.verbosity < 0.4) prefs.push('Appreciates concise responses');
    if (tone.enthusiasm > 0.6) prefs.push('Values energetic engagement');
    if (patterns.questionFrequency > 0.5) prefs.push('Inquisitive and curious');

    return prefs;
  }

  private generateCommunicationTips(profile: VibeProfile): string[] {
    return this.generateAdaptationSuggestions(profile);
  }

  private generateAdaptiveTraits(tone: ToneProfile, style: StyleProfile): string[] {
    const traits: string[] = [];

    if (tone.formality > 0.6) traits.push('Professional');
    else traits.push('Approachable');

    if (tone.friendliness > 0.7) traits.push('Warm');
    if (style.directness > 0.7) traits.push('Straightforward');
    if (style.technicality > 0.6) traits.push('Technical');
    if (style.creativity > 0.6) traits.push('Creative');
    if (tone.enthusiasm > 0.6) traits.push('Energetic');

    return traits.slice(0, 5);
  }

  private createNewVibeProfile(sessionId: string): VibeProfile {
    const defaultTone: ToneProfile = {
      formality: 0.5,
      friendliness: 0.5,
      assertiveness: 0.5,
      enthusiasm: 0.5,
      professionalism: 0.5,
      humor: 0.3
    };

    const defaultStyle: StyleProfile = {
      verbosity: 0.5,
      technicality: 0.5,
      creativity: 0.5,
      directness: 0.5,
      emotiveness: 0.3,
      complexity: 0.5
    };

    const defaultSentiment: SentimentProfile = {
      polarity: 0,
      subjectivity: 0.5,
      confidence: 0.5,
      intensity: 0.5
    };

    const defaultPatterns: CommunicationPatterns = {
      avgMessageLength: 0,
      emojiFrequency: 0,
      questionFrequency: 0,
      exclamationFrequency: 0,
      slangUsage: 0,
      acronymUsage: 0,
      punctuationStyle: 'moderate',
      paragraphStructure: 'single-block'
    };

    return {
      sessionId,
      userVibe: {
        currentTone: defaultTone,
        currentStyle: defaultStyle,
        currentSentiment: defaultSentiment,
        patterns: defaultPatterns
      },
      conversationHistory: [],
      trends: {
        toneShift: { direction: 'stable', magnitude: 0 },
        engagementLevel: { current: 0.5, trend: 'stable' },
        topicProgression: [],
        adaptationScore: 0.5
      },
      lastUpdated: Date.now()
    };
  }

  private createDefaultPersonality(): PersonalityProfile {
    return {
      name: 'Default Uly',
      description: 'Balanced, helpful, and knowledgeable AI assistant with expertise across multiple domains',
      tone: {
        formality: 0.6,
        friendliness: 0.8,
        assertiveness: 0.6,
        enthusiasm: 0.7,
        professionalism: 0.7,
        humor: 0.4
      },
      style: {
        verbosity: 0.6,
        technicality: 0.7,
        creativity: 0.6,
        directness: 0.7,
        emotiveness: 0.4,
        complexity: 0.6
      },
      traits: [
        'Knowledgeable',
        'Helpful',
        'Professional',
        'Friendly',
        'Adaptive'
      ],
      responseTemplates: {
        greeting: 'Hello! I\'m Uly, your advanced AI assistant. How can I help you today?',
        acknowledgment: 'I understand.',
        thinking: 'Let me analyze that...',
        conclusion: 'I hope this helps! Let me know if you need anything else.'
      }
    };
  }

  // Averaging helper methods
  private averageToneProfile(tones: ToneProfile[]): ToneProfile {
    if (tones.length === 0) return this.createDefaultPersonality().tone;

    return {
      formality: tones.reduce((sum, t) => sum + t.formality, 0) / tones.length,
      friendliness: tones.reduce((sum, t) => sum + t.friendliness, 0) / tones.length,
      assertiveness: tones.reduce((sum, t) => sum + t.assertiveness, 0) / tones.length,
      enthusiasm: tones.reduce((sum, t) => sum + t.enthusiasm, 0) / tones.length,
      professionalism: tones.reduce((sum, t) => sum + t.professionalism, 0) / tones.length,
      humor: tones.reduce((sum, t) => sum + t.humor, 0) / tones.length
    };
  }

  private averageStyleProfile(styles: StyleProfile[]): StyleProfile {
    if (styles.length === 0) return this.createDefaultPersonality().style;

    return {
      verbosity: styles.reduce((sum, s) => sum + s.verbosity, 0) / styles.length,
      technicality: styles.reduce((sum, s) => sum + s.technicality, 0) / styles.length,
      creativity: styles.reduce((sum, s) => sum + s.creativity, 0) / styles.length,
      directness: styles.reduce((sum, s) => sum + s.directness, 0) / styles.length,
      emotiveness: styles.reduce((sum, s) => sum + s.emotiveness, 0) / styles.length,
      complexity: styles.reduce((sum, s) => sum + s.complexity, 0) / styles.length
    };
  }

  private averageSentimentProfile(sentiments: SentimentProfile[]): SentimentProfile {
    if (sentiments.length === 0) {
      return { polarity: 0, subjectivity: 0.5, confidence: 0.5, intensity: 0.5 };
    }

    return {
      polarity: sentiments.reduce((sum, s) => sum + s.polarity, 0) / sentiments.length,
      subjectivity: sentiments.reduce((sum, s) => sum + s.subjectivity, 0) / sentiments.length,
      confidence: sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length,
      intensity: sentiments.reduce((sum, s) => sum + s.intensity, 0) / sentiments.length
    };
  }

  private averageCommunicationPatterns(patterns: CommunicationPatterns[]): CommunicationPatterns {
    if (patterns.length === 0) {
      return {
        avgMessageLength: 0,
        emojiFrequency: 0,
        questionFrequency: 0,
        exclamationFrequency: 0,
        slangUsage: 0,
        acronymUsage: 0,
        punctuationStyle: 'moderate',
        paragraphStructure: 'single-block'
      };
    }

    const mostCommonPunctuation = this.getMostCommon(patterns.map(p => p.punctuationStyle));
    const mostCommonStructure = this.getMostCommon(patterns.map(p => p.paragraphStructure));

    return {
      avgMessageLength: patterns.reduce((sum, p) => sum + p.avgMessageLength, 0) / patterns.length,
      emojiFrequency: patterns.reduce((sum, p) => sum + p.emojiFrequency, 0) / patterns.length,
      questionFrequency: patterns.reduce((sum, p) => sum + p.questionFrequency, 0) / patterns.length,
      exclamationFrequency: patterns.reduce((sum, p) => sum + p.exclamationFrequency, 0) / patterns.length,
      slangUsage: patterns.reduce((sum, p) => sum + p.slangUsage, 0) / patterns.length,
      acronymUsage: patterns.reduce((sum, p) => sum + p.acronymUsage, 0) / patterns.length,
      punctuationStyle: mostCommonPunctuation,
      paragraphStructure: mostCommonStructure
    };
  }

  private getMostCommon<T>(arr: T[]): T {
    const counts = new Map<T, number>();
    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || arr[0];
  }

  private calculateAdaptationConfidence(profile: VibeProfile): number {
    // Confidence increases with more conversation history
    const historyFactor = Math.min(1, profile.conversationHistory.length / 10);

    // Confidence is higher when user's vibe is consistent
    const consistency = this.calculateVibeConsistency(profile);

    return (historyFactor * 0.6 + consistency * 0.4);
  }

  private calculateVibeConsistency(profile: VibeProfile): number {
    if (profile.conversationHistory.length < 3) return 0.5;

    // Compare variance in tone/style across messages
    const tones = profile.conversationHistory.map(m => m.tone);
    const formalityVariance = this.calculateVariance(tones.map(t => t.formality));
    const enthusiasmVariance = this.calculateVariance(tones.map(t => t.enthusiasm));

    // Lower variance = higher consistency
    const avgVariance = (formalityVariance + enthusiasmVariance) / 2;
    return Math.max(0, 1 - avgVariance * 2);
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }
}
