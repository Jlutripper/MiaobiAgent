import React, { useRef, useState, useLayoutEffect, useMemo, useEffect } from 'react';
import { ResultData, LayoutBox, ArticleSection, TextSection, ImageSection, DecorationElement, PosterTemplate } from '../types';
import { EditableTextSection } from './EditableTextSection';
import { EditableImageSection } from './EditableImageSection';
import { calculateStylesFromConstraints, calculateDecorationStyle } from './utils/layoutUtils';

const RenderLayoutBox = ({ box, template, parentSize }: { box: LayoutBox; template: PosterTemplate; parentSize: { width: number; height: number } }) => {
    const style: React.CSSProperties = {
        ...calculateStylesFromConstraints(box.constraints, parentSize),
        zIndex: box.zIndex
    };

    const innerStyle: React.CSSProperties = {
        background: box.backgroundColor,
        backgroundImage: box.backgroundImage ? `url(${box.backgroundImage})` : 'none',
        borderRadius: `${box.borderRadius}px`,
        paddingTop: box.paddingTop, paddingRight: box.paddingRight,
        paddingBottom: box.paddingBottom, paddingLeft: box.paddingLeft,
        overflow: 'hidden',
        width: '100%',
        height: '100%'
    };

    if (box.layoutMode === 'grid') {
        innerStyle.display = 'grid';
        innerStyle.gridTemplateColumns = box.gridTemplateColumns;
        innerStyle.gridTemplateRows = box.gridTemplateRows;
        innerStyle.columnGap = `${box.columnGap || 0}px`;
        innerStyle.rowGap = `${box.rowGap || 0}px`;
        innerStyle.justifyContent = box.justifyContent;
        innerStyle.alignItems = box.alignItems;
    } else {
        innerStyle.display = 'flex';
        innerStyle.flexDirection = box.flexDirection || 'column';
        innerStyle.gap = `${box.columnGap || 0}px`;
        innerStyle.justifyContent = box.justifyContent || 'flex-start';
        innerStyle.alignItems = box.alignItems || 'stretch';
    }


    return (
        <div
            className="layout-box-wrapper pointer-events-none"
            style={style}
        >
            <div
                className="w-full h-full p-0 m-0 bg-cover bg-center"
                style={innerStyle}
            >
                {box.sections.map(section => {
                    if (section.isVisible === false) return null;
                    
                    const sectionWrapperStyle: React.CSSProperties = {
                        position: 'relative',
                    };

                    if (box.layoutMode === 'flex') {
                        sectionWrapperStyle.flexGrow = section.flexGrow ?? 0;
                        sectionWrapperStyle.flexShrink = section.flexShrink ?? 1;
                    } else if (box.layoutMode === 'grid') {
                        sectionWrapperStyle.gridColumn = section.gridColumn;
                        sectionWrapperStyle.gridRow = section.gridRow;
                    }

                    if(section.type === 'layout_box') {
                        return (
                            <div key={section.id} style={sectionWrapperStyle}>
                                <RenderLayoutBox box={section} template={template} parentSize={{width: 0, height: 0}} />
                            </div>
                        )
                    }

                    if (section.type === 'text') {
                        return (
                            <div key={section.id} style={sectionWrapperStyle}>
                                <EditableTextSection 
                                    section={section} 
                                    isSelected={false}
                                    onSelect={() => {}}
                                />
                            </div>
                        )
                    }
                    if (section.type === 'image') {
                        return (
                            <div key={section.id} style={sectionWrapperStyle}>
                                <EditableImageSection 
                                    section={section} 
                                    isSelected={false}
                                    onSelect={() => {}}
                                />
                            </div>
                        )
                    }
                    return null;
                })}
            </div>
        </div>
    );
};

const RenderDecoration = ({ deco, template, parentSize, zoom }: { deco: DecorationElement, template: PosterTemplate, parentSize: { width: number, height: number }, zoom: number }) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const [finalStyle, setFinalStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

    useLayoutEffect(() => {
        const selfSize = elementRef.current ? { 
            width: elementRef.current.getBoundingClientRect().width / zoom,
            height: elementRef.current.getBoundingClientRect().height / zoom
        } : null;

        const calculatedStyle = calculateDecorationStyle(deco, template, parentSize, selfSize);
        setFinalStyle(calculatedStyle);
    }, [deco, template, parentSize, zoom]);

    return (
        <div ref={elementRef} style={finalStyle}>
            <img 
                src={deco.imageUrl} 
                alt="decoration" 
                className="w-full h-auto object-contain pointer-events-none" 
                style={{
                    borderRadius: `${deco.borderRadius || 0}px`,
                    overflow: 'hidden'
                }}
            />
        </div>
    )
};


