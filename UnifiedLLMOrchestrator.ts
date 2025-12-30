/**
 * Unified LLM Orchestrator
 *
 * Master controller for all 11 LLM integrations in ULYSSES-OS.
 * Provides intelligent routing, fallback chains, and load balancing
 * across all configured LLM providers.
 *
 * Supported Providers:
 * 1. Claude (Anthropic) - Primary, highest quality
 * 2. GPT-4 (OpenAI) - Alternative high-quality
 * 3. DeepSeek - Specialized reasoning
 * 4. Ollama (Local) - Privacy-focused, offline capable
 * 5. Gemini (Google) - Multimodal capabilities
 * 6. Cohere - Enterprise-grade
 * 7. HuggingFace - Open source models
 * 8. Mistral - European alternative
 * 9. Perplexity - Search-augmented
 * 10. Groq - Ultra-fast inference
 * 11. Together AI - Fine-tuned models
 */

import { credentialManager } from '../security/SecureCredentialManager';

export interface LLMProvider {
  name: string;
  endpoint: string;
  model: string;
  maxTokens: number;
  temperature: number;
  priority: number;
  capabilities: string[];
  rateLimit: number; // requests per minute
  latency: 'low' | 'medium' | 'high';
  cost: 'free' | 'low' | 'medium' | 'high';
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  preferredProvider?: string;
  requiredCapabilities?: string[];
}

export interface LLMResponse {
  text: string;
  provider: string;
  model: string;
  tokensUsed: number;
  latency: number;
  cached: boolean;
}

export class UnifiedLLMOrchestrator {
  private static instance: UnifiedLLMOrchestrator;
  private providers: Map<string, LLMProvider> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private lastReset: Date = new Date();

  // All supported LLM configurations
  private readonly providerConfigs: LLMProvider[] = [
    {
      name: 'Claude',
      endpoint: 'https://api.anthropic.com/v1/messages',
      model: 'claude-3-opus-20240229',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 1,
      capabilities: ['reasoning', 'coding', 'analysis', 'creative', 'long-context'],
      rateLimit: 60,
      latency: 'medium',
      cost: 'high'
    },
    {
      name: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4-turbo-preview',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 2,
      capabilities: ['reasoning', 'coding', 'analysis', 'creative', 'function-calling'],
      rateLimit: 60,
      latency: 'medium',
      cost: 'high'
    },
    {
      name: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 3,
      capabilities: ['reasoning', 'coding', 'math', 'analysis'],
      rateLimit: 100,
      latency: 'medium',
      cost: 'low'
    },
    {
      name: 'Ollama',
      endpoint: 'http://localhost:11434/api/generate',
      model: 'llama2',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 4,
      capabilities: ['reasoning', 'coding', 'local', 'offline'],
      rateLimit: 1000,
      latency: 'low',
      cost: 'free'
    },
    {
      name: 'Gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      model: 'gemini-pro',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 5,
      capabilities: ['reasoning', 'multimodal', 'analysis', 'vision'],
      rateLimit: 60,
      latency: 'medium',
      cost: 'medium'
    },
    {
      name: 'Cohere',
      endpoint: 'https://api.cohere.ai/v1/chat',
      model: 'command',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 6,
      capabilities: ['reasoning', 'enterprise', 'rag', 'embeddings'],
      rateLimit: 100,
      latency: 'medium',
      cost: 'medium'
    },
    {
      name: 'HuggingFace',
      endpoint: 'https://api-inference.huggingface.co/models',
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 7,
      capabilities: ['reasoning', 'open-source', 'custom-models'],
      rateLimit: 30,
      latency: 'high',
      cost: 'low'
    },
    {
      name: 'Mistral',
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      model: 'mistral-large-latest',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 8,
      capabilities: ['reasoning', 'coding', 'multilingual', 'european'],
      rateLimit: 60,
      latency: 'medium',
      cost: 'medium'
    },
    {
      name: 'Perplexity',
      endpoint: 'https://api.perplexity.ai/chat/completions',
      model: 'pplx-7b-online',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 9,
      capabilities: ['search', 'real-time', 'citations', 'web-access'],
      rateLimit: 20,
      latency: 'medium',
      cost: 'medium'
    },
    {
      name: 'Groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'mixtral-8x7b-32768',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 10,
      capabilities: ['fast-inference', 'reasoning', 'speed-optimized'],
      rateLimit: 100,
      latency: 'low',
      cost: 'low'
    },
    {
      name: 'TogetherAI',
      endpoint: 'https://api.together.xyz/v1/chat/completions',
      model: 'togethercomputer/llama-2-70b-chat',
      maxTokens: 4096,
      temperature: 0.7,
      priority: 11,
      capabilities: ['fine-tuning', 'custom-models', 'reasoning'],
      rateLimit: 60,
      latency: 'medium',
      cost: 'low'
    }
  ];

  private constructor() {
    this.initializeProviders();
  }

  static getInstance(): UnifiedLLMOrchestrator {
    if (!UnifiedLLMOrchestrator.instance) {
      UnifiedLLMOrchestrator.instance = new UnifiedLLMOrchestrator();
    }
    return UnifiedLLMOrchestrator.instance;
  }

