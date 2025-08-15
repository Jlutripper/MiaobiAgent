import { GoogleGenAI, Type } from "@google/genai";
import { PosterTemplate } from '../types';
import { base64ToGenerativePart } from './imageToolsService';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Intermediate data structure produced by Agent A (Vision Analyst)
interface ImageAnalysisResult {
    background: {
        description: string; // e.g., "A dark blue to black vertical gradient." or "A photo of a sunny beach."
    };
    elements: {
        role: string; // e.g., "logo", "main-title", "product-image"
        type: 'text' | 'image';
        boundingBox: { // In percentages
            x: number;
            y: number;
            width: number;
            height: number;
        };
        contentDescription: string; // e.g., "主标题占位符" or "A minimalist white bird icon."
    }[];
}

/**
 * **Agent A: The AI Vision Analyst**
 * Analyzes the image and creates a high-level semantic outline.
 */
const analyzeImageContent = async (base64Image: string): Promise<ImageAnalysisResult> => {
    const analysisSchema = {
        type: Type.OBJECT,
        properties: {
            background: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING, description: "A detailed description of the poster's background (e.g., 'a solid red color', 'a photo of a cityscape at night')." },
                },
                required: ['description'],
            },
            elements: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        role: { type: Type.STRING, description: "The semantic role of the element (e.g., 'logo', 'main-title', 'body-text')." },
                        type: { type: Type.STRING, enum: ['text', 'image'] },
                        boundingBox: {
                            type: Type.OBJECT,
                            description: "The bounding box of the element, with all values as percentages (0-100) relative to the canvas.",
                            properties: {
                                x: { type: Type.NUMBER }, y: { type: Type.NUMBER },
                                width: { type: Type.NUMBER }, height: { type: Type.NUMBER },
                            },
                            required: ['x', 'y', 'width', 'height'],
                        },
                        contentDescription: { type: Type.STRING, description: "For text, a Chinese placeholder (e.g., '主标题'). For images, a brief English description of the image content." },
                    },
                    required: ['role', 'type', 'boundingBox', 'contentDescription'],
                },
            },
        },
        required: ['background', 'elements'],
    };

    const systemInstruction = `You are an expert computer vision analyst. Your only job is to analyze the provided poster image and break it down into a structured JSON outline. Do not design a template, just describe what you see.

**CRITICAL INSTRUCTIONS:**
1.  **Analyze Background FIRST:** Your first and most important task is to describe the overall background of the poster.
2.  **Identify All Elements:** Find every piece of text and every image on the poster.
3.  **Define Bounding Boxes:** For each element, you **MUST** provide its bounding box (\`x\`, \`y\`, \`width\`, \`height\`) as **percentages** of the total canvas size. Be as precise as possible.
4.  **Describe Content:** Provide a generic Chinese placeholder for text elements and a brief English description for image elements.
5.  **Adhere to Schema:** Your output MUST be a single, valid JSON object that strictly conforms to the provided schema.`;

    const imagePart = base64ToGenerativePart(base64Image, 'image/png');
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart] },
        config: { systemInstruction, responseMimeType: 'application/json', responseSchema: analysisSchema }
    });
    
    try {
        return JSON.parse(response.text) as ImageAnalysisResult;
    } catch (e) {
        console.error("Agent A (Vision Analyst) failed to produce valid JSON:", response.text);
        throw new Error("AI Vision Analyst failed to parse the image structure.");
    }
};

/**
 * **Agent B: The AI Template Architect**
 * Takes the structured outline from Agent A and builds the final, technical PosterTemplate.
 */
