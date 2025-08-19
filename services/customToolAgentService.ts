import { CustomTool } from '../types';
import { unifiedAIService } from './unifiedAIService';

export const executeCustomTool = async (tool: CustomTool, textPrompt?: string, base64ImageData?: string): Promise<string> => {
    
    const finalImagePrompt = await unifiedAIService.generateText({
        task: 'CONTENT_GENERATION',
        prompt: `\nUser's text input: "${textPrompt || 'none'}"`,
        systemInstruction: `${tool.systemPrompt}\nBased on the above instructions and inputs, create a single, highly-detailed, and creative prompt for an image generation model (like Imagen 3 or DALL-E 3) to create the final image. The prompt should be a single continuous string of text.`,
        imageBase64: base64ImageData,
        mimeType: base64ImageData ? 'image/png' : undefined
    });

    if (!finalImagePrompt || finalImagePrompt.trim().length < 10) {
        throw new Error("Failed to generate a valid image prompt from the custom tool instructions.");
    }

    return await unifiedAIService.generateImage({
        task: 'IMAGE_GENERATION',
        prompt: finalImagePrompt
    });
};
