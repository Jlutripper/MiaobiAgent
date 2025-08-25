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

/**
 * 背景移除服务 - 通过AI重新生成
 * 
 * 使用AI模型分析原图并生成移除背景的新图片
 */
export const removeImageBackground = async (
    base64ImageData: string, 
    options: {
        method?: 'ai_model' | 'traditional_algorithm' | 'hybrid';
        quality?: 'high' | 'medium' | 'fast';
        edgeSmoothing?: boolean;
        preserveTransparency?: boolean;
        outputFormat?: 'png' | 'webp';
    } = {}
): Promise<string> => {
    try {
        // 验证输入数据
        if (!base64ImageData || !base64ImageData.startsWith('data:image/')) {
            throw new Error('Invalid image data. Expected base64 data URL format.');
        }

        console.log('🎯 [Background Removal] Starting AI-based background removal...');

        // 首先分析图片内容
        const description = await unifiedAIService.generateText({
            task: 'CONTENT_GENERATION',
            prompt: 'Analyze this image and provide a detailed description of the main subject that should be kept when removing the background. Focus on the foreground object, person, or subject that should remain visible. Describe their appearance, pose, clothing, and any important details.',
            imageBase64: base64ImageData,
            systemInstruction: 'You are an expert at analyzing images for background removal. Provide a clear, detailed description of what should remain visible after background removal.'
        });

        // 生成新图片，主体保持不变但背景透明
        const prompt = `Create a high-quality image with transparent background showing: ${description}. The subject should be isolated from any background, with clean edges and professional quality. PNG format with transparency.`;

        const result = await unifiedAIService.generateImage({
            task: 'IMAGE_GENERATION',
            prompt: prompt,
            aspectRatio: '1:1'
        });

        console.log('✅ [Background Removal] AI-based background removal completed successfully');
        return result;

    } catch (error) {
        console.error('❌ [Background Removal] AI service failed:', error);
        
        // 提供清晰的错误信息和解决建议
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        throw new Error(
            `背景移除失败: ${errorMessage}\n` +
            '建议：确保图片清晰且主体明显，或尝试使用其他图片。'
        );
    }
};

/**
 * 批量背景移除服务
 * 
 * 支持同时处理多张图片的背景移除
 * 提供进度回调和错误处理
 */
export const batchRemoveImageBackground = async (
    images: Array<{ id: string; imageData: string; }>,
    options: {
        method?: 'ai_model' | 'traditional_algorithm' | 'hybrid';
        quality?: 'high' | 'medium' | 'fast';
        onProgress?: (completed: number, total: number, currentId: string) => void;
    } = {}
): Promise<Array<{ id: string; success: boolean; result?: string; error?: string; }>> => {
    
    const results: Array<{ id: string; success: boolean; result?: string; error?: string; }> = [];
    
    console.log(`🔄 [Batch Background Removal] Processing ${images.length} images...`);
    
    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        
        try {
            // 调用进度回调
            options.onProgress?.(i, images.length, image.id);
            
            const result = await removeImageBackground(image.imageData, {
                method: options.method,
                quality: options.quality
            });
            
            results.push({
                id: image.id,
                success: true,
                result: result
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            results.push({
                id: image.id,
                success: false,
                error: errorMessage
            });
            
            console.error(`❌ [Batch Background Removal] Failed for image ${image.id}:`, errorMessage);
        }
    }
    
    // 最终进度回调
    options.onProgress?.(images.length, images.length, '');
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ [Batch Background Removal] Completed: ${successCount}/${images.length} successful`);
    
    return results;
};
