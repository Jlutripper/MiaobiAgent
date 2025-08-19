import React, { useRef, useLayoutEffect, useState, useCallback, useEffect, useMemo } from 'react';
import { TextSection, TextSpan, TextSpanStyle } from '../types';
import { isGradient, parseGradientString } from './utils/colorUtils';

// Helper to convert spans to a contentEditable-safe HTML string.
// This new version ensures all text, styled or not, is wrapped in a <span>.
// This prevents React from getting confused by mixed content (elements and raw text nodes).
const spansToHtml = (spans: TextSpan[]): string => {
    if (!spans || spans.length === 0) return '<span><br></span>'; // Use a span with a line break to keep the div editable

    return spans.map(span => {
        const style: string[] = [];
        if (span.style?.fontWeight) style.push(`font-weight: ${span.style.fontWeight}`);
        if (span.style?.fontFamily) style.push(`font-family: ${span.style.fontFamily}`);
        if (span.style?.color && !isGradient(span.style.color)) style.push(`color: ${span.style.color}`);
        
        const styleAttr = style.length > 0 ? ` style="${style.join('; ')}"` : '';

        // Escape HTML special characters from the text content
        const escapedText = (span.text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
            
        // Convert newlines to <br> tags within the escaped text
        const textWithBreaks = escapedText.replace(/\n/g, '<br>');

        return `<span${styleAttr}>${textWithBreaks}</span>`;
    }).join('');
};

/**
 * A robust, recursive HTML parser for contentEditable divs.
 * It traverses the DOM tree to accurately convert messy browser-generated HTML
 * back into a clean array of TextSpan objects.
 */
const htmlToSpans = (container: HTMLElement): TextSpan[] => {
    const spans: TextSpan[] = [];
    if (!container) return [];

    // Recursive function to process each node in the DOM tree
    function processNode(node: Node, currentStyle: TextSpanStyle = {}) {
        if (node.nodeType === Node.TEXT_NODE) {
            // If it's a text node, push its content with the current inherited style
            if (node.textContent) {
                spans.push({ text: node.textContent, style: currentStyle });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tagName = el.tagName.toUpperCase();
            
            // Handle block-level elements (like DIVs created by Enter key) by adding a newline
            const isBlock = ['P', 'DIV'].includes(tagName);
            if (isBlock && spans.length > 0 && !spans[spans.length - 1].text.endsWith('\n')) {
                 spans.push({ text: '\n', style: {} }); 
            }

            // Determine the style for children of this element
            let childStyle = { ...currentStyle };
            if (tagName === 'SPAN') {
                if (el.style.fontWeight) childStyle.fontWeight = parseInt(el.style.fontWeight, 10) || undefined;
                if (el.style.fontFamily) childStyle.fontFamily = el.style.fontFamily || undefined;
                if (el.style.color) childStyle.color = el.style.color || undefined;
            }

            // Recursively process all child nodes
            el.childNodes.forEach(child => processNode(child, childStyle));

            // Handle line breaks
            if (tagName === 'BR') {
                spans.push({ text: '\n', style: {} });
            }
        }
    }

    container.childNodes.forEach(node => processNode(node));

    // --- Merge adjacent spans that have identical styles ---
    if (spans.length < 2) return spans.filter(s => s.text);
    
    const merged: TextSpan[] = [];
    if (spans.length > 0) {
        let current = { ...spans[0] }; // Start with a copy
        for (let i = 1; i < spans.length; i++) {
            const next = spans[i];
            if (JSON.stringify(current.style) === JSON.stringify(next.style)) {
                current.text += next.text;
            } else {
                merged.push(current);
                current = { ...next }; // Start a new span
            }
        }
        merged.push(current);
    }
    
    // Final cleanup: remove empty spans
    return merged.filter(s => s.text);
};


// Helper to get selection indices.
const getSelectionIndices = (element: HTMLElement): { start: number, end: number } | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return null;

    let charCount = 0;
    let startOffset = -1;
    let endOffset = -1;

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;

    while ((node = walker.nextNode())) {
        const isStart = node === range.startContainer;
        const isEnd = node === range.endContainer;
        if (isStart) startOffset = charCount + range.startOffset;
        if (isEnd) endOffset = charCount + range.endOffset;
        if (startOffset !== -1 && endOffset !== -1) break;
        charCount += node.textContent?.length || 0;
    }
    
    if (startOffset === -1 || endOffset === -1) return null;
    return { start: Math.min(startOffset, endOffset), end: Math.max(startOffset, endOffset) };
};

// --- NEW: HTML-based Renderer for Display Mode ---
const HtmlTextRenderer = ({ section }: { section: TextSection }) => {
    const { style, content = [] } = section;

    const wrapperStyle: React.CSSProperties = {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: style.color,
        textAlign: style.textAlign,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
        writingMode: style.writingMode,
        textShadow: style.textShadow,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        transform: `rotate(${section.rotation || 0}deg)`,
        transformOrigin: 'center center',
    };

    if (isGradient(style.color)) {
        wrapperStyle.backgroundImage = style.color;
        wrapperStyle.backgroundClip = 'text';
        (wrapperStyle as any).WebkitBackgroundClip = 'text';
        wrapperStyle.color = 'transparent';
        (wrapperStyle as any).backgroundColor = parseGradientString(style.color)?.stops[0]?.color || 'black';
    }

    if (style.textStroke) {
        const [width, ...colorParts] = style.textStroke.split(' ');
        const color = colorParts.join(' ');
        (wrapperStyle as any).WebkitTextStrokeWidth = width;
        (wrapperStyle as any).WebkitTextStrokeColor = color;
    }

    return (
        <div style={wrapperStyle}>
            {content.map((span, index) => {
                const spanStyle: React.CSSProperties = {};
                const effectiveStyle = { ...style, ...span.style };

                if (effectiveStyle.fontFamily !== style.fontFamily) spanStyle.fontFamily = effectiveStyle.fontFamily;
                if (effectiveStyle.fontWeight !== style.fontWeight) spanStyle.fontWeight = effectiveStyle.fontWeight;
                if (effectiveStyle.fontSize !== style.fontSize) spanStyle.fontSize = effectiveStyle.fontSize;
                if (effectiveStyle.letterSpacing !== style.letterSpacing) spanStyle.letterSpacing = effectiveStyle.letterSpacing ? `${effectiveStyle.letterSpacing}px` : undefined;

                if (effectiveStyle.color) {
                    if (isGradient(effectiveStyle.color)) {
                        spanStyle.backgroundImage = effectiveStyle.color;
                        spanStyle.backgroundClip = 'text';
                        (spanStyle as any).WebkitBackgroundClip = 'text';
                        spanStyle.color = 'transparent';
                        (spanStyle as any).backgroundColor = parseGradientString(effectiveStyle.color)?.stops[0]?.color || 'black';
                    } else {
                        spanStyle.color = effectiveStyle.color;
                        spanStyle.backgroundImage = 'none';
                    }
                }
                
                return <span key={index} style={spanStyle}>{span.text}</span>;
            })}
        </div>
    );
};


// --- SVG Renderer for the 'curve' effect ---
const SvgCurvedTextRenderer = ({ section }: { section: TextSection }) => {
    const { style, content = [] } = section;
    const { curve = 0, fontSize = 24 } = style;
    
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<SVGTextElement>(null);
    const [viewBox, setViewBox] = useState('0 0 100 100');
    
    // This effect measures the rendered SVG text and sets the container's height
    // to match, which is the key to solving the layout problem.
    useLayoutEffect(() => {
        if (textRef.current && containerRef.current) {
            const bbox = textRef.current.getBBox();
            
            // We set the SVG's viewBox to tightly crop the text
            setViewBox(`${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);

            // And we set the parent div's height to the measured height of the text
            containerRef.current.style.height = `${bbox.height}px`;
        }
    }, [content, style, curve]); // Rerun whenever text or style changes

    const uniqueId = `path-${section.id}`;

    const pathData = useMemo(() => {
        const curveValue = curve / 100;
        if (Math.abs(curveValue) < 0.01) return ''; // No curve

        const width = 1000; // A virtual width for calculation
        const arcHeight = width * curveValue * 0.5;
        const radius = (width * width + 4 * arcHeight * arcHeight) / (8 * arcHeight);
        const sweepFlag = curveValue > 0 ? 0 : 1;

        if (Math.abs(radius) < 1) return ''; // Avoid invalid radius

        return `M 0 ${radius} A ${radius} ${radius} 0 0 ${sweepFlag} ${width} ${radius}`;
    }, [curve]);

    const textAnchor = style.textAlign === 'center' ? 'middle' : style.textAlign === 'right' ? 'end' : 'start';

    return (
        <div ref={containerRef} className="w-full pointer-events-none" style={{ transform: `rotate(${section.rotation || 0}deg)`, transformOrigin: 'center center' }}>
             <svg width="100%" height="100%" overflow="visible" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
                <defs>
                    <path id={uniqueId} d={pathData}></path>
                </defs>
                <text ref={textRef} style={{ fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, letterSpacing: style.letterSpacing, textShadow: style.textShadow }}>
                    <textPath href={`#${uniqueId}`} startOffset="50%" textAnchor={textAnchor} fill={style.color}>
                         {content.map(s => s.text).join('')}
                    </textPath>
                </text>
            </svg>
        </div>
    )
};

interface EditableTextSectionProps {
    section: TextSection;
    isSelected: boolean;
    isEditing: boolean;
    onSelect: (e: React.MouseEvent) => void;
    onEnterEditMode: () => void;
    onExitEditMode: () => void;
    onUpdateContent: (newContent: TextSpan[]) => void;
    onSelectionChange: (selection: { start: number; end: number } | null) => void;
}

// --- Main Component ---
export const EditableTextSection = (props: EditableTextSectionProps) => {
    const { section, isSelected, isEditing, onSelect, onEnterEditMode, onExitEditMode, onUpdateContent, onSelectionChange } = props;
    const { style, content } = section;
    
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isEditing && contentRef.current) {
            contentRef.current.innerHTML = spansToHtml(content);
            contentRef.current.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            if (sel) {
                range.selectNodeContents(contentRef.current);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }, [isEditing, content]);

    useEffect(() => {
        const handleSelectionChange = () => {
            if (isEditing && contentRef.current) {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0 && contentRef.current.contains(selection.anchorNode)) {
                    const indices = getSelectionIndices(contentRef.current);
                     onSelectionChange(indices);
                }
            }
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [isEditing, onSelectionChange]);

    const handleBlur = useCallback(() => {
        if (contentRef.current) {
            const newSpans = htmlToSpans(contentRef.current);
            onUpdateContent(newSpans);
        }
        onExitEditMode();
    }, [onUpdateContent, onExitEditMode]);

    if (isEditing) {
        const editingStyle: React.CSSProperties = {
            width: '100%',
            height: '100%',
            outline: '2px solid #f97316',
            outlineOffset: '2px',
            position: 'relative',
            cursor: 'text',
            textAlign: style.textAlign,
            lineHeight: style.lineHeight,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
            color: style.color,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
        };
        return (
            <div
                key="editor"
                ref={contentRef}
                style={editingStyle}
                contentEditable
                suppressContentEditableWarning
                onClick={e => e.stopPropagation()}
                onDoubleClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onBlur={handleBlur}
            />
        );
    }
    
    const hasCurve = style.curve && style.curve !== 0;

    const displayStyle: React.CSSProperties = {
        width: '100%',
        minHeight: `${style.fontSize}px`, // Ensure a minimum height
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        outlineOffset: '2px',
        cursor: 'pointer',
        position: 'relative',
    };
    
    return (
        <div
            key="display"
            style={displayStyle}
            onClick={onSelect}
            onDoubleClick={onEnterEditMode}
        >
            {hasCurve ? (
                <SvgCurvedTextRenderer section={section} />
            ) : (
                <HtmlTextRenderer section={section} />
            )}
        </div>
    );
};