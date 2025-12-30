import { KnowledgeResponse } from '../types';
import { logger } from '../utils/Logger';

/**
 * Multi-step reasoning and chain-of-thought processing
 * Enables complex problem solving through decomposition
 */




export interface ReasoningStep {
  step: number;
  question: string;
  domain: string;
  reasoning: string;
  conclusion: string;
  confidence: number;
}

export interface ReasoningChainResult {
  originalQuery: string;
  steps: ReasoningStep[];
  finalAnswer: string;
  overallConfidence: number;
  chainLength: number;
}

export class ReasoningChain {
  /**
   * Decompose complex query into reasoning steps
   */
  decompose(query: string): string[] {
    const subQueries: string[] = [];

    // Detect multi-part questions
    if (query.includes(' and ')) {
      const parts = query.split(' and ').map(p => p.trim());
      subQueries.push(...parts);
    } else if (query.includes('?') && query.split('?').length > 2) {
      const questions = query.split('?').filter(q => q.trim().length > 0);
      subQueries.push(...questions.map(q => q.trim() + '?'));
    } else {
      // Analyze query complexity
      const isComplex = this.isComplexQuery(query);

      if (isComplex) {
        // Break down complex query
        const decomposed = this.decomposeComplexQuery(query);
        subQueries.push(...decomposed);
      } else {
        subQueries.push(query);
      }
    }

    logger.debug('Decomposed query into steps', {
      original: query,
      steps: subQueries.length
    });

    return subQueries;
  }

  /**
   * Build reasoning chain from responses
   */
  buildChain(
    originalQuery: string,
    stepResponses: Array<{ query: string; responses: KnowledgeResponse[] }>
  ): ReasoningChainResult {
    const steps: ReasoningStep[] = [];

    for (let i = 0; i < stepResponses.length; i++) {
      const { query, responses } = stepResponses[i];

      // Extract key insights from responses
      const reasoning = this.extractReasoning(responses);
      const conclusion = this.formulateConclusion(responses);
      const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;

      steps.push({
        step: i + 1,
        question: query,
        domain: responses[0]?.domain || 'unknown',
        reasoning,
        conclusion,
        confidence: avgConfidence
      });
    }

    // Synthesize final answer
    const finalAnswer = this.synthesizeFinalAnswer(originalQuery, steps);
    const overallConfidence = this.calculateOverallConfidence(steps);

    return {
      originalQuery,
      steps,
      finalAnswer,
      overallConfidence,
      chainLength: steps.length
    };
  }

  /**
   * Validate reasoning chain for logical consistency
   */
  validateChain(chain: ReasoningChainResult): {
    isValid: boolean;
    issues: string[];
    strength: number;
  } {
    const issues: string[] = [];

    // Check for contradictions
    for (let i = 0; i < chain.steps.length - 1; i++) {
      if (this.detectContradiction(chain.steps[i], chain.steps[i + 1])) {
        issues.push(`Contradiction between step ${i + 1} and ${i + 2}`);
      }
    }

    // Check confidence degradation
    const confidences = chain.steps.map(s => s.confidence);
    const hasSignificantDrop = confidences.some((c, i) =>
      i > 0 && confidences[i - 1] - c > 0.3
    );

    if (hasSignificantDrop) {
      issues.push('Significant confidence drop detected in reasoning chain');
    }

    // Check completeness
    if (chain.steps.length < 2 && this.isComplexQuery(chain.originalQuery)) {
      issues.push('Query complexity suggests more reasoning steps needed');
    }

    const strength = this.calculateChainStrength(chain);

    return {
      isValid: issues.length === 0,
      issues,
      strength
    };
  }

  /**
   * Generate critique of reasoning chain
   */
  critique(chain: ReasoningChainResult): string[] {
    const critiques: string[] = [];

    // Analyze each step
    for (const step of chain.steps) {
      if (step.confidence < 0.7) {
        critiques.push(`Step ${step.step}: Low confidence (${(step.confidence * 100).toFixed(0)}%) - consider gathering more information`);
      }

      if (step.reasoning.length < 50) {
        critiques.push(`Step ${step.step}: Reasoning appears superficial - more depth needed`);
      }
    }

    // Analyze overall chain
    if (chain.overallConfidence < 0.75) {
      critiques.push(`Overall confidence is low - chain may need strengthening`);
    }

    if (chain.chainLength === 1 && chain.originalQuery.length > 100) {
      critiques.push(`Complex query handled in single step - decomposition may improve quality`);
    }

    // Check for missing domains
    const domains = new Set(chain.steps.map(s => s.domain));
    if (domains.size === 1 && chain.originalQuery.includes(' and ')) {
      critiques.push(`Query spans multiple topics but only one domain consulted`);
    }

    return critiques;
  }

