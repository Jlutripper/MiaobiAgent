import { GoogleGenAI, Type } from "@google/genai";
import { AspectRatio, ResultData, PosterTemplate, LayoutBox, ArticleSection, TextSection, ImageSection, DecorationElement } from '../types';
import { generateStandaloneImage } from './imageToolsService';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const articleSectionSchema = {
    type: Type.ARRAY,
    description: 'An array of content sections (text or image).',
    items: {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['text', 'image'] },
            role: { type: Type.STRING, description: "Role of the section (e.g., 'title', 'body', 'logo')." },
            text: { type: Type.STRING, description: "Text content (for type 'text')." },
            style: {
                type: Type.OBJECT,
                description: "Styling for the text (for type 'text').",
                properties: {
                    fontFamily: { type: Type.STRING, description: "Font from: 'ZCOOL KuaiLe', 'Noto Sans SC'." },
                    fontSize: { type: Type.NUMBER },
                    fontWeight: { type: Type.NUMBER, enum: [400, 700, 900] },
                    color: { type: Type.STRING, description: "Hex color." },
                    textAlign: { type: Type.STRING, enum: ['left', 'center', 'right', 'justify'] },
                    lineHeight: { type: Type.NUMBER }
                }
            },
            prompt: { type: Type.STRING, description: "Image generation prompt (for type 'image')." },
        }
    }
};