const buildTemplateFromAnalysis = async (
    analysis: ImageAnalysisResult,
    targetDimensions: { width: number; height: number }
): Promise<PosterTemplate> => {
     const textStyleDefinitionSchema = { type: Type.OBJECT, properties: { fontFamily: { type: Type.STRING }, fontSize: { type: Type.NUMBER }, fontWeight: { type: Type.NUMBER }, color: { type: Type.STRING }, textAlign: { type: Type.STRING, enum: ['left', 'center', 'right', 'justify'] }, lineHeight: { type: Type.NUMBER } }, required: ['fontFamily', 'fontSize', 'fontWeight', 'color', 'textAlign', 'lineHeight'] };
     const sectionSchema = { type: Type.OBJECT, properties: { id: { type: Type.STRING }, type: { type: Type.STRING, enum: ['text', 'image'] }, role: { type: Type.STRING }, text: { type: Type.STRING }, style: textStyleDefinitionSchema, imageUrl: { type: Type.STRING }, prompt: { type: Type.STRING }, objectFit: { type: Type.STRING, enum: ['cover', 'contain'] } }, required: ['id', 'type', 'role'] };
     const layoutBoxSchema = { type: Type.OBJECT, properties: { id: { type: Type.STRING }, role: { type: Type.STRING }, constraints: { type: Type.OBJECT, properties: { top: { type: Type.STRING }, bottom: { type: Type.STRING }, left: { type: Type.STRING }, right: { type: Type.STRING }, width: { type: Type.STRING }, height: { type: Type.STRING }, centerX: { type: Type.STRING }, centerY: { type: Type.STRING } } }, backgroundColor: { type: Type.STRING, description: "MUST be 'transparent'." }, zIndex: { type: Type.NUMBER }, sections: { type: Type.ARRAY, items: sectionSchema } }, required: ['id', 'role', 'constraints', 'backgroundColor', 'zIndex', 'sections'] };
     const fullSchema = { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, width: { type: Type.NUMBER }, height: { type: Type.NUMBER }, background: { type: Type.OBJECT, properties: { type: { type: Type.STRING, enum: ['color', 'image'] }, value: { type: Type.STRING } }, required: ['type', 'value'] }, layoutBoxes: { type: Type.ARRAY, items: layoutBoxSchema } }, required: ['name', 'description', 'width', 'height', 'background', 'layoutBoxes'] };

    const systemInstruction = `You are an expert AI layout system architect. Your task is to translate a high-level visual analysis into a precise, technical, and reusable JSON \`PosterTemplate\`. You will NOT see the original image.

**Target Canvas Size:**
- Width: ${targetDimensions.width}px
- Height: ${targetDimensions.height}px

**CRITICAL TRANSLATION RULES:**
1.  **Golden Rule:** Every element from the analysis **MUST** become its own \`LayoutBox\`. Each \`LayoutBox\` **MUST** contain exactly one content \`section\`.
2.  **Translate BoundingBox to Constraints:** Convert each element's percentage-based \`boundingBox\` into a set of CSS-like string constraints. For example, \`{ x: 10, y: 15, width: 80, height: 20 }\` becomes \`constraints: { left: '10%', top: '15%', width: '80%', height: '20%' }\`.
3.  **Create Content Sections:**
    *   If an element's \`type\` is 'text', create a \`TextSection\`. Use its \`contentDescription\` as the placeholder Chinese \`text\`. You MUST also generate a plausible \`style\` object for it.
    *   If an element's \`type\` is 'image', create an \`ImageSection\`. The \`imageUrl\` **MUST** be an empty string \`''\`. Use its \`contentDescription\` as the English \`prompt\`.
4.  **Implement Background:** Analyze the background description. If it describes a color, set \`background.type\` to \`'color'\` and \`value\` to a hex/rgba string. If it describes a scene, set \`type\` to \`'image'\` and \`value\` to an English image generation prompt based on the description.
5.  **Metadata:** Provide a suitable \`name\` and \`description\` for the template in Chinese.
6.  **IDs and Defaults:** You **MUST** generate a unique string \`id\` for every box and section. All \`LayoutBox\` backgrounds **MUST** be \`'transparent'\`.
7.  **Schema Adherence:** Your final output MUST be a single, valid JSON object that strictly conforms to the provided schema.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate this analysis into a template:\n${JSON.stringify(analysis, null, 2)}`,
        config: { systemInstruction, responseMimeType: 'application/json', responseSchema: fullSchema }
    });

    try {
        return JSON.parse(response.text) as PosterTemplate;
    } catch (e) {
        console.error("Agent B (Template Architect) failed to produce valid JSON:", response.text);
        throw new Error("AI Template Architect failed to build the template.");
    }
};

/**
 * Orchestrates the two-agent workflow to deconstruct an image into a PosterTemplate.
 */
export const deconstructImageToTemplate = async (
    base64Image: string,
    targetDimensions: { width: number; height: number }
): Promise<PosterTemplate> => {
    // Step 1: Agent A analyzes the image and creates a high-level plan.
    const analysisResult = await analyzeImageContent(base64Image);

    // Step 2: Agent B takes the plan and builds the technical template.
    const generatedTemplate = await buildTemplateFromAnalysis(analysisResult, targetDimensions);

    // Step 3: Post-process and finalize the template for immediate use.
    generatedTemplate.id = `poster-template-${Date.now()}`;
    generatedTemplate.coverImageUrl = '';
    generatedTemplate.tags = [];
    generatedTemplate.width = targetDimensions.width;
    generatedTemplate.height = targetDimensions.height;
    generatedTemplate.decorations = []; // Ensure this is always a valid empty array

    if (generatedTemplate.layoutBoxes) {
        generatedTemplate.layoutBoxes.forEach((box: any) => {
            box.type = 'layout_box';
            if (!box.backgroundColor) box.backgroundColor = 'transparent';
            if (box.zIndex === undefined) box.zIndex = (box.role?.toLowerCase().includes('logo') ? 10 : 1);
            if (!box.sections) box.sections = [];
            if (!box.borderRadius) box.borderRadius = 0;
            if (!box.paddingTop) box.paddingTop = 0;
            if (!box.paddingRight) box.paddingRight = 0;
            if (!box.paddingBottom) box.paddingBottom = 0;
            if (!box.paddingLeft) box.paddingLeft = 0;
        });
    }

    return generatedTemplate;
};
