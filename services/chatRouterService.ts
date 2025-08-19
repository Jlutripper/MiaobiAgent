import { SchemaType } from './aiSchemaTypes';
import { Tool, CustomTool, LongArticleTemplate, PosterTemplate } from '../types';
import { PREDEFINED_TOOLS } from "../constants";
import { unifiedAIService } from './unifiedAIService';

export const getChatResponse = async (
    prompt: string,
    customTools: CustomTool[],
    longArticleTemplates: LongArticleTemplate[],
    posterTemplates: PosterTemplate[]
): Promise<{ tool: Tool; prompt?: string; displayPrompt?: string; reply: string; initialContent?: string; templateId?: string; }> => {
    
    const allTools = [...PREDEFINED_TOOLS, ...customTools];
    const toolDescriptions = allTools.map(t => `- "${t.id}": ${t.description}`).join('\n');
    
    const longArticleTemplateDescriptions = longArticleTemplates.length > 0 ? 
        `\nAvailable 'long_article' templates:\n${longArticleTemplates.map(t => `- Template ID "${t.id}", Name: "${t.name}", Description: "${t.description}"`).join('\n')}`
        : '';
    
    const posterTemplateDescriptions = posterTemplates.length > 0 ?
        `\nAvailable 'poster' templates:\n${posterTemplates.map(t => `- Template ID "${t.id}", Name: "${t.name}", Description: "${t.description}"`).join('\n')}`
        : '';

    const systemInstruction = `You are a helpful and creative AI assistant. Your primary job is to act as a tool router. You must understand the user's request in Chinese and determine the single best tool and, if applicable, the best template to use. Your internal thought process must be hidden.

**Available Tools:**
${toolDescriptions}
${longArticleTemplateDescriptions}
${posterTemplateDescriptions}

**Your Routing Logic (CRITICAL):**
1.  **Analyze User Intent:** First, determine the user's core creative goal (e.g., "design a poster for a product sale," "create a long-form article about a topic," "generate a standalone image").
2.  **Select a Tool:** Based on the intent, choose exactly one tool ID from the list.
3.  **Template Matching (for 'poster' and 'long_article' tools ONLY):**
    -   **Perform Semantic Analysis:** Do not just match keywords. Analyze the *semantic meaning* of the user's request and compare it to the template's 'name' and 'description'.
    -   **Strict Matching Rule:** A template is a match ONLY if the user's core intent strongly aligns with the template's described purpose (e.g., user wants a "product promo," template is for "e-commerce product cards").
    -   **MANDATORY FALLBACK:** If there is NO strong semantic match, you MUST set 'templateId' to 'none'. Do NOT force a partial match. It is better to create from scratch than to use the wrong template.
4.  **Formulate Response:**
    -   'prompt': An English translation of the user's core creative request for internal use.
    -   'reply': A friendly, conversational response in Chinese. Ask a follow-up question if the next step requires more information.
    -   'initialContent': If the user provides the main body of text directly, extract it here.

**Example of Correct Template Matching:**
User: "帮我设计一张“夏季特卖”海报"
Template List: - Template ID "p-123", Name: "夏季促销海报", Description: "一个用于季节性销售活动的多功能海报模板。"
Analysis: User's intent is "summer sale poster". The template is for "seasonal sales". This is a strong semantic match.
JSON Response: { "tool": "poster", "templateId": "p-123", ..., "reply": "好的，我们将使用“夏季促销海报”模板为您设计..." }

**Example of Correct Fallback:**
User: "帮我设计一张“乐队演出”的海报"
Template List: - Template ID "p-123", Name: "夏季促销海报", Description: "一个用于季节性销售活动的多功能海报模板。"
Analysis: User's intent is "band concert poster". The template is for "sales". This is a weak match. Fallback is required.
JSON Response: { "tool": "poster", "templateId": "none", ..., "reply": "好的，我们来为您的乐队设计海报。请问您希望是什么样的尺寸比例呢？" }

You MUST respond ONLY in the specified JSON format.`;

    const routingSchema = {
        type: SchemaType.OBJECT,
        properties: {
            tool: {
                type: SchemaType.STRING,
                enum: allTools.map(t => t.id),
                description: 'The single most appropriate tool for the user\'s request.'
            },
            templateId: {
                type: SchemaType.STRING,
                description: "For 'long_article' or 'poster' tools, the ID of the best-fitting template or 'none'. Omit for other tools."
            },
            prompt: {
                type: SchemaType.STRING,
                description: 'The core creative prompt from the user, translated to English if necessary. For internal use ONLY. This is mandatory for all tools except "chat".'
            },
            displayPrompt: {
                type: SchemaType.STRING,
                description: 'The original prompt in the user\'s language to show in the UI.'
            },
            initialContent: {
                type: SchemaType.STRING,
                description: 'If the user provides the main content directly in their prompt, extract that content here. Otherwise, omit.'
            },
            reply: {
                type: SchemaType.STRING,
                description: 'A friendly, brief, conversational reply in Chinese to the user. This is your direct answer for "chat" tool. For other tools, ask a follow-up question if needed.'
            }
        },
        required: ['tool', 'reply']
    };

    const responseText = await unifiedAIService.generateJSON({
        task: 'ROUTING',
        prompt: prompt,
        systemInstruction: systemInstruction,
        schema: routingSchema,
    });
    
    try {
        const result = JSON.parse(responseText);
        if (!result.prompt) {
            result.prompt = prompt;
        }
        return result;
    } catch (e) {
        console.error("Failed to parse routing response:", responseText);
        // Fallback for non-JSON or malformed responses
        return { tool: 'chat', reply: responseText || "对不起，我没太理解。可以换一种方式问我吗？", prompt: prompt };
    }
};