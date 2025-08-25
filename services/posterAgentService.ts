import { SchemaType } from './utils/aiSchemaTypes';
import { AspectRatio, ResultData, PosterTemplate, LayoutBox, ArticleSection, ImageSection } from '../types';
import { unifiedAIService } from './unifiedAIService';
import { layoutBoxSchema, textSpanSchema } from './generatedSchemas';

const generateDynamicTemplate = async (
    theme: string,
    dimensions: { width: number; height: number }
): Promise<PosterTemplate> => {

    // Construct a schema for the layout generation task
    const layoutSchema = {
        type: SchemaType.OBJECT,
        properties: {
            background: {
                type: SchemaType.OBJECT,
                description: "The poster's background. Choose 'image' and a prompt for visual themes, or 'color' and a hex/rgba value for abstract themes.",
                properties: {
                    type: { type: SchemaType.STRING, enum: ['image', 'color'] },
                    prompt: { type: SchemaType.STRING, description: "REQUIRED if type is 'image'. A detailed English prompt for a text-free background image." },
                    value: { type: SchemaType.STRING, description: "REQUIRED if type is 'color'. A hex or rgba color string." }
                },
                required: ['type']
            },
            layoutBoxes: {
                type: SchemaType.ARRAY,
                description: "An array of content containers defined by constraints.",
                items: {
                    ...layoutBoxSchema,
                    properties: {
                        ...layoutBoxSchema.properties,
                        // Override sections to be an empty array for this task
                        sections: {
                            type: SchemaType.ARRAY,
                            description: "This MUST be an empty array `[]`. Content is added in the next step."
                        }
                    }
                }
            }
        },
        required: ['background', 'layoutBoxes']
    };

    const systemInstruction = `You are an AI layout architect using a professional constraint-based system. Your task is to design a visually appealing, content-agnostic poster template structure based on a theme.

**Theme:** "${theme}"
**Canvas Size:** You are designing for a fixed canvas size of ${dimensions.width}px wide and ${dimensions.height}px tall.

**CRITICAL DESIGN RULES:**
1.  **Fixed Canvas Size:** You are designing for a fixed canvas size of ${dimensions.width}px wide and ${dimensions.height}px tall. All your constraints must work within these dimensions.
2.  **Constraint Integrity Rule (VERY IMPORTANT):** To ensure a layout is well-defined:
    *   When you use \`centerX\` to center an element horizontally, you **MUST also provide a \`width\`**. You **MUST NOT** define \`left\` or \`right\` in this case.
    *   When you use \`centerY\` to center an element vertically, you **MUST also provide a \`height\`**. You **MUST NOT** define \`top\` or \`bottom\` in this case.
3.  **Use the Right Layout Tool:** For complex layouts with multiple elements needing precise alignment (e.g., a feature list), you SHOULD set the parent container's \`layoutMode\` to \`'grid'\`. You must then define \`gridTemplateColumns\` and/or \`gridTemplateRows\` for that container.
4.  **Aesthetics First:** Create a clean, professional, and balanced layout. Use ample whitespace, visual hierarchy, and proper layering via the \`zIndex\` property (start zIndex from 2).
5.  **Clean Backgrounds:** For all \`layoutBoxes\`, you MUST set \`backgroundColor\` to \`'transparent'\` by default. Only specify a non-transparent color if the design absolutely requires a solid panel.
6.  **Structure Only (VERY IMPORTANT):** Your task is ONLY to define the layout structure (\`layoutBoxes\`). The \`sections\` array inside each box must be an empty array \`[]\`.
7.  **Background Logic:**
    - If the theme describes a visual scene (e.g., 'a beach'), set background \`type\` to \`'image'\` and provide a detailed English \`prompt\`.
    - If the theme is abstract (e.g., 'minimalist dark'), set background \`type\` to \`'color'\` and provide a hex/rgba \`value\`.

Respond ONLY with a valid JSON object matching the schema.`;
    
    const responseText = await unifiedAIService.generateJSON({
        task: 'LAYOUT_GENERATION',
        prompt: `Design a template for the theme: "${theme}"`,
        systemInstruction,
        schema: layoutSchema,
    });
    
    const layout = JSON.parse(responseText);

    // Defensive fallback logic
    const bg = layout.background;
    if (bg.type === 'image' && (!bg.prompt || bg.prompt.trim() === '')) {
        console.warn("AI returned image background without a prompt. Falling back to theme.");
        bg.prompt = theme; // Fallback to the user's theme
    }
    if (bg.type === 'color' && (!bg.value || bg.value.trim() === '')) {
        console.warn("AI returned color background without a value. Falling back to dark gray.");
        bg.value = 'rgba(55, 65, 81, 1)'; // Fallback to a neutral dark gray
    }

    const dynamicTemplate: PosterTemplate = {
        id: `dynamic-${Date.now()}`,
        name: `Dynamic Template for ${theme}`,
        description: `A dynamically generated template for the theme: ${theme}`,
        tags: [],
        coverImageUrl: '',
        width: dimensions.width,
        height: dimensions.height,
        background: {
            type: bg.type,
            value: bg.type === 'image' ? bg.prompt : bg.value, 
            blur: 'none',
            tintColor: 'rgba(0,0,0,0)',
        },
        layoutBoxes: layout.layoutBoxes.map((box: any) => ({
            ...box,
            id: `box-${Date.now()}-${Math.random()}`,
            sections: [], // Ensure sections are empty
            type: 'layout_box',
            // Provide defaults for flex properties if AI omits them
            flexDirection: box.flexDirection || 'column',
            justifyContent: box.justifyContent || 'flex-start',
            alignItems: box.alignItems || 'stretch',
        })),
        decorations: []
    };

    return dynamicTemplate;
};