const generateDynamicTemplate = async (
    theme: string,
    dimensions: { width: number; height: number }
): Promise<PosterTemplate> => {
    const layoutSchema = {
        type: Type.OBJECT,
        properties: {
            background: {
                type: Type.OBJECT,
                description: "The poster's background. Choose 'image' and a prompt for visual themes, or 'color' and a hex/rgba value for abstract themes.",
                properties: {
                    type: { type: Type.STRING, enum: ['image', 'color'] },
                    prompt: { type: Type.STRING, description: "REQUIRED if type is 'image'. A detailed English prompt for a text-free background image." },
                    value: { type: Type.STRING, description: "REQUIRED if type is 'color'. A hex or rgba color string." }
                },
                required: ['type']
            },
            layoutBoxes: {
                type: Type.ARRAY,
                description: "An array of content containers defined by constraints.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                         role: { type: Type.STRING, description: "A unique, descriptive role for this box (e.g., 'header', 'mainContent')." },
                         constraints: {
                            type: Type.OBJECT,
                            description: "Defines the box's size and position using responsive constraints. Use percentages for responsive values and pixels for fixed values.",
                            properties: {
                                top: { type: Type.STRING, description: "Top edge constraint (e.g., '10px', '5%')." },
                                bottom: { type: Type.STRING, description: "Bottom edge constraint (e.g., '10px', '5%')." },
                                left: { type: Type.STRING, description: "Left edge constraint (e.g., '10px', '5%')." },
                                right: { type: Type.STRING, description: "Right edge constraint (e.g., '10px', '5%')." },
                                width: { type: Type.STRING, description: "Width constraint (e.g., '100px', '80%')." },
                                height: { type: Type.STRING, description: "Height constraint (e.g., '100px', '15%')." },
                                centerX: { type: Type.STRING, description: "Horizontal center offset (e.g., '0px', '-20px')." },
                                centerY: { type: Type.STRING, description: "Vertical center offset (e.g., '0px', '30px')." },
                            }
                         },
                         layoutMode: { type: Type.STRING, enum: ['flex', 'grid'], description: "The layout mode for the children of this box." },
                         gridTemplateColumns: { type: Type.STRING, description: "CSS grid-template-columns value (if layoutMode is 'grid')." },
                         gridTemplateRows: { type: Type.STRING, description: "CSS grid-template-rows value (if layoutMode is 'grid')." },
                         columnGap: { type: Type.NUMBER, description: "Column gap for grid layouts in pixels."},
                         rowGap: { type: Type.NUMBER, description: "Row gap for grid layouts in pixels."},
                         backgroundColor: { type: Type.STRING, description: "An rgba color string for the box background." },
                         borderRadius: { type: Type.NUMBER },
                         paddingTop: { type: Type.NUMBER },
                         paddingRight: { type: Type.NUMBER },
                         paddingBottom: { type: Type.NUMBER },
                         paddingLeft: { type: Type.NUMBER },
                         flexDirection: { type: Type.STRING, enum: ['row', 'column'] },
                         justifyContent: { type: Type.STRING, enum: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'] },
                         alignItems: { type: Type.STRING, enum: ['flex-start', 'center', 'flex-end', 'stretch'] },
                         zIndex: { type: Type.NUMBER, description: "Stacking order. Higher is on top. Start from 2." }
                    },
                    required: ['role', 'constraints', 'layoutMode', 'backgroundColor', 'borderRadius', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'zIndex']
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
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Design a template for the theme: "${theme}"`,
        config: { systemInstruction, responseMimeType: 'application/json', responseSchema: layoutSchema }
    });
    
    const layout = JSON.parse(response.text);

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

    let template: PosterTemplate | null = templateId && templateId !== 'none' ? allTemplates.find(t => t.id === templateId) : null;
    
    const [w, h] = aspectRatio.split(':').map(Number);
    const targetWidth = 1080;
    const targetHeight = Math.round(targetWidth * h / w);
    const targetDimensions = { width: targetWidth, height: targetHeight };

    if (template) {
        const originalWidth = template.width;
        template = JSON.parse(JSON.stringify(template)); // Deep copy
        template.width = targetDimensions.width;
        template.height = targetDimensions.height;

        if (originalWidth > 0 && Math.abs(originalWidth - targetDimensions.width) > 1) {
            const scaleFactor = targetDimensions.width / originalWidth;
            scaleTemplateElements(template, scaleFactor);
        }

    } else {
        template = await generateDynamicTemplate(theme, targetDimensions);
    }
    
    type PosterData = Extract<ResultData, {type: 'poster'}>;

    let resultData: Omit<PosterData, 'type' | 'prompt'> = JSON.parse(JSON.stringify({ // Deep copy
        templateId: template.id,
        width: template.width,
        height: template.height,
        background: { ...template.background },
        layoutBoxes: template.layoutBoxes,
        decorations: template.decorations,
    }));
    
    if (resultData.background.type === 'image' && !resultData.background.value.startsWith('data:')) {
         try {
            const newBackgroundValue = await generateStandaloneImage(resultData.background.value, aspectRatio);
            resultData.background.value = newBackgroundValue;
        } catch (e) { console.error("Failed to generate custom background, using template default.", e); }
    }

    const textSpanStyleSchema = { type: Type.OBJECT, properties: {} };
    const textSpanSchema = { type: Type.OBJECT, properties: { text: { type: Type.STRING }, style: textSpanStyleSchema }, required: ['text', 'style'] };

    const compositionSchema = {
        type: Type.OBJECT,
        properties: {
            composition: {
                type: Type.ARRAY,
                description: "An array of layout boxes to be included in the final design.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        boxRole: { type: Type.STRING, description: "The role of the LayoutBox from the template." },
                        sections: {
                            type: Type.ARRAY,
                            description: "The sections to include within this box.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    sectionRole: { type: Type.STRING, description: "The role of the section from the template. MUST match exactly." },
                                    gridColumn: { type: Type.STRING, description: "CSS grid-column value for this section within a grid parent." },
                                    gridRow: { type: Type.STRING, description: "CSS grid-row value for this section within a grid parent." },
                                    content: {
                                        type: Type.OBJECT,
                                        description: "The content for the section. OMIT THIS for locked sections.",
                                        properties: {
                                            content: { 
                                                type: Type.ARRAY, 
                                                description: "For a text section, an array with one TextSpan object: `[{ \"text\": \"...\", \"style\": {} }]`",
                                                items: textSpanSchema
                                            },
                                            prompt: { type: Type.STRING, description: "English prompt for an image section." },
                                            style: {
                                                type: Type.OBJECT,
                                                description: "ONLY for new text sections in empty containers. Provide a suitable style.",
                                                properties: {
                                                    fontSize: { type: Type.NUMBER, description: "Font size in pixels." },
                                                    color: { type: Type.STRING, description: "Hex color code." }
                                                }
                                            }
                                        }
                                    }
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

    const templateStructureString = template.layoutBoxes.map(box => {
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
- Canvas Size: ${template.width}px wide by ${template.height}px tall.
${templateStructureString}

**CRITICAL INSTRUCTIONS & WORKFLOW:**

1.  **Golden Rule for Filling Containers:**
    -   **If a \`Layout Box\` has pre-defined \`sections\`:** Adapt the user's content to fit these sections. Keep all 'required' sections. You may remove 'optional' sections if they are irrelevant to the user's request.
    -   **If a \`Layout Box\` is an EMPTY CONTAINER:** You **MUST** act as a designer and **CREATE NEW \`TextSection\` or \`ImageSection\` elements to fill it.** The sections you create must be logical for the container's \`role\` (e.g., a \`role: 'header'\` box should be filled with a \`role: 'main-headline'\` text section).

2.  **ROLE MATCHING (STRICT RULE):** When filling a pre-defined section, you **MUST** use its original \`role\` name from the blueprint as the \`sectionRole\` in your JSON output. Do NOT invent new roles for existing sections.

3.  **STYLE RULE (VERY IMPORTANT):**
    -   For **pre-defined sections**, you **MUST NOT** provide any style information. The template has its own styles.
    -   For **NEW sections you create** for empty containers, you **MUST** provide a suitable initial \`style\` object containing \`fontSize\` and \`color\` that is appropriate for the theme and canvas size.

4.  **Grid Layout Rule:** If a container's \`layoutMode\` is \`'grid'\`, you **MUST** assign a \`gridColumn\` and/or \`gridRow\` to each section you place inside it.

5.  **Handle Locked Content:** For any section marked as \`(LOCKED)\`, you are FORBIDDEN from changing its content. In your JSON response, you **MUST OMIT** the entire \`content\` object for these locked sections.

6.  **Content Generation Rules:**
    -   **LANGUAGE:** All generated text MUST be in **Chinese**. All image \`prompt\`s MUST be in **English**.
    -   **TEXT:** If the user provides content, map it to the appropriate text sections. If not, write creative, compelling copy based on the theme. For text sections, the content must be structured as a \`content\` array with a single TextSpan object, like this: \`"content": [{ "text": "Your text here", "style": {} }]\`.
    -   **IMAGES:** Create descriptive, artistic English prompts for all image sections that need one.

7.  **JSON OUTPUT:** Your final output MUST be ONLY a valid JSON object that matches the provided schema.`;
    
    const contentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Theme: "${theme}"`,
        config: { systemInstruction, responseMimeType: 'application/json', responseSchema: compositionSchema }
    });
    const designPlan = JSON.parse(contentResponse.text);

    const composedBoxes: LayoutBox[] = [];
    const aiComposition = designPlan.composition || [];

    for (const plannedBox of aiComposition) {
        const originalBox = template.layoutBoxes.find(b => b.role === plannedBox.boxRole);
        if (!originalBox) continue;

        const newBox: LayoutBox = { ...JSON.parse(JSON.stringify(originalBox)) };

        const composedSections: ArticleSection[] = [];
        for (const plannedSection of plannedBox.sections) {
            let originalSection = originalBox.sections.find(s => s.role === plannedSection.sectionRole);
            const isNewSection = !originalSection;

            if (isNewSection) { 
                const isText = !!plannedSection.content?.content;
                if (isText) {
                     originalSection = {
                        id: `section-${Date.now()}-${Math.random()}`, type: 'text', role: plannedSection.sectionRole,
                        content: [],
                        style: { fontFamily: "'Noto Sans SC', sans-serif", fontSize: 32, fontWeight: 700, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.5, ...plannedSection.content?.style }
                    };
                } else { // Is Image
                     originalSection = {
                        id: `section-${Date.now()}-${Math.random()}`, type: 'image', role: plannedSection.sectionRole, imageUrl: '', prompt: ''
                    } as ImageSection;
                }
            }

            const newSection: ArticleSection = { ...JSON.parse(JSON.stringify(originalSection)) };
            
            if (originalSection.isContentLocked || !plannedSection.content) {
                composedSections.push(newSection);
                continue;
            }

            if (newSection.type === 'text' && plannedSection.content?.content) {
                newSection.content = plannedSection.content.content;
            } else if (newSection.type === 'image' && plannedSection.content?.prompt) {
                newSection.prompt = plannedSection.content.prompt;
            }
            
            if (!isNewSection && newSection.type === 'text' && originalSection.type === 'text') {
                newSection.style = JSON.parse(JSON.stringify(originalSection.style));
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
                const imageResponse = await generateStandaloneImage(section.prompt, '1:1');
                section.imageUrl = imageResponse;
            } catch (e) { console.error(`Failed to generate image for role ${section.role}`, e); }
        });
    await Promise.all(imageGenPromises);
    return resultData;

};

export const adaptPosterToTemplate = async (
    currentPoster: ResultData & { type: 'poster' },
    newTemplateId: string,
    allTemplates: PosterTemplate[]
): Promise<Omit<ResultData & { type: 'poster' }, 'type' | 'prompt'>> => {
    
    const newTemplate = allTemplates.find(t => t.id === newTemplateId);
    if (!newTemplate) throw new Error("New template not found");

    const currentContentByRole: Record<string, { textContent: Record<string, string>; imagePrompts: Record<string, string> }> = {};
    currentPoster.layoutBoxes.forEach(box => {
        if (!box.role) return;
        const textContent: Record<string, string> = {};
        const imagePrompts: Record<string, string> = {};
        box.sections.forEach(section => {
            if (section.type === 'text' && section.role && section.content.length > 0) textContent[section.role] = section.content.map(s => s.text).join('');
            if (section.type === 'image' && section.role && section.prompt) imagePrompts[section.role] = section.prompt;
        });
        if (Object.keys(textContent).length > 0 || Object.keys(imagePrompts).length > 0) {
            currentContentByRole[box.role] = { textContent, imagePrompts };
        }
    });

    const newTemplateStructure: Record<string, { textRoles: string[]; imageRoles: string[] }> = {};
    newTemplate.layoutBoxes.forEach(box => {
        if (!box.role) return;
        const textRoles = box.sections.filter(s => s.type === 'text').map(s => s.role);
        const imageRoles = box.sections.filter(s => s.type === 'image').map(s => s.role);
        if (textRoles.length > 0 || imageRoles.length > 0) {
            newTemplateStructure[box.role] = { textRoles, imageRoles };
        }
    });

    const layoutBoxContentProperties: Record<string, any> = {};
    Object.entries(newTemplateStructure).forEach(([boxRole, { textRoles, imageRoles }]) => {
        const properties: Record<string, any> = {};
        if (textRoles.length > 0) properties.textContent = { type: Type.OBJECT, properties: textRoles.reduce((acc, role) => ({ ...acc, [role]: { type: Type.STRING } }), {}) };
        if (imageRoles.length > 0) properties.imagePrompts = { type: Type.OBJECT, properties: imageRoles.reduce((acc, role) => ({ ...acc, [role]: { type: Type.STRING } }), {}) };
        if (Object.keys(properties).length > 0) layoutBoxContentProperties[boxRole] = { type: Type.OBJECT, properties };
    });

    const contentSchema = {
        type: Type.OBJECT,
        properties: { layoutBoxContents: { type: Type.OBJECT, properties: layoutBoxContentProperties } },
        required: ['layoutBoxContents']
    };

    const systemInstruction = `You are an expert content adaptation AI. Your task is to intelligently remap content from an old poster layout to a new one.
**Existing Content (organized by old layout roles):**
${JSON.stringify(currentContentByRole, null, 2)}

**New Template Structure (by new layout roles):**
${JSON.stringify(newTemplateStructure, null, 2)}

**CRITICAL RULES:**
1.  **Analyze and Map:** Compare the roles from the old layout to the new one. Map the existing content to the most semantically similar roles in the new template. For example, old 'title' content should go into a new 'header' or 'mainTitle' role.
2.  **PRESERVE CONTENT:** You MUST use the existing text and image prompts verbatim. Do NOT change, add, or rewrite them.
3.  **Handle Mismatches:** If old content has no matching role in the new template, it's okay to discard it. If a new role has no corresponding old content, it's okay for it to remain empty.
4.  **JSON OUTPUT:** Respond ONLY with a valid JSON object matching the new template's content schema.`;

    const contentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Remap this content: ${JSON.stringify(currentContentByRole)}`,
        config: { systemInstruction, responseMimeType: 'application/json', responseSchema: contentSchema }
    });
    const structuredContent = JSON.parse(contentResponse.text).layoutBoxContents;

    type PosterData = Extract<ResultData, { type: 'poster' }>;
    let adaptedPoster: Omit<PosterData, 'type' | 'prompt'> = {
        templateId: newTemplate.id,
        width: newTemplate.width,
        height: newTemplate.height,
        background: { ...newTemplate.background },
        layoutBoxes: JSON.parse(JSON.stringify(newTemplate.layoutBoxes)),
        decorations: JSON.parse(JSON.stringify(newTemplate.decorations)),
    };

    adaptedPoster.layoutBoxes.forEach(box => {
        const boxContent = structuredContent?.[box.role];
        if (!boxContent) return;
        box.sections.forEach(section => {
            if (section.type === 'text' && boxContent.textContent?.[section.role]) section.content = [{ text: boxContent.textContent[section.role], style: {} }];
            else if (section.type === 'image' && boxContent.imagePrompts?.[section.role]) section.prompt = boxContent.imagePrompts[section.role];
        });
    });

    const imageGenPromises = adaptedPoster.layoutBoxes.flatMap(box => box.sections)
        .filter((s): s is ImageSection => s.type === 'image' && !!s.prompt && !s.imageUrl.startsWith('data:'))
        .map(async section => {
            try {
                const imageResponse = await generateStandaloneImage(section.prompt, '1:1');
                section.imageUrl = imageResponse;
            } catch (e) { console.error(`Failed to generate image for role ${section.role}`, e); }
        });

    await Promise.all(imageGenPromises);
    return adaptedPoster;
};