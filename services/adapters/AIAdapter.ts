// services/adapters/AIAdapter.ts

/**
 * AI Adapter Interface (设计合同)
 * 
 * 这个接口定义了所有AI服务商适配器必须遵守的通用方法。
 * 它确保了无论底层是Gemini, OpenAI, 还是未来的Claude，
 * 我们的上层服务都能用同样的方式与它们对话。
 */

// --- 通用参数类型定义 ---

export interface GenerateJSONParams {
  task: string;
  prompt: string;
  systemInstruction?: string;
  schema?: any; // Gemini-specific schema
}

export interface GenerateTextParams {
  task: string;
  prompt: string;
  systemInstruction?: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface GenerateImageParams {
  task: string;
  prompt: string;
  aspectRatio?: string;
}


export interface AIAdapter {
  generateJSON(params: GenerateJSONParams): Promise<string>;
  generateText(params: GenerateTextParams): Promise<string>;
  generateImage(params: GenerateImageParams): Promise<string>;
}
