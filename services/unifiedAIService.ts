import { AI_MODELS, aiAdapters } from './aiClient';
import { GenerateJSONParams, GenerateTextParams, GenerateImageParams, MCPServiceParams } from './adapters/AIAdapter';
import { extractFirstJson } from './utils/aiRequestUtils';
import { layoutBoxSchema } from './generatedSchemas';

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
    const raw = await adapter.generateJSON({ ...params, task: config.model });

    // 运行时校验：当提供了schema时进行解析与校验（默认使用 layoutBoxSchema 示例；外部也可传入 params.schema 覆盖）
    const targetSchema = params.schema || layoutBoxSchema;
    try {
      const parsed = JSON.parse(raw);
      // 简化版校验：仅校验必填字段是否存在，类型粗校验（避免引入重库）。后续可接 valibot/zod。
  validateByLooseSchema(parsed, targetSchema);
      return JSON.stringify(parsed);
    } catch (e) {
      // 尝试自愈：从文本中提取第一个 JSON
      const recovered = extractFirstJson(raw);
      if (recovered) {
        try {
          validateByLooseSchema(recovered, targetSchema);
          return JSON.stringify(recovered);
        } catch {}
      }
      // 保底返回原文（上层可感知并处理），同时抛错以便统一错误流
      throw new Error(`AI JSON parse/validate failed: ${String(e)}. Raw: ${trimForLog(raw)}`);
    }
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

  /**
   * 调用MCP服务
   * 专门用于本地MCP服务调用，如背景移除等
   */
  async callMCPService(task: string, method: string, data: any, options?: Record<string, any>): Promise<string> {
    const config = AI_MODELS[task];
    if (!config) throw new Error(`No model configuration found for MCP task: ${task}`);
    
    if (config.provider !== 'mcp') {
      throw new Error(`Task ${task} is not configured for MCP provider`);
    }
    
    const adapter = aiAdapters.mcp;
    if (!adapter || !adapter.callMCPService) {
      throw new Error('MCP adapter not available or does not support MCP service calls');
    }
    
    return adapter.callMCPService({
      task: config.model,
      method,
      data,
      options: options || {}
    });
  },
};

// 轻量级通用 Schema 校验（OBJECT/STRING/NUMBER/BOOLEAN/ARRAY）
function validateByLooseSchema(value: any, schema: any, path: string = '$'): void {
  if (!schema || typeof schema !== 'object') return;
  const type = schema.type;
  switch (type) {
    case 'OBJECT': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        // 宽松兼容：当 schema 表示为 { content: ARRAY } 或 { prompt: STRING } 的容器时
        const props = schema.properties || {};
        const expectTextArray = props.content && props.content.type === 'ARRAY';
        const expectPromptString = props.prompt && props.prompt.type === 'STRING';
        const isAcceptableAlt = (Array.isArray(value) && expectTextArray) || (typeof value === 'string' && expectPromptString);
        if (!isAcceptableAlt) throw new Error(`${path} expected OBJECT`);
        return; // 视为通过
      }
      const required: string[] = schema.required || [];
      for (const key of required) {
        if (!(key in value)) throw new Error(`${path}.${key} is required`);
      }
      const props = schema.properties || {};
      for (const key in value) {
  if (props[key]) validateByLooseSchema(value[key], props[key], `${path}.${key}`);
      }
      break;
    }
    case 'ARRAY': {
      if (!Array.isArray(value)) throw new Error(`${path} expected ARRAY`);
      if (schema.items) {
  value.forEach((v: any, idx: number) => validateByLooseSchema(v, schema.items, `${path}[${idx}]`));
      }
      break;
    }
    case 'STRING': {
      if (typeof value !== 'string') throw new Error(`${path} expected STRING`);
      if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} not in enum`);
      break;
    }
    case 'NUMBER': {
      if (typeof value !== 'number') throw new Error(`${path} expected NUMBER`);
      break;
    }
    case 'BOOLEAN': {
      if (typeof value !== 'boolean') throw new Error(`${path} expected BOOLEAN`);
      break;
    }
    default:
      // 不识别的类型，跳过
      break;
  }
}

function trimForLog(s: string, max = 500): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '…' : s;
}
