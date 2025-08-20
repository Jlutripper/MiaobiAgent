import { DecorationElement } from '../../types';

// 定义锚点位置类型
type AnchorOriginPoint = 'top-left' | 'top-center' | 'top-right' | 
                        'center-left' | 'center' | 'center-right' | 
                        'bottom-left' | 'bottom-center' | 'bottom-right';

/**
 * 解析偏移量值，支持像素和百分比
 */
const parseOffsetValue = (value: string, referenceSize: number): number => {
    if (!value) return 0;
    
    const match = value.match(/^(-?\d+(?:\.\d+)?)\s*(px|%)?$/);
    if (!match) return 0;
    
    const numValue = parseFloat(match[1]);
    const unit = match[2] || 'px';
    
    return unit === '%' ? (numValue / 100) * referenceSize : numValue;
};

// 锚点附着点配置
export const ANCHOR_ATTACHMENT_POINTS = {
    outside: {
        'top-left': { x: 1, y: 0 },
        'top-center': { x: 0.5, y: 1 },
        'top-right': { x: 0, y: 0 },
        'center-left': { x: 1, y: 0.5 },
        'center': { x: 0.5, y: 0.5 },
        'center-right': { x: 0, y: 0.5 },
        'bottom-left': { x: 1, y: 1 },
        'bottom-center': { x: 0.5, y: 0 },
        'bottom-right': { x: 0, y: 1 }
    },
    inside: {
        'top-left': { x: 0, y: 0 },
        'top-center': { x: 0.5, y: 0 },
        'top-right': { x: 1, y: 0 },
        'center-left': { x: 0, y: 0.5 },
        'center': { x: 0.5, y: 0.5 },
        'center-right': { x: 1, y: 0.5 },
        'bottom-left': { x: 0, y: 1 },
        'bottom-center': { x: 0.5, y: 1 },
        'bottom-right': { x: 1, y: 1 }
    }
} as const;

/**
 * 计算锚点附着点的像素坐标
 */
export const calculateAttachmentPoint = (
    mode: 'inside' | 'outside',
    originPoint: AnchorOriginPoint,
    size: { width: number; height: number }
): { x: number; y: number } => {
    const factors = ANCHOR_ATTACHMENT_POINTS[mode]?.[originPoint] || { x: 0.5, y: 0.5 };
    
    return {
        x: size.width * factors.x,
        y: size.height * factors.y
    };
};

/**
 * 计算锚点原点的像素坐标
 */
export const calculateOriginPoint = (
    originPoint: AnchorOriginPoint,
    bounds: { left: number; top: number; width: number; height: number; centerX: number; centerY: number; right: number; bottom: number }
): { x: number; y: number } => {
    let x: number, y: number;
    
    // 计算X坐标
    if (originPoint.includes('left')) {
        x = bounds.left;
    } else if (originPoint.includes('right')) {
        x = bounds.right;
    } else {
        x = bounds.centerX;
    }
    
    // 计算Y坐标
    if (originPoint.includes('top')) {
        y = bounds.top;
    } else if (originPoint.includes('bottom')) {
        y = bounds.bottom;
    } else {
        y = bounds.centerY;
    }
    
    return { x, y };
};

/**
 * 计算最终的锚定位置，支持百分比偏移
 */
export const calculateAnchoredPosition = (
    anchor: NonNullable<DecorationElement['anchor']>,
    anchorBounds: { left: number; top: number; width: number; height: number; centerX: number; centerY: number; right: number; bottom: number },
    selfSize: { width: number; height: number },
    parentSize: { width: number; height: number }
): { x: number; y: number } => {
    // 计算锚点原点
    const origin = calculateOriginPoint(anchor.originPoint, anchorBounds);
    
    // 计算自身附着点
    const attachment = calculateAttachmentPoint(
        anchor.attachmentMode || 'outside',
        anchor.originPoint,
        selfSize
    );
    
    // 解析偏移量，支持百分比相对于父容器大小
    const offsetX = parseOffsetValue(anchor.offset.x, parentSize.width);
    const offsetY = parseOffsetValue(anchor.offset.y, parentSize.height);
    
    // 计算最终位置
    return {
        x: origin.x - attachment.x + offsetX,
        y: origin.y - attachment.y + offsetY
    };
};

/**
 * 验证锚定配置是否有效
 */
export const isValidAnchor = (anchor: DecorationElement['anchor']): boolean => {
    if (!anchor) return false;
    
    return !!(
        anchor.elementId &&
        anchor.originPoint &&
        anchor.offset &&
        typeof anchor.offset.x === 'string' &&
        typeof anchor.offset.y === 'string'
    );
};

/**
 * 格式化偏移量值，确保总是包含单位
 */
export const formatOffsetValue = (value: string | number): string => {
    if (typeof value === 'number') {
        return `${value}px`;
    }
    
    if (typeof value === 'string') {
        // 如果已经有单位，直接返回
        if (value.match(/^\s*-?\d+(?:\.\d+)?\s*(px|%)\s*$/)) {
            return value.trim();
        }
        
        // 如果是纯数字，添加px单位
        if (value.match(/^\s*-?\d+(?:\.\d+)?\s*$/)) {
            return `${parseFloat(value)}px`;
        }
    }
    
    return '0px';
};
