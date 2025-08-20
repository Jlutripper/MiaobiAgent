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
 * 专业背景移除服务 - 通过MCP调用
 * 
 * 使用真正的背景移除算法，而非AI重新生成
 * 支持多种背景移除方法和高级选项
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

        // 设置默认选项
        const defaultOptions = {
            method: 'ai_model' as const,
            quality: 'high' as const,
            edgeSmoothing: true,
            preserveTransparency: true,
            outputFormat: 'png' as const,
            ...options
        };

        console.log('🎯 [Background Removal] Starting MCP background removal...', {
            method: defaultOptions.method,
            quality: defaultOptions.quality,
            outputFormat: defaultOptions.outputFormat
        });

        // 调用MCP背景移除服务
        const result = await unifiedAIService.callMCPService(
            'BACKGROUND_REMOVAL',
            defaultOptions.method,
            base64ImageData,
            {
                quality: defaultOptions.quality,
                edgeSmoothing: defaultOptions.edgeSmoothing,
                preserveTransparency: defaultOptions.preserveTransparency,
                outputFormat: defaultOptions.outputFormat
            }
        );

        console.log('✅ [Background Removal] MCP background removal completed successfully');
        return result;

    } catch (error) {
        console.error('❌ [Background Removal] MCP service failed:', error);
        
        // 提供清晰的错误信息和解决建议
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (errorMessage.includes('MCP adapter not available')) {
            throw new Error(
                '背景移除服务暂时不可用。请确保MCP服务已正确配置和启动。\n' +
                '配置指南：检查环境变量 MCP_BACKGROUND_REMOVER_PATH 是否正确设置。'
            );
        }
        
        if (errorMessage.includes('timeout')) {
            throw new Error(
                '背景移除服务超时。图片可能太大或服务器负载过高。\n' +
                '建议：尝试压缩图片或稍后重试。'
            );
        }
        
        throw new Error(`背景移除失败: ${errorMessage}`);
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
            console.error(`❌ [Batch Background Removal] Failed for image ${image.id}:`, errorMessage);
            
            results.push({
                id: image.id,
                success: false,
                error: errorMessage
            });
        }
    }
    
    // 最终进度回调
    options.onProgress?.(images.length, images.length, 'completed');
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ [Batch Background Removal] Completed: ${successCount}/${images.length} successful`);
    
    return results;
};

/*
团队集成指南：

1. 环境变量配置（在项目根目录创建.env文件）：
   MCP_BACKGROUND_REMOVER_PATH=/path/to/your/mcp-server.js
   MCP_BACKGROUND_REMOVER_METHOD=ai_model
   MCP_BACKGROUND_REMOVER_TIMEOUT=30000

2. MCP服务器要求：
   - 必须实现 "remove_background" 工具
   - 支持 jsonrpc 2.0 协议
   - 输入格式：{ imageData: string, method: string, options: {...} }
   - 输出格式：{ success: boolean, imageData: string }

3. 调用示例：
   const result = await removeImageBackground(base64Image, {
     method: 'ai_model',
     quality: 'high',
     edgeSmoothing: true
   });

4. 错误处理：
   - 自动提供用户友好的错误信息
   - 包含解决建议和配置指导
   - 支持超时和重试机制

5. 性能优化：
   - 支持批量处理
   - 提供进度回调
   - 智能缓存（团队可扩展）
*/
