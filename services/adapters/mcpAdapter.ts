// services/adapters/mcpAdapter.ts

import { AIAdapter, GenerateJSONParams, GenerateTextParams, GenerateImageParams, MCPServiceParams } from './AIAdapter';

/**
 * MCP (Model Context Protocol) 适配器
 * 
 * 专门用于与本地MCP服务通信的适配器。
 * 支持各种MCP工具调用，如背景移除、图像处理等。
 * 
 * 注意：此适配器通过HTTP API与MCP服务通信，而不是直接spawn进程
 * 这样可以在浏览器环境中正常工作
 */

interface MCPConfig {
  backgroundRemover: {
    apiEndpoint: string;
    defaultMethod: string;
    timeout: number;
    supportedFormats: string[];
  };
}

// MCP服务配置 - 基于HTTP API的配置
const MCP_CONFIG: MCPConfig = {
  backgroundRemover: {
    // TODO: 团队开发完成后，更新为实际的MCP HTTP API端点
    // 例如: "http://localhost:3001/api/remove-background"
    apiEndpoint: process.env.MCP_BACKGROUND_REMOVER_ENDPOINT || "",
    
    // TODO: 根据团队MCP服务支持的方法进行配置
    defaultMethod: process.env.MCP_BACKGROUND_REMOVER_METHOD || "ai_model",
    
    // 超时时间（毫秒）
    timeout: parseInt(process.env.MCP_BACKGROUND_REMOVER_TIMEOUT || "30000"),
    
    // 支持的图像格式
    supportedFormats: ["png", "jpg", "jpeg", "webp"]
  }
};

export class MCPAdapter implements AIAdapter {

  // MCP适配器不支持传统AI生成，抛出明确错误
  async generateJSON(_params: GenerateJSONParams): Promise<string> {
    throw new Error('MCP adapter does not support JSON generation. Use AI adapters instead.');
  }

  async generateText(_params: GenerateTextParams): Promise<string> {
    throw new Error('MCP adapter does not support text generation. Use AI adapters instead.');
  }

  async generateImage(_params: GenerateImageParams): Promise<string> {
    throw new Error('MCP adapter does not support image generation. Use AI adapters instead.');
  }

  /**
   * 调用MCP服务的核心方法
   */
  async callMCPService(params: MCPServiceParams): Promise<string> {
    const { task, method, data, options = {} } = params;

    switch (task) {
      case 'background_removal':
        return this.callBackgroundRemovalService(data, method, options);
      
      // TODO: 团队可以在这里添加更多MCP服务
      // case 'image_upscaling':
      //   return this.callImageUpscalingService(data, method, options);
      
      default:
        throw new Error(`Unsupported MCP task: ${task}`);
    }
  }

