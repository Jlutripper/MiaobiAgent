import OpenAI from "openai";

/**
 * AI模型配置
 * 将任务类型映射到具体模型名称，统一使用OpenAI兼容的客户端。
 */
export const AI_MODELS: Record<string, string> = {
  // 不同任务对应不同的模型
  ROUTING: 'gpt-4o-mini',
  LAYOUT_GENERATION: 'gpt-4o',
  CONTENT_GENERATION: 'gpt-4o',
  IMAGE_GENERATION: 'dall-e-3',
};

// --- OpenAI 兼容客户端 ---
const OPENAI_API_KEY = "sk-";
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