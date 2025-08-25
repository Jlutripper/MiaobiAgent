import { SchemaType } from './utils/aiSchemaTypes';
import { ResultData, LongArticleTemplate, TextSection, ImageSection } from '../types';
import { FONT_FAMILIES } from '../constants';
import { unifiedAIService } from './unifiedAIService';


export const generateLongArticleLayout = async (
    theme: string,
    userContent: string,
    width: number,
    generateIllustrations: boolean,
    templateId: string | null,
    allTemplates: LongArticleTemplate[]
): Promise<Omit<ResultData & { type: 'long_article' }, 'type'>> => {
    
    const template = templateId ? allTemplates.find(t => t.id === templateId) : null;
    
    type LongArticleData = Extract<ResultData, { type: 'long_article' }>;

    let resultData: Omit<LongArticleData, 'type'> = {
        templateId: null,
        sections: [],
        decorations: [],
        width: width,
        background: { type: 'color', value: '#FFFFFF', blur: 'none', tintColor: 'rgba(0,0,0,0)' },
        contentContainer: { 
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backgroundImage: null,
            backgroundBlur: 'none',
            borderRadius: 16,
            marginTop: 60,
            marginBottom: 60,
            marginX: 40,
            paddingTop: 40,
            paddingRight: 40,
            paddingBottom: 40,
            paddingLeft: 40,
        }
    };


    if (template) {
        resultData = {
            ...resultData,
            templateId: template.id,
            width: template.width,
            background: template.background,
            contentContainer: template.contentContainer,
            sections: JSON.parse(JSON.stringify(template.sections)), // Deep copy
            decorations: JSON.parse(JSON.stringify(template.decorations)), // Deep copy
        };
        
        const textRoles = template.sections.filter(s => s.type === 'text' && !s.isContentLocked).map(s => (s as TextSection).role);
        const imageRoles = template.sections.filter(s => s.type === 'image' && !s.isContentLocked).map(s => (s as ImageSection).role);
        const lockedTextRoles = template.sections.filter(s => s.type === 'text' && s.isContentLocked).map(s => s.role);

        const contentSchemaProperties: Record<string, any> = {};
        const requiredFields: string[] = [];

        if (textRoles.length > 0) {
            contentSchemaProperties.textContent = {
                type: SchemaType.OBJECT,
                description: "A mapping of role names to their corresponding text content.",
                properties: textRoles.reduce((acc, role) => ({ ...acc, [role]: { type: SchemaType.STRING, description: `Content for the '${role}' text block.` } }), {}),
                required: textRoles
            };
            requiredFields.push('textContent');
        }

        if (imageRoles.length > 0 && generateIllustrations) {
            contentSchemaProperties.imagePrompts = {
                type: SchemaType.OBJECT,
                description: "A mapping of image role names to their English generation prompts.",
                properties: imageRoles.reduce((acc, role) => ({ ...acc, [role]: { type: SchemaType.STRING, description: `Image prompt for the '${role}' image block.` } }), {}),
                required: imageRoles,
            };
        }
        
        if (Object.keys(contentSchemaProperties).length === 0) {
             // If all sections are locked, no need to call the AI for content.
            return resultData;
        }

        const contentSchema = {
            type: SchemaType.OBJECT,
            properties: contentSchemaProperties,
            required: requiredFields,
        };

        const systemInstruction = `You are an expert content adaptation AI. Your task is to take a user's theme and raw text and map it to a pre-designed article structure.

User Request:
- Theme: "${theme}"
- Raw Content: "${userContent || '(empty, please create content based on the theme)'}"

Target Structure:
- Available text roles to fill: ${textRoles.join(', ') || 'none'}
- Locked text roles (use their existing content): ${lockedTextRoles.join(', ') || 'none'}
- Image roles needing a prompt: ${imageRoles.join(', ') || 'none'}

**CRITICAL INSTRUCTIONS:**
1.  **Analyze and Map Content:** Read the user's Raw Content and theme. Break it down logically (title, intro, points). Assign these pieces to the most appropriate **available** text roles.
2.  **PRESERVE USER CONTENT (MOST IMPORTANT):** If Raw Content is provided, your ONLY job is to map it to the available roles. DO NOT rewrite, improve, or change it. Use it VERBATIM. If some roles are left empty because there's no matching content, that is OKAY.
3.  **Generate if Necessary:** ONLY if Raw Content is empty, act as a creative copywriter and generate compelling Chinese content for ALL available text roles based on the theme.
4.  **Create Image Prompts:** If image roles exist and illustration generation is enabled, generate a concise, descriptive English prompt for the image model.
5.  **JSON OUTPUT:** Respond ONLY with a valid JSON object adhering to the schema. Do not include locked roles in your output.`;

        const contentResponseText = await unifiedAIService.generateJSON({
            task: 'CONTENT_GENERATION',
            prompt: `Theme: "${theme}"\nUser's article text: "${userContent || '(empty, please create content based on the theme)'}"`,
            systemInstruction,
            schema: contentSchema,
        });
        const structuredContent = JSON.parse(contentResponseText);
        
        if (structuredContent.textContent) {
            resultData.sections.forEach(section => {
                if (section.type === 'text' && !section.isContentLocked && structuredContent.textContent?.[section.role]) {
                    (section as TextSection).content = [{ text: structuredContent.textContent[section.role], style: {} }];
                }
            });
        }

        if (generateIllustrations && structuredContent.imagePrompts && imageRoles.length > 0) {
            const imageGenerationPromises = imageRoles.map(async (role) => {
                const prompt = structuredContent.imagePrompts[role];
                if (!prompt) return { role, imageUrl: null };
                try {
                    const imageUrl = await unifiedAIService.generateImage({
                        task: 'IMAGE_GENERATION',
                        prompt: prompt,
                        aspectRatio: '1:1',
                    });
                    return { role, imageUrl };
                } catch (e) {
                    console.error(`Failed to generate illustration for role ${role}:`, e);
                    return { role, imageUrl: null };
                }
            });

            const generatedImages = await Promise.all(imageGenerationPromises);
            const imageUrlMap = new Map(generatedImages.map(img => [img.role, img.imageUrl]));

            resultData.sections.forEach(section => {
                if (section.type === 'image' && !section.isContentLocked && imageUrlMap.has(section.role)) {
                    const newUrl = imageUrlMap.get(section.role);
                    if (newUrl) {
                        (section as ImageSection).imageUrl = newUrl;
                        (section as ImageSection).prompt = structuredContent.imagePrompts[section.role];
                    }
                }
            });
        }
    } else {
        const layoutSchema = {
            type: SchemaType.OBJECT,
            properties: {
                title: { type: SchemaType.STRING },
                body: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                backgroundPrompt: { type: SchemaType.STRING }
            },
            required: ['title', 'body', 'backgroundPrompt']
        };

        const systemInstruction = `You are a social media copywriter. Your task is to structure user-provided content into a long-form article.
1.  Based on the theme, write a catchy title in the same language as the theme.
2.  **CRITICAL RULE**: If the user provides 'userContent', you MUST use it for the body paragraphs. Your only job is to split the original text into logical paragraphs for the 'body' array. DO NOT translate it, change wording, summarize, or rewrite it in any way.
3.  **Creative Writing**: If 'userContent' is empty, you must generate relevant article content in Chinese for both the title and body based on the theme.
4.  Create a prompt in English for a subtle, minimalist background image that matches the theme.
5.  Respond with a single JSON object.`;
        
        const contentResponseText = await unifiedAIService.generateJSON({
            task: 'CONTENT_GENERATION',
            prompt: `Theme: "${theme}"\nUser's article text: "${userContent || '(empty, please create content based on the theme)'}"`,
            systemInstruction,
            schema: layoutSchema
        });
        const layoutData = JSON.parse(contentResponseText);

        const backgroundUrl = await unifiedAIService.generateImage({
            task: 'IMAGE_GENERATION',
            prompt: layoutData.backgroundPrompt,
            aspectRatio: '9:16'
        });
        resultData.background = { type: 'image', value: backgroundUrl, blur: 'none', tintColor: 'rgba(0,0,0,0)' };

        const defaultTitleStyle = { fontFamily: FONT_FAMILIES[0].family, fontSize: 64, fontWeight: 900, color: '#1F2937', textAlign: 'center' as const, lineHeight: 1.3 };
        const defaultBodyStyle = { fontFamily: FONT_FAMILIES[1].family, fontSize: 24, fontWeight: 400, color: '#374151', textAlign: 'left' as const, lineHeight: 1.8 };
        
        resultData.sections.push({ id: `title-${Date.now()}`, type: 'text', role: 'title', content: [{ text: layoutData.title, style: {} }], style: defaultTitleStyle });
        layoutData.body.forEach((p: string, i: number) => {
             resultData.sections.push({ id: `body-${Date.now()}-${i}`, type: 'text', role: 'body', content: [{ text: p, style: {} }], style: defaultBodyStyle });
        });
    }

    return resultData;
};