  /**
   * 背景移除MCP服务调用 - HTTP API版本
   */
  private async callBackgroundRemovalService(
    imageData: string, 
    method: string, 
    options: Record<string, any>
  ): Promise<string> {
    
    // 验证输入数据
    this.validateImageData(imageData);
    
    const config = MCP_CONFIG.backgroundRemover;
    
    // 检查MCP服务是否已配置
    if (!config.apiEndpoint || config.apiEndpoint.trim() === '') {
      throw new Error(
        '背景移除服务尚未配置。MCP API端点为空。\n' +
        '请联系开发团队确认MCP背景移除服务的开发进度，或设置环境变量 MCP_BACKGROUND_REMOVER_ENDPOINT。\n' +
        '例如: MCP_BACKGROUND_REMOVER_ENDPOINT=http://localhost:3001/api/remove-background'
      );
    }
    
    // 构建HTTP请求数据
    const requestData = {
      imageData: imageData,
      method: method || config.defaultMethod,
      outputFormat: options.outputFormat || "png",
      quality: options.quality || "high",
      edgeSmoothing: options.edgeSmoothing !== false,
      preserveTransparency: options.preserveTransparency !== false,
      ...options // 允许传递其他自定义参数
    };

    try {
      console.log('🔄 [MCP] Calling background removal service...', {
        endpoint: config.apiEndpoint,
        method: requestData.method,
        quality: requestData.quality
      });

      const result = await this.executeHTTPRequest(config.apiEndpoint, requestData, config.timeout);
      return this.parseBackgroundRemovalResult(result);
    } catch (error) {
      // 增强错误信息，提供更多上下文
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('fetch')) {
        throw new Error(
          '无法连接到MCP背景移除服务。可能的原因：\n' +
          '1. MCP服务未启动或端点错误\n' +
          '2. 网络连接问题\n' +
          '3. CORS配置问题\n' +
          `当前配置端点: ${config.apiEndpoint}`
        );
      }
      
      throw new Error(`MCP Background Removal failed: ${errorMessage}`);
    }
  }

  /**
   * 执行HTTP请求的核心逻辑
   */
  private async executeHTTPRequest(
    endpoint: string, 
    requestData: any, 
    timeout: number
  ): Promise<any> {
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`MCP service timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * 解析背景移除结果
   */
  private parseBackgroundRemovalResult(httpResult: any): string {
    try {
      // TODO: 根据团队MCP服务的实际HTTP响应格式进行调整
      // HTTP API版本的期望格式: { success: boolean, imageData: string, metadata?: any }
      
      if (httpResult.success && httpResult.imageData) {
        console.log('✅ [MCP] Background removal completed successfully');
        return httpResult.imageData;
      }
      
      if (httpResult.error) {
        throw new Error(httpResult.error);
      }
      
      throw new Error('Invalid MCP HTTP response format');
      
    } catch (error) {
      throw new Error(`Failed to parse background removal result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 验证输入图像数据
   */
  private validateImageData(imageData: string): void {
    if (!imageData) {
      throw new Error('Image data is required');
    }
    
    if (!imageData.startsWith('data:image/')) {
      throw new Error('Invalid image data format. Expected data URL format.');
    }
    
    const mimeType = imageData.split(';')[0].split(':')[1];
    const format = mimeType.split('/')[1];
    
    if (!MCP_CONFIG.backgroundRemover.supportedFormats.includes(format.toLowerCase())) {
      throw new Error(`Unsupported image format: ${format}. Supported formats: ${MCP_CONFIG.backgroundRemover.supportedFormats.join(', ')}`);
    }
  }
}

/*
团队集成指南 - HTTP API版本:

1. 环境变量配置:
   - MCP_BACKGROUND_REMOVER_ENDPOINT: MCP HTTP API端点 (例如: http://localhost:3001/api/remove-background)
   - MCP_BACKGROUND_REMOVER_METHOD: 默认背景移除方法
   - MCP_BACKGROUND_REMOVER_TIMEOUT: 服务超时时间（毫秒）

2. MCP HTTP API期望的输入格式:
   POST /api/remove-background
   Content-Type: application/json
   {
     "imageData": "data:image/png;base64,<base64_data>",
     "method": "ai_model",
     "outputFormat": "png",
     "quality": "high",
     "edgeSmoothing": true,
     "preserveTransparency": true
   }

3. MCP HTTP API期望的输出格式:
   {
     "success": true,
     "imageData": "data:image/png;base64,<result_data>",
     "metadata": {
       "processingTime": 1234,
       "method": "ai_model"
     }
   }

4. 错误响应格式:
   {
     "success": false,
     "error": "Error message here"
   }

5. CORS配置:
   确保MCP服务配置了正确的CORS headers，允许前端应用访问

6. 如需修改接口，请同时更新:
   - parseBackgroundRemovalResult() 方法
   - callBackgroundRemovalService() 方法的请求数据构建
   - MCP_CONFIG 配置对象

7. 本地开发建议:
   - 在本地运行MCP服务在端口3001
   - 设置环境变量: MCP_BACKGROUND_REMOVER_ENDPOINT=http://localhost:3001/api/remove-background
   - 确保服务支持CORS
*/
