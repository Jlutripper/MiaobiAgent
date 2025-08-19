// services/adapters/geminiAdapter.ts

import { ai } from '../aiClient';
import { AIAdapter, GenerateJSONParams, GenerateTextParams, GenerateImageParams } from './AIAdapter';

/**
 * Gemini AI Adapter
 * 
 * 实现了AIAdapter接口，专门处理与Google Gemini模型的通信。
 * 它封装了Gemini SDK的所有特定实现细节。
 */
export class GeminiAdapter implements AIAdapter {

  async generateJSON(params: GenerateJSONParams): Promise<string> {
    if (!ai.client) throw new Error("Gemini client is not initialized.");
    const { task: modelName, prompt, systemInstruction, schema } = params;
    
    const response = await ai.client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          systemInstruction: systemInstruction,
      },
    });
    
    return response.text;
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    if (!ai.client) throw new Error("Gemini client is not initialized.");
    const { task: modelName, prompt, systemInstruction, imageBase64, mimeType } = params;

    const parts: any[] = [];
    if (imageBase64 && mimeType) {
        parts.push({
            inlineData: {
                data: imageBase64.split(',')[1] || imageBase64,
                mimeType
            }
        });
    }
    parts.push({ text: prompt });

    const response = await ai.client.models.generateContent({
        model: modelName,
        contents: { parts: parts },
        config: {
            systemInstruction: systemInstruction,
        }
    });
    return response.text;
  }

  async generateImage(params: GenerateImageParams): Promise<string> {
    if (!ai.client) throw new Error("Gemini client is not initialized.");
    const { task: modelName, prompt, aspectRatio = '1:1' } = params;

    const response = await ai.client.models.generateImages({
        model: modelName,
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio,
        },
    });
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  }
}