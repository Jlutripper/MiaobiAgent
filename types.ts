export type Guide = {
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    dist?: number;
};

export type PredefinedTool = 'poster' | 'generator' | 'upscaler' | 'remover' | 'chat' | 'long_article';
export type Tool = PredefinedTool | string; // string for custom tool IDs

// MCP服务相关类型
export type MCPBackgroundRemovalMethod = 'ai_model' | 'traditional_algorithm' | 'hybrid';
export type MCPQualityLevel = 'high' | 'medium' | 'fast';
export type MCPImageFormat = 'png' | 'webp' | 'jpg' | 'jpeg';

export interface MCPBackgroundRemovalOptions {
    method?: MCPBackgroundRemovalMethod;
    quality?: MCPQualityLevel;
    edgeSmoothing?: boolean;
    preserveTransparency?: boolean;
    outputFormat?: MCPImageFormat;
}

export interface MCPBatchProcessingResult {
    id: string;
    success: boolean;
    result?: string;
    error?: string;
}

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export type InteractionType = 'aspect_ratio_selector' | 'file_upload' | 'long_article_details_input';

export interface CustomTool {
    id: string;
    name: string;
    description: string; // For the AI to understand what it is
    systemPrompt: string; // The instructions for the AI
    requiresText: boolean;
    requiresImage: boolean;
}

export type GradientStop = {
    id: string; // Unique ID for stable interaction
    color: string;
    position: number; // 0 to 1
};

// --- NEW: ADVANCED GRADIENT TYPES ---
export type GradientType = 'linear' | 'radial' | 'conic';

export type RadialGradientShape = 'circle' | 'ellipse';

export type GradientPosition = { x: number, y: number }; // In percentage

export type LinearGradient = {
    type: 'linear';
    angle: number;
    stops: GradientStop[];
};

export type RadialGradient = {
    type: 'radial';
    shape: RadialGradientShape;
    position: GradientPosition;
    stops: GradientStop[];
};

export type ConicGradient = {
    type: 'conic';
    angle: number;
    position: GradientPosition;
    stops: GradientStop[];
};

export type Gradient = LinearGradient | RadialGradient | ConicGradient;


export interface TextElementData {
    id: string;
    type: 'text';
    text: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    opacity: number;
    textShadow?: {
      offsetX: number;
      offsetY: number;
      blur: number;
      color: string;
    };
    textStroke?: {
      width: number;
      color: string;
    };
}


// --- SHARED CONTENT TYPES ---
export interface TextStyleDefinition {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string; // Can be a color string or a gradient string
    textAlign: 'left' | 'center' | 'right' | 'justify';
    lineHeight: number;
    letterSpacing?: number; // In pixels
    textShadow?: string; // e.g., '2px 2px 4px rgba(0,0,0,0.5)'
    textStroke?: string; // e.g., '2px black' or a gradient string
    curve?: number; // From -100 to 100 for WordArt effect
    writingMode?: 'horizontal-tb' | 'vertical-rl'; // For vertical text
    // AI Guardrails
    minFontSize?: number;
    maxFontSize?: number;
}

// --- NEW: STRUCTURED TEXT SPANS ---
export interface TextSpanStyle extends Partial<Omit<TextStyleDefinition, 'textAlign' | 'lineHeight' | 'curve' | 'writingMode'>> {
    // Inherits most styles, allowing for local overrides.
    // Properties that apply to the whole block are omitted.
}

export interface TextSpan {
    text: string; // Pure text content, no HTML.
    style: TextSpanStyle;
}


// NEW: Base interface for all sections to support flexbox properties and metadata
export interface SectionBase {
    id: string;
    type: 'text' | 'image' | 'layout_box';
    role: string; // e.g., 'title', 'subtitle', 'body'
    rotation?: number;
    marginTop?: number; // Kept for long articles
    marginBottom?: number; // Kept for long articles
    // AI Metadata
    importance?: 'required' | 'optional' | 'recommended';
    aiInstructions?: string; // NEW: Detailed instructions for the AI
    isContentLocked?: boolean; // NEW: Prevent AI from changing content
    // Editor metadata
    isVisible?: boolean;
    isLocked?: boolean;
    // Flex item properties
    flexGrow?: number;
    flexShrink?: number;
    // Grid item properties
    gridColumn?: string; // e.g., '1 / 2', 'span 2'
    gridRow?: string; // e.g., '1 / 3'
}

export type TextSection = SectionBase & {
    type: 'text';
    // `text: string` is replaced by `content: TextSpan[]` for structured styling.
    content: TextSpan[];
    style: TextStyleDefinition; // Base style for the entire block
};

export type ImageSection = SectionBase & {
    type: 'image';
    imageUrl: string;
    prompt: string;
    objectFit?: 'cover' | 'contain';
    height?: number; // Optional explicit height in pixels (for flow layout)
    // AI Guardrails
    minHeight?: number;
    maxHeight?: number;
};

