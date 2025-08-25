import { AI_MODELS, openai } from './aiClient';
import OpenAI from 'openai';
import { extractFirstJson } from './utils/aiRequestUtils';
import { layoutBoxSchema } from './generatedSchemas';
import { SchemaType } from './utils/aiSchemaTypes';

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

// Helper: convert our simple schema object into a text description for OpenAI
const schemaToText = (schema: any, indent = ''): string => {
    if (!schema || !schema.properties) return '';
    let text = '{\n';
    const properties = schema.properties;
    const required = schema.required || [];

    for (const key in properties) {
        const prop = properties[key];
        const isRequired = required.includes(key);
        const requiredMarker = isRequired ? '' : '?';
        const description = prop.description ? ` // ${prop.description}` : '';
        
        let typeString = '';
        switch(prop.type) {
            case SchemaType.STRING:
                typeString = prop.enum ? prop.enum.map((e:string) => `"${e}"`).join(' | ') : 'string';
                break;
            case SchemaType.NUMBER:
                typeString = 'number';
                break;
            case SchemaType.BOOLEAN:
                typeString = 'boolean';
                break;
            case SchemaType.ARRAY:
                const itemSchema = prop.items || { type: 'any' };
                const itemText = schemaToText(itemSchema, indent + '  ');
                typeString = itemSchema.properties ? `Array<${itemText}>` : `Array<${itemSchema.type?.toLowerCase() || 'any'}>`;
                break;
            case SchemaType.OBJECT:
                typeString = schemaToText(prop, indent + '  ');
                break;
            default:
                typeString = 'any';
        }
        text += `${indent}  "${key}"${requiredMarker}: ${typeString};${description}\n`;
    }
    text += `${indent}}`;
    return text;
};

/**
 * 统一AI服务 (简化版本)
 * 
 * 直接使用OpenAI兼容的客户端，不再使用adapter模式。
 * 所有功能都通过模型名称区分，简化架构。
 */
export const unifiedAIService = {

  async generateJSON(params: GenerateJSONParams): Promise<string> {
    const modelName = AI_MODELS[params.task];
    if (!modelName) throw new Error(`No model configuration found for task: ${params.task}`);
    
    if (!openai.client) throw new Error("OpenAI client is not initialized.");

    const { prompt, systemInstruction, schema } = params;

    let finalSystemInstruction = systemInstruction || '';
    if (schema) {
        const schemaDescription = schemaToText(schema);
        finalSystemInstruction += `\nYou MUST respond ONLY with a valid JSON object. The JSON object MUST strictly adhere to the following TypeScript interface:\n${schemaDescription}`;
    } else {
        finalSystemInstruction += "\nYou MUST respond ONLY with a valid JSON object.";
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: finalSystemInstruction },
      { role: "user", content: prompt }
    ];

    const response = await openai.client.chat.completions.create({
      model: modelName,
      messages: messages,
      response_format: { type: "json_object" },
    });
    
    const raw = response.choices[0].message.content || '{}';

    // 运行时校验：当提供了schema时进行解析与校验
    const targetSchema = schema || layoutBoxSchema;
    try {
      const parsed = JSON.parse(raw);
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
    const modelName = AI_MODELS[params.task];
    if (!modelName) throw new Error(`No model configuration found for task: ${params.task}`);

    if (!openai.client) throw new Error("OpenAI client is not initialized.");

    const { prompt, systemInstruction, imageBase64 } = params;

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: 'text', text: prompt }];
    if (imageBase64) {
        // OpenAI API expects the full data URI for image_url
        userContent.push({ type: 'image_url', image_url: { url: imageBase64 } });
    }
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: userContent });

    const response = await openai.client.chat.completions.create({
        model: modelName,
        messages: messages,
    });
    return response.choices[0].message.content || '';
  },

  async generateImage(params: GenerateImageParams): Promise<string> {
    const modelName = AI_MODELS[params.task];
    if (!modelName) throw new Error(`No model configuration found for task: ${params.task}`);

    if (!openai.client) throw new Error("OpenAI client is not initialized.");
    
    const { prompt } = params;

    const response = await openai.client.images.generate({
        model: modelName,
        prompt: prompt,
        n: 1,
        size: "1024x1024", // DALL-E 3 default size
        response_format: 'b64_json',
    });
    const b64_json = response.data?.[0]?.b64_json;
    if (!b64_json) throw new Error("OpenAI did not return a base64 image.");
    return `data:image/png;base64,${b64_json}`;
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
