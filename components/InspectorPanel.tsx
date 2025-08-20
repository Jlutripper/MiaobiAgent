import React, { useState, useRef, useMemo } from 'react';
import { produce } from 'immer';
import { PosterTemplate, LayoutBox, ArticleSection, TextSection, ImageSection, DecorationElement, TextStyleDefinition, TextSpan, TextSpanStyle } from '../types';
import { FONT_FAMILIES, TEMPLATE_TEXT_ROLES } from '../constants';
import { SpinnerIcon, ArrowUpTrayIcon, TrashIcon, QuestionMarkCircleIcon, LockClosedIcon, LockOpenIcon, PaintBrushIcon, HighlighterIcon, EyeIcon, EyeSlashIcon, AlignTextCenter, AlignTextLeft, AlignTextRight, AlignTextJustifyIcon, PlusIcon, PhotoIcon, AnchorTopLeftIcon, AnchorTopCenterIcon, AnchorTopRightIcon, AnchorCenterLeftIcon, AnchorCenterIcon, AnchorCenterRightIcon, AnchorBottomLeftIcon, AnchorBottomCenterIcon, AnchorBottomRightIcon } from './icons';
import { RgbaColorPicker as ColorPicker } from './RgbaColorPicker';
import { Tooltip } from './Tooltip';
import { DecorationPanel } from './DecorationPanel';
import { FlexLayoutBoxPanel } from './PosterTemplateEditor';
import { getAllLayoutBoxes, getPixelBounds, findBoxById } from './utils/layoutUtils';
import { useNumericInput } from '../hooks/useNumericInput';


const ColorSwatch = ({ label, value, onChange, allowGradient = true }: { label?: string, value: string, onChange: (v: string) => void, allowGradient?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                {label && <label className="block text-sm font-medium text-gray-300">{label}</label>}
                <button onClick={() => onChange('transparent')} className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-gray-700">清除</button>
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

const GlobalPanel = ({ template, onUpdate, onFileUpload, isProcessing }: { template: PosterTemplate, onUpdate: (updates: Partial<PosterTemplate>) => void, onFileUpload: any, isProcessing: boolean }) => {
    const widthInputProps = useNumericInput(template.width, (val) => onUpdate({ width: val }), 1080);
    const heightInputProps = useNumericInput(template.height, (val) => onUpdate({ height: val }), 1080);
    
    return (
        <div className="space-y-4">
            <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">模板信息</summary><div className="mt-4 space-y-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-1">名称*</label><input type="text" value={template.name} onChange={e => onUpdate({ name: e.target.value })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">描述*</label><textarea value={template.description} onChange={e => onUpdate({ description: e.target.value })} rows={3} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"></textarea></div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">画布宽度 (px)*</label>
                        <input type="number" {...widthInputProps} placeholder="必需" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">画布高度 (px)*</label>
                        <input type="number" {...heightInputProps} placeholder="必需" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
                    </div>
                </div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">封面图片*</label><img src={template.coverImageUrl || `data:image/svg+xml;base64,${btoa(`<svg width="300" height="150" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#555"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#fff" text-anchor="middle" dy=".3em">Upload Cover</text></svg>`)}`} alt="Cover" className="w-full h-32 object-cover rounded-md bg-gray-600 mb-2" /><button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = e => onFileUpload((e.target as HTMLInputElement).files?.[0], { maxWidth: 512, quality: 0.7 }, (b64:string) => onUpdate({ coverImageUrl: b64 })); i.click(); }} disabled={isProcessing} className="w-full flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm disabled:bg-gray-500">{isProcessing ? <SpinnerIcon className="w-5 h-5"/> : <ArrowUpTrayIcon className="w-5 h-5"/>} 上传封面</button></div>
            </div></details>
            <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">页面背景</summary><div className="mt-4 space-y-4">
                <ColorSwatch 
                    label="背景颜色/渐变" 
                    value={template.background.value} 
                    onChange={v => onUpdate({ background: { ...template.background, type: 'color', value: v } })} 
                />
                <button 
                    onClick={() => { 
                        const i = document.createElement('input'); 
                        i.type = 'file'; 
                        i.accept = 'image/*'; 
                        i.onchange = e => onFileUpload(
                            (e.target as HTMLInputElement).files?.[0], 
                            { maxWidth: 1280, quality: 0.8 }, 
                            (b64:string) => onUpdate({ background: {...template.background, type: 'image', value: b64} })
                        ); 
                        i.click(); 
                    }} 
                    disabled={isProcessing} 
                    className="w-full flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm disabled:bg-gray-500"
                >
                    {isProcessing ? <SpinnerIcon className="w-5 h-5"/> : <ArrowUpTrayIcon className="w-5 h-5"/>} 上传图片
                </button>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">模糊</label><select value={template.background.blur} onChange={e => onUpdate({ background: {...template.background, blur: e.target.value as any} })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"><option value="none">无</option><option value="light">轻微</option><option value="dark">明显</option></select></div>
                <ColorSwatch label="染色" value={template.background.tintColor} onChange={v => onUpdate({ background: {...template.background, tintColor: v} })} />
            </div></details>
        </div>
    );
};

const CommonSectionPanel = ({ section, onUpdate }: { section: ArticleSection | DecorationElement, onUpdate: (updates: Partial<ArticleSection | DecorationElement>) => void }) => (
    <>
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">角色 (用于 AI 识别)</label>
            <input
                type="text"
                value={(section as any).role || ''}
                onChange={e => onUpdate({ role: e.target.value })}
                placeholder="例如: header, product-info"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
            />
        </div>
        <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-300 mb-1">
                给 AI 的指令
                 <Tooltip text="为这个区块添加特别说明，帮助 AI 更准确地生成内容。例如：'这是一个促销活动的截止日期，请使用醒目的风格'。">
                    <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                </Tooltip>
            </label>
            <textarea
                value={(section as any).aiInstructions || ''}
                onChange={e => onUpdate({ aiInstructions: e.target.value })}
                placeholder="例如: 这是法律免责声明，请勿修改"
                rows={3}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
            />
        </div>
         <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-md">
            <label htmlFor="content-lock-toggle" className="flex items-center gap-1 text-sm font-medium text-gray-300">
                锁定内容
                <Tooltip text="开启后，AI 将不会修改此区块的任何内容（文字或图片），非常适合用于Logo、Slogan等固定元素。">
                    <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                </Tooltip>
            </label>
            <button
                type="button"
                onClick={() => onUpdate({ isContentLocked: !(section as any).isContentLocked })}
                className={`${ (section as any).isContentLocked ? 'bg-red-600' : 'bg-gray-500' } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`}
                role="switch"
                aria-checked={(section as any).isContentLocked}
                id="content-lock-toggle"
            >
                <span className={`${ (section as any).isContentLocked ? 'translate-x-5' : 'translate-x-0' } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}/>
            </button>
        </div>
        <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-300 mb-1">
                重要性
                <Tooltip text="告诉AI如何处理此区块。'必需'：始终保留。'可选'：如果用户提供的内容与此区块无关，AI会将其移除。'推荐'：AI会优先保留。">
                    <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                </Tooltip>
            </label>
            <select
                value={(section as any).importance || 'required'}
                onChange={(e) => onUpdate({ importance: e.target.value as any })}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
            >
                <option value="required">必需</option>
                <option value="recommended">推荐</option>
                <option value="optional">可选</option>
            </select>
        </div>
    </>
);

const FlexItemPanel = ({ section, onUpdate }: { section: ArticleSection, onUpdate: (updates: Partial<ArticleSection>) => void }) => {
    const flexGrowProps = useNumericInput(section.flexGrow, (val) => onUpdate({ flexGrow: val }));
    const flexShrinkProps = useNumericInput(section.flexShrink, (val) => onUpdate({ flexShrink: val }), 1);

    return (
        <>
            <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-300 mb-1">
                    空间分配权重 (Grow)
                    <Tooltip text="当容器内有剩余空间时，此元素将按此权重比例拉伸以填充空间。0代表不拉伸。">
                        <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                    </Tooltip>
                </label>
                <input type="number" min="0" {...flexGrowProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
            </div>
             <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-300 mb-1">
                    空间压缩权重 (Shrink)
                    <Tooltip text="当容器空间不足时，此元素被压缩的比例。0代表不压缩。">
                        <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                    </Tooltip>
                </label>
                <input type="number" min="0" {...flexShrinkProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
            </div>
        </>
    );
};


const LayoutBoxPanel = ({ box, onUpdate, parentIsGrid, template, mode }: { box: LayoutBox; onUpdate: (updates: Partial<LayoutBox>) => void; parentIsGrid: boolean; template: PosterTemplate; mode: 'template' | 'instance' }) => {
    
    const zIndexProps = useNumericInput(box.zIndex, (val) => onUpdate({ zIndex: val }));
    const borderRadiusProps = useNumericInput(box.borderRadius, (val) => onUpdate({ borderRadius: val }));
    const paddingTopProps = useNumericInput(box.paddingTop, (val) => onUpdate({ paddingTop: val }));
    const paddingBottomProps = useNumericInput(box.paddingBottom, (val) => onUpdate({ paddingBottom: val }));
    const paddingLeftProps = useNumericInput(box.paddingLeft, (val) => onUpdate({ paddingLeft: val }));
    const paddingRightProps = useNumericInput(box.paddingRight, (val) => onUpdate({ paddingRight: val }));
    const columnGapProps = useNumericInput(box.columnGap, (val) => onUpdate({ columnGap: val }));
    const rowGapProps = useNumericInput(box.rowGap, (val) => onUpdate({ rowGap: val }));
    
    const handleConstraintChange = (key: keyof LayoutBox['constraints'], value: string) => {
        onUpdate({ constraints: { ...box.constraints, [key]: value || undefined } });
    };

    const handleHorizontalAlign = (align: 'start' | 'center' | 'end' | 'stretch') => {
        onUpdate({
            constraints: produce(box.constraints, draft => {
                delete draft.left; delete draft.right; delete draft.centerX;
                if (align === 'start') draft.left = '0%';
                else if (align === 'end') draft.right = '0%';
                else if (align === 'stretch') { draft.left = '0%'; draft.right = '0%'; delete draft.width; }
                else if (align === 'center') {
                    if (draft.width === undefined) draft.width = '50%';
                    draft.centerX = '0px';
                }
            })
        });
    };
    
    const handleVerticalAlign = (align: 'start' | 'center' | 'end' | 'stretch') => {
        onUpdate({
            constraints: produce(box.constraints, draft => {
                delete draft.top; delete draft.bottom; delete draft.centerY;
                if (align === 'start') draft.top = '0%';
                else if (align === 'end') draft.bottom = '0%';
                else if (align === 'stretch') { draft.top = '0%'; draft.bottom = '0%'; delete draft.height; }
                else if (align === 'center') {
                    if (draft.height === undefined) draft.height = '50%';
                    draft.centerY = '0px';
                }
            })
        });
    };
    
    const handleCenterOnCanvas = () => {
         onUpdate({
            constraints: produce(box.constraints, draft => {
                delete draft.left; delete draft.right; delete draft.centerX;
                delete draft.top; delete draft.bottom; delete draft.centerY;
                if (draft.width === undefined) draft.width = '50%';
                if (draft.height === undefined) draft.height = '50%';
                draft.centerX = '0px';
                draft.centerY = '0px';
            })
        });
    };

    const handleGridTrackChange = (type: 'columns' | 'rows', index: number, value: string, unit: string) => {
        const key = type === 'columns' ? 'gridTemplateColumns' : 'gridTemplateRows';
        const tracks = (box[key] || '').split(' ').filter(Boolean);
        tracks[index] = `${value}${unit}`;
        onUpdate({ [key]: tracks.join(' ') });
    };
    
    const handleAddTrack = (type: 'columns' | 'rows') => {
        const key = type === 'columns' ? 'gridTemplateColumns' : 'gridTemplateRows';
        const newTrack = '1fr';
        onUpdate({ [key]: ((box[key] || '') + ` ${newTrack}`).trim() });
    };

    const handleRemoveTrack = (type: 'columns' | 'rows', index: number) => {
        const key = type === 'columns' ? 'gridTemplateColumns' : 'gridTemplateRows';
        const tracks = (box[key] || '').split(' ').filter(Boolean);
        tracks.splice(index, 1);
        onUpdate({ [key]: tracks.join(' ') });
    };
    
    const gridCols = (box.gridTemplateColumns || '').split(' ').filter(Boolean);
    const gridRows = (box.gridTemplateRows || '').split(' ').filter(Boolean);
    
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

    const handleSwitchToConstraints = () => {
        const parentSize = { width: template.width, height: template.height };
        if (!box.anchor) return;

        const anchorBox = findBoxById(template.layoutBoxes, box.anchor.elementId);
        if (!anchorBox) { onUpdate({ anchor: undefined }); return; }

        const selfSize = getPixelBounds(box, parentSize);
        const anchorBounds = getPixelBounds(anchorBox, parentSize);
        
        let originX = anchorBounds.left, originY = anchorBounds.top;
        if (box.anchor.originPoint.includes('center')) originX = anchorBounds.centerX;
        if (box.anchor.originPoint.includes('right')) originX = anchorBounds.right;
        if (box.anchor.originPoint.includes('center')) originY = anchorBounds.centerY;
        if (box.anchor.originPoint.includes('bottom')) originY = anchorBounds.bottom;
        
        const finalX = originX + box.anchor.offset.x;
        const finalY = originY + box.anchor.offset.y;

        onUpdate({
            anchor: undefined,
            constraints: {
                left: `${(finalX / parentSize.width) * 100}%`,
                top: `${(finalY / parentSize.height) * 100}%`,
                width: `${selfSize.width}px`,
                height: `${selfSize.height}px`,
            }
        });
    };
    
    return (
        <div className="space-y-4">
            {mode === 'template' && (
                <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open>
                    <summary className="font-semibold cursor-pointer">AI 与布局</summary>
                    <div className="mt-4 space-y-4">
                        <CommonSectionPanel section={box} onUpdate={onUpdate} />
                    </div>
                </details>
            )}
            
            {parentIsGrid ? (
                 <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">网格定位 (Grid)</summary><div className="mt-4 space-y-2">
                     <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                        <div><label className="text-sm">列 (Column)</label><input type="text" value={box.gridColumn || ''} onChange={e => onUpdate({ gridColumn: e.target.value || undefined })} placeholder="e.g. 1 / 2" className="w-full p-1 bg-gray-700 border-gray-600 rounded mt-1" /></div>
                        <div><label className="text-sm">行 (Row)</label><input type="text" value={box.gridRow || ''} onChange={e => onUpdate({ gridRow: e.target.value || undefined })} placeholder="e.g. 1 / 3" className="w-full p-1 bg-gray-700 border-gray-600 rounded mt-1" /></div>
                    </div>
                </div></details>
            ) : (
                <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">位置与尺寸</summary><div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between bg-gray-600/50 p-1 rounded-md">
                        <button onClick={handleSwitchToConstraints} className={`flex-1 p-1 rounded text-xs ${box.anchor === undefined ? 'bg-blue-600' : ''}`}>约束模式</button>
                        <button onClick={() => onUpdate({ anchor: { elementId: '', originPoint: 'top-left', offset: { x: 0, y: 0 }, attachmentMode: 'outside' } })} className={`flex-1 p-1 rounded text-xs ${box.anchor !== undefined ? 'bg-blue-600' : ''}`}>锚定模式</button>
                    </div>
                    {box.anchor !== undefined ? (
                         <div className="space-y-3 pt-2">
                             <select value={box.anchor?.elementId || ''} onChange={e => onUpdate({ anchor: { ...(box.anchor!), elementId: e.target.value } })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white mb-2">
                                 <option value="">选择锚定目标...</option>
                                 {getAllLayoutBoxes(template.layoutBoxes).filter(b => b.id !== box.id).map(b => <option key={b.id} value={b.id}>{b.role}</option>)}
                             </select>
                             {box.anchor.elementId && (<>
                                <div>
                                    <label className="text-sm">附着模式</label>
                                    <div className="flex items-center justify-between bg-gray-800 p-1 rounded-md mt-1">
                                        <button onClick={() => onUpdate({ anchor: { ...box.anchor!, attachmentMode: 'outside' } })} className={`flex-1 p-1 rounded text-xs ${(box.anchor.attachmentMode === 'outside' || !box.anchor.attachmentMode) ? 'bg-blue-600' : ''}`}>外部</button>
                                        <button onClick={() => onUpdate({ anchor: { ...box.anchor!, attachmentMode: 'inside' } })} className={`flex-1 p-1 rounded text-xs ${box.anchor.attachmentMode === 'inside' ? 'bg-blue-600' : ''}`}>内部</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm">锚点</label>
                                    <div className="grid grid-cols-3 gap-1 mt-1">
                                         {originPoints.map(p => {
                                            const Icon = anchorIcons[p];
                                            return <button key={p} onClick={() => onUpdate({ anchor: { ...(box.anchor!), originPoint: p }})} className={`h-8 rounded-md flex items-center justify-center ${box.anchor?.originPoint === p ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-400 hover:bg-gray-500'}`} title={`Anchor to ${p}`}><Icon className="w-5 h-5" /></button>
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm">偏移 (px)</label>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        <input type="number" value={box.anchor.offset.x} onChange={e => onUpdate({ anchor: {...box.anchor!, offset: { ...box.anchor!.offset, x: parseInt(e.target.value, 10) || 0 }} })} placeholder="X" className="w-full p-1 bg-gray-700 border-gray-600 rounded"/>
                                        <input type="number" value={box.anchor.offset.y} onChange={e => onUpdate({ anchor: {...box.anchor!, offset: { ...box.anchor!.offset, y: parseInt(e.target.value, 10) || 0 }} })} placeholder="Y" className="w-full p-1 bg-gray-700 border-gray-600 rounded"/>
                                    </div>
                                </div>
                             </>)}
                         </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-gray-300 mb-2">水平对齐</label>
                                    <div className="grid grid-cols-4 gap-2"><button onClick={() => handleHorizontalAlign('start')} className="p-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">左</button><button onClick={() => handleHorizontalAlign('center')} className="p-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">中</button><button onClick={() => handleHorizontalAlign('end')} className="p-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">右</button><button onClick={() => handleHorizontalAlign('stretch')} className="p-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">拉伸</button></div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-300 mb-2">垂直对齐</label>
                                    <div className="grid grid-cols-4 gap-2"><button onClick={() => handleVerticalAlign('start')} className="p-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">上</button><button onClick={() => handleVerticalAlign('center')} className="p-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">中</button><button onClick={() => handleVerticalAlign('end')} className="p-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">下</button><button onClick={() => handleVerticalAlign('stretch')} className="p-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">拉伸</button></div>
                                </div>
                                <button onClick={handleCenterOnCanvas} className="w-full p-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">画布居中</button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-3 pt-2 border-t border-gray-700">
                                {box.constraints?.centerX !== undefined ? (<input type="text" value={box.constraints.centerX} onChange={e => handleConstraintChange('centerX', e.target.value)} className="w-full p-1 bg-gray-700 border-gray-600 rounded text-xs col-span-2" placeholder="水平偏移 (X)" />) : ( <> <input type="text" value={box.constraints.left || ''} onChange={e => handleConstraintChange('left', e.target.value)} className="w-full p-1 bg-gray-700 border-gray-600 rounded text-xs" placeholder="Left" /> <input type="text" value={box.constraints.right || ''} onChange={e => handleConstraintChange('right', e.target.value)} className="w-full p-1 bg-gray-700 border-gray-600 rounded text-xs" placeholder="Right" /></>)}
                                {box.constraints?.centerY !== undefined ? (<input type="text" value={box.constraints.centerY} onChange={e => handleConstraintChange('centerY', e.target.value)} className="w-full p-1 bg-gray-700 border-gray-600 rounded text-xs col-span-2" placeholder="垂直偏移 (Y)" />) : ( <> <input type="text" value={box.constraints.top || ''} onChange={e => handleConstraintChange('top', e.target.value)} className="w-full p-1 bg-gray-700 border-gray-600 rounded text-xs" placeholder="Top" /><input type="text" value={box.constraints.bottom || ''} onChange={e => handleConstraintChange('bottom', e.target.value)} className="w-full p-1 bg-gray-700 border-gray-600 rounded text-xs" placeholder="Bottom" /></>)}
                                <input type="text" value={box.constraints.width || ''} onChange={e => handleConstraintChange('width', e.target.value)} className="w-full p-1 bg-gray-700 border-gray-600 rounded text-xs" placeholder="Width" /><input type="text" value={box.constraints.height || ''} onChange={e => handleConstraintChange('height', e.target.value)} className="w-full p-1 bg-gray-700 border-gray-600 rounded text-xs" placeholder="Height" />
                            </div>
                        </>
                    )}
                    <div><label className="block text-sm font-medium text-gray-300 mb-1 mt-3">图层顺序 (Z-Index)</label><input type="number" {...zIndexProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
                </div></details>
            )}

            <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700"><summary className="font-semibold cursor-pointer">内容布局</summary><div className="mt-4 space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">布局模式</label>
                    <div className="flex items-center justify-between bg-gray-600/50 p-1 rounded-md">
                        <button onClick={() => onUpdate({ layoutMode: 'flex' })} className={`flex-1 p-1 rounded text-xs ${(box.layoutMode === 'flex' || !box.layoutMode) ? 'bg-blue-600' : ''}`}>Flexbox</button>
                        <button onClick={() => onUpdate({ layoutMode: 'grid' })} className={`flex-1 p-1 rounded text-xs ${box.layoutMode === 'grid' ? 'bg-blue-600' : ''}`}>Grid</button>
                    </div>
                 </div>
                 {box.layoutMode === 'grid' ? (
                     <div className="space-y-4">
                        <div>
                             <div className="flex justify-between items-center mb-1"><label className="text-sm">列 (Columns)</label><button onClick={()=>handleAddTrack('columns')} className="p-1 rounded-full bg-gray-600 hover:bg-gray-500"><PlusIcon className="w-4 h-4"/></button></div>
                             {gridCols.map((track, i) => {
                                 const [val, unit] = track.match(/(\d+\.?\d*)(\D+)?/s)?.slice(1) || [track, 'fr'];
                                 return <div key={i} className="flex gap-2 items-center"><input type="text" value={val} onChange={e => handleGridTrackChange('columns', i, e.target.value, unit)} className="w-full p-1 bg-gray-700 rounded"/><select value={unit} onChange={e=>handleGridTrackChange('columns', i, val, e.target.value)} className="p-1 bg-gray-700 rounded"><option>fr</option><option>px</option><option>%</option><option>auto</option></select><button onClick={()=>handleRemoveTrack('columns',i)} className="p-1 text-red-400">&times;</button></div>
                             })}
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1"><label className="text-sm">行 (Rows)</label><button onClick={()=>handleAddTrack('rows')} className="p-1 rounded-full bg-gray-600 hover:bg-gray-500"><PlusIcon className="w-4 h-4"/></button></div>
                            {gridRows.map((track, i) => {
                                 const [val, unit] = track.match(/(\d+\.?\d*)(\D+)?/s)?.slice(1) || [track, 'fr'];
                                 return <div key={i} className="flex gap-2 items-center"><input type="text" value={val} onChange={e => handleGridTrackChange('rows', i, e.target.value, unit)} className="w-full p-1 bg-gray-700 rounded"/><select value={unit} onChange={e=>handleGridTrackChange('rows', i, val, e.target.value)} className="p-1 bg-gray-700 rounded"><option>fr</option><option>px</option><option>%</option><option>auto</option></select><button onClick={()=>handleRemoveTrack('rows',i)} className="p-1 text-red-400">&times;</button></div>
                             })}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div><label className="text-sm">列间距</label><input type="number" {...columnGapProps} className="w-full p-1 bg-gray-700 rounded mt-1"/></div>
                             <div><label className="text-sm">行间距</label><input type="number" {...rowGapProps} className="w-full p-1 bg-gray-700 rounded mt-1"/></div>
                        </div>
                     </div>
                 ) : (
                    <FlexLayoutBoxPanel box={box} onUpdate={onUpdate} />
                 )}
            </div></details>
            <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700"><summary className="font-semibold cursor-pointer">外观</summary><div className="mt-4 space-y-4">
                <ColorSwatch label="背景颜色/渐变" value={box.backgroundColor} onChange={v => onUpdate({ backgroundColor: v })} />
                <div><label className="block text-sm font-medium text-gray-300 mb-1">圆角 (px)</label><input type="number" {...borderRadiusProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">内边距 (px)</label><div className="grid grid-cols-2 gap-2">
                    <input type="number" {...paddingTopProps} placeholder="上" className="w-full p-1 bg-gray-700 border border-gray-600 rounded-md" />
                    <input type="number" {...paddingBottomProps} placeholder="下" className="w-full p-1 bg-gray-700 border border-gray-600 rounded-md" />
                    <input type="number" {...paddingLeftProps} placeholder="左" className="w-full p-1 bg-gray-700 border border-gray-600 rounded-md" />
                    <input type="number" {...paddingRightProps} placeholder="右" className="w-full p-1 bg-gray-700 border border-gray-600 rounded-md" />
                </div></div>
            </div></details>
        </div>
    );
};

const TextSectionPanel = ({ section, onUpdate, parentIsGrid, mode, activeTextSelection, onApplyStyleToSelection }: { section: TextSection, onUpdate: (updates: Partial<TextSection>) => void, parentIsGrid: boolean, mode: 'template' | 'instance', activeTextSelection: {start: number, end: number} | null, onApplyStyleToSelection: (style: TextSpanStyle) => void }) => {
    
    const fontSizeProps = useNumericInput(section.style.fontSize, (val) => handleStyleUpdate({ fontSize: val }));
    const lineHeightProps = useNumericInput(section.style.lineHeight, (val) => onUpdate({ style: {...section.style, lineHeight: val} }), 1.5);
    const letterSpacingProps = useNumericInput(section.style.letterSpacing, (val) => handleStyleUpdate({ letterSpacing: val }));
    const rotationProps = useNumericInput(section.rotation, (val) => onUpdate({ rotation: val }));
    const curveProps = useNumericInput(section.style.curve, (val) => handleCurveUpdate(val));

    const handleStyleUpdate = (updates: Partial<TextStyleDefinition>) => {
        if (activeTextSelection && activeTextSelection.start !== activeTextSelection.end) {
             onApplyStyleToSelection(updates);
        } else {
            onUpdate({ style: { ...section.style, ...updates } });
        }
    };

    const parseCssUnitValue = (cssString: string | undefined): number => {
        if (!cssString) return 0;
        const match = cssString.match(/(-?\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
    };

    let shadowOffsetX = 0, shadowOffsetY = 0, shadowBlur = 0, shadowColor = 'rgba(0,0,0,0.5)';
    if (section.style.textShadow) {
        const shadowString = section.style.textShadow;
        const colorMatch = shadowString.match(/rgba?\(.+?\)|#([0-9a-fA-F]{3,8})/);
        shadowColor = colorMatch ? colorMatch[0] : 'rgba(0,0,0,0.5)';
        const offsetString = colorMatch ? shadowString.replace(colorMatch[0], '').trim() : shadowString;
        const offsets = offsetString.split(' ').map(p => parseCssUnitValue(p));
        shadowOffsetX = offsets[0] || 0;
        shadowOffsetY = offsets[1] || 0;
        shadowBlur = offsets[2] || 0;
    }

    let strokeWidth = 0, strokeColor = 'rgba(0,0,0,1)';
    if (section.style.textStroke) {
        const [widthPart, ...colorParts] = section.style.textStroke.split(' ');
        strokeWidth = parseCssUnitValue(widthPart);
        strokeColor = colorParts.join(' ') || 'rgba(0,0,0,1)';
    }

    const handleTextShadowChange = (key: 'offsetX' | 'offsetY' | 'blur' | 'color', value: string | number) => {
        const newValues = { offsetX: shadowOffsetX, offsetY: shadowOffsetY, blur: shadowBlur, color: shadowColor };
        if (key === 'color' && typeof value === 'string') newValues.color = value;
        else if (typeof value === 'number') newValues[key as 'offsetX' | 'offsetY' | 'blur'] = value;
        handleStyleUpdate({ textShadow: `${newValues.offsetX}px ${newValues.offsetY}px ${newValues.blur}px ${newValues.color}` });
    };

    const handleTextStrokeChange = (key: 'width' | 'color', value: string | number) => {
        const newValues = { width: strokeWidth, color: strokeColor };
        if (key === 'width' && typeof value === 'number') newValues.width = value;
        else if (key === 'color' && typeof value === 'string') newValues.color = value;
        handleStyleUpdate({ textStroke: `${newValues.width}px ${newValues.color}` });
    };
    
    const handleCurveUpdate = (value: number) => {
        onUpdate({ 
            style: {
                ...section.style, 
                curve: value,
                // When curving, force line height to a sensible default to avoid weirdness
                ...(value !== 0 ? { lineHeight: 1 } : {})
            } 
        });
    }
    
    const shadowXProps = useNumericInput(shadowOffsetX, (val) => handleTextShadowChange('offsetX', val));
    const shadowYProps = useNumericInput(shadowOffsetY, (val) => handleTextShadowChange('offsetY', val));
    const shadowBlurProps = useNumericInput(shadowBlur, (val) => handleTextShadowChange('blur', val));
    const strokeWidthProps = useNumericInput(strokeWidth, (val) => handleTextStrokeChange('width', val));

    return (
        <div className="space-y-4">
            {mode === 'template' && (
                <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open>
                    <summary className="font-semibold cursor-pointer">AI 与布局</summary>
                    <div className="mt-4 space-y-4">
                        <CommonSectionPanel section={section} onUpdate={onUpdate} />
                        {parentIsGrid ? (
                             <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                                <div><label className="text-sm">列 (Column)</label><input type="text" value={section.gridColumn || ''} onChange={e => onUpdate({ gridColumn: e.target.value || undefined })} placeholder="e.g. 1 / 2" className="w-full p-1 bg-gray-700 border-gray-600 rounded mt-1" /></div>
                                <div><label className="text-sm">行 (Row)</label><input type="text" value={section.gridRow || ''} onChange={e => onUpdate({ gridRow: e.target.value || undefined })} placeholder="e.g. 1 / 3" className="w-full p-1 bg-gray-700 border-gray-600 rounded mt-1" /></div>
                            </div>
                        ) : (
                            <FlexItemPanel section={section} onUpdate={onUpdate} />
                        )}
                    </div>
                </details>
            )}
            <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">内容与字体</summary><div className="mt-4 space-y-4">
                <p className="text-xs text-gray-400 p-2 bg-gray-800 rounded-md">请直接在画布上选择并修改文本内容与样式。</p>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">字体</label><select value={section.style.fontFamily} onChange={e => handleStyleUpdate({ fontFamily: e.target.value })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white">{FONT_FAMILIES.map(font => <option key={font.name} value={font.family}>{font.name}</option>)}</select></div>
                <div className="flex gap-4"><div className="flex-1"><label className="block text-sm font-medium text-gray-400 mb-1">字号</label><input type="number" {...fontSizeProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" /></div><div className="flex-1"><label className="block text-sm font-medium text-gray-400 mb-1">字重</label><select value={section.style.fontWeight} onChange={e => handleStyleUpdate({ fontWeight: parseInt(e.target.value, 10) })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"><option value={400}>常规</option><option value={700}>加粗</option><option value="900">特粗</option></select></div></div>
                <div className="flex gap-4"><div className="flex-1"><label className="block text-sm font-medium text-gray-400 mb-1">行间距</label><input type="number" step="0.1" {...lineHeightProps} disabled={!!section.style.curve && section.style.curve !== 0} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white disabled:opacity-50" /></div><div className="flex-1"><label className="block text-sm font-medium text-gray-400 mb-1">字间距 (px)</label><input type="number" {...letterSpacingProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" /></div></div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">对齐</label><div className="grid grid-cols-4 gap-2"><button onClick={() => onUpdate({ style: {...section.style, textAlign: 'left'} })} className={`p-2 rounded-md ${section.style.textAlign === 'left' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextLeft className="w-5 h-5 mx-auto" /></button><button onClick={() => onUpdate({ style: {...section.style, textAlign: 'center'} })} className={`p-2 rounded-md ${section.style.textAlign === 'center' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextCenter className="w-5 h-5 mx-auto" /></button><button onClick={() => onUpdate({ style: {...section.style, textAlign: 'right'} })} className={`p-2 rounded-md ${section.style.textAlign === 'right' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextRight className="w-5 h-5 mx-auto" /></button><button onClick={() => onUpdate({ style: {...section.style, textAlign: 'justify'} })} className={`p-2 rounded-md ${section.style.textAlign === 'justify' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextJustifyIcon className="w-5 h-5 mx-auto" /></button></div></div>
                 <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">文字方向</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => onUpdate({ style: {...section.style, writingMode: 'horizontal-tb'} })} className={`p-2 rounded-md ${(!section.style.writingMode || section.style.writingMode === 'horizontal-tb') ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}>水平</button>
                        <button onClick={() => onUpdate({ style: {...section.style, writingMode: 'vertical-rl'} })} className={`p-2 rounded-md ${section.style.writingMode === 'vertical-rl' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}>垂直</button>
                    </div>
                </div>
            </div></details>
             <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">效果</summary><div className="mt-4 space-y-4">
                <ColorSwatch label="颜色" value={section.style.color} onChange={v => handleStyleUpdate({ color: v })} />
                <div><label className="block text-sm font-medium text-gray-300 mb-1">旋转 (°)</label><input type="number" {...rotationProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">文字弯曲</label>
                    <div className="flex items-center gap-2">
                        <input type="range" min="-100" max="100" value={section.style.curve || 0} onChange={e => handleCurveUpdate(parseInt(e.target.value, 10))} className="flex-grow h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                        <input type="number" min="-100" max="100" {...curveProps} className="w-20 p-1 bg-gray-700 border border-gray-600 rounded-md text-center" />
                    </div>
                </div>
                <div><label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"><input type="checkbox" checked={!!section.style.textShadow} onChange={() => handleStyleUpdate({ textShadow: section.style.textShadow ? undefined : '2px 2px 4px rgba(0,0,0,0.5)' })} className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500"/>阴影</label>
                    {section.style.textShadow && <div className="space-y-2 pl-6">
                        <div className="grid grid-cols-3 gap-2 text-xs"><span>X</span><span>Y</span><span>模糊</span></div>
                        <div className="grid grid-cols-3 gap-2">
                            <input type="number" {...shadowXProps} className="w-full p-1 bg-gray-600 rounded-md" />
                            <input type="number" {...shadowYProps} className="w-full p-1 bg-gray-600 rounded-md" />
                            <input type="number" {...shadowBlurProps} className="w-full p-1 bg-gray-600 rounded-md" />
                        </div>
                        <ColorSwatch value={shadowColor} onChange={v => handleTextShadowChange('color', v)} allowGradient={false}/>
                    </div>}
                </div>
                <div><label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"><input type="checkbox" checked={!!section.style.textStroke} onChange={() => handleStyleUpdate({ textStroke: section.style.textStroke ? undefined : '1px rgba(255,255,255,1)' })} className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500"/>描边</label>
                    {section.style.textStroke && <div className="space-y-2 pl-6">
                        <div><label className="text-xs">宽度 (px)</label><input type="number" {...strokeWidthProps} className="w-full p-1 bg-gray-600 rounded-md" /></div>
                        <ColorSwatch label="颜色" value={strokeColor} onChange={v => handleTextStrokeChange('color', v)} allowGradient={true} />
                    </div>}
                </div>
            </div></details>
        </div>
    );
};

const ImageSectionPanel = ({ section, onUpdate, onFileUpload, isProcessing, posterWidth, parentIsGrid, mode }: { section: ImageSection, onUpdate: (updates: Partial<ImageSection>) => void, onFileUpload: any, isProcessing: boolean, posterWidth: number, parentIsGrid: boolean, mode: 'template' | 'instance' }) => {
    const rotationProps = useNumericInput(section.rotation, (val) => onUpdate({ rotation: val }));
    
    return (
        <div className="space-y-4">
            {section.imageUrl ? (
                <img src={section.imageUrl} alt="preview" className="rounded-lg w-full"/>
            ) : (
                <div className="w-full aspect-video bg-gray-700 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-400">
                        <PhotoIcon className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-sm">暂无图片</p>
                    </div>
                </div>
            )}
            {mode === 'template' && (
                <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open>
                    <summary className="font-semibold cursor-pointer">AI 与布局</summary>
                    <div className="mt-4 space-y-4">
                        <CommonSectionPanel section={section} onUpdate={onUpdate} />
                         {parentIsGrid ? (
                             <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                                <div><label className="text-sm">列 (Column)</label><input type="text" value={section.gridColumn || ''} onChange={e => onUpdate({ gridColumn: e.target.value || undefined })} placeholder="e.g. 1 / 2" className="w-full p-1 bg-gray-700 border-gray-600 rounded mt-1" /></div>
                                <div><label className="text-sm">行 (Row)</label><input type="text" value={section.gridRow || ''} onChange={e => onUpdate({ gridRow: e.target.value || undefined })} placeholder="e.g. 1 / 3" className="w-full p-1 bg-gray-700 border-gray-600 rounded mt-1" /></div>
                            </div>
                         ) : (
                            <FlexItemPanel section={section} onUpdate={onUpdate} />
                         )}
                    </div>
                </details>
            )}
             <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">图片与样式</summary><div className="mt-4 space-y-4">
                <div><label className="block text-sm font-medium text-gray-400 mb-1">图片提示词 (用于 AI 生成)</label><textarea value={section.prompt} onChange={(e) => onUpdate({ prompt: e.target.value })} placeholder="输入提示词以生成图片" className="w-full h-24 p-2 bg-gray-700 border border-gray-600 rounded-md text-white"/></div>
                <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept='image/*'; i.onchange = e => onFileUpload((e.target as HTMLInputElement).files?.[0], { maxWidth: posterWidth, quality: 0.8 }, (b64:string) => onUpdate({ imageUrl: b64 })); i.click(); }} disabled={isProcessing} className="w-full flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm disabled:bg-gray-500">{isProcessing ? <SpinnerIcon className="w-5 h-5"/> : <ArrowUpTrayIcon className="w-5 h-5"/>} 上传图片</button>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">填充模式</label><select value={section.objectFit || 'cover'} onChange={e => onUpdate({ objectFit: e.target.value as ImageSection['objectFit'] })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"><option value="cover">覆盖</option><option value="contain">完整显示</option></select></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">旋转 (°)</label><input type="number" {...rotationProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
            </div></details>
        </div>
    );
};

const findElementInTemplate = (template: PosterTemplate, path: string[]): { parent: LayoutBox | PosterTemplate | null, element: ArticleSection | DecorationElement | null } => {
    if (!path || path.length === 0) return { parent: null, element: null };
    
    let parent: LayoutBox | PosterTemplate | null = template;
    let element: ArticleSection | DecorationElement | null = null;
    let currentLevel: (ArticleSection | DecorationElement)[] = [...template.layoutBoxes, ...(template.decorations || [])];

    for (let i = 0; i < path.length; i++) {
        const id = path[i];
        const found = currentLevel.find(item => item.id === id);

        if (!found) return { parent: null, element: null };
        
        element = found;

        if (i < path.length - 1) { // If not the last item, it must be a container to traverse deeper
            if (found.type === 'layout_box') {
                parent = found;
                currentLevel = found.sections;
            } else {
                return { parent: null, element: null };
            }
        }
    }
    return { parent, element };
};


export const InspectorPanel = ({
    selectedElement,
    template,
    onUpdate,
    onGlobalUpdate,
    onFileUpload,
    isProcessing,
    posterWidth,
    activeTextSelection,
    onApplyStyleToSelection,
    mode = 'template'
}: {
    selectedElement: { element: ArticleSection | DecorationElement | null, path: string[] };
    template: PosterTemplate;
    onUpdate: (updates: any) => void;
    onGlobalUpdate: (updates: Partial<PosterTemplate>) => void;
    onFileUpload: any;
    isProcessing: boolean;
    posterWidth: number;
    mode?: 'template' | 'instance';
    activeTextSelection?: { start: number, end: number } | null;
    onApplyStyleToSelection?: (style: TextSpanStyle) => void;
}) => {
    const allLayoutBoxes = useMemo(() => {
        if (!template) return [];
        return getAllLayoutBoxes(template.layoutBoxes);
    }, [template]);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Stop propagation to prevent canvas click handlers from firing,
        // which would incorrectly exit text editing mode.
        e.stopPropagation();
    };

    const panelContent = () => {
        if (!selectedElement || !selectedElement.element) {
            if (mode === 'template') {
                return <GlobalPanel template={template} onUpdate={onGlobalUpdate} onFileUpload={onFileUpload} isProcessing={isProcessing} />;
            }
            return <div className="text-gray-400 text-center p-4">请从画布中选择一个元素进行编辑。</div>;
        }

        const { element, path } = selectedElement;
        const { parent } = findElementInTemplate(template, path);
        const parentIsGrid = !!parent && 'layoutMode' in parent && parent.layoutMode === 'grid';
        
        switch (element.type) {
            case 'layout_box':
                return <LayoutBoxPanel box={element} onUpdate={onUpdate} parentIsGrid={parentIsGrid} template={template} mode={mode} />;
            case 'text':
                return <TextSectionPanel section={element} onUpdate={onUpdate} parentIsGrid={parentIsGrid} mode={mode} activeTextSelection={activeTextSelection || null} onApplyStyleToSelection={onApplyStyleToSelection!} />;
            case 'image':
                return <ImageSectionPanel section={element} onUpdate={onUpdate} onFileUpload={onFileUpload} isProcessing={isProcessing} posterWidth={posterWidth} parentIsGrid={parentIsGrid} mode={mode} />;
            case 'decoration':
                 return <DecorationPanel 
                    decoration={element} 
                    onUpdate={onUpdate} 
                    onDelete={() => {}} 
                    onUpload={(file) => onFileUpload(file, { maxWidth: 512, quality: 0.8 }, (b64:string) => onUpdate({ imageUrl: b64 }))}
                    availableLayoutBoxes={allLayoutBoxes}
                    parentSize={{ width: posterWidth, height: template.height }}
                    template={template}
                />;
            default:
                return <div className="text-gray-400 text-center p-4">请选择一个元素进行检查。</div>;
        }
    };
    
    return (
        <div onMouseDown={handleMouseDown}>
            {panelContent()}
        </div>
    );
};