  /**
   * Initialize available providers based on configured credentials
   */
  private initializeProviders(): void {
    for (const config of this.providerConfigs) {
      if (credentialManager.isConfigured(config.name) || config.name === 'Ollama') {
        this.providers.set(config.name, config);
        this.requestCounts.set(config.name, 0);
      }
    }
    console.log(`[LLM Orchestrator] Initialized ${this.providers.size} providers`);
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providers.values())
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Select best provider for a request
   */
  selectProvider(request: LLMRequest): LLMProvider | null {
    const available = this.getAvailableProviders();

    if (available.length === 0) return null;

    // If specific provider requested
    if (request.preferredProvider) {
      const preferred = this.providers.get(request.preferredProvider);
      if (preferred && this.isWithinRateLimit(preferred)) {
        return preferred;
      }
    }

    // If specific capabilities required
    if (request.requiredCapabilities && request.requiredCapabilities.length > 0) {
      for (const provider of available) {
        const hasAllCapabilities = request.requiredCapabilities.every(
          cap => provider.capabilities.includes(cap)
        );
        if (hasAllCapabilities && this.isWithinRateLimit(provider)) {
          return provider;
        }
      }
    }

    // Default: return highest priority available provider
    for (const provider of available) {
      if (this.isWithinRateLimit(provider)) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Check if provider is within rate limit
   */
  private isWithinRateLimit(provider: LLMProvider): boolean {
    // Reset counts every minute
    const now = new Date();
    if (now.getTime() - this.lastReset.getTime() > 60000) {
      this.requestCounts.forEach((_, key) => this.requestCounts.set(key, 0));
      this.lastReset = now;
    }

    const count = this.requestCounts.get(provider.name) || 0;
    return count < provider.rateLimit;
  }

  /**
   * Record a request to a provider
   */
  private recordRequest(provider: LLMProvider): void {
    const count = this.requestCounts.get(provider.name) || 0;
    this.requestCounts.set(provider.name, count + 1);
  }

  /**
   * Generate completion using best available provider
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.selectProvider(request);

    if (!provider) {
      throw new Error('No LLM provider available');
    }

    const startTime = Date.now();
    this.recordRequest(provider);

    try {
      const text = await this.callProvider(provider, request);

      return {
        text,
        provider: provider.name,
        model: provider.model,
        tokensUsed: this.estimateTokens(text),
        latency: Date.now() - startTime,
        cached: false
      };
    } catch (error) {
      // Try fallback
      const fallback = this.getFallbackProvider(provider);
      if (fallback) {
        console.log(`[LLM Orchestrator] Falling back from ${provider.name} to ${fallback.name}`);
        const text = await this.callProvider(fallback, request);
        return {
          text,
          provider: fallback.name,
          model: fallback.model,
          tokensUsed: this.estimateTokens(text),
          latency: Date.now() - startTime,
          cached: false
        };
      }
      throw error;
    }
  }

  /**
   * Get fallback provider
   */
  private getFallbackProvider(current: LLMProvider): LLMProvider | null {
    const available = this.getAvailableProviders();
    const currentIndex = available.findIndex(p => p.name === current.name);

    for (let i = currentIndex + 1; i < available.length; i++) {
      if (this.isWithinRateLimit(available[i])) {
        return available[i];
      }
    }
    return null;
  }

  /**
   * Call a specific provider
   */
  private async callProvider(provider: LLMProvider, request: LLMRequest): Promise<string> {
    const credential = credentialManager.getCredential(provider.name);

    // Provider-specific implementations would go here
    // For now, return a placeholder indicating which provider would be used
    console.log(`[LLM Orchestrator] Would call ${provider.name} with model ${provider.model}`);

    // This is a stub - actual implementation would make the API call
    return `[Response from ${provider.name}]`;
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ~= 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Get orchestrator status
   */
  getStatus(): {
    totalProviders: number;
    configuredProviders: number;
    providerDetails: Array<{
      name: string;
      available: boolean;
      priority: number;
      requestCount: number;
      capabilities: string[];
    }>;
  } {
    return {
      totalProviders: this.providerConfigs.length,
      configuredProviders: this.providers.size,
      providerDetails: this.providerConfigs.map(config => ({
        name: config.name,
        available: this.providers.has(config.name),
        priority: config.priority,
        requestCount: this.requestCounts.get(config.name) || 0,
        capabilities: config.capabilities
      }))
    };
  }

  /**
   * Log orchestrator status
   */
  logStatus(): void {
    const status = this.getStatus();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  UNIFIED LLM ORCHESTRATOR STATUS');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📊 Providers: ${status.configuredProviders}/${status.totalProviders} configured\n`);

    console.log('Provider Status:');
    for (const detail of status.providerDetails) {
      const status = detail.available ? '✅' : '❌';
      console.log(`  ${status} ${detail.name} (Priority: ${detail.priority})`);
      if (detail.available) {
        console.log(`     Requests: ${detail.requestCount}`);
        console.log(`     Capabilities: ${detail.capabilities.slice(0, 3).join(', ')}...`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
  }
}

export const llmOrchestrator = UnifiedLLMOrchestrator.getInstance();