const parseAndScale = (value: any, scaleFactor: number): any => {
    if (value === undefined || value === null) return value;
    
    if (typeof value === 'number') {
        return Math.round(value * scaleFactor);
    }

    if (typeof value === 'string') {
        const stringValue = value.trim();
        if (stringValue.endsWith('px')) {
            const num = parseFloat(stringValue.replace('px', ''));
            if (!isNaN(num)) {
                 return `${Math.round(num * scaleFactor)}px`;
            }
        }
        return stringValue;
    }
    
    return value;
};


const scaleTemplateElements = (template: PosterTemplate, scaleFactor: number): void => {
    const scaleRecursively = (items: (LayoutBox | ArticleSection)[]) => {
        for (const item of items) {
            if (item.type === 'layout_box') {
                item.borderRadius = parseAndScale(item.borderRadius, scaleFactor);
                item.paddingTop = parseAndScale(item.paddingTop, scaleFactor);
                item.paddingRight = parseAndScale(item.paddingRight, scaleFactor);
                item.paddingBottom = parseAndScale(item.paddingBottom, scaleFactor);
                item.paddingLeft = parseAndScale(item.paddingLeft, scaleFactor);
                item.columnGap = parseAndScale(item.columnGap, scaleFactor);
                item.rowGap = parseAndScale(item.rowGap, scaleFactor);
                
                if (item.constraints) {
                    item.constraints.top = parseAndScale(item.constraints.top, scaleFactor);
                    item.constraints.bottom = parseAndScale(item.constraints.bottom, scaleFactor);
                    item.constraints.left = parseAndScale(item.constraints.left, scaleFactor);
                    item.constraints.right = parseAndScale(item.constraints.right, scaleFactor);
                    item.constraints.width = parseAndScale(item.constraints.width, scaleFactor);
                    item.constraints.height = parseAndScale(item.constraints.height, scaleFactor);
                    item.constraints.centerX = parseAndScale(item.constraints.centerX, scaleFactor);
                    item.constraints.centerY = parseAndScale(item.constraints.centerY, scaleFactor);
                }
                
                if (item.sections) {
                    scaleRecursively(item.sections);
                }
            }
            
            if (item.type === 'text') {
                item.style.fontSize = parseAndScale(item.style.fontSize, scaleFactor);
                item.style.letterSpacing = parseAndScale(item.style.letterSpacing, scaleFactor);
            }
            
            // Handle rotation for all section types
            if (item.rotation !== undefined) {
                // Rotation is in degrees, no scaling needed
                // item.rotation = item.rotation; // Keep original rotation
            }
        }
    };
    scaleRecursively(template.layoutBoxes);
    
    if (template.decorations) {
        for (const deco of template.decorations) {
            deco.borderRadius = parseAndScale(deco.borderRadius, scaleFactor);
            if (deco.position) {
                deco.position.yPx = parseAndScale(deco.position.yPx, scaleFactor);
            }
            if (deco.anchor) {
                deco.anchor.offset.x = parseAndScale(deco.anchor.offset.x, scaleFactor);
                deco.anchor.offset.y = parseAndScale(deco.anchor.offset.y, scaleFactor);
            }
            if (deco.shadow) {
                deco.shadow.offsetX = parseAndScale(deco.shadow.offsetX, scaleFactor);
                deco.shadow.offsetY = parseAndScale(deco.shadow.offsetY, scaleFactor);
                deco.shadow.blur = parseAndScale(deco.shadow.blur, scaleFactor);
            }
            if (deco.stroke) {
                deco.stroke.width = parseAndScale(deco.stroke.width, scaleFactor);
            }
        }
    }
};


