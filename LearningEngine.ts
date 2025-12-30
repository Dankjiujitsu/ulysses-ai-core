import { KnowledgeResponse, ReasoningContext } from '../types';
import { logger } from '../utils/Logger';

/**
 * Learning and adaptation system
 * Learns from query patterns to improve responses over time
 */




interface QueryPattern {
  query: string;
  domains: string[];
  frequency: number;
  avgConfidence: number;
  lastAccessed: number;
  successfulResponses: number;
  totalQueries: number;
}

interface AdaptationRule {
  pattern: RegExp;
  transformation: (query: string) => string;
  confidence: number;
  successRate: number;
}

export class LearningEngine {
  private patterns: Map<string, QueryPattern> = new Map();
  private adaptations: AdaptationRule[] = [];
  private queryHistory: Array<{ context: ReasoningContext; responses: KnowledgeResponse[]; timestamp: number }> = [];
  private maxHistorySize = 10000;

  /**
   * Record a query and its results for learning
   */
  recordQuery(context: ReasoningContext, responses: KnowledgeResponse[]): void {
    const key = this.generatePatternKey(context);
    const pattern = this.patterns.get(key) || this.createNewPattern(context);

    // Update pattern statistics
    pattern.frequency++
    pattern.lastAccessed = Date.now();
    pattern.totalQueries++

    // Calculate average confidence
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    if (avgConfidence > 0.8) {
      pattern.successfulResponses++
    }

    pattern.avgConfidence = (pattern.avgConfidence * (pattern.frequency - 1) + avgConfidence) / pattern.frequency;

    this.patterns.set(key, pattern);

    // Store in history
    this.queryHistory.push({
      context,
      responses,
      timestamp: Date.now()
    });

    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory.shift();
    }

    // Periodically learn adaptations
    if (this.queryHistory.length % 100 === 0) {
      this.learnAdaptations();
    }

