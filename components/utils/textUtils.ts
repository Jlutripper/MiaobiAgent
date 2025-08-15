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