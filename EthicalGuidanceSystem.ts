import { GeolocationService, LocationData, MultiJurisdictionData } from '../utils/GeolocationService';
import { LegalKnowledgeBase } from './LegalKnowledgeBase';
import { logger } from '../utils/Logger';
import { ProductionLogger } from '../utils/ProductionLogger';

/**
 * EthicalGuidanceSystem - Detects and provides detailed guidance on illegal/unethical requests
 * Integrates geolocation and legal knowledge to provide jurisdiction-specific warnings
 */

export interface EthicalAnalysis {
  isProblematic: boolean;
  severity: 'none' | 'minor' | 'moderate' | 'severe' | 'critical';
  violationTypes: string[];
  detailedExplanation: string;
  jurisdiction: string;
  locationData?: LocationData;

  // Trust Organs: Confidence & Evidence
  confidence: number; // 0.0 to 1.0 (1.0 = very confident, 0.5 = uncertain)
  needsClarification: boolean; // True if system needs more context
  clarifyingQuestions?: string[]; // Questions to ask user for clarity
  evidence: {
    matchedKeywords: string[];
    contextChecked: boolean;
    ambiguousTerms: string[];
    reasoning: string;
  };

  // Multi-Jurisdiction Support
  multiJurisdiction?: MultiJurisdictionData; // Multiple applicable jurisdictions
  usingVpn?: boolean; // Detected VPN usage
}

export interface ProblematicPattern {
  keywords: string[];
  violationType: string;
  requiresContext?: boolean;
}

interface DetectionResult {
  violationTypes: string[];
  matchedKeywords: string[];
  ambiguousTerms: string[];
  contextChecked: boolean;
}

export class EthicalGuidanceSystem {
  private geolocationService: GeolocationService;
  private legalKnowledgeBase: LegalKnowledgeBase;
  private problematicPatterns: ProblematicPattern[];
  private productionLogger: ProductionLogger;

  constructor() {
    this.geolocationService = new GeolocationService();
    this.legalKnowledgeBase = new LegalKnowledgeBase();
    this.problematicPatterns = this.initializePatterns();
    this.productionLogger = ProductionLogger.getInstance();
  }

