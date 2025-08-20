// services/adapters/AIAdapter.ts

/**
 * AI Adapter Interface (设计合同)
 * 
 * 这个接口定义了所有AI服务商适配器必须遵守的通用方法。
 * 它确保了无论底层是哪家模型服务商，
 * 我们的上层服务都能用同样的方式与它们对话。
 */

// --- 通用参数类型定义 ---

export interface GenerateJSONParams {
  task: string;
  prompt: string;
  systemInstruction?: string;
  schema?: any; // Optional JSON schema in our internal format
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

// --- MCP服务参数类型定义 ---
export interface MCPServiceParams {
  task: string;
  method: string;
  data: any;
  options?: Record<string, any>;
}

export interface AIAdapter {
  generateJSON(params: GenerateJSONParams): Promise<string>;
  generateText(params: GenerateTextParams): Promise<string>;
  generateImage(params: GenerateImageParams): Promise<string>;
  // MCP服务调用（可选实现）
  callMCPService?(params: MCPServiceParams): Promise<string>;
}