export const adaptArticleToTemplate = async (
    currentArticle: ResultData & { type: 'long_article' },
    newTemplateId: string | null,
    allTemplates: LongArticleTemplate[]
): Promise<Omit<ResultData & { type: 'long_article' }, 'type'>> => {

    const userContent = currentArticle.sections
        .filter(s => s.type === 'text')
        .map(s => (s as TextSection).content.map(span => span.text).join(''))
        .join('\n\n');
    
    const titleSection = currentArticle.sections.find(s => s.type === 'text' && s.role === 'title');
    const theme = (titleSection && titleSection.type === 'text') ? titleSection.content.map(s => s.text).join('') : "Untitled";

    const newTemplate = newTemplateId ? allTemplates.find(t => t.id === newTemplateId) : null;
    const targetWidth = newTemplate ? newTemplate.width : currentArticle.width;

    const baseAdaptedArticle = await generateLongArticleLayout(theme, userContent, targetWidth, true, newTemplateId, allTemplates);

    const scaleFactor = targetWidth / currentArticle.width;
    
    if (Math.abs(scaleFactor - 1) < 0.01) {
        return baseAdaptedArticle;
    }

    baseAdaptedArticle.sections.forEach(section => {
        if (section.type === 'text') {
            section.style.fontSize = Math.max(10, Math.round(section.style.fontSize * scaleFactor));
        }
    });

    baseAdaptedArticle.decorations.forEach(deco => {
        deco.sizePercent.width = Math.max(1, deco.sizePercent.width * scaleFactor);
        deco.position.yPx = Math.round(deco.position.yPx * scaleFactor);
    });

    const cc = baseAdaptedArticle.contentContainer;
    cc.borderRadius = Math.round(cc.borderRadius * scaleFactor);
    cc.marginTop = Math.round(cc.marginTop * scaleFactor);
    cc.marginBottom = Math.round(cc.marginBottom * scaleFactor);
    cc.marginX = Math.round(cc.marginX * scaleFactor);
    cc.paddingTop = Math.round(cc.paddingTop * scaleFactor);
    cc.paddingRight = Math.round(cc.paddingRight * scaleFactor);
    cc.paddingBottom = Math.round(cc.paddingBottom * scaleFactor);
    cc.paddingLeft = Math.round(cc.paddingLeft * scaleFactor);

    return baseAdaptedArticle;
};