import React, { useRef, useLayoutEffect, useState } from 'react';
import { TextSection } from '../types';
import { isGradient } from './utils/colorUtils';

type StyledChar = {
    char: string;
    styles: React.CSSProperties;
};

type CharLayout = StyledChar & {
    width: number;
    x: number;
    y: number;
    rotate: number;
};

const parseRichTextToStyledChars = (html: string, baseStyle: React.CSSProperties): StyledChar[] => {
    const container = document.createElement('div');
    container.innerHTML = html;
    const chars: StyledChar[] = [];

    const traverse = (node: Node, inheritedStyles: React.CSSProperties) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            for (const char of text) {
                chars.push({ char, styles: inheritedStyles });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            let newStyles = { ...inheritedStyles };
            
            switch (element.tagName.toLowerCase()) {
                case 'b': case 'strong': newStyles.fontWeight = 'bold'; break;
                case 'i': case 'em': newStyles.fontStyle = 'italic'; break;
                case 'u': newStyles.textDecoration = 'underline'; break;
                case 'font':
                    if (element.hasAttribute('color')) {
                        newStyles.color = element.getAttribute('color') || inheritedStyles.color;
                    }
                    break;
            }
            
            if (element.style.color) newStyles.color = element.style.color;
            if (element.style.backgroundColor) newStyles.backgroundColor = element.style.backgroundColor;
            if (element.style.fontWeight) newStyles.fontWeight = element.style.fontWeight;
            if (element.style.fontStyle) newStyles.fontStyle = element.style.fontStyle;
            if (element.style.textDecoration) newStyles.textDecoration = element.style.textDecoration;

            element.childNodes.forEach(child => traverse(child, newStyles));
        }
    };

    traverse(container, baseStyle);
    return chars;
};