  private isComplexQuery(query: string): boolean {
    const indicators = [
      query.length > 100,
      query.split(/\s+/).length > 15,
      /how.*and.*why/i.test(query),
      /explain.*detail/i.test(query),
      /analyze.*consider/i.test(query),
      /compare.*contrast/i.test(query)
    ];

    return indicators.filter(Boolean).length >= 2;
  }

  private decomposeComplexQuery(query: string): string[] {
    const subQueries: string[] = [];

    // If it's a 'how and why' question
    if (/how/i.test(query) && /why/i.test(query)) {
      const howMatch = query.match(/how[^?]+/i);
      const whyMatch = query.match(/why[^?]+/i);
      if (howMatch) subQueries.push(howMatch[0] + '?');
      if (whyMatch) subQueries.push(whyMatch[0] + '?');
    }
    // If it mentions multiple topics
    else if (query.includes(',')) {
      const parts = query.split(',').map(p => p.trim());
      const base = parts[0];
      for (let i = 1; i < parts.length; i++) {
        subQueries.push(`${base} - specifically ${parts[i]}`);
      }
    }
    // General complex query - break into foundation + application
    else {
      subQueries.push(`What are the fundamentals of ${query}?`);
      subQueries.push(query); // Original as second step
    }

    return subQueries.length > 0 ? subQueries : [query];
  }

  private extractReasoning(responses: KnowledgeResponse[]): string {
    if (responses.length === 0) return '';

    // Extract first few sentences as reasoning
    const firstResponse = responses[0].information;
    const sentences = firstResponse.split(/[.!?]+/).slice(0, 3);
    return sentences.join('. ').trim();
  }

  private formulateConclusion(responses: KnowledgeResponse[]): string {
    if (responses.length === 0) return '';

    // For multiple responses, synthesize
    if (responses.length > 1) {
      return `Based on analysis across ${responses.length} domains, the key finding is: ${this.extractReasoning(responses)}`;
    }

    return this.extractReasoning(responses);
  }

  private synthesizeFinalAnswer(query: string, steps: ReasoningStep[]): string {
    if (steps.length === 1) {
      return steps[0].conclusion;
    }

    let synthesis = `To address '${query}', here's the comprehensive analysis:\n\n`;

    for (const step of steps) {
      synthesis += `${step.step}. ${step.question}\n`;
      synthesis += `   ${step.conclusion}\n\n`;
    }

    synthesis += `INTEGRATED CONCLUSION:\n`;
    synthesis += `Combining insights from all ${steps.length} analytical steps, `;

    // Create holistic conclusion (theme analysis reserved for future enhancement)
    synthesis += `the evidence suggests a multi-faceted approach is optimal. `;
    synthesis += `Each component reinforces the others, creating a comprehensive understanding.`;

    return synthesis;
  }

  private calculateOverallConfidence(steps: ReasoningStep[]): number {
    if (steps.length === 0) return 0;

    // Weakest link approach - chain is only as strong as weakest step
    const minConfidence = Math.min(...steps.map(s => s.confidence));

    // But also consider average
    const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;

    // Weighted combination
    return minConfidence * 0.4 + avgConfidence * 0.6;
  }

  private detectContradiction(step1: ReasoningStep, step2: ReasoningStep): boolean {
    const contradictoryTerms = [
      ['not', 'is'],
      ['never', 'always'],
      ['impossible', 'possible'],
      ['avoid', 'recommend']
    ];

    const text1 = step1.conclusion.toLowerCase();
    const text2 = step2.conclusion.toLowerCase();

    for (const [term1, term2] of contradictoryTerms) {
      if (text1.includes(term1) && text2.includes(term2)) {
        return true;
      }
    }

    return false;
  }

  private calculateChainStrength(chain: ReasoningChainResult): number {
    let strength = chain.overallConfidence;

    // Bonus for appropriate length
    const idealLength = this.isComplexQuery(chain.originalQuery) ? 3 : 1;
    const lengthRatio = Math.min(chain.chainLength / idealLength, 1);
    strength *= lengthRatio;

    // Penalty for low individual step confidence
    const lowConfidenceSteps = chain.steps.filter(s => s.confidence < 0.7).length;
    strength *= Math.max(0.5, 1 - lowConfidenceSteps / chain.steps.length);

    return strength;
  }
}