    logger.debug('Query recorded for learning', {
      key,
      frequency: pattern.frequency,
      avgConfidence: pattern.avgConfidence
    });
  }

  /**
   * Optimize query based on learned patterns
   */
  optimizeQuery(context: ReasoningContext): ReasoningContext {
    let optimized = { ...context };

    // Apply learned adaptations
    for (const adaptation of this.adaptations) {
      if (adaptation.pattern.test(optimized.query) && adaptation.successRate > 0.7) {
        optimized.query = adaptation.transformation(optimized.query);
        logger.debug('Applied adaptation to query', {
          original: context.query,
          optimized: optimized.query,
          successRate: adaptation.successRate
        });
      }
    }

    // Suggest additional domains based on patterns
    const key = this.generatePatternKey(context);
    const similarPatterns = this.findSimilarPatterns(key);

    if (similarPatterns.length > 0) {
      const suggestedDomains = new Set(optimized.domains);
      for (const pattern of similarPatterns) {
        pattern.domains.forEach(d => suggestedDomains.add(d));
      }
      optimized.domains = Array.from(suggestedDomains);
    }

    // Adjust depth based on query complexity
    const complexity = this.assessQueryComplexity(optimized.query);
    if (complexity > 0.7 && optimized.depth === 'basic') {
      optimized.depth = 'intermediate';
      logger.debug('Increased query depth based on complexity', { complexity });
    }

    return optimized;
  }

  /**
   * Get insights from learned patterns
   */
  getInsights(): {
    totalQueries: number;
    uniquePatterns: number;
    avgSuccessRate: number;
    topPatterns: QueryPattern[];
    adaptations: number;
  } {
    const patterns = Array.from(this.patterns.values());
    const totalQueries = patterns.reduce((sum, p) => sum + p.frequency, 0);
    const avgSuccessRate =
      patterns.reduce((sum, p) => sum + p.successfulResponses / p.totalQueries, 0) / patterns.length || 0;

    const topPatterns = patterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    return {
      totalQueries,
      uniquePatterns: this.patterns.size,
      avgSuccessRate,
      topPatterns,
      adaptations: this.adaptations.length
    };
  }

  /**
   * Learn new adaptations from query history
   */
  private learnAdaptations(): void {
    const recentHistory = this.queryHistory.slice(-1000);

    // Find common query transformations that lead to better results
    const transformations: Map<string, { count: number; successes: number }> = new Map();

    for (let i = 0; i < recentHistory.length - 1; i++) {
      const current = recentHistory[i];
      const next = recentHistory[i + 1];

      if (this.areSimilar(current.context.query, next.context.query)) {
        const transformation = `${current.context.query} -> ${next.context.query}`;
        const currentConf = this.getAverageConfidence(current.responses);
        const nextConf = this.getAverageConfidence(next.responses);

        const stats = transformations.get(transformation) || { count: 0, successes: 0 };
        stats.count++
        if (nextConf > currentConf) {
          stats.successes++
        }
        transformations.set(transformation, stats);
      }
    }

    // Create adaptation rules from successful transformations
    for (const [transformation, stats] of transformations.entries()) {
      if (stats.count >= 5 && stats.successes / stats.count > 0.7) {
        const [from, to] = transformation.split(' -> ');
        this.adaptations.push({
          pattern: new RegExp(this.escapeRegex(from), 'i'),
          transformation: () => to,
          confidence: stats.successes / stats.count,
          successRate: stats.successes / stats.count
        });
      }
    }

    logger.info('Learned new adaptations', {
      totalAdaptations: this.adaptations.length,
      newFromBatch: this.adaptations.filter(a => a.confidence > 0.7).length
    });
  }

  private createNewPattern(context: ReasoningContext): QueryPattern {
    return {
      query: context.query,
      domains: context.domains,
      frequency: 0,
      avgConfidence: 0,
      lastAccessed: Date.now(),
      successfulResponses: 0,
      totalQueries: 0
    };
  }

  private generatePatternKey(context: ReasoningContext): string {
    return `${context.query.toLowerCase().trim()}:${context.domains.sort().join(',')}`;
  }

  private findSimilarPatterns(key: string, limit: number = 5): QueryPattern[] {
    const patterns = Array.from(this.patterns.values());
    return patterns
      .filter(p => p.avgConfidence > 0.8 && p.frequency > 3)
      .sort((a, b) => {
        const aSimilarity = this.calculateSimilarity(key, this.generatePatternKey({ query: a.query, domains: a.domains, depth: 'expert', includeAnalysis: false }));
        const bSimilarity = this.calculateSimilarity(key, this.generatePatternKey({ query: b.query, domains: b.domains, depth: 'expert', includeAnalysis: false }));
        return bSimilarity - aSimilarity;
      })
      .slice(0, limit);
  }

  private calculateSimilarity(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\W+/));
    const bWords = new Set(b.toLowerCase().split(/\W+/));
    const intersection = new Set([...aWords].filter(x => bWords.has(x)));
    const union = new Set([...aWords, ...bWords]);
    return intersection.size / union.size;
  }

  private assessQueryComplexity(query: string): number {
    const words = query.split(/\s+/).length;
    const hasMultipleConcepts = query.includes(' and ') || query.includes(' or ');
    const hasQuestionWords = /how|why|what|when|where|explain|analyze/.test(query.toLowerCase());

    let complexity = Math.min(words / 20, 0.5); // Word count contributes up to 0.5;
    if (hasMultipleConcepts) complexity += 0.3;
    if (hasQuestionWords) complexity += 0.2;

    return Math.min(complexity, 1.0);
  }

  private areSimilar(a: string, b: string): boolean {
    return this.calculateSimilarity(a, b) > 0.6;
  }

  private getAverageConfidence(responses: KnowledgeResponse[]): number {
    if (responses.length === 0) return 0;
    return responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Export learned patterns for persistence
   */
  export(): {
    patterns: Array<[string, QueryPattern]>;
    adaptations: AdaptationRule[];
  } {
    return {
      patterns: Array.from(this.patterns.entries()),
      adaptations: this.adaptations
    };
  }

  /**
   * Import learned patterns
   */
  import(data: {
    patterns: Array<[string, QueryPattern]>;
    adaptations: AdaptationRule[];
  }): void {
    this.patterns = new Map(data.patterns);
    this.adaptations = data.adaptations;
    logger.info('Imported learned patterns', {
      patterns: this.patterns.size,
      adaptations: this.adaptations.length
    });
  }
}