interface Anchor {
    elementId: string;
    originPoint: 'top-left' | 'top-center' | 'top-right' | 
                 'center-left' | 'center' | 'center-right' | 
                 'bottom-left' | 'bottom-center' | 'bottom-right';
    offset: { x: string; y: string; }; // 支持 '10px', '5%', '-20px' 等格式
    attachmentMode?: 'outside' | 'inside';
}


// --- POSTER SPECIFIC TYPES ---
export interface LayoutBox extends SectionBase {
    id: string;
    type: 'layout_box';
    role: string;
    constraints: {
        top?: string; // '10px', '5%'
        bottom?: string;
        left?: string;
        right?: string;
        width?: string;
        height?: string;
        centerX?: string; // New: '0px', '-20px', '5%'
        centerY?: string; // New: '0px', '30px'
    };
    anchor?: Anchor;
    backgroundColor: string; // rgba
    backgroundImage: string | null; // base64
    borderRadius: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    sections: ArticleSection[]; // A LayoutBox can now contain other LayoutBoxes
    layoutMode: 'flex' | 'grid'; // Replaced 'flow'
    zIndex?: number; // NEW: For layering containers
    // Flexbox container properties
    flexDirection?: 'row' | 'column';
    justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
    alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
    // Grid container properties
    gridTemplateColumns?: string; // e.g. '1fr 2fr'
    gridTemplateRows?: string; // e.g. 'repeat(3, 100px)'
    columnGap?: number; // in pixels
    rowGap?: number; // in pixels
}

export type ArticleSection = TextSection | ImageSection | LayoutBox; // LayoutBox can now be a section


export interface PosterTemplate {
    id: string;
    name: string;
    description: string;
    tags: string[];
    coverImageUrl: string;
    width: number;
    height: number; // Canvas height is now required
    background: {
        type: 'color' | 'image';
        value: string; // color hex or base64 image
        blur: 'none' | 'light' | 'dark';
        tintColor: string; // rgba color
    };
    layoutBoxes: LayoutBox[];
    decorations: DecorationElement[];
}


// --- LONG ARTICLE SPECIFIC TYPES ---
export interface LongArticleTemplate {
    id: string;
    name: string;
    description: string;
    tags: string[];
    coverImageUrl: string; // base64 string
    width: number;
    background: {
        type: 'color' | 'image';
        value: string; // color hex or base64 image
        blur: 'none' | 'light' | 'dark';
        tintColor: string; // rgba color
    };
    contentContainer: {
        backgroundColor: string; // rgba color
        backgroundImage: string | null;
        backgroundBlur: 'none' | 'light' | 'dark';
        borderRadius: number;
        marginTop: number;
        marginBottom: number;
        marginX: number; // horizontal margin for the content block
        paddingTop: number;
        paddingRight: number;
        paddingBottom: number;
        paddingLeft: number;
    };
    sections: (TextSection | ImageSection)[]; // Long articles don't have nested boxes
    decorations: DecorationElement[];
}

export interface DecorationElement {
    id: string;
    type: 'decoration';
    role?: string;
    imageUrl: string;
    position: { xPercent: number, yPx: number };
    sizePercent: { width: number }; // height is auto based on image aspect ratio
    angle: number;
    zIndex: number;
    scope: 'page' | 'content';
    borderRadius?: number; // in px
    shadow?: {
        offsetX: number;
        offsetY: number;
        blur: number;
        color: string;
    };
    stroke?: {
        width: number; // in px
        color: string;
    };
    anchor?: Anchor;
    isVisible?: boolean;
    isLocked?: boolean;
}

// --- CONSOLIDATED RESULT & CHAT TYPES ---
export type ResultData = {
    type: 'poster';
    templateId: string | null;
    width: number;
    height: number; // This is now required
    background: {
        type: 'color' | 'image';
        value: string;
        blur: 'none' | 'light' | 'dark';
        tintColor: string; // rgba color
    };
    layoutBoxes: LayoutBox[];
    decorations: DecorationElement[];
    prompt: string;
    previewImageUrl?: string;
} | {
    type: 'image';
    imageUrl: string;
} | {
    type: 'long_article';
    templateId: string | null;
    sections: (TextSection | ImageSection)[];
    decorations: DecorationElement[];
    width: number;
    background: {
        type: 'color' | 'image';
        value: string;
        blur: 'none' | 'light' | 'dark';
        tintColor: string; // rgba color
    };
    contentContainer: {
        backgroundColor: string; // rgba color
        backgroundImage: string | null;
        backgroundBlur: 'none' | 'light' | 'dark';
        borderRadius: number;
        marginTop: number;
        marginBottom: number;
        marginX: number; // horizontal margin for the content block
        paddingTop: number;
        paddingRight: number;
        paddingBottom: number;
        paddingLeft: number;
    };
};

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    result?: ResultData;
    interactionType?: InteractionType;
    isThinking?: boolean;
    initialContent?: string;
}
