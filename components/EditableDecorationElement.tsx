import React, { useRef, useCallback, useState, useEffect, useLayoutEffect } from 'react';
import { DecorationElement, PosterTemplate } from '../types';
import { ResizeHandleIcon, RotateCwIcon } from './icons';
import { getPixelBounds, calculateDecorationStyle } from './utils/layoutUtils';

const SNAP_THRESHOLD = 5;

type Guide = { x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number; dist?: number };

export const EditableDecorationElement = ({
    element,
    parentSize,
    template,
    zoom,
    isSelected,
    onSetGuides,
    onClick,
    onUpdate,
}: {
    element: DecorationElement;
    parentSize: { width: number; height: number };
    template: PosterTemplate;
    zoom: number;
    isSelected: boolean;
    onSetGuides: (guides: Guide[]) => void;
    onClick: (e: React.MouseEvent) => void;
    onUpdate: (id: string, updates: Partial<DecorationElement>) => void;
}) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [finalStyle, setFinalStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
    const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

    const interactionRef = useRef<{
        type: 'drag' | 'resize' | 'rotate';
        startX: number;
        startY: number;
        startPosPx?: { x: number; y: number };
        startOffset?: { x: number; y: number };
        startSizePx: { width: number };
        startAngle: number;
        elementCenter: { x: number, y: number };
    } | null>(null);

    // Effect to calculate intrinsic aspect ratio of the image
    useEffect(() => {
        const img = imgRef.current;
        if (!img) return;

        const updateAspectRatio = () => {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setImageAspectRatio(img.naturalHeight / img.naturalWidth);
            }
        };

        // If image is already loaded/cached, update aspect ratio immediately
        if (img.complete && img.naturalWidth > 0) {
            updateAspectRatio();
        } else {
            // Otherwise, wait for it to load
            img.addEventListener('load', updateAspectRatio);
        }

        return () => {
            img.removeEventListener('load', updateAspectRatio);
        };
    }, [element.imageUrl]);


     useLayoutEffect(() => {
        // Deterministic size calculation, independent of DOM measurement
        let selfSize: { width: number; height: number; } | null = null;
        if (imageAspectRatio !== null && parentSize.width > 0) {
            const pixelWidth = (element.sizePercent.width / 100) * parentSize.width;
            const pixelHeight = pixelWidth * imageAspectRatio;
            selfSize = { width: pixelWidth, height: pixelHeight };
        }
        
        const calculatedStyle = calculateDecorationStyle(element, template, parentSize, selfSize);
        
        setFinalStyle({
            ...calculatedStyle,
            outline: isSelected ? '2px solid #f97316' : 'none',
            outlineOffset: '4px',
            userSelect: 'none',
            pointerEvents: 'auto',
        });
    }, [element, template, parentSize, isSelected, imageAspectRatio]);


    const handleMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize' | 'rotate') => {
        e.preventDefault();

        if (!parentSize.width || !elementRef.current) return;

        const elRect = elementRef.current!.getBoundingClientRect();
        const elementCenter = {
            x: elRect.left + elRect.width / 2,
            y: elRect.top + elRect.height / 2,
        };
        
        const interaction = {
            type,
            startX: e.clientX,
            startY: e.clientY,
            startSizePx: { width: Math.round((element.sizePercent.width / 100) * parentSize.width) },
            startAngle: element.angle,
            elementCenter,
        };

        if (element.anchor) {
            interactionRef.current = { ...interaction, startOffset: { ...element.anchor.offset } };
        } else {
            interactionRef.current = { ...interaction, startPosPx: { x: (element.position.xPercent / 100) * parentSize.width, y: element.position.yPx } };
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!interactionRef.current || !parentSize.width || !elementRef.current) return;

        let dx = (e.clientX - interactionRef.current.startX) / zoom;
        let dy = (e.clientY - interactionRef.current.startY) / zoom;
        
        let newUpdates: Partial<DecorationElement> = {};
        const activeGuides: Guide[] = [];

        if (interactionRef.current.type === 'drag') {
             if (element.anchor) {
                const { startOffset } = interactionRef.current;
                if (!startOffset) return;
                 // Snapping logic can be added here for anchored elements if needed
                newUpdates.anchor = { ...element.anchor, offset: { x: startOffset.x + dx, y: startOffset.y + dy } };
             } else {
                const { startPosPx } = interactionRef.current;
                if (!startPosPx) return;
                const elRect = elementRef.current.getBoundingClientRect();
                const elWidth = elRect.width / zoom;
                const elHeight = elRect.height / zoom;

                let finalX = startPosPx.x + dx;
                let finalY = startPosPx.y + dy;
                
                const vTargets = [0, parentSize.width / 2, parentSize.width];
                const hTargets = [0, parentSize.height / 2, parentSize.height];
                
                const allBoxesAndDecos = [...template.layoutBoxes, ...(template.decorations || [])];

                allBoxesAndDecos.forEach(other => {
                    if (other.id === element.id) return;
                    if (other.type === 'layout_box') {
                        const bounds = getPixelBounds(other, parentSize);
                         if (bounds.width > 0) {
                            vTargets.push(bounds.left, bounds.centerX, bounds.right);
                            hTargets.push(bounds.top, bounds.centerY, bounds.bottom);
                        }
                    } else if (other.type === 'decoration' && !other.anchor) {
                        const left = (other.position.xPercent / 100) * parentSize.width;
                        const width = (other.sizePercent.width / 100) * parentSize.width;
                        vTargets.push(left, left + width / 2, left + width);
                    }
                });

                const currentBounds = { left: finalX, right: finalX + elWidth, centerX: finalX + elWidth / 2, top: finalY, bottom: finalY + elHeight, centerY: finalY + elHeight / 2 };
                
                for (const target of vTargets) { if (Math.abs(currentBounds.left - target) < SNAP_THRESHOLD) { dx += target - currentBounds.left; activeGuides.push({ x: target }); break; } if (Math.abs(currentBounds.centerX - target) < SNAP_THRESHOLD) { dx += target - currentBounds.centerX; activeGuides.push({ x: target }); break; } if (Math.abs(currentBounds.right - target) < SNAP_THRESHOLD) { dx += target - currentBounds.right; activeGuides.push({ x: target }); break; } }
                for (const target of hTargets) { if (Math.abs(currentBounds.top - target) < SNAP_THRESHOLD) { dy += target - currentBounds.top; activeGuides.push({ y: target }); break; } if (Math.abs(currentBounds.centerY - target) < SNAP_THRESHOLD) { dy += target - currentBounds.centerY; activeGuides.push({ y: target }); break; } if (Math.abs(currentBounds.bottom - target) < SNAP_THRESHOLD) { dy += target - currentBounds.bottom; activeGuides.push({ y: target }); break; } }
                
                newUpdates.position = {
                    xPercent: ((startPosPx.x + dx) / parentSize.width) * 100,
                    yPx: Math.round(startPosPx.y + dy),
                };
             }
        } else if (interactionRef.current.type === 'resize') {
            let newWidthPx = Math.max(20, interactionRef.current.startSizePx.width + dx);
            newUpdates.sizePercent = { width: (Math.round(newWidthPx) / parentSize.width) * 100 };
        } else if (interactionRef.current.type === 'rotate') {
             const center = interactionRef.current.elementCenter;
             const startAngleRad = Math.atan2(interactionRef.current.startY - center.y, interactionRef.current.startX - center.x);
             const currentAngleRad = Math.atan2(e.clientY - center.y, e.clientX - center.x);
             const angleDiffRad = currentAngleRad - startAngleRad;
             newUpdates.angle = interactionRef.current.startAngle + (angleDiffRad * 180 / Math.PI);
        }
        
        onSetGuides(activeGuides);
        onUpdate(element.id, newUpdates);

    }, [zoom, parentSize, element.id, onUpdate, template, onSetGuides, element.anchor]);

    const handleMouseUp = useCallback(() => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        interactionRef.current = null;
        onSetGuides([]);
    }, [handleMouseMove, onSetGuides]);

    return (
        <div
            ref={elementRef}
            className="decoration-wrapper"
            style={finalStyle}
            onClick={onClick}
            onMouseDown={(e) => handleMouseDown(e, 'drag')}
        >
            <img 
                ref={imgRef}
                src={element.imageUrl} 
                alt="decoration" 
                className="w-full h-auto object-contain pointer-events-none" 
                style={{
                    borderRadius: `${element.borderRadius || 0}px`,
                    overflow: 'hidden'
                }}
            />
            {isSelected && (
                 <>
                    <div
                        className="absolute -right-2 -bottom-2 cursor-se-resize w-5 h-5 bg-white rounded-full flex items-center justify-center border-2 border-orange-500"
                        style={{ transform: `rotate(${-element.angle}deg) scale(${1/zoom})` }}
                        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize'); }}
                    >
                        <ResizeHandleIcon className="w-3 h-3 text-orange-500" />
                    </div>
                     <div
                        className="absolute -right-2 -top-2 cursor-pointer w-5 h-5 bg-white rounded-full flex items-center justify-center border-2 border-orange-500"
                        style={{ transform: `rotate(${-element.angle}deg) scale(${1/zoom})` }}
                        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'rotate'); }}
                    >
                        <RotateCwIcon className="w-3 h-3 text-orange-500" />
                    </div>
                 </>
            )}
        </div>
    );
};
