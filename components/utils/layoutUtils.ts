import { LayoutBox, DecorationElement, PosterTemplate } from "../../types";

const parseValue = (val: string | undefined, parentValue: number = 0): number => {
    if (!val) return 0;
    const match = val.match(/(-?\d+\.?\d*)\s*(px|%)?/);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2] || 'px';
    return unit === '%' ? (value / 100) * parentValue : value;
};

export const calculateStylesFromConstraints = (
    constraints: LayoutBox['constraints'],
    parentSize: { width: number; height: number }
): React.CSSProperties => {
    const styles: React.CSSProperties = { position: 'absolute' };
    const { top, bottom, left, right, width, height, centerX, centerY } = constraints || {};
    const transforms: string[] = [];

    // Horizontal
    if (centerX !== undefined) {
        styles.left = `calc(50% + ${centerX})`;
        transforms.push('translateX(-50%)');
        if (width !== undefined) styles.width = width;
    } else {
        if (left !== undefined) styles.left = left;
        if (right !== undefined) styles.right = right;
        if (width !== undefined) styles.width = width;
    }

    // Vertical
    if (centerY !== undefined) {
        styles.top = `calc(50% + ${centerY})`;
        transforms.push('translateY(-50%)');
        if (height !== undefined) styles.height = height;
    } else {
        if (top !== undefined) styles.top = top;
        if (bottom !== undefined) styles.bottom = bottom;
        if (height !== undefined) styles.height = height;
    }

    if (transforms.length > 0) {
        styles.transform = transforms.join(' ');
    }

    return styles;
};


export const getPixelBounds = (
    box: LayoutBox,
    parentSize: { width: number; height: number },
    parentIsGrid: boolean = false
): { left: number; top: number; width: number; height: number; right: number; bottom: number; centerX: number; centerY: number } => {
    
    if (parentIsGrid) {
        // We can't know the exact pixel bounds of a grid item from constraints alone,
        // as it's determined by the grid container. Returning zeros prevents incorrect snapping.
        // A more advanced implementation might query the DOM, but this is safer.
        return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, centerX: 0, centerY: 0 };
    }

    const { constraints = {} } = box;
    const parentWidth = parentSize.width;
    const parentHeight = parentSize.height;

    let finalLeft = 0, finalTop = 0, finalWidth = 0, finalHeight = 0;

    // Horizontal calculation
    const width = constraints.width ? parseValue(constraints.width, parentWidth) : null;
    const left = constraints.left ? parseValue(constraints.left, parentWidth) : null;
    const right = constraints.right ? parseValue(constraints.right, parentWidth) : null;
    const centerX = constraints.centerX ? parseValue(constraints.centerX, parentWidth) : null;
    
    if (centerX !== null && width !== null) {
        finalWidth = width;
        finalLeft = (parentWidth / 2) + centerX - (width / 2);
    } else if (left !== null && right !== null) {
        finalLeft = left;
        finalWidth = parentWidth - left - right;
    } else if (left !== null && width !== null) {
        finalLeft = left;
        finalWidth = width;
    } else if (right !== null && width !== null) {
        finalWidth = width;
        finalLeft = parentWidth - right - width;
    } else if (left !== null) {
        finalLeft = left;
        finalWidth = 50; // Fallback
    } else if (right !== null) {
        finalLeft = parentWidth - right - 50; // Fallback
        finalWidth = 50;
    } else if (width !== null) {
        finalWidth = width;
        finalLeft = (parentWidth - width) / 2; // Fallback to center
    }


    // Vertical calculation
    const height = constraints.height ? parseValue(constraints.height, parentHeight) : null;
    const top = constraints.top ? parseValue(constraints.top, parentHeight) : null;
    const bottom = constraints.bottom ? parseValue(constraints.bottom, parentHeight) : null;
    const centerY = constraints.centerY ? parseValue(constraints.centerY, parentHeight) : null;
    
    if (centerY !== null && height !== null) {
        finalHeight = height;
        finalTop = (parentHeight / 2) + centerY - (height / 2);
    } else if (top !== null && bottom !== null) {
        finalTop = top;
        finalHeight = parentHeight - top - bottom;
    } else if (top !== null && height !== null) {
        finalTop = top;
        finalHeight = height;
    } else if (bottom !== null && height !== null) {
        finalHeight = height;
        finalTop = parentHeight - bottom - height;
    } else if (top !== null) {
        finalTop = top;
        finalHeight = 50; // Fallback
    } else if (bottom !== null) {
        finalTop = parentHeight - bottom - 50;
        finalHeight = 50; // Fallback
    } else if (height !== null) {
        finalHeight = height;
        finalTop = (parentHeight - height) / 2; // Fallback to center
    }


    return {
        left: finalLeft,
        top: finalTop,
        width: finalWidth,
        height: finalHeight,
        right: finalLeft + finalWidth,
        bottom: finalTop + finalHeight,
        centerX: finalLeft + finalWidth / 2,
        centerY: finalTop + finalHeight / 2,
    };
};