export const PosterPreviewRenderer = ({ template, onRendered, zoom = 1 }: {
    template: PosterTemplate;
    onRendered?: () => void;
    zoom?: number;
}) => {
    
    const allImages = useMemo(() => [
        template.background.type === 'image' ? template.background.value : null,
        ...template.layoutBoxes.flatMap(box => box.backgroundImage ? [box.backgroundImage] : []),
        ...template.layoutBoxes.flatMap(box => box.sections.filter(s => s.type === 'image').map(s => (s as ImageSection).imageUrl)),
        ...(template.decorations || []).map(d => d.imageUrl)
    ].filter(Boolean) as string[], [template]);

    useEffect(() => {
        let loadedCount = 0;
        if (allImages.length === 0) {
            onRendered?.();
            return;
        }

        const onFinish = () => {
            loadedCount++;
            if (loadedCount >= allImages.length) {
                setTimeout(() => onRendered?.(), 100);
            }
        };

        allImages.forEach(src => {
            const img = new Image();
            img.src = src;
            img.onload = onFinish;
            img.onerror = onFinish; 
        });
    }, [allImages, onRendered]);

    const backgroundBlurValue = { 'light': '8px', 'dark': '16px', 'none': '0px' }[template.background.blur || 'none'];
    const parentSize = { width: template.width, height: template.height };

    return (
        <div
            className="font-sans relative"
            style={{
                width: template.width,
                height: template.height,
                background: template.background.type === 'color' ? template.background.value : undefined,
                overflow: 'hidden'
            }}
        >
             <div className="absolute inset-0" style={{ zIndex: -2 }}>
                 <div
                    className="w-full h-full bg-cover bg-center"
                    style={{
                        ...(template.background.type === 'image' && template.background.value
                            ? { backgroundImage: `url(${template.background.value})` }
                            : { background: template.background.value }
                        ),
                        filter: `blur(${backgroundBlurValue})`,
                        transform: 'scale(1.05)',
                    }}
                />
            </div>
            <div className="absolute inset-0 w-full h-full" style={{ backgroundColor: template.background.tintColor || 'transparent', zIndex: -1 }} />
            <div className="relative w-full h-full">
                {template.layoutBoxes.map((box) => (
                    <RenderLayoutBox key={box.id} box={box} template={template} parentSize={parentSize} />
                ))}
                {(template.decorations || []).map(deco => (
                    <RenderDecoration key={deco.id} deco={deco} template={template} parentSize={parentSize} zoom={zoom} />
                ))}
            </div>
        </div>
    );
};


export const PosterPreview = ({ result }: { result: ResultData & { type: 'poster' } }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);

    const canvasHeight = result.height;

    useLayoutEffect(() => {
        const calculateScale = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                if (containerWidth > 0 && result.width > 0) {
                    setScale(Math.min(1, containerWidth / result.width));
                }
            }
        };

        calculateScale();

        const observer = new ResizeObserver(calculateScale);
        const currentContainer = containerRef.current;
        if (currentContainer) observer.observe(currentContainer);

        return () => {
            if (currentContainer) observer.unobserve(currentContainer);
        };
    }, [result.width]);
    
    const template: PosterTemplate = {
        ...result,
        id: result.templateId || 'preview-id',
        name: result.prompt,
        description: '', tags: [], coverImageUrl: '',
    };


    return (
        <div
            ref={containerRef}
            className="w-full rounded-lg bg-gray-800 overflow-hidden"
            style={{ height: scale > 0 ? canvasHeight * scale : 200 }}
        >
            {scale > 0 && (
                <div
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        width: result.width,
                        height: canvasHeight,
                    }}
                >
                    <PosterPreviewRenderer template={template} zoom={scale} />
                </div>
            )}
        </div>
    );
};