import { GoogleGenAI } from "@google/genai";
import { CustomTool } from '../types';
import { base64ToGenerativePart } from './imageToolsService';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const executeCustomTool = async (tool: CustomTool, textPrompt?: string, base64ImageData?: string): Promise<string> => {
    const contents = [];
    
    if (textPrompt) {
        contents.push({ text: `\nUser's text input: "${textPrompt}"` });
    }
    if (base64ImageData) {
        contents.push(base64ToGenerativePart(base64ImageData, 'image/png'));
    }
    
    const promptGenResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction: `${tool.systemPrompt}\nBased on the above instructions and inputs, create a single, highly-detailed, and creative prompt for an image generation model (like Imagen 3) to create the final image. The prompt should be a single continuous string of text.`
        }
    });
    const finalImagePrompt = promptGenResponse.text;

    if (!finalImagePrompt || finalImagePrompt.trim().length < 10) {
        throw new Error("Failed to generate a valid image prompt from the custom tool instructions.");
    }

    const imageResponse = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: finalImagePrompt,
        config: { 
            numberOfImages: 1,
            outputMimeType: 'image/png'
        }
    });

    const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
};
