import { AI_MODELS, aiAdapters } from './aiClient';
import { GenerateJSONParams, GenerateTextParams, GenerateImageParams } from './adapters/AIAdapter';

/**
 * 统一AI服务 (路由器版本)
 * 
 * 这个服务现在是一个纯粹的路由器。它不再包含任何特定于服务商的实现逻辑。
 * 它的职责是：
 * 1. 根据任务类型，从 `AI_MODELS` 配置中查找应该使用哪个服务商 (`provider`)。
 * 2. 从 `aiAdapters` 注册表中获取该服务商对应的适配器实例。
 * 3. 调用适配器的通用方法，并将所有参数透传过去。
 * 
 * 这种设计实现了真正的“可插拔”架构。
 */
export const unifiedAIService = {

  async generateJSON(params: GenerateJSONParams): Promise<string> {
    const config = AI_MODELS[params.task];
    if (!config) throw new Error(`No model configuration found for task: ${params.task}`);
    
    const adapter = aiAdapters[config.provider];
    if (!adapter) throw new Error(`No adapter or client initialized for provider: ${config.provider}`);
    
    // 委托给具体的适配器执行
    return adapter.generateJSON({ ...params, task: config.model });
  },

  async generateText(params: GenerateTextParams): Promise<string> {
    const config = AI_MODELS[params.task];
    if (!config) throw new Error(`No model configuration found for task: ${params.task}`);

    const adapter = aiAdapters[config.provider];
    if (!adapter) throw new Error(`No adapter or client initialized for provider: ${config.provider}`);

    return adapter.generateText({ ...params, task: config.model });
  },

  async generateImage(params: GenerateImageParams): Promise<string> {
    const config = AI_MODELS[params.task];
    if (!config) throw new Error(`No model configuration found for task: ${params.task}`);

    const adapter = aiAdapters[config.provider];
    if (!adapter) throw new Error(`No adapter or client initialized for provider: ${config.provider}`);

    return adapter.generateImage({ ...params, task: config.model });
  },
};