export const findBoxById = (boxes: LayoutBox[], boxId: string): LayoutBox | null => {
    for (const box of boxes) {
        if (box.id === boxId) return box;
        if (box.sections) {
            const found = findBoxById(box.sections.filter(s => s.type === 'layout_box') as LayoutBox[], boxId);
            if (found) return found;
        }
    }
    return null;
};

export const getAllLayoutBoxes = (boxes: LayoutBox[]): LayoutBox[] => {
    let allBoxes: LayoutBox[] = [];
    for (const box of boxes) {
        allBoxes.push(box);
        if (box.sections) {
            allBoxes = allBoxes.concat(getAllLayoutBoxes(box.sections.filter(s => s.type === 'layout_box') as LayoutBox[]));
        }
    }
    return allBoxes;
};

export const calculateDecorationStyle = (
    deco: DecorationElement,
    template: PosterTemplate,
    parentSize: { width: number; height: number },
    selfSize: { width: number; height: number } | null
): React.CSSProperties => {
    const style: React.CSSProperties = {
        width: `${deco.sizePercent.width}%`,
        zIndex: deco.zIndex,
        position: 'absolute',
    };

    if (deco.anchor && selfSize) {
        const anchorBox = findBoxById(template.layoutBoxes, deco.anchor.elementId);
        if (anchorBox) {
            const anchorBounds = getPixelBounds(anchorBox, parentSize);
            const point = deco.anchor.originPoint;

            let originX: number;
            if (point.includes('left')) originX = anchorBounds.left;
            else if (point.includes('right')) originX = anchorBounds.right;
            else originX = anchorBounds.centerX;

            let originY: number;
            if (point.includes('top')) originY = anchorBounds.top;
            else if (point.includes('bottom')) originY = anchorBounds.bottom;
            else originY = anchorBounds.centerY;
            
            let selfAttachmentPointX: number, selfAttachmentPointY: number;
        
            if (deco.anchor.attachmentMode === 'outside') {
                switch (point) {
                    case 'top-left':    selfAttachmentPointX = selfSize.width; selfAttachmentPointY = 0; break;
                    case 'top-center':  selfAttachmentPointX = selfSize.width / 2; selfAttachmentPointY = selfSize.height; break;
                    case 'top-right':   selfAttachmentPointX = 0; selfAttachmentPointY = 0; break;
                    case 'center-left': selfAttachmentPointX = selfSize.width; selfAttachmentPointY = selfSize.height / 2; break;
                    case 'center-right':selfAttachmentPointX = 0; selfAttachmentPointY = selfSize.height / 2; break;
                    case 'bottom-left': selfAttachmentPointX = selfSize.width; selfAttachmentPointY = selfSize.height; break;
                    case 'bottom-center':selfAttachmentPointX = selfSize.width / 2; selfAttachmentPointY = 0; break;
                    case 'bottom-right':selfAttachmentPointX = 0; selfAttachmentPointY = selfSize.height; break;
                    case 'center': default: selfAttachmentPointX = selfSize.width / 2; selfAttachmentPointY = selfSize.height / 2; break;
                }
            } else {
                if (point.includes('left')) selfAttachmentPointX = 0; else if (point.includes('right')) selfAttachmentPointX = selfSize.width; else selfAttachmentPointX = selfSize.width / 2;
                if (point.includes('top')) selfAttachmentPointY = 0; else if (point.includes('bottom')) selfAttachmentPointY = selfSize.height; else selfAttachmentPointY = selfSize.height / 2;
            }
            
            let finalX = originX - selfAttachmentPointX + deco.anchor.offset.x;
            let finalY = originY - selfAttachmentPointY + deco.anchor.offset.y;

            style.left = 0;
            style.top = 0;
            style.transform = `translate(${finalX}px, ${finalY}px) rotate(${deco.angle}deg)`;
        } else {
             style.left = '0'; style.top = '0'; style.transform = `rotate(${deco.angle}deg)`;
        }
    } else {
        style.left = `${deco.position.xPercent}%`;
        style.top = `${deco.position.yPx}px`;
        style.transform = `rotate(${deco.angle}deg)`;
    }

    const boxShadows = [];
    if (deco.stroke && deco.stroke.width > 0) {
        boxShadows.push(`0 0 0 ${deco.stroke.width}px ${deco.stroke.color}`);
    }
    if (boxShadows.length > 0) style.boxShadow = boxShadows.join(', ');
    const filters = [];
    if (deco.shadow) {
        const { offsetX, offsetY, blur, color } = deco.shadow;
        filters.push(`drop-shadow(${offsetX}px ${offsetY}px ${blur}px ${color})`);
    }
    if (filters.length > 0) style.filter = filters.join(' ');
    style.borderRadius = `${deco.borderRadius || 0}px`;

    return style;
};
