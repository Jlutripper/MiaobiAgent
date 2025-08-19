import { SchemaType } from './aiSchemaTypes';
import { PosterTemplate, LayoutBox } from '../types';
import { unifiedAIService } from './unifiedAIService';
import { textSpanSchema, layoutBoxSchema } from './generatedSchemas';

// Agent A (Vision Analyst) 的输出结构
interface ImageAnalysisResult {
    background: {
        description: string; 
    };
    elements: {
        role: string;
        type: 'text' | 'image';
        boundingBox: { // In percentages
            x: number;
            y: number;
            width: number;
            height: number;
        };
        contentDescription: string;
    }[];
}

// Agent B (Layout Strategist) 的输出结构
interface TemplatePlan extends Omit<PosterTemplate, 'background'> {
    backgroundColor?: string;
    backgroundImagePrompt?: string;
}


/**
 * **Agent A: AI 视觉分析师 (Vision Analyst)**
 * 分析图像并创建一个高级别的、语义化的大纲。
 */
const analyzeImageContent = async (base64Image: string): Promise<ImageAnalysisResult> => {
    const analysisSchema = {
        type: SchemaType.OBJECT,
        properties: {
            background: {
                type: SchemaType.OBJECT,
                properties: {
                    description: { type: SchemaType.STRING, description: "对海报背景的详细描述 (例如, '纯红色', '夜晚的城市风光照片')." },
                },
                required: ['description'],
            },
            elements: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        role: { type: SchemaType.STRING, description: "元素的语义角色 (例如, 'logo', 'main-title', 'body-text')." },
                        type: { type: SchemaType.STRING, enum: ['text', 'image'] },
                        boundingBox: {
                            type: SchemaType.OBJECT,
                            description: "元素的边界框，所有值都是相对于画布的百分比 (0-100).",
                            properties: {
                                x: { type: SchemaType.NUMBER }, y: { type: SchemaType.NUMBER },
                                width: { type: SchemaType.NUMBER }, height: { type: SchemaType.NUMBER },
                            },
                            required: ['x', 'y', 'width', 'height'],
                        },
                        contentDescription: { type: SchemaType.STRING, description: "对于文本，是一个中文占位符 (例如, '主标题')。对于图片，是对图片内容的简短英文描述。" },
                    },
                    required: ['role', 'type', 'boundingBox', 'contentDescription'],
                },
            },
        },
        required: ['background', 'elements'],
    };

    const systemInstruction = `你是一位顶级的计算机视觉分析专家。你唯一的任务是分析提供的海报图片，并将其分解为一个结构化的 JSON 大纲。不要设计模板，仅仅描述你看到了什么。

**关键指令:**
1.  **首先分析背景:** 你的首要且最重要的任务是描述海报的整体背景。
2.  **识别所有元素:** 找到海报上的每一段文字和每一张图片。
3.  **定义边界框:** 对于每个元素，你 **必须** 提供其边界框 (\`x\`, \`y\`, \`width\`, \`height\`)，数值为相对于整个画布尺寸的**百分比**。请尽可能精确。
4.  **描述内容:** 为文本元素提供一个通用的中文占位符，为图片元素提供一个简短的英文描述。
5.  **遵守 Schema:** 你的输出 **必须** 是一个严格遵循所提供 schema 的、单一且有效的 JSON 对象。`;

    const responseText = await unifiedAIService.generateText({
        task: 'LAYOUT_GENERATION', // 使用具备视觉能力的模型
        prompt: '分析这张图片，并返回结构化的 JSON 大纲。',
        systemInstruction,
        imageBase64: base64Image,
        mimeType: 'image/png'
    });
    
    try {
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson) as ImageAnalysisResult;
    } catch (e) {
        console.error("Agent A (Vision Analyst) 未能生成有效的 JSON:", responseText);
        throw new Error("AI 视觉分析师解析图片结构失败。");
    }
};

/**
 * **Agent B: AI 布局策略师 (Layout Strategist)**
 * 接收来自 Agent A 的结构化大纲，并构建一个包含智能约束的模板方案。
 */
