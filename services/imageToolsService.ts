import { AspectRatio } from '../types';
import { unifiedAIService } from './unifiedAIService';

export const generateStandaloneImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
    return unifiedAIService.generateImage({
        task: 'IMAGE_GENERATION',
        prompt: prompt,
        aspectRatio: aspectRatio,
    });
};

export const upscaleImage = async (base64ImageData: string): Promise<string> => {
    const description = await unifiedAIService.generateText({
        task: 'CONTENT_GENERATION',
        prompt: 'Create a detailed, objective description of this image for an image generation model. Focus on subjects, colors, composition, and style.',
        imageBase64: base64ImageData,
        mimeType: 'image/png'
    });
    
    const newImagePrompt = `Photorealistic 4K image based on this description: ${description}. High detail, cinematic lighting.`;
    
    return unifiedAIService.generateImage({
        task: 'IMAGE_GENERATION',
        prompt: newImagePrompt,
        aspectRatio: '1:1', // Default to 1:1 for upscaling
    });
};

export const removeImageBackground = async (base64ImageData: string): Promise<string> => {
    const description = await unifiedAIService.generateText({
        task: 'CONTENT_GENERATION',
        prompt: 'Identify the main subject in this image and describe it in detail. For example: "A black cat sitting on a red cushion".',
        imageBase64: base64ImageData,
        mimeType: 'image/png',
    });

    const newImagePrompt = `A high-resolution image of: ${description}. Centered, studio lighting, on a pure white background. The subject should be clearly isolated.`;
    
    return unifiedAIService.generateImage({
        task: 'IMAGE_GENERATION',
        prompt: newImagePrompt,
        aspectRatio: '1:1' // Default to 1:1 for background removal
    });
};
