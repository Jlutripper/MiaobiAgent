import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const base64ToGenerativePart = (base64: string, mimeType: string) => {
    return {
        inlineData: {
            data: base64.split(',')[1] || base64,
            mimeType
        },
    };
};

export const generateStandaloneImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
    const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio,
        }
    });

    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
};

export const upscaleImage = async (base64ImageData: string): Promise<string> => {
    const imagePart = base64ToGenerativePart(base64ImageData, 'image/png');

    const describeResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            imagePart,
            { text: 'Create a detailed, objective description of this image for an image generation model. Focus on subjects, colors, composition, and style.' }
        ],
    });
    const description = describeResponse.text;
    
    const newImagePrompt = `Photorealistic 4K image based on this description: ${description}. High detail, cinematic lighting.`;
    const imageResponse = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: newImagePrompt,
        config: { numberOfImages: 1, outputMimeType: 'image/jpeg' }
    });

    const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
};

export const removeImageBackground = async (base64ImageData: string): Promise<string> => {
    const imagePart = base64ToGenerativePart(base64ImageData, 'image/png');
    
    const describeResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            imagePart,
            { text: 'Identify the main subject in this image and describe it in detail. For example: "A black cat sitting on a red cushion".' }
        ],
    });
    const description = describeResponse.text;

    const newImagePrompt = `A high-resolution image of: ${description}. Centered, studio lighting, on a pure white background. The subject should be clearly isolated.`;
    
    const imageResponse = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: newImagePrompt,
        config: { numberOfImages: 1, outputMimeType: 'image/png' }
    });

    const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
};