export const EditableTextSection = ({ section, isSelected, onSelect }: { section: TextSection, isSelected: boolean, onSelect: (e: React.MouseEvent) => void }) => {
    const { style, text, rotation = 0 } = section;
    const { curve = 0, letterSpacing = 0, writingMode, textAlign } = style;
    const isColorGradient = isGradient(style.color);

    const [layout, setLayout] = useState<{ chars: CharLayout[], containerWidth: number, containerHeight: number }>({ chars: [], containerWidth: 0, containerHeight: 0 });
    const isMountedRef = useRef(false);

    useLayoutEffect(() => {
        isMountedRef.current = true;
        let measurementDiv: HTMLDivElement | null = null;
        let isCancelled = false;

        const calculateLayout = async () => {
            if (!isMountedRef.current || Math.abs(curve) < 1) return;
            
            await document.fonts.ready;
            if (isCancelled) return;

            const baseCharStyle: React.CSSProperties = {
                fontFamily: style.fontFamily,
                fontSize: `${style.fontSize}px`,
                fontWeight: style.fontWeight,
                letterSpacing: `${letterSpacing}px`,
                whiteSpace: 'pre',
                color: style.color,
                WebkitTextStroke: style.textStroke,
            };
            const styledChars = parseRichTextToStyledChars(text, baseCharStyle);

            if (styledChars.length === 0) {
                 if (!isCancelled) setLayout({ chars: [], containerWidth: 0, containerHeight: style.fontSize });
                 return;
            }

            measurementDiv = document.createElement('div');
            measurementDiv.style.position = 'absolute';
            measurementDiv.style.visibility = 'hidden';
            measurementDiv.style.top = '-9999px';
            measurementDiv.style.left = '-9999px';
            document.body.appendChild(measurementDiv);
            
            const charWidths = styledChars.map(styledChar => {
                const span = document.createElement('span');
                Object.assign(span.style, styledChar.styles);
                span.textContent = styledChar.char === ' ' ? '\u00A0' : styledChar.char;
                measurementDiv.appendChild(span);
                const width = span.getBoundingClientRect().width;
                measurementDiv.removeChild(span);
                return width;
            });

            document.body.removeChild(measurementDiv);
            measurementDiv = null;
            if (isCancelled) return;

            const totalTextWidth = charWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, styledChars.length - 1) * letterSpacing;
            let containerWidth = 0;
            let containerHeight = 0;
            const charLayouts: CharLayout[] = [];

            const radius = (50 * style.fontSize) / (curve / 100);
            const circumference = 2 * Math.PI * Math.abs(radius);
            const totalAngleDeg = (totalTextWidth / circumference) * 360;

            let currentAngleDeg = -totalAngleDeg / 2;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

            for (let i = 0; i < styledChars.length; i++) {
                const charWidth = charWidths[i];
                const angleForCharCenter = (charWidth / 2 / totalTextWidth) * totalAngleDeg;
                currentAngleDeg += angleForCharCenter;

                const currentAngleRad = currentAngleDeg * (Math.PI / 180);
                
                const x = Math.sin(currentAngleRad) * radius;
                const y = (1 - Math.cos(currentAngleRad)) * radius;

                charLayouts.push({ ...styledChars[i], width: charWidth, x, y: radius > 0 ? y : -y, rotate: currentAngleDeg });

                const angleForCharEnd = (charWidth / 2 / totalTextWidth) * totalAngleDeg;
                const angleForSpacing = (letterSpacing / totalTextWidth) * totalAngleDeg;
                currentAngleDeg += angleForCharEnd + angleForSpacing;
            }
            
            charLayouts.forEach(l => {
                const angleRad = (l.rotate) * (Math.PI / 180);
                const x1 = l.x - (l.width/2) * Math.cos(angleRad);
                const x2 = l.x + (l.width/2) * Math.cos(angleRad);
                const y1 = l.y - (l.width/2) * Math.sin(angleRad);
                const y2 = l.y + (l.width/2) * Math.sin(angleRad);
                minX = Math.min(minX, x1, x2);
                maxX = Math.max(maxX, x1, x2);
                minY = Math.min(minY, y1, y2, l.y - style.fontSize, l.y + style.fontSize);
                maxY = Math.max(maxY, y1, y2, l.y - style.fontSize, l.y + style.fontSize);
            });

            const offsetX = -minX;
            const offsetY = -minY;

            charLayouts.forEach(layout => {
                layout.x += offsetX;
                layout.y += offsetY;
            });

            containerWidth = maxX - minX;
            containerHeight = maxY - minY;

            if (curve < 0) {
                charLayouts.forEach(layout => {
                    layout.y = containerHeight - layout.y;
                    layout.rotate = -layout.rotate;
                });
            }
            if (!isCancelled) {
                 setLayout({ chars: charLayouts, containerWidth, containerHeight });
            }
        };

        calculateLayout();

        return () => {
            isCancelled = true;
            isMountedRef.current = false;
            if (measurementDiv) {
                document.body.removeChild(measurementDiv);
            }
        };
    }, [text, style]);
    
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(e);
    };

    if (Math.abs(curve) < 1) {
        const isVertical = writingMode === 'vertical-rl';

        const flatWrapperStyle: React.CSSProperties = {
             transform: `rotate(${rotation || 0}deg)`,
             cursor: 'pointer',
             outline: isSelected ? '2px solid #3b82f6' : 'none',
             outlineOffset: '2px',
             ...(isVertical && {
                display: 'flex',
                width: '100%',
                height: '100%',
                justifyContent: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start'
             })
        };

        const flatTextStyle: React.CSSProperties = {
            ...style,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            writingMode: writingMode || 'horizontal-tb',
            WebkitTextStroke: style.textStroke,
            textShadow: style.textShadow,
            ...isColorGradient ? {
                background: style.color,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
            } : {
                color: style.color,
            }
        };
        
        if (isVertical) {
             delete flatTextStyle.textAlign;
        }

        return (
            <div style={flatWrapperStyle} onClick={handleClick}>
                <div style={flatTextStyle} dangerouslySetInnerHTML={{ __html: text }} />
            </div>
        )
    }

    return (
        <div
            onClick={handleClick}
            style={{
                width: layout.containerWidth,
                height: layout.containerHeight,
                position: 'relative',
                transform: `rotate(${rotation || 0}deg)`,
                cursor: 'pointer',
                outline: isSelected ? '2px solid #3b82f6' : 'none',
                outlineOffset: '2px',
            }}
        >
            {layout.chars.map((charLayout, index) => (
                <span
                    key={index}
                    style={{
                        ...charLayout.styles,
                        WebkitTextStroke: style.textStroke,
                        textShadow: style.textShadow,
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        transformOrigin: 'center center',
                        transform: `translate(${charLayout.x}px, ${charLayout.y}px) rotate(${charLayout.rotate}deg)`,
                        ...isGradient(charLayout.styles.color || '') ? {
                            background: charLayout.styles.color,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                            WebkitTextFillColor: 'transparent',
                        } : {
                            color: charLayout.styles.color,
                        },
                        backgroundColor: charLayout.styles.backgroundColor,
                    }}
                >
                    {charLayout.char}
                </span>
            ))}
        </div>
    );
};