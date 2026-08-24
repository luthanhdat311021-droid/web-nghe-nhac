/**
 * AI Provider Factory & Manager
 * MusicWave AI Smart Search Engine
 */

import { IAIProvider, AIAnalysisResult, SearchContext } from './aiTypes.js';
import { RuleBasedSemanticProvider } from './ruleBasedProvider.js';
import { GeminiAIProvider } from './geminiProvider.js';

export class AIProviderManager {
  private static instance: AIProviderManager;
  private activeProvider: IAIProvider;

  private constructor() {
    const gemini = new GeminiAIProvider();
    if (gemini.isAvailable()) {
      this.activeProvider = gemini;
    } else {
      this.activeProvider = new RuleBasedSemanticProvider();
    }
  }

  public static getInstance(): AIProviderManager {
    if (!AIProviderManager.instance) {
      AIProviderManager.instance = new AIProviderManager();
    }
    return AIProviderManager.instance;
  }

  public getProvider(): IAIProvider {
    return this.activeProvider;
  }

  public setProvider(provider: IAIProvider) {
    this.activeProvider = provider;
  }

  public async analyzeQuery(query: string, context?: SearchContext): Promise<AIAnalysisResult> {
    return this.activeProvider.analyzeQuery(query, context);
  }
}

export const aiSearchManager = AIProviderManager.getInstance();