  /**
   * Initialize patterns for detecting problematic requests
   */
  private initializePatterns(): ProblematicPattern[] {
    return [
      // Cybercrime
      {
        keywords: ['hack', 'breach', 'exploit', 'ddos', 'malware', 'ransomware', 'backdoor', 'zero-day', 'sql injection', 'xss attack', 'crack password', 'steal password', 'steal someone\'s password', 'bypass security', 'bypass authentication', 'bypass two-factor'],
        violationType: 'hacking'
      },
      {
        keywords: ['steal data', 'exfiltrate', 'data breach', 'unauthorized access', 'penetration test without permission', 'intercept', 'keylogger', 'install keylogger', 'botnet', 'create botnet'],
        violationType: 'hacking'
      },

      // Drugs
      {
        keywords: ['make drugs', 'synthesize', 'methamphetamine', 'make meth', 'create meth', 'cook meth', 'sell meth', 'cocaine', 'heroin', 'fentanyl', 'mdma', 'lsd', 'illegal drug', 'controlled substance', 'drug lab', 'marijuana', 'grow marijuana', 'synthetic opioid'],
        violationType: 'illegal_drugs'
      },
      {
        keywords: ['sell drugs', 'drug dealing', 'distribute narcotics', 'drug trafficking', 'traffic narcotics', 'smuggle drugs'],
        violationType: 'illegal_drugs'
      },

      // Fraud
      {
        keywords: ['credit card fraud', 'steal credit card', 'credit card theft', 'identity theft', 'steal identity', 'steal someone\'s identity', 'stolen money', 'phishing', 'scam', 'ponzi scheme', 'pyramid scheme', 'fake id', 'counterfeit', 'forge document', 'fake currency'],
        violationType: 'fraud'
      },
      {
        keywords: ['tax fraud', 'insurance fraud', 'wire fraud', 'securities fraud', 'embezzle'],
        violationType: 'fraud'
      },

      // Weapons
      {
        keywords: ['make bomb', 'homemade bomb', 'make a bomb', 'explosive device', 'ieds', 'weapon of mass destruction', 'biological weapon', 'chemical weapon', 'poison gas', '3d print gun', 'untraceable weapon'],
        violationType: 'weapons_trafficking'
      },
      {
        keywords: ['illegal weapons', 'buy illegal guns', 'buy illegal weapons', 'sell guns illegally', 'straw purchase', 'gun trafficking', 'traffic guns', 'automatic weapon conversion'],
        violationType: 'weapons_trafficking'
      },

      // Crimes against children
      {
        keywords: ['child porn', 'csam', 'child sexual', 'child exploitation', 'underage', 'minor sexual', 'child abuse material', 'pedophile'],
        violationType: 'child_exploitation'
      },

      // Terrorism
      {
        keywords: ['terrorist attack', 'terrorism', 'isis', 'al qaeda', 'jihad', 'radicalize', 'mass casualty', 'suicide bomb', 'plane hijack'],
        violationType: 'terrorism'
      },
      {
        keywords: ['support terrorist', 'fund terrorism', 'material support', 'terrorist organization'],
        violationType: 'terrorism'
      },

      // Violence
      {
        keywords: ['how to kill', 'murder someone', 'assassinate', 'poison someone', 'make it look like accident', 'dispose of body', 'dispose of a body', 'get away with murder', 'hide a body', 'bury a body', 'mass shooting', 'plan a shooting', 'plan mass shooting'],
        violationType: 'murder'
      },
      {
        keywords: ['kidnap', 'torture', 'human sacrifice', 'serial kill'],
        violationType: 'murder'
      },

      // Financial crimes
      {
        keywords: ['evade tax', 'hide income', 'offshore account', 'money laundering', 'launder money', 'launder', 'wash money', 'shell company fraud', 'tax haven abuse'],
        violationType: 'tax_evasion'
      },

      // Human trafficking
      {
        keywords: ['human trafficking', 'traffick humans', 'traffick people', 'sex trafficking', 'forced labor', 'force people into labor', 'slavery', 'smuggle people', 'illegal immigration ring', 'sell humans', 'organ harvesting', 'sell people'],
        violationType: 'human_trafficking'
      },

      // IP theft
      {
        keywords: ['steal trade secret', 'corporate espionage', 'pirate software', 'crack software', 'stolen intellectual property', 'bypass drm'],
        violationType: 'intellectual_property_theft'
      },

      // Privacy violations
      {
        keywords: ['spy on someone', 'stalk', 'track without consent', 'wiretap', 'intercept communications', 'install spyware', 'revenge porn', 'doxxing'],
        violationType: 'privacy_violation'
      },

      // Misinformation
      {
        keywords: ['spread misinformation', 'fake news campaign', 'manipulate election', 'disinformation attack', 'deepfake for harm'],
        violationType: 'misinformation',
        requiresContext: true
      }
    ];
  }