export const generatePosterLayout = async (
    theme: string,
    userContent: string | undefined,
    aspectRatio: AspectRatio,
    templateId: string | null,
    allTemplates: PosterTemplate[]
): Promise<Omit<ResultData & { type: 'poster' }, 'type' | 'prompt'>> => {

    const found = templateId && templateId !== 'none' ? allTemplates.find(t => t.id === templateId) : null;
    
    const [w, h] = aspectRatio.split(':').map(Number);
    const targetWidth = 1080;
    const targetHeight = Math.round(targetWidth * h / w);
    const targetDimensions = { width: targetWidth, height: targetHeight };

    let selectedTemplate: PosterTemplate;
    if (found) {
        const originalWidth = found.width;
        const cloned = JSON.parse(JSON.stringify(found)) as PosterTemplate; // Deep copy
        cloned.width = targetDimensions.width;
        cloned.height = targetDimensions.height;
        if (originalWidth > 0 && Math.abs(originalWidth - targetDimensions.width) > 1) {
            const scaleFactor = targetDimensions.width / originalWidth;
            scaleTemplateElements(cloned, scaleFactor);
        }
        selectedTemplate = cloned;
    } else {
        selectedTemplate = await generateDynamicTemplate(theme, targetDimensions);
    }
    
    type PosterData = Extract<ResultData, {type: 'poster'}>;

    let resultData: Omit<PosterData, 'type' | 'prompt'> = JSON.parse(JSON.stringify({ // Deep copy
        templateId: selectedTemplate.id,
        width: selectedTemplate.width,
        height: selectedTemplate.height,
        background: { ...selectedTemplate.background },
        layoutBoxes: selectedTemplate.layoutBoxes,
        decorations: selectedTemplate.decorations,
    }));
    
    if (resultData.background.type === 'image' && !resultData.background.value.startsWith('data:')) {
         try {
            const newBackgroundValue = await unifiedAIService.generateImage({
                task: 'IMAGE_GENERATION',
                prompt: resultData.background.value,
                aspectRatio,
            });
            resultData.background.value = newBackgroundValue;
        } catch (e) { console.error("Failed to generate custom background, using template default.", e); }
    }

    const compositionSchema = {
        type: SchemaType.OBJECT,
        properties: {
            composition: {
                type: SchemaType.ARRAY,
                description: "An array of layout boxes to be included in the final design.",
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        boxRole: { type: SchemaType.STRING, description: "The role of the LayoutBox from the template." },
                        sections: {
                            type: SchemaType.ARRAY,
                            description: "The sections to include within this box.",
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    sectionRole: { type: SchemaType.STRING, description: "The role of the section from the template. MUST match exactly." },
                                    flexGrow: { type: SchemaType.NUMBER, description: "For new sections in a flex container. MUST be 1 for new image sections to ensure they are visible. Omit for sections in a grid container." },
                                    gridColumn: { type: SchemaType.STRING, description: "CSS grid-column value for this section within a grid parent." },
                                    gridRow: { type: SchemaType.STRING, description: "CSS grid-row value for this section within a grid parent." },
                                    content: {
                                        type: SchemaType.OBJECT,
                                        description: "The content for the section. OMIT THIS for locked sections.",
                                        properties: {
                                            content: { 
                                                type: SchemaType.ARRAY, 
                                                description: "For a text section, an array with one TextSpan object: `[{ \"text\": \"...\", \"style\": {} }]`",
                                                items: textSpanSchema
                                            },
                                            prompt: { type: SchemaType.STRING, description: "English prompt for an image section." },
                                            style: {
                                                type: SchemaType.OBJECT,
                                                description: "ONLY for new text sections in empty containers. Provide a suitable style.",
                                                properties: {
                                                    fontSize: { type: SchemaType.NUMBER, description: "Font size in pixels." },
                                                    color: { type: SchemaType.STRING, description: "Hex color code." },
                                                    writingMode: { type: SchemaType.STRING, description: "Text direction: 'horizontal-tb' or 'vertical-rl'." }
                                                }
                                            }
                                        }
                                    },
                                    rotation: { type: SchemaType.NUMBER, description: "Rotation angle in degrees (0-360). Use sparingly for design emphasis." }
                                },
                                required: ['sectionRole']
                            }
                        }
                    },
                    required: ['boxRole']
                }
            }
        },
        required: ['composition']
    };

    const templateStructureString = selectedTemplate.layoutBoxes.map(box => {
        const sectionsDescription = (box.sections && box.sections.length > 0)
            ? (box.sections || []).map(s => {
                const locked = s.isContentLocked ? ' (LOCKED)' : '';
                return `  - Pre-defined Section (role: "${s.role}", type: ${s.type}, importance: ${s.importance || 'required'})${locked}`;
              }).join('\n')
            : `  - This is an empty container. You must create appropriate text and image sections to fill it based on its role.`;
        return `- Layout Box (role: "${box.role}", layoutMode: "${box.layoutMode || 'flex'}"):\n${sectionsDescription}`;
    }).join('\n');
    
    const systemInstruction = `You are an expert AI content designer, acting as an "interior designer" for a poster. You are given a pre-designed layout ("the blueprint") and a user's request. Your job is to creatively and logically fill the blueprint with content.

**User Request:**
- Theme: "${theme}"
- Provided Content: "${userContent || '(empty, create content from theme)'}"

**The Blueprint (Layout Structure):**
This is the layout you MUST work within. Do NOT alter it.
- Canvas Size: ${selectedTemplate.width}px wide by ${selectedTemplate.height}px tall.
${templateStructureString}

**CRITICAL INSTRUCTIONS & WORKFLOW:**

1.  **Golden Rule for Filling Containers:**
    -   **If a \`Layout Box\` has pre-defined \`sections\`:** Adapt the user's content to fit these sections. Keep all 'required' sections. You may remove 'optional' sections if they are irrelevant to the user's request.
    -   **If a \`Layout Box\` is an EMPTY CONTAINER:** You **MUST** act as a designer and **CREATE NEW \`TextSection\` or \`ImageSection\` elements to fill it.** The sections you create must be logical for the container's \`role\` (e.g., a \`role: 'header'\` box should be filled with a \`role: 'main-headline'\` text section).

2.  **ROLE MATCHING (STRICT RULE):** When filling a pre-defined section, you **MUST** use its original \`role\` name from the blueprint as the \`sectionRole\` in your JSON output. Do NOT invent new roles for existing sections.

3.  **STYLE RULE (VERY IMPORTANT):**
    -   For **pre-defined sections**, you **MUST NOT** provide any style information. The template has its own styles.
    -   For **NEW sections you create** for empty containers, you **MUST** provide a suitable initial \`style\` object containing \`fontSize\` and \`color\` that is appropriate for the theme and canvas size.

4.  **FLEXBOX RULE (CRITICAL):** When you create a **NEW** \`ImageSection\` to fill an empty **flex** container, you **MUST** include \`"flexGrow": 1\` in its definition to ensure it properly fills the available space. Omit \`flexGrow\` for sections inside a grid container.

5.  **Grid Layout Rule:** If a container's \`layoutMode\` is \`'grid'\`, you **MUST** assign a \`gridColumn\` and/or \`gridRow\` to each section you place inside it.

6.  **Handle Locked Content:** For any section marked as \`(LOCKED)\`, you are FORBIDDEN from changing its content. In your JSON response, you **MUST OMIT** the entire \`content\` object for these locked sections.

7.  **Content Generation Rules:**
    -   **LANGUAGE:** All generated text MUST be in **Chinese**. All image \`prompt\`s MUST be in **English**.
    -   **TEXT:** If the user provides content, map it to the appropriate text sections. If not, write creative, compelling copy based on the theme. For text sections, the content must be structured as a \`content\` array with a single TextSpan object, like this: \`"content": [{ "text": "Your text here", "style": {} }]\`.
    -   **IMAGES:** Create descriptive, artistic English prompts for all image sections that need one.
    -   **TEXT ROTATION:** Use the \`rotation\` property sparingly for design emphasis (e.g., 15-45 degrees for dynamic headings). Remember that rotation is purely visual - the layout box size remains unchanged.
    -   **VERTICAL TEXT:** Use \`"writingMode": "vertical-rl"\` for Chinese text when appropriate for the design aesthetic.

8.  **JSON OUTPUT:** Your final output MUST be ONLY a valid JSON object that matches the provided schema.`;
    
    const contentResponseText = await unifiedAIService.generateJSON({
        task: 'CONTENT_GENERATION',
        prompt: `Theme: "${theme}"`,
        systemInstruction,
        schema: compositionSchema,
    });
    const designPlan = JSON.parse(contentResponseText);

    const composedBoxes: LayoutBox[] = [];
    const aiComposition = designPlan.composition || [];

    for (const plannedBox of aiComposition) {
    const originalBox = selectedTemplate.layoutBoxes.find(b => b.role === plannedBox.boxRole);
        if (!originalBox) continue;

        const newBox: LayoutBox = { ...JSON.parse(JSON.stringify(originalBox)) };

        const composedSections: ArticleSection[] = [];
    for (const plannedSection of plannedBox.sections) {
            const existing = originalBox.sections.find(s => s.role === plannedSection.sectionRole);
            const isNewSection = !existing;

            let baseSection: ArticleSection;
            if (isNewSection) { 
                const isText = !!plannedSection.content?.content || typeof plannedSection.content === 'string' || Array.isArray(plannedSection.content);
                if (isText) {
                     baseSection = {
                        id: `section-${Date.now()}-${Math.random()}`, type: 'text', role: plannedSection.sectionRole,
                        content: [],
                        style: { fontFamily: "'Noto Sans SC', sans-serif", fontSize: 32, fontWeight: 700, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.5, ...plannedSection.content?.style }
                    };
                } else { // Is Image
                     baseSection = {
                        id: `section-${Date.now()}-${Math.random()}`, type: 'image', role: plannedSection.sectionRole, imageUrl: '', prompt: ''
                    } as ImageSection;
                }
            } else {
                baseSection = existing!;
            }

            const newSection: ArticleSection = { ...JSON.parse(JSON.stringify(baseSection)) };
            
            // 规范化 plannedSection.content：
            // 允许 AI 返回 content 为字符串或为直接的 TextSpan[]
            let normalizedContent: any = plannedSection.content;
            if (typeof normalizedContent === 'string') {
                normalizedContent = { content: [{ text: normalizedContent, style: {} }] };
            } else if (Array.isArray(normalizedContent)) {
                normalizedContent = { content: normalizedContent };
            }

            if (baseSection.isContentLocked || !normalizedContent) {
                composedSections.push(newSection);
                continue;
            }

            if (newSection.type === 'text' && normalizedContent?.content) {
                newSection.content = normalizedContent.content;
            } else if (newSection.type === 'image' && normalizedContent?.prompt) {
                newSection.prompt = normalizedContent.prompt;
            }
            
            if (!isNewSection && newSection.type === 'text' && baseSection.type === 'text') {
                newSection.style = JSON.parse(JSON.stringify(baseSection.style));
            }

            if (newBox.layoutMode === 'flex' && plannedSection.flexGrow !== undefined) {
                newSection.flexGrow = plannedSection.flexGrow;
            }
            
            if (newBox.layoutMode === 'grid') {
                newSection.gridColumn = plannedSection.gridColumn;
                newSection.gridRow = plannedSection.gridRow;
            }

            composedSections.push(newSection);
        }
        newBox.sections = composedSections;
        composedBoxes.push(newBox);
    }
    resultData.layoutBoxes = composedBoxes;

    const imageGenPromises = resultData.layoutBoxes.flatMap(box => box.sections)
        .filter((s): s is ImageSection => s.type === 'image' && !!s.prompt && !s.isContentLocked)
        .map(async section => {
            try {
                const imageResponse = await unifiedAIService.generateImage({
                    task: 'IMAGE_GENERATION',
                    prompt: section.prompt,
                    aspectRatio: '1:1'
                });
                section.imageUrl = imageResponse;
            } catch (e) { console.error(`Failed to generate image for role ${section.role}`, e); }
        });
    await Promise.all(imageGenPromises);
    return resultData;

};