import React, { useState, useRef } from 'react';
import { DecorationElement, LayoutBox, PosterTemplate } from '../types';
import { ArrowUpTrayIcon, TrashIcon, AnchorTopLeftIcon, AnchorTopCenterIcon, AnchorTopRightIcon, AnchorCenterLeftIcon, AnchorCenterIcon, AnchorCenterRightIcon, AnchorBottomLeftIcon, AnchorBottomCenterIcon, AnchorBottomRightIcon } from './icons';
import { RgbaColorPicker as ColorPicker } from './RgbaColorPicker';
import { getPixelBounds, findBoxById } from './utils/layoutUtils';
import { useNumericInput } from '../hooks/useNumericInput';

const ColorSwatch = ({ label, value, onChange, allowGradient = true }: { label?: string, value: string, onChange: (v: string) => void, allowGradient?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    return (
        <div>
             <div className="flex justify-between items-center mb-1">
                {label && <label className="block text-sm font-medium text-gray-300">{label}</label>}
            </div>
            <button
                ref={anchorRef}
                onClick={() => setIsOpen(true)}
                className="w-full h-10 border border-gray-600 rounded-md"
                style={{ background: value }}
            />
            {isOpen && (
                <ColorPicker
                    value={value}
                    onChange={onChange}
                    onClose={() => setIsOpen(false)}
                    anchorRef={anchorRef}
                    allowGradient={allowGradient}
                />
            )}
        </div>
    );
};

export const DecorationPanel = ({
    decoration,
    onUpdate,
    onDelete,
    onUpload,
    availableLayoutBoxes,
    parentSize,
    template
}: {
    decoration: DecorationElement,
    onUpdate: (updates: Partial<DecorationElement>) => void,
    onDelete: () => void,
    onUpload: (file: File) => void,
    availableLayoutBoxes: LayoutBox[],
    parentSize: { width: number, height: number },
    template: PosterTemplate
}) => {
     const originPoints: DecorationElement['anchor']['originPoint'][] = [
        'top-left', 'top-center', 'top-right',
        'center-left', 'center', 'center-right',
        'bottom-left', 'bottom-center', 'bottom-right'
    ];
    
    const anchorIcons: { [key in typeof originPoints[number]]: React.FC<{className?: string}> } = {
        'top-left': AnchorTopLeftIcon, 'top-center': AnchorTopCenterIcon, 'top-right': AnchorTopRightIcon,
        'center-left': AnchorCenterLeftIcon, 'center': AnchorCenterIcon, 'center-right': AnchorCenterRightIcon,
        'bottom-left': AnchorBottomLeftIcon, 'bottom-center': AnchorBottomCenterIcon, 'bottom-right': AnchorBottomRightIcon
    };
    
    const zIndexProps = useNumericInput(decoration.zIndex, (val) => onUpdate({ zIndex: val }));
    const borderRadiusProps = useNumericInput(decoration.borderRadius, (val) => onUpdate({ borderRadius: val }));
    const offsetXProps = useNumericInput(decoration.anchor?.offset.x, (val) => onUpdate({ anchor: {...decoration.anchor!, offset: { ...decoration.anchor!.offset, x: val }} }));
    const offsetYProps = useNumericInput(decoration.anchor?.offset.y, (val) => onUpdate({ anchor: {...decoration.anchor!, offset: { ...decoration.anchor!.offset, y: val }} }));
    const xPercentProps = useNumericInput(decoration.position.xPercent, (val) => onUpdate({ position: { ...decoration.position, xPercent: val } }));
    const yPxProps = useNumericInput(decoration.position.yPx, (val) => onUpdate({ position: { ...decoration.position, yPx: val } }));
    const widthPercentProps = useNumericInput(decoration.sizePercent.width, (val) => onUpdate({ sizePercent: { width: val } }));
    const angleProps = useNumericInput(decoration.angle, (val) => onUpdate({ angle: val }));
    const shadowXProps = useNumericInput(decoration.shadow?.offsetX, (val) => onUpdate({ shadow: { ...decoration.shadow!, offsetX: val } }));
    const shadowYProps = useNumericInput(decoration.shadow?.offsetY, (val) => onUpdate({ shadow: { ...decoration.shadow!, offsetY: val } }));
    const shadowBlurProps = useNumericInput(decoration.shadow?.blur, (val) => onUpdate({ shadow: { ...decoration.shadow!, blur: val } }));
    const strokeWidthProps = useNumericInput(decoration.stroke?.width, (val) => onUpdate({ stroke: { ...decoration.stroke!, width: val } }));


    const handleClearAnchor = () => {
        if (!decoration.anchor) return;
        
        // Calculate the current absolute position in pixels
        const anchorBox = findBoxById(template.layoutBoxes, decoration.anchor.elementId);
        if (!anchorBox) {
            onUpdate({ anchor: undefined }); // Fallback
            return;
        }

        const bounds = getPixelBounds(anchorBox, parentSize);
        let originX = bounds.left, originY = bounds.top;
        if (decoration.anchor.originPoint.includes('center')) originX = bounds.centerX;
        if (decoration.anchor.originPoint.includes('right')) originX = bounds.right;
        if (decoration.anchor.originPoint.includes('center')) originY = bounds.centerY;
        if (decoration.anchor.originPoint.includes('bottom')) originY = bounds.bottom;

        const finalX = originX + decoration.anchor.offset.x;
        const finalY = originY + decoration.anchor.offset.y;

        onUpdate({ 
            anchor: undefined,
            position: {
                xPercent: (finalX / parentSize.width) * 100,
                yPx: finalY
            }
        });
    };

     return (
        <div className="space-y-4 animate-pop-in">
             <h3 className="text-lg font-semibold text-orange-400 border-b border-orange-400/30 pb-2">装饰元素</h3>
            
            <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open>
                <summary className="font-semibold cursor-pointer">基础</summary>
                <div className="mt-4 space-y-4">
                     <div>
                         <label className="block text-sm font-medium text-gray-300 mb-1">图片</label>
                         <button
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) onUpload(file);
                                };
                                input.click();
                            }}
                            className="w-full flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm"
                        >
                            <ArrowUpTrayIcon className="w-5 h-5"/>
                            上传替换
                        </button>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">图层顺序 (Z-Index)</label>
                        <input type="number" {...zIndexProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                        <p className="text-xs text-gray-500 mt-1">负数在内容后, 正数在内容前</p>
                    </div>
                </div>
            </details>

            <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open>
                <summary className="font-semibold cursor-pointer">定位与变换</summary>
                <div className="mt-4 space-y-4">
                     <div className="p-3 bg-gray-700/50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="font-medium">锚定</h4>
                             {decoration.anchor && <button onClick={handleClearAnchor} className="text-xs text-red-400 hover:text-red-300">清除锚点</button>}
                        </div>
                         <select 
                            value={decoration.anchor?.elementId || ''} 
                            onChange={e => onUpdate({ anchor: { elementId: e.target.value, originPoint: 'top-left', offset: {x: 0, y: 0}, attachmentMode: 'outside' } })} 
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white mb-2"
                        >
                             <option value="">无 (自由浮动)</option>
                             {availableLayoutBoxes.map(box => <option key={box.id} value={box.id}>{box.role}</option>)}
                         </select>

                         {decoration.anchor && decoration.anchor.elementId && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm">附着模式</label>
                                    <div className="flex items-center justify-between bg-gray-800 p-1 rounded-md mt-1">
                                        <button onClick={() => onUpdate({ anchor: { ...decoration.anchor!, attachmentMode: 'outside' } })} className={`flex-1 p-1 rounded text-xs ${(decoration.anchor.attachmentMode === 'outside' || !decoration.anchor.attachmentMode) ? 'bg-blue-600' : ''}`}>外部</button>
                                        <button onClick={() => onUpdate({ anchor: { ...decoration.anchor!, attachmentMode: 'inside' } })} className={`flex-1 p-1 rounded text-xs ${decoration.anchor.attachmentMode === 'inside' ? 'bg-blue-600' : ''}`}>内部</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm">锚点</label>
                                    <div className="grid grid-cols-3 gap-1 mt-1">
                                        {originPoints.map(p => {
                                            const Icon = anchorIcons[p];
                                            return (
                                                <button 
                                                    key={p} 
                                                    onClick={() => onUpdate({ anchor: { ...decoration.anchor!, originPoint: p }})} 
                                                    className={`h-8 rounded-md flex items-center justify-center ${decoration.anchor?.originPoint === p ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-400 hover:bg-gray-500'}`}
                                                    title={`Anchor to ${p.replace('-', ' ')}`}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                 <div>
                                    <label className="text-sm">偏移 (px)</label>
                                     <div className="grid grid-cols-2 gap-2 mt-1">
                                         <input type="number" {...offsetXProps} placeholder="X" className="w-full p-1 bg-gray-700 border-gray-600 rounded"/>
                                         <input type="number" {...offsetYProps} placeholder="Y" className="w-full p-1 bg-gray-700 border-gray-600 rounded"/>
                                     </div>
                                </div>
                            </div>
                         )}
                    </div>

                     {!decoration.anchor && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">位置 (X %, Y px)</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" step="0.1" {...xPercentProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                                <input type="number" {...yPxProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                            </div>
                        </div>
                     )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">宽度 (%)</label>
                            <input type="number" {...widthPercentProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">旋转 (°)</label>
                            <input type="number" {...angleProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                        </div>
                    </div>
                </div>
            </details>

            <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open>
                <summary className="font-semibold cursor-pointer">效果</summary>
                <div className="mt-4 space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">圆角 (px)</label>
                        <input
                            type="number"
                            min="0"
                            {...borderRadiusProps}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                            <input
                                type="checkbox"
                                checked={!!decoration.shadow}
                                onChange={() => onUpdate({ shadow: decoration.shadow ? undefined : { offsetX: 2, offsetY: 2, blur: 4, color: 'rgba(0,0,0,0.5)' } })}
                                className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500"
                            />
                            <span>阴影</span>
                        </label>
                        {decoration.shadow && (
                            <div className="space-y-2 pl-6">
                                <div className="grid grid-cols-3 gap-2 text-xs"><span>X</span><span>Y</span><span>模糊</span></div>
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="number" {...shadowXProps} className="w-full p-1 bg-gray-700 rounded-md" />
                                    <input type="number" {...shadowYProps} className="w-full p-1 bg-gray-700 rounded-md" />
                                    <input type="number" {...shadowBlurProps} className="w-full p-1 bg-gray-700 rounded-md" />
                                </div>
                                <ColorSwatch value={decoration.shadow.color} onChange={v => onUpdate({ shadow: { ...decoration.shadow!, color: v } })} allowGradient={false} />
                            </div>
                        )}
                    </div>
                     <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                             <input
                                type="checkbox"
                                checked={!!decoration.stroke && decoration.stroke.width > 0}
                                onChange={() => onUpdate({ stroke: (decoration.stroke && decoration.stroke.width > 0) ? { ...decoration.stroke, width: 0 } : { width: 2, color: '#ffffff' } })}
                                className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500"
                            />
                            <span>描边</span>
                        </label>
                        {decoration.stroke && decoration.stroke.width > 0 && (
                             <div className="space-y-2 pl-6">
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" min="0" {...strokeWidthProps} placeholder="宽度" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
                                    <ColorSwatch value={decoration.stroke.color} onChange={v => onUpdate({ stroke: { ...decoration.stroke!, color: v }})} allowGradient={false}/>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </details>
            
             <button onClick={onDelete} className="w-full flex items-center justify-center gap-2 p-2 mt-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">
                <TrashIcon className="w-5 h-5"/> 删除装饰
            </button>
        </div>
     )
}