  /**
   * Analyze a query for ethical/legal issues
   */
  async analyzeQuery(query: string, userIp?: string): Promise<EthicalAnalysis> {
    const startTime = Date.now();
    const queryLower = query.toLowerCase();

    // Detect violation types with evidence
    const detection = this.detectViolations(queryLower);

    if (detection.violationTypes.length === 0) {
      const result: EthicalAnalysis = {
        isProblematic: false,
        severity: 'none',
        violationTypes: [],
        detailedExplanation: '',
        jurisdiction: 'N/A',
        confidence: 1.0, // Very confident it's benign
        needsClarification: false,
        evidence: {
          matchedKeywords: [],
          contextChecked: detection.contextChecked,
          ambiguousTerms: detection.ambiguousTerms,
          reasoning: 'No problematic keywords detected'
        }
      };

      // Log classification for review and improvement
      if (process.env.ENABLE_PRODUCTION_LOGGING === 'true') {
        await this.productionLogger.logClassification(query, result, {
          userIp,
          responseTimeMs: Date.now() - startTime
        });
      }

      return result;
    }

    // Calculate confidence score
    const confidence = this.calculateConfidence(detection, query);

    // Determine if clarification is needed
    const needsClarification = confidence < 0.7;

    // Generate clarifying questions if needed
    const clarifyingQuestions = needsClarification
      ? this.generateClarifyingQuestions(detection, query)
      : undefined;

    // Get user location
    let locationData: LocationData | undefined;
    try {
      locationData = await this.geolocationService.getLocation(userIp);
    } catch (error) {
      logger.warn('Could not determine location', { error: String(error) } as Record<string, unknown>);
    }

    const jurisdiction = locationData
      ? this.geolocationService.getJurisdiction(locationData)
      : 'your jurisdiction';

    // Get the most severe violation
    const severities = detection.violationTypes.map(vt => {
      const violation = this.legalKnowledgeBase.getViolation(vt);
      return violation?.severity || 'moderate';
    });

    const maxSeverity = this.getMaxSeverity(severities);

    // Get multi-jurisdiction data
    const multiJurisdiction = locationData
      ? this.geolocationService.getApplicableJurisdictions(locationData, detection.violationTypes)
      : undefined;

    // Detect VPN usage
    const usingVpn = locationData
      ? this.geolocationService.detectVpn(locationData)
      : undefined;

    // Generate detailed explanation
    const detailedExplanation = this.generateDetailedExplanation(
      detection.violationTypes,
      locationData,
      confidence,
      needsClarification,
      multiJurisdiction,
      usingVpn
    );

    // Build reasoning
    const reasoning = this.buildReasoning(detection, confidence, maxSeverity);

    const result: EthicalAnalysis = {
      isProblematic: true,
      severity: maxSeverity,
      violationTypes: detection.violationTypes,
      detailedExplanation,
      jurisdiction,
      locationData,
      confidence,
      needsClarification,
      clarifyingQuestions,
      evidence: {
        matchedKeywords: detection.matchedKeywords,
        contextChecked: detection.contextChecked,
        ambiguousTerms: detection.ambiguousTerms,
        reasoning
      },
      multiJurisdiction,
      usingVpn
    };

    // Log classification for review and improvement
    if (process.env.ENABLE_PRODUCTION_LOGGING === 'true') {
      await this.productionLogger.logClassification(query, result, {
        userIp,
        responseTimeMs: Date.now() - startTime
      });
    }

    return result;
  }

  /**
   * Calculate confidence score based on detection evidence
   * Score ranges from 0.0 (very uncertain) to 1.0 (very confident)
   */
  private calculateConfidence(detection: DetectionResult, query: string): number {
    let confidence = 0.5; // Start at neutral;

    // High confidence factors (+)
    if (detection.matchedKeywords.length >= 2) confidence += 0.3; // Multiple keyword matches
    if (detection.violationTypes.length >= 2) confidence += 0.2; // Multiple violation types
    if (detection.contextChecked && detection.ambiguousTerms.length === 0) confidence += 0.2; // Context checked, no ambiguity

    // Low confidence factors (-)
    if (detection.ambiguousTerms.some(t => t.includes('suspicious'))) confidence -= 0.2; // Ambiguous terms present
    if (detection.matchedKeywords.length === 1 && query.split(' ').length > 10) confidence -= 0.1; // Single match in long query
    if (query.includes('for educational') || query.includes('for research')) confidence -= 0.3; // Educational context

    // Clamp between 0 and 1
    return Math.max(0.0, Math.min(1.0, confidence));
  }

  /**
   * Generate clarifying questions for low-confidence detections
   */
  private generateClarifyingQuestions(detection: DetectionResult, query: string): string[] {
    const questions: string[] = [];

    // Check for educational/research keywords
    if (query.toLowerCase().includes('educational') || query.toLowerCase().includes('research')) {
      questions.push('Is this query for educational purposes, professional research, or authorized security testing?');
    }

    // Check for ambiguous terms
    if (detection.ambiguousTerms.some(t => t.includes('hack'))) {
      questions.push("Are you asking about computer security/hacking, or using 'hack' in a different context (life hacks, productivity, etc.)?");
    }

    if (detection.ambiguousTerms.some(t => t.includes('exploit'))) {
      questions.push("Are you asking about exploiting vulnerabilities, or using 'exploit' in a business/opportunity context?");
    }

    // Default clarification
    if (questions.length === 0 && detection.matchedKeywords.length > 0) {
      questions.push('Can you provide more context about your intent? This helps me provide more accurate guidance.');
      questions.push('Are you researching this topic for legitimate educational or professional purposes?');
    }

    return questions;
  }

  /**
   * Build reasoning explanation for the detection
   */
  private buildReasoning(detection: DetectionResult, confidence: number, severity: string): string {
    let reasoning = `Detected ${detection.violationTypes.length} violation type(s): ${detection.violationTypes.join(', ')}. `;
    reasoning += `Matched ${detection.matchedKeywords.length} keyword(s): ${detection.matchedKeywords.slice(0, 3).join(', ')}`;
    if (detection.matchedKeywords.length > 3) {
      reasoning += ` (and ${detection.matchedKeywords.length - 3} more)`;
    }
    reasoning += `. `;

    if (detection.contextChecked) {
      reasoning += `Context analysis performed. `;
    }

    if (detection.ambiguousTerms.length > 0) {
      reasoning += `Ambiguous terms found: ${detection.ambiguousTerms.join(', ')}. `;
    }

    reasoning += `Confidence: ${(confidence * 100).toFixed(0)}%. Severity: ${severity}.`;

    return reasoning;
  }

  /**
   * Check if a keyword appears in a benign context
   */
  private isBenignContext(queryLower: string, keyword: string): boolean {
    // Benign contexts for 'hack'
    if (keyword === 'hack') {
      const benignHackContexts = [
        'productivity', 'life hack', 'growth hack', 'hack your', 'hack my', 'hack their',
        'bio hack', 'hackathon', 'hack together', 'hack it', 'morning routine',
        'run faster', 'prototype', 'sleep schedule', 'ethical hack', 'security audit'
      ];
      return benignHackContexts.some(context => queryLower.includes(context));
    }

    // Benign contexts for 'exploit'
    if (keyword === 'exploit') {
      const benignExploitContexts = [
        'market', 'opportunity', 'inefficiencies', 'advantage', 'economies of scale',
        'network effects', 'arbitrage', 'strengths', 'data for insights', 'leverage'
      ];
      return benignExploitContexts.some(context => queryLower.includes(context));
    }

    // Benign contexts for 'crack'
    if (keyword === 'crack') {
      const benignCrackContexts = [
        'crack the code', 'crack interview', 'coding interview', 'crack a problem',
        'crack jokes', 'crack open', 'case study'
      ];
      return benignCrackContexts.some(context => queryLower.includes(context));
    }

    // Benign contexts for 'breach'
    if (keyword === 'breach') {
      const benignBreachContexts = ['incident response', 'data breach' + ' procedures'];
      return benignBreachContexts.some(context => queryLower.includes(context));
    }

    return false;
  }

  /**
   * Detect violation types in a query with evidence tracking
   */
  private detectViolations(queryLower: string): DetectionResult {
    const detectedViolations = new Set<string>();
    const matchedKeywords: string[] = [];
    const ambiguousTerms: string[] = [];
    let contextChecked = false;

    const ambiguousKeywords = ['hack', 'exploit', 'crack'];

    for (const pattern of this.problematicPatterns) {
      for (const keyword of pattern.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          // Track if we checked context for ambiguous terms
          if (ambiguousKeywords.includes(keyword)) {
            contextChecked = true;
            if (this.isBenignContext(queryLower, keyword)) {
              ambiguousTerms.push(keyword + ' (benign context)');
              continue; // Skip this keyword, it's benign
            } else {
              ambiguousTerms.push(keyword + ' (suspicious context)');
            }
          }

          detectedViolations.add(pattern.violationType);
          matchedKeywords.push(keyword);
          break;
        }
      }
    }

