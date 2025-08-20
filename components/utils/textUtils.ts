import { produce } from 'immer';
import { TextSpan, TextSpanStyle } from '../../types';

/**
 * Applies a given style to a selected range within an array of TextSpans.
 * This function handles splitting spans if the selection is partial.
 * @param spans The initial array of TextSpan objects.
 * @param style The style to apply to the selection.
 * @param selection An object with start and end character indices.
 * @returns A new array of TextSpan objects with the style applied.
 */
export const applyStyleToSelection = (
    spans: TextSpan[],
    style: TextSpanStyle,
    selection: { start: number; end: number }
): TextSpan[] => {
    if (selection.start === selection.end || !spans) {
        return spans;
    }

    const newSpans: TextSpan[] = [];
    let currentIndex = 0;

    for (const span of spans) {
        const spanStart = currentIndex;
        const spanEnd = currentIndex + span.text.length;

        // --- No overlap ---
        if (selection.end <= spanStart || selection.start >= spanEnd) {
            newSpans.push(span);
        } 
        // --- Overlap exists ---
        else {
            // Part before selection
            if (selection.start > spanStart) {
                newSpans.push({
                    text: span.text.substring(0, selection.start - spanStart),
                    style: span.style,
                });
            }

            // Part inside selection
            const selectedTextStart = Math.max(spanStart, selection.start);
            const selectedTextEnd = Math.min(spanEnd, selection.end);
            newSpans.push({
                text: span.text.substring(selectedTextStart - spanStart, selectedTextEnd - spanStart),
                style: { ...span.style, ...style },
            });

            // Part after selection
            if (selection.end < spanEnd) {
                newSpans.push({
                    text: span.text.substring(selection.end - spanStart),
                    style: span.style,
                });
            }
        }
        currentIndex = spanEnd;
    }
    
    // --- Merge adjacent spans if they have identical styles ---
    if (newSpans.length <= 1) {
        return newSpans;
    }

    // Using immer's produce for safe mutation within the merging logic
    return produce(newSpans, draft => {
        let i = 0;
        while (i < draft.length - 1) {
            const current = draft[i];
            const next = draft[i + 1];
            // Deep equality check for styles
            if (JSON.stringify(current.style) === JSON.stringify(next.style)) {
                current.text += next.text;
                draft.splice(i + 1, 1); // Remove the merged span
            } else {
                i++;
            }
        }
    });
};

/**
 * 计算旋转后的边界框尺寸
 * @param width 原始宽度
 * @param height 原始高度  
 * @param rotation 旋转角度（度）
 * @returns 旋转后的边界框 {width, height}
 */
export const calculateRotatedBounds = (width: number, height: number, rotation: number): { width: number, height: number } => {
    if (!rotation || rotation === 0) {
        return { width, height };
    }

    // 将角度转换为弧度
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));

    // 计算旋转后的边界框
    const newWidth = width * cos + height * sin;
    const newHeight = width * sin + height * cos;

    return {
        width: Math.ceil(newWidth),
        height: Math.ceil(newHeight)
    };
};

/**
 * 根据文字内容和样式估算文字的尺寸
 * @param content 文字内容数组
 * @param style 文字样式
 * @returns 估算的尺寸 {width, height}
 */
export const estimateTextSize = (content: TextSpan[], style: any): { width: number, height: number } => {
    const fontSize = style.fontSize || 16;
    const lineHeight = style.lineHeight || 1.2;
    const isVertical = style.writingMode === 'vertical-rl';
    
    // 合并所有文字内容
    const text = content.map(span => span.text).join('') || '文字';
    
    // 创建一个临时的测量元素
    const measureElement = document.createElement('div');
    measureElement.style.position = 'absolute';
    measureElement.style.visibility = 'hidden';
    measureElement.style.whiteSpace = 'pre-wrap';
    measureElement.style.fontSize = `${fontSize}px`;
    measureElement.style.fontFamily = style.fontFamily || 'Arial';
    measureElement.style.fontWeight = style.fontWeight || 'normal';
    measureElement.style.letterSpacing = style.letterSpacing ? `${style.letterSpacing}px` : 'normal';
    measureElement.style.lineHeight = `${lineHeight}`;
    measureElement.style.writingMode = style.writingMode || 'horizontal-tb';
    
    if (isVertical) {
        // 垂直文本：限制宽度，让高度自然生成
        measureElement.style.width = '200px'; // 合理的垂直文本宽度
        measureElement.style.height = 'auto';
    } else {
        // 水平文本：限制最大宽度
        measureElement.style.width = 'max-content';
        measureElement.style.maxWidth = '300px';
    }
    
    measureElement.textContent = text;

    document.body.appendChild(measureElement);
    const rect = measureElement.getBoundingClientRect();
    document.body.removeChild(measureElement);

    return {
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height)
    };
};