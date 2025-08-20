import { LayoutBox } from '../../types';

/**
 * 验证并清理冲突的约束
 * 确保约束系统的一致性
 */
export const validateConstraints = (constraints: LayoutBox['constraints']): LayoutBox['constraints'] => {
    if (!constraints) return {};
    
    const validated = { ...constraints };
    
    // 清理水平约束冲突
    if (validated.centerX !== undefined) {
        // 如果设置了centerX，移除left和right
        delete validated.left;
        delete validated.right;
        // 确保有width值
        if (!validated.width) {
            validated.width = '50%';
        }
    } else if (validated.left !== undefined && validated.right !== undefined) {
        // 如果同时设置了left和right，移除width
        delete validated.width;
    }
    
    // 清理垂直约束冲突
    if (validated.centerY !== undefined) {
        // 如果设置了centerY，移除top和bottom
        delete validated.top;
        delete validated.bottom;
        // 确保有height值
        if (!validated.height) {
            validated.height = '50%';
        }
    } else if (validated.top !== undefined && validated.bottom !== undefined) {
        // 如果同时设置了top和bottom，移除height
        delete validated.height;
    }
    
    return validated;
};

/**
 * 智能约束更新：在更新约束时自动处理冲突
 */
export const updateConstraints = (
    currentConstraints: LayoutBox['constraints'],
    updates: Partial<LayoutBox['constraints']>
): LayoutBox['constraints'] => {
    const newConstraints = { ...currentConstraints, ...updates };
    return validateConstraints(newConstraints);
};

/**
 * 检查约束是否有效
 */
export const isValidConstraints = (constraints: LayoutBox['constraints']): boolean => {
    if (!constraints) return true;
    
    // 检查是否有基本的定位信息
    const hasHorizontal = constraints.left || constraints.right || constraints.centerX;
    const hasVertical = constraints.top || constraints.bottom || constraints.centerY;
    const hasSize = constraints.width || constraints.height;
    
    return !!(hasHorizontal && hasVertical) || !!hasSize;
};

/**
 * 为约束提供默认值
 */
export const getDefaultConstraints = (): LayoutBox['constraints'] => {
    return {
        top: '20px',
        left: '20px',
        width: '200px',
        height: '150px'
    };
};