    return {
      violationTypes: Array.from(detectedViolations),
      matchedKeywords,
      ambiguousTerms,
      contextChecked
    };
  }

  /**
   * Get maximum severity from a list
   */
  private getMaxSeverity(
    severities: Array<'minor' | 'moderate' | 'severe' | 'critical'>
  ): 'minor' | 'moderate' | 'severe' | 'critical' {
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('severe')) return 'severe';
    if (severities.includes('moderate')) return 'moderate';
    return 'minor';
  }

  /**
   * Generate detailed explanation for violations
   */
  private generateDetailedExplanation(
    violationTypes: string[],
    locationData?: LocationData,
    confidence?: number,
    needsClarification?: boolean,
    multiJurisdiction?: MultiJurisdictionData,
    usingVpn?: boolean
  ): string {
    let explanation = '⚠️  ETHICAL & LEGAL WARNING ⚠️\n\n';

    // Add VPN detection notice
    if (usingVpn) {
      explanation += `🔒 VPN/PROXY DETECTED - Laws from multiple jurisdictions may apply.\n\n`;
    }

    // Add multi-jurisdiction notice
    if (multiJurisdiction && multiJurisdiction.crossBorder) {
      explanation += `🌍 MULTI-JURISDICTION ALERT:\n`;
      explanation += `   This activity may be illegal in multiple jurisdictions:\n`;
      multiJurisdiction.applicableJurisdictions.forEach(j => {
        explanation += `   • ${j}\n`;
      });
      explanation += `   Most restrictive: ${multiJurisdiction.mostRestrictive}\n\n`;
    }

    // Add uncertainty notice if confidence is low
    if (confidence !== undefined && confidence < 0.7) {
      explanation += `🔍 CONFIDENCE LEVEL: ${(confidence * 100).toFixed(0)}% - I'm not fully certain about this detection.\n\n`;
      if (needsClarification) {
        explanation += `⚠️  This query contains ambiguous language. I may be flagging this incorrectly.\n`;
        explanation += `   Please provide more context if this is for legitimate purposes (education, research, security testing).\n\n`;
      }
    }

    explanation += 'I cannot and will not provide assistance with this request. Here\'s why:\n\n';

    const jurisdiction = locationData
      ? this.geolocationService.getJurisdiction(locationData)
      : 'most jurisdictions';

    for (let i = 0; i < violationTypes.length; i++) {
      const violationType = violationTypes[i];
      const violation = this.legalKnowledgeBase.getViolation(violationType);

      if (!violation) continue;

      explanation += `${'='.repeat(80)}\n`;
      explanation += `VIOLATION ${i + 1}: ${violation.category.toUpperCase()} - ${violationType.toUpperCase().replace(/_/g, ' ')}\n`;
      explanation += `SEVERITY: ${violation.severity.toUpperCase()}\n`;
      explanation += `${'='.repeat(80)}\n\n`;

      // Jurisdiction-specific laws
      explanation += `📍 LAWS APPLICABLE IN ${jurisdiction.toUpperCase()}:\n\n`;

      const applicableLaws = this.legalKnowledgeBase.getJurisdictionLaws(
        violationType,
        locationData?.country || 'United States',
        locationData?.regionName
      );

      if (applicableLaws.length > 0) {
        applicableLaws.forEach((law, idx) => {
          explanation += `   ${idx + 1}. ${law}\n`;
        });
      } else {
        if (violation.federalLaws) {
          violation.federalLaws.forEach((law, idx) => {
            explanation += `   ${idx + 1}. ${law}\n`;
          });
        }
      }

      explanation += '\n';

      // Penalties
      explanation += `⚖️  POTENTIAL PENALTIES:\n\n`;

      if (violation.penalties.criminal) {
        explanation += `   CRIMINAL:\n   ${violation.penalties.criminal}\n\n`;
      }

      if (violation.penalties.civil) {
        explanation += `   CIVIL:\n   ${violation.penalties.civil}\n\n`;
      }

      if (violation.penalties.administrative) {
        explanation += `   ADMINISTRATIVE:\n   ${violation.penalties.administrative}\n\n`;
      }

      // Detailed consequences
      explanation += `⛔ REAL-WORLD CONSEQUENCES:\n\n`;
      explanation += `   This isn't just about laws on paper. Here's what actually happens:\n\n`;

      violation.consequences.forEach((consequence, idx) => {
        explanation += `   ${idx + 1}. ${consequence}\n`;
      });

      explanation += '\n';

      // Related offenses
      if (violation.relatedOffenses && violation.relatedOffenses.length > 0) {
        explanation += `🔗 RELATED CHARGES YOU MAY ALSO FACE:\n\n`;
        explanation += `   Prosecutors often add additional charges:\n`;
        violation.relatedOffenses.forEach((offense, idx) => {
          explanation += `   ${idx + 1}. ${offense.charAt(0).toUpperCase() + offense.slice(1)}\n`;
        });
        explanation += '\n';
      }

      // Examples of what this includes
      if (violation.examples && violation.examples.length > 0) {
        explanation += `📋 THIS INCLUDES:\n\n`;
        violation.examples.forEach((example, idx) => {
          explanation += `   ${idx + 1}. ${example}\n`;
        });
        explanation += '\n';
      }

      explanation += '\n';
    }

    // Final ethical message
    explanation += `${'='.repeat(80)}\n`;
    explanation += `WHY I'M TELLING YOU THIS:\n`;
    explanation += `${'='.repeat(80)}\n\n`;

    explanation += `I'm an AI assistant designed to help people, not harm them. What you're asking about\n`;
    explanation += `would cause serious harm - to others, to yourself, and to society. The consequences\n`;
    explanation += `outlined above are REAL. People's lives are destroyed by these actions every day.\n\n`;

    explanation += `Instead of pursuing this path, I encourage you to:\n\n`;
    explanation += `   1. Seek legitimate alternatives to achieve your goals\n`;
    explanation += `   2. Consult with a licensed attorney if you have legal questions\n`;
    explanation += `   3. Reach out to appropriate support services if you're in crisis\n`;
    explanation += `   4. Consider the long-term impact on yourself and others\n\n`;

    if (violationTypes.some(vt => ['murder', 'terrorism', 'child_exploitation'].includes(vt))) {
      explanation += `⚠️  IMMEDIATE HELP RESOURCES:\n\n`;
      explanation += `   National Suicide Prevention Lifeline: 988\n`;
      explanation += `   Crisis Text Line: Text HOME to 741741\n`;
      explanation += `   National Domestic Violence Hotline: 1-800-799-7233\n`;
      explanation += `   Childhelp National Child Abuse Hotline: 1-800-422-4453\n\n`;
    }

    explanation += `I'm here to help you with legal, ethical, and constructive requests. Please let me\n`;
    explanation += `know if there's something positive I can assist you with instead.\n`;

    return explanation;
  }

  /**
   * Get a simple boolean check without full analysis
   */
  async isQueryProblematic(query: string): Promise<boolean> {
    const queryLower = query.toLowerCase();
    const detection = this.detectViolations(queryLower);
    return detection.violationTypes.length > 0;
  }

  /**
   * Export location data for logging/audit purposes
   */
  async getLocationForAudit(userIp?: string): Promise<LocationData | null> {
    try {
      return await this.geolocationService.getLocation(userIp);
    } catch (error) {
      return null;
    }
  }
}