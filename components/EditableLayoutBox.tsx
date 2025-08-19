import React, { useRef, useCallback } from 'react';
import { produce } from 'https://esm.sh/immer@10.1.1';
import { LayoutBox, DecorationElement, Guide, ArticleSection, TextSection, ImageSection, PosterTemplate, TextSpan } from '../types';
import { EditableTextSection } from './EditableTextSection';
import { EditableImageSection } from './EditableImageSection';
import { getPixelBounds, calculateStylesFromConstraints, findBoxById } from './utils/layoutUtils';


const SNAP_THRESHOLD = 5;

interface EditableLayoutBoxProps {
    box: LayoutBox;
    path: string[];
    parentSize: { width: number; height: number };
    parentLayoutMode?: 'flex' | 'grid';
    zoom: number;
    isSelected: (id: string) => boolean;
    template: PosterTemplate;
    otherBoxes: LayoutBox[];
    otherDecorations: DecorationElement[];
    onSetGuides: (guides: Guide[]) => void;
    onSelect: (path: string[]) => void;
    onUpdate: (path: string[], updates: Partial<LayoutBox | ArticleSection>) => void;
    onDoubleClick?: (path: string[]) => void;
    editorMode?: 'template' | 'instance';
    
    // New props for text editing
    editingTextPath: string[] | null;
    onEnterTextEditMode: (path: string[]) => void;
    onExitTextEditMode: () => void;
    onSelectionChange: (selection: { start: number; end: number; } | null) => void;
}

const parseValue = (val: string | undefined): { value: number, unit: string } => {
    if (!val) return { value: 0, unit: 'px' };
    const match = val.match(/(-?\d+\.?\d*)\s*(px|%)?/);
    if (!match) return { value: 0, unit: 'px' };
    return { value: parseFloat(match[1]), unit: match[2] || 'px' };
};

const stringifyValue = (val: number, unit: string): string => {
    // Round to 2 decimal places for percentages to avoid long floats
    const roundedVal = unit === '%' ? Math.round(val * 100) / 100 : Math.round(val);
    return `${roundedVal}${unit}`;
};


export const EditableLayoutBox = (props: EditableLayoutBoxProps) => {
    const { box, path, parentSize, parentLayoutMode, zoom, isSelected, template, otherBoxes, otherDecorations, onSetGuides, onSelect, onUpdate, onDoubleClick, editorMode = 'template' } = props;
    const interactionRef = useRef<{ 
        type: 'drag' | 'resize-br'; 
        startX: number; 
        startY: number;
        startConstraints: LayoutBox['constraints'];
        dragModeConstraints: Partial<LayoutBox['constraints']>;
        startOffset?: { x: number; y: number };
    } | null>(null);
    
    const isGridChild = parentLayoutMode === 'grid';
    const isFlexChild = parentLayoutMode === 'flex';

    const handleMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize-br') => {
        if ((isGridChild || isFlexChild) && !box.anchor) return;
        if (box.isLocked) return;
        
        // For constraint-based and anchored elements, proceed.
        if (!parentSize.width && !box.anchor) return;

        e.preventDefault();

        const startConstraints = JSON.parse(JSON.stringify(box.constraints || {}));

        // **INTELLIGENT DRAG LOGIC**: Determine which constraints to modify
        const dragModeConstraints = produce(startConstraints, (draft: Partial<LayoutBox['constraints']>) => {
            if (type === 'drag') {
                // If stretched horizontally, break the 'right' constraint
                if (draft.left !== undefined && draft.right !== undefined && draft.centerX === undefined) {
                    delete draft.right;
                }
                // If stretched vertically, break the 'bottom' constraint
                if (draft.top !== undefined && draft.bottom !== undefined && draft.centerY === undefined) {
                    delete draft.bottom;
                }
            }
        });

        if (box.anchor) {
             interactionRef.current = { type, startX: e.clientX, startY: e.clientY, startConstraints, dragModeConstraints, startOffset: { ...box.anchor.offset } };
        } else {
             interactionRef.current = { type, startX: e.clientX, startY: e.clientY, startConstraints, dragModeConstraints };
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!interactionRef.current || (!box.anchor && (isGridChild || isFlexChild))) return;
        if (!parentSize.width && !box.anchor) return;


        let dx = (e.clientX - interactionRef.current.startX) / zoom;
        let dy = (e.clientY - interactionRef.current.startY) / zoom;

        let newUpdates: Partial<LayoutBox> = {};
        
        const activeGuides: Guide[] = [];

        if (interactionRef.current.type === 'drag') {
            if (box.anchor) {
                const { startOffset } = interactionRef.current;
                if (!startOffset) return;
                newUpdates.anchor = { ...box.anchor, offset: { x: startOffset.x + dx, y: startOffset.y + dy } };
            } else {
                const startBounds = getPixelBounds(box, parentSize);
                let finalX = startBounds.left + dx;
                let finalY = startBounds.top + dy;
                
                const vTargets = [0, parentSize.width / 2, parentSize.width];
                const hTargets = [0, parentSize.height / 2, parentSize.height];
    
                otherBoxes.forEach(otherBox => {
                    const bounds = getPixelBounds(otherBox, parentSize);
                    vTargets.push(bounds.left, bounds.centerX, bounds.right);
                    hTargets.push(bounds.top, bounds.centerY, bounds.bottom);
                });
    
                const currentBounds = {
                    left: finalX,
                    right: finalX + startBounds.width,
                    centerX: finalX + startBounds.width / 2,
                    top: finalY,
                    bottom: finalY + startBounds.height,
                    centerY: finalY + startBounds.height / 2,
                };
    
                // Vertical Snapping
                for (const target of vTargets) {
                    if (Math.abs(currentBounds.left - target) < SNAP_THRESHOLD) { dx += target - currentBounds.left; activeGuides.push({ x: target, y1: Math.min(currentBounds.top, hTargets.reduce((a, b) => Math.min(a,b), Infinity)), y2: Math.max(currentBounds.bottom, hTargets.reduce((a, b) => Math.max(a,b), -Infinity)) }); break; }
                     if (Math.abs(currentBounds.centerX - target) < SNAP_THRESHOLD) { dx += target - currentBounds.centerX; activeGuides.push({ x: target }); break; }
                    if (Math.abs(currentBounds.right - target) < SNAP_THRESHOLD) { dx += target - currentBounds.right; activeGuides.push({ x: target }); break; }
                }
                 // Horizontal Snapping
                for (const target of hTargets) {
                    if (Math.abs(currentBounds.top - target) < SNAP_THRESHOLD) { dy += target - currentBounds.top; activeGuides.push({ y: target, x1: Math.min(currentBounds.left, vTargets.reduce((a,b)=>Math.min(a,b), Infinity)), x2: Math.max(currentBounds.right, vTargets.reduce((a,b)=>Math.max(a,b),-Infinity)) }); break; }
                     if (Math.abs(currentBounds.centerY - target) < SNAP_THRESHOLD) { dy += target - currentBounds.centerY; activeGuides.push({ y: target }); break; }
                    if (Math.abs(currentBounds.bottom - target) < SNAP_THRESHOLD) { dy += target - currentBounds.bottom; activeGuides.push({ y: target }); break; }
                }
    
    
                const { top, left, bottom, right, centerX, centerY } = interactionRef.current.dragModeConstraints;
                let newConstraints = { ...interactionRef.current.dragModeConstraints };
                
                // **PRIORITIZE CENTER DRAG**
                if (centerX !== undefined) {
                     const parsedCenterX = parseValue(interactionRef.current.startConstraints.centerX);
                     newConstraints.centerX = stringifyValue(parsedCenterX.value + dx, parsedCenterX.unit === '%' ? '%' : 'px');
                } else if (left !== undefined) {
                    const parsedLeft = parseValue(interactionRef.current.startConstraints.left);
                    if (parsedLeft.unit === '%') {
                        newConstraints.left = stringifyValue((parsedLeft.value / 100 * parentSize.width + dx) / parentSize.width * 100, '%');
                    } else {
                        newConstraints.left = stringifyValue(parsedLeft.value + dx, 'px');
                    }
                }
                
                if (centerY !== undefined) {
                    const parsedCenterY = parseValue(interactionRef.current.startConstraints.centerY);
                    newConstraints.centerY = stringifyValue(parsedCenterY.value + dy, parsedCenterY.unit === '%' ? '%' : 'px');
                } else if (top !== undefined) {
                     const parsedTop = parseValue(interactionRef.current.startConstraints.top);
                     if (parsedTop.unit === '%') {
                        newConstraints.top = stringifyValue((parsedTop.value / 100 * parentSize.height + dy) / parentSize.height * 100, '%');
                     } else {
                        newConstraints.top = stringifyValue(parsedTop.value + dy, 'px');
                     }
                }
                newUpdates.constraints = { ...box.constraints, ...newConstraints };
            }

        } else if (interactionRef.current.type === 'resize-br') {
            const { width, height, right, bottom } = interactionRef.current.startConstraints;
            let newConstraints: Partial<LayoutBox['constraints']> = { ...interactionRef.current.startConstraints };

            if (width !== undefined) {
                const parsedWidth = parseValue(width);
                if (parsedWidth.unit === '%') {
                    newConstraints.width = stringifyValue((parsedWidth.value / 100 * parentSize.width + dx) / parentSize.width * 100, '%');
                } else {
                    newConstraints.width = stringifyValue(Math.max(20, parsedWidth.value + dx), 'px');
                }
            } else if (right !== undefined) {
                const parsedRight = parseValue(right);
                 if (parsedRight.unit === '%') {
                    newConstraints.right = stringifyValue((parsedRight.value / 100 * parentSize.width - dx) / parentSize.width * 100, '%');
                 } else {
                    newConstraints.right = stringifyValue(parsedRight.value - dx, 'px');
                 }
            }
            
            if (height !== undefined) {
                const parsedHeight = parseValue(height);
                 if (parsedHeight.unit === '%') {
                    newConstraints.height = stringifyValue((parsedHeight.value / 100 * parentSize.height + dy) / parentSize.height * 100, '%');
                } else {
                    newConstraints.height = stringifyValue(Math.max(20, parsedHeight.value + dy), 'px');
                }
            } else if (bottom !== undefined) {
                 const parsedBottom = parseValue(bottom);
                 if (parsedBottom.unit === '%') {
                    newConstraints.bottom = stringifyValue((parsedBottom.value / 100 * parentSize.height - dy) / parentSize.height * 100, '%');
                 } else {
                    newConstraints.bottom = stringifyValue(parsedBottom.value - dy, 'px');
                 }
            }
             newUpdates.constraints = { ...box.constraints, ...newConstraints };
        }
        
        onSetGuides(activeGuides);
        onUpdate(path, newUpdates);
    }, [zoom, parentSize, path, onUpdate, isGridChild, isFlexChild, box, otherBoxes, otherDecorations, onSetGuides]);

    const handleMouseUp = useCallback(() => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        interactionRef.current = null;
        onSetGuides([]);
    }, [handleMouseMove, onSetGuides]);
    
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(path);
    };

    const wrapperStyle: React.CSSProperties = {
        position: 'absolute',
        outline: isSelected(box.id) ? '2px solid #3b82f6' : 'none',
        outlineOffset: '2px',
        userSelect: 'none',
        zIndex: box.zIndex
    };

    if (box.anchor) {
        const anchorBox = findBoxById(template.layoutBoxes, box.anchor.elementId);
        if (anchorBox) {
            const selfBounds = getPixelBounds(box, parentSize);
            const selfWidth = selfBounds.width;
            const selfHeight = selfBounds.height;

            const anchorBounds = getPixelBounds(anchorBox, parentSize);
            const point = box.anchor.originPoint;

            let originX: number;
            if (point.includes('left')) originX = anchorBounds.left;
            else if (point.includes('right')) originX = anchorBounds.right;
            else originX = anchorBounds.centerX;

            let originY: number;
            if (point.includes('top')) originY = anchorBounds.top;
            else if (point.includes('bottom')) originY = anchorBounds.bottom;
            else originY = anchorBounds.centerY;
            
            let selfAttachmentPointX: number;
            let selfAttachmentPointY: number;

            if (box.anchor.attachmentMode === 'outside') {
                // Rearchitected logic for 'outside' mode based on opposite point attachment
                switch (point) {
                    case 'top-left':    selfAttachmentPointX = selfWidth; selfAttachmentPointY = 0; break;
                    case 'top-center':  selfAttachmentPointX = selfWidth / 2; selfAttachmentPointY = selfHeight; break;
                    case 'top-right':   selfAttachmentPointX = 0; selfAttachmentPointY = 0; break;
                    case 'center-left': selfAttachmentPointX = selfWidth; selfAttachmentPointY = selfHeight / 2; break;
                    case 'center-right':selfAttachmentPointX = 0; selfAttachmentPointY = selfHeight / 2; break;
                    case 'bottom-left': selfAttachmentPointX = selfWidth; selfAttachmentPointY = selfHeight; break;
                    case 'bottom-center':selfAttachmentPointX = selfWidth / 2; selfAttachmentPointY = 0; break;
                    case 'bottom-right':selfAttachmentPointX = 0; selfAttachmentPointY = selfHeight; break;
                    case 'center':
                    default:
                        selfAttachmentPointX = selfWidth / 2;
                        selfAttachmentPointY = selfHeight / 2;
                        break;
                }
            } else {
                // Correct, untouched logic for 'inside' mode
                if (point.includes('left')) selfAttachmentPointX = 0;
                else if (point.includes('right')) selfAttachmentPointX = selfWidth;
                else selfAttachmentPointX = selfWidth / 2;

                if (point.includes('top')) selfAttachmentPointY = 0;
                else if (point.includes('bottom')) selfAttachmentPointY = selfHeight;
                else selfAttachmentPointY = selfHeight / 2;
            }

            let finalX = originX - selfAttachmentPointX;
            let finalY = originY - selfAttachmentPointY;

            finalX += box.anchor.offset.x;
            finalY += box.anchor.offset.y;

            wrapperStyle.left = `${finalX}px`;
            wrapperStyle.top = `${finalY}px`;
            wrapperStyle.width = `${selfBounds.width}px`;
            wrapperStyle.height = `${selfBounds.height}px`;
            wrapperStyle.cursor = 'move';
        } else {
            Object.assign(wrapperStyle, calculateStylesFromConstraints(box.constraints, parentSize));
        }
    } else if (isGridChild) {
        wrapperStyle.position = 'relative'; // Let grid handle it
        wrapperStyle.gridColumn = box.gridColumn;
        wrapperStyle.gridRow = box.gridRow;
        wrapperStyle.cursor = 'pointer';
        delete wrapperStyle.outline; // Outline is complex on grid items
    } else if (isFlexChild) {
        // A flex child should fill the space allocated by the parent flex container.
        // It should not use absolute positioning from constraints.
        wrapperStyle.position = 'relative';
        wrapperStyle.width = '100%';
        wrapperStyle.height = '100%';
        wrapperStyle.cursor = 'pointer';
    } else {
        Object.assign(wrapperStyle, calculateStylesFromConstraints(box.constraints, parentSize));
        if (!box.isLocked) {
           wrapperStyle.cursor = 'move';
        } else {
            wrapperStyle.cursor = 'pointer';
        }
    }
    
    const innerStyle: React.CSSProperties = {
        background: box.backgroundColor,
        backgroundImage: box.backgroundImage ? `url(${box.backgroundImage})` : 'none',
        borderRadius: `${box.borderRadius}px`,
        paddingTop: box.paddingTop, paddingRight: box.paddingRight,
        paddingBottom: box.paddingBottom, paddingLeft: box.paddingLeft,
        overflow: 'hidden',
        pointerEvents: 'none',
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
    } else { // flex
        innerStyle.display = 'flex';
        innerStyle.flexDirection = box.flexDirection || 'column';
        innerStyle.gap = `${box.columnGap || 0}px`; // Note: Using columnGap for flex gap for simplicity
        innerStyle.justifyContent = box.justifyContent || 'flex-start';
        innerStyle.alignItems = box.alignItems || 'stretch';
    }


    return (
        <div
            className={`layout-box-wrapper ${box.isLocked ? 'pointer-events-none' : 'pointer-events-auto'}`}
            style={wrapperStyle}
            onClick={handleClick}
            onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(path); }}
            onMouseDown={(e) => handleMouseDown(e, 'drag')}
        >
            <div
                className="w-full h-full p-0 m-0 bg-cover bg-center"
                style={innerStyle}
            >
                {box.sections.map(section => {
                     if (section.isVisible === false) return null;
                     
                     const sectionWrapperStyle: React.CSSProperties = {
                         pointerEvents: 'auto',
                         position: 'relative',
                    };

                    if (box.layoutMode === 'flex') {
                        sectionWrapperStyle.flexGrow = section.flexGrow ?? 0;
                        sectionWrapperStyle.flexShrink = section.flexShrink ?? 1;
                    } else if (box.layoutMode === 'grid') { // grid
                        sectionWrapperStyle.gridColumn = section.gridColumn;
                        sectionWrapperStyle.gridRow = section.gridRow;
                    }
                    
                    if(section.type === 'layout_box') {
                        return (
                            <div key={section.id} style={sectionWrapperStyle}>
                                <EditableLayoutBox
                                    {...props}
                                    box={section}
                                    path={[...path, section.id]}
                                    parentSize={{width: 0, height: 0}} // Placeholder, nested size is determined by flex/grid
                                    parentLayoutMode={box.layoutMode}
                                />
                            </div>
                        )
                    }

                    if (section.type === 'text') {
                        const sectionPath = [...path, section.id];
                        const isEditing = props.editingTextPath !== null && JSON.stringify(props.editingTextPath) === JSON.stringify(sectionPath);
                        return (
                             <div key={section.id} style={sectionWrapperStyle}>
                                <EditableTextSection 
                                    section={section} 
                                    isSelected={isSelected(section.id)}
                                    isEditing={isEditing}
                                    onSelect={(e) => {e.stopPropagation(); onSelect(sectionPath)}}
                                    onEnterEditMode={() => props.onEnterTextEditMode(sectionPath)}
                                    onExitEditMode={props.onExitTextEditMode}
                                    onUpdateContent={(newContent: TextSpan[]) => onUpdate(sectionPath, { content: newContent })}
                                    onSelectionChange={props.onSelectionChange}
                                />
                            </div>
                        )
                    }
                    if (section.type === 'image') {
                        return (
                            <div key={section.id} style={sectionWrapperStyle}>
                                <EditableImageSection 
                                    section={section} 
                                    isSelected={isSelected(section.id)}
                                    onSelect={(e) => {e.stopPropagation(); onSelect([...path, section.id])}}
                                />
                            </div>
                        )
                    }
                    return null;
                })}
            </div>
            
            {isSelected(box.id) && !isGridChild && !isFlexChild && !box.isLocked && (
                <>
                    <div
                        className="absolute -right-1 -bottom-1 cursor-se-resize w-4 h-4"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            handleMouseDown(e, 'resize-br');
                        }}
                    >
                        <div className="w-full h-full bg-white border-2 border-blue-500 rounded-full" />
                    </div>
                </>
            )}
        </div>
    );
};