const inferLayoutFromAnalysis = async (
    analysis: ImageAnalysisResult,
    targetDimensions: { width: number; height: number }
): Promise<TemplatePlan> => {
     const textStyleDefinitionSchema = { type: SchemaType.OBJECT, properties: { fontFamily: { type: SchemaType.STRING }, fontSize: { type: SchemaType.NUMBER }, fontWeight: { type: SchemaType.NUMBER }, color: { type: SchemaType.STRING }, textAlign: { type: SchemaType.STRING, enum: ['left', 'center', 'right', 'justify'] }, lineHeight: { type: SchemaType.NUMBER } }, required: ['fontFamily', 'fontSize', 'fontWeight', 'color', 'textAlign', 'lineHeight'] };
     const sectionSchema = { type: SchemaType.OBJECT, properties: { id: { type: SchemaType.STRING }, type: { type: SchemaType.STRING, enum: ['text', 'image'] }, role: { type: SchemaType.STRING }, content: { type: SchemaType.ARRAY, description: "对于文本区块，是一个包含单个 TextSpan 对象的数组: `[{ \"text\": \"...\", \"style\": {} }]`", items: textSpanSchema }, style: textStyleDefinitionSchema, imageUrl: { type: SchemaType.STRING }, prompt: { type: SchemaType.STRING }, objectFit: { type: SchemaType.STRING, enum: ['cover', 'contain'] }, flexGrow: { type: SchemaType.NUMBER, description: "图片区块必须设置为1" }, flexShrink: { type: SchemaType.NUMBER, description: "图片区块必须设置为1" } }, required: ['id', 'type', 'role'] };
     
     const fullSchema = { 
         type: SchemaType.OBJECT, 
         properties: { 
            name: { type: SchemaType.STRING }, 
            description: { type: SchemaType.STRING }, 
            backgroundColor: { type: SchemaType.STRING, description: "如果背景是颜色/渐变，在此提供 CSS 字符串。否则，省略此字段。" },
            backgroundImagePrompt: { type: SchemaType.STRING, description: "如果背景是场景/图片，在此提供详细的英文生成指令。否则，省略此字段。" },
            layoutBoxes: { 
                type: SchemaType.ARRAY, 
                items: {
                    ...layoutBoxSchema,
                    properties: {
                        ...layoutBoxSchema.properties,
                        sections: {
                            type: SchemaType.ARRAY,
                            items: sectionSchema
                        }
                    },
                    required: [...(layoutBoxSchema.required || []), 'sections']
                } 
            } 
        }, 
        required: ['name', 'description', 'layoutBoxes'] 
    };

    const systemInstruction = `你是一位顶级的、专精于约束布局的 AI 系统架构师。你的任务是将一份高级视觉分析报告翻译成一个精确、技术化的海报模板 JSON 结构。你不会看到原始图片。

**目标画布尺寸:**
- 宽度: ${targetDimensions.width}px
- 高度: ${targetDimensions.height}px

**关键翻译规则:**

1.  **背景优先原则 (最重要):** 你的首要任务是定义背景。分析输入中的 \`background.description\` 字段。你 **必须** 且**只能**选择以下一种方式输出：
    *   **\`backgroundColor\`:** 如果描述是颜色或渐变 (如 "纯红色", "蓝紫渐变")，在此提供 CSS 字符串 (如 \`'#FF0000'\`, \`'linear-gradient(to right, blue, purple)'\`)。
    *   **\`backgroundImagePrompt\`:** 如果描述是场景或图片 (如 "夜晚的城市", "木质纹理")，在此提供一个新的、详细的**英文**图片生成指令。
    *   **强制回退:** 如果描述模糊或不确定，你 **必须** 提供一个值为 \`'#374151'\` 的 \`backgroundColor\`。**绝不能**同时使用这两个字段。

2.  **黄金法则:** 分析报告中的每个 \`element\` **必须** 成为一个独立的 \`LayoutBox\`。每个 \`LayoutBox\` **必须** 包含且只包含一个内容的 \`section\`。

3.  **约束推断引擎 (核心任务):** 这是你最重要的工作。将每个元素的百分比 \`boundingBox\` 转换为一套智能、稳固的约束。不要只是简单地复制百分比，而是要根据以下规则**推断**设计师的意图：
    *   **居中:**
        *   如果一个盒子的水平中心 (\`x + width/2\`) 位于 48% 到 52% 之间，你 **必须** 使用 \`centerX\` 和 \`width\`。对于 \`centerX\`，计算其与画布中心的精确像素偏移。例如：如果中心是 51%，则 \`centerX\` 为 \`'${Math.round(0.01 * targetDimensions.width)}px'\`。
        *   如果垂直中心位于 48% 到 52% 之间，你 **必须** 使用 \`centerY\` 和 \`height\`。
    *   **拉伸:**
        *   如果一个盒子的宽度 >= 95%，你 **必须** 使用 \`left\` 和 \`right\` 来使其拉伸。将 \`left\` 设为盒子的 \`x\` 百分比，\`right\` 设为 \`100 - (x + width)\` 的百分比。此时不要使用 \`width\`。
        *   如果高度 >= 95%，则使用 \`top\` 和 \`bottom\`。
    *   **边缘吸附:**
        *   如果一个盒子的 \`x\` <= 2%，你 **必须** 使用 \`left\` 和 \`width\` 来定义其水平位置。
        *   如果盒子的右边缘 (\`x + width\`) >= 98%，你 **必须** 使用 \`right\` 和 \`width\` 来定义其水平位置。
    *   **默认情况:** 对于不符合以上任何规则的盒子，使用 \`left\`, \`top\`, \`width\`, 和 \`height\` 来定义。将所有百分比值转换为字符串 (例如, \`'10%'\`)。

4.  **创建内容区块:**
    *   如果元素的 \`type\` 是 'text'，创建一个 \`TextSection\`。其 \`content\` **必须** 是 \`[{ "text": "...", "style": {} }]\`。使用元素的 \`contentDescription\`作为占位符文本，并生成一个合理的初始 \`style\`。
    *   如果元素的 \`type\` 是 'image'，创建一个 \`ImageSection\` 并遵循以下规则：
        *   \`imageUrl\` **必须** 是空字符串 \`''\`。
        *   使用其 \`contentDescription\` 作为英文 \`prompt\`。
        *   **必须** 设置 \`"objectFit": "cover"\`。
        *   **必须** 设置 \`"flexGrow": 1\` 和 \`"flexShrink": 1\` 以确保图片能正确填充其容器。

5.  **元数据与默认值:** 提供一个中文的 \`name\` 和 \`description\`。生成唯一的字符串 \`id\`。所有 \`LayoutBox\` 的背景 **必须** 是 \`'transparent'\`。

6.  **遵守 Schema:** 你的输出 **必须** 是一个严格遵循所提供 schema 的、单一且有效的 JSON 对象。`;

    const responseText = await unifiedAIService.generateJSON({
        task: 'LAYOUT_GENERATION',
        prompt: `将这份分析报告翻译成模板方案:\n${JSON.stringify(analysis, null, 2)}`,
        systemInstruction,
        schema: fullSchema,
    });

    try {
        return JSON.parse(responseText) as TemplatePlan;
    } catch (e) {
        console.error("Agent B (Template Architect) 未能生成有效的 JSON:", responseText);
        throw new Error("AI 模板架构师构建模板失败。");
    }
};

/**
 * 编排三步工作流，将一张图片解构为最终的海报模板，
 * 包括了如果需要则生成背景图的关键步骤。
 */
export const deconstructImageToTemplate = async (
    base64Image: string,
    targetDimensions: { width: number; height: number }
): Promise<PosterTemplate> => {
    // 步骤 1: Agent A (视觉分析师) 分析图片，创建高级别大纲。
    const analysisResult = await analyzeImageContent(base64Image);

    // 步骤 2: Agent B (布局策略师) 接收大纲，构建包含智能约束的模板*方案*。
    const templatePlan = await inferLayoutFromAnalysis(analysisResult, targetDimensions);

    // 步骤 3: 执行背景生成任务
    let finalBackground: PosterTemplate['background'];

    if (templatePlan.backgroundImagePrompt) {
        try {
            console.log(`正在使用指令生成背景: "${templatePlan.backgroundImagePrompt}"`);

            const { width, height } = targetDimensions;
            const ratio = width / height;
            
            const supportedRatios: { [key: string]: number } = {
                '1:1': 1, '16:9': 16 / 9, '9:16': 9 / 16, '4:3': 4 / 3, '3:4': 3 / 4,
            };

            let closestAspectRatioString: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1';
            let minDiff = Math.abs(ratio - supportedRatios['1:1']);

            for (const [key, value] of Object.entries(supportedRatios)) {
                const diff = Math.abs(ratio - value);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestAspectRatioString = key as '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
                }
            }

            const imageUrl = await unifiedAIService.generateImage({
                task: 'IMAGE_GENERATION',
                prompt: templatePlan.backgroundImagePrompt,
                aspectRatio: closestAspectRatioString
            });
            finalBackground = {
                type: 'image', value: imageUrl, blur: 'none', tintColor: 'rgba(0,0,0,0)'
            };
        } catch (e) {
            console.error("背景图片生成失败，回退到默认颜色。", e);
            finalBackground = {
                type: 'color', value: '#374151', blur: 'none', tintColor: 'rgba(0,0,0,0)'
            };
        }
    } else {
        finalBackground = {
            type: 'color',
            value: templatePlan.backgroundColor || '#374151', // 如果AI两者都未提供，则回退
            blur: 'none',
            tintColor: 'rgba(0,0,0,0)'
        };
    }
    
    // 步骤 4 (Agent C 的简化版): 组装最终的、完整的、有效的模板。
    const finalTemplate: PosterTemplate = {
        id: `poster-template-${Date.now()}`,
        name: templatePlan.name,
        description: templatePlan.description,
        coverImageUrl: '',
        tags: [],
        width: targetDimensions.width,
        height: targetDimensions.height,
        background: finalBackground,
        layoutBoxes: templatePlan.layoutBoxes || [],
        decorations: [],
    };
    
    // 最后的清理和健全性检查
    if (finalTemplate.layoutBoxes) {
        finalTemplate.layoutBoxes.forEach((box: LayoutBox) => {
            box.type = 'layout_box';
            if (!box.backgroundColor) box.backgroundColor = 'transparent';
            if (box.zIndex === undefined) box.zIndex = (box.role?.toLowerCase().includes('logo') ? 10 : 1);
            if (!box.sections) box.sections = [];
            box.sections.forEach((section: any) => {
                if (section.type === 'text' && !section.content) {
                    section.content = [{ text: section.text || '占位文本', style: {} }];
                    delete section.text;
                }
            });
        });
    }

    return finalTemplate;
};