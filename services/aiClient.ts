import OpenAI from "openai";
import { AIAdapter } from './adapters/AIAdapter';
import { OpenAIAdapter } from './adapters/openaiAdapter';
import { withAdapterTelemetry } from './adapters/adapterTelemetryDecorator';

// --- 定义服务商类型 ---
type AIProvider = 'openai';

interface ModelConfig {
  provider: AIProvider;
  model: string;
}

/**
 * AI模型配置
 * 将任务类型映射到具体服务商和模型名称，以便于灵活切换和管理。
 */
export const AI_MODELS: Record<string, ModelConfig> = {
  // 可以灵活地为不同任务配置不同的服务商
  ROUTING: { provider: 'openai', model: 'gpt-5-mini' },
  LAYOUT_GENERATION: { provider: 'openai', model: 'gpt-4o' },
  CONTENT_GENERATION: { provider: 'openai', model: 'gpt-4o' },
  IMAGE_GENERATION: { provider: 'openai', model: 'dall-e-3' },
};

// --- OpenAI 客户端 ---
const OPENAI_API_KEY = "sss";
const OPENAI_API_BASE_URL = "https://aihubmix.com/v1";

let openaiClient: OpenAI | null = null;
if (OPENAI_API_KEY) {
  try {
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: OPENAI_API_BASE_URL,
      dangerouslyAllowBrowser: true,
    });
  } catch (error) {
    console.error("Failed to initialize OpenAI client:", error);
  }
} else {
    console.warn("OPENAI_API_KEY environment variable not set. OpenAI provider will not be available.");
}

export const openai = {
  client: openaiClient,
};


/**
 * AI 适配器注册表
 * 
 * 这是适配器模式的核心。我们在这里实例化所有可用的适配器，
 * 并将它们存储在一个映射中。`unifiedAIService` 将使用这个映射来
 * 动态选择正确的适配器，而无需任何if/else逻辑。
 */
export const aiAdapters: Partial<Record<AIProvider, AIAdapter>> = {};
if (openai.client) {
  aiAdapters.openai = withAdapterTelemetry(new OpenAIAdapter(), { provider: 'openai', retry: { attempts: 2, timeoutMs: 40000 } });
}