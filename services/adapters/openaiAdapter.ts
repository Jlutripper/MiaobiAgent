// services/adapters/openaiAdapter.ts

import OpenAI from "openai";
import { openai } from '../aiClient';
import { AIAdapter, GenerateJSONParams, GenerateTextParams, GenerateImageParams } from './AIAdapter';
import { SchemaType } from '../aiSchemaTypes';

// Helper function to convert a Gemini-style schema object into a text description for OpenAI
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
 * OpenAI AI Adapter
 * 
 * 实现了AIAdapter接口，专门处理与OpenAI模型的通信。
 */
export class OpenAIAdapter implements AIAdapter {

  async generateJSON(params: GenerateJSONParams): Promise<string> {
    if (!openai.client) throw new Error("OpenAI client is not initialized.");

    const { task: modelName, prompt, systemInstruction, schema } = params;

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
    return response.choices[0].message.content || '{}';
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    if (!openai.client) throw new Error("OpenAI client is not initialized.");

    const { task: modelName, prompt, systemInstruction, imageBase64 } = params;

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
  }

  async generateImage(params: GenerateImageParams): Promise<string> {
    if (!openai.client) throw new Error("OpenAI client is not initialized.");
    
    const { task: modelName, prompt } = params;

    const response = await openai.client.images.generate({
        model: modelName,
        prompt: prompt,
        n: 1,
        size: "1024x1024", // DALL-E 3 default size
        response_format: 'b64_json',
    });
    const b64_json = response.data[0].b64_json;
    if (!b64_json) throw new Error("OpenAI did not return a base64 image.");
    return `data:image/png;base64,${b64_json}`;
  }
}