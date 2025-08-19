import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ArticleSection, AspectRatio, TextStyleDefinition, TextSection, ImageSection, LayoutBox, TextSpan, TextSpanStyle } from '../types';
import { FONT_FAMILIES, TEMPLATE_TEXT_ROLES } from '../constants';
import { SpinnerIcon, ArrowPathIcon, ArrowUpTrayIcon, TrashIcon, AlignTextCenter, AlignTextLeft, AlignTextRight, AlignTextJustifyIcon, PaintBrushIcon, HighlighterIcon, QuestionMarkCircleIcon, LockClosedIcon, LockOpenIcon } from './icons';
import { RgbaColorPicker as ColorPicker } from './RgbaColorPicker';
import { Tooltip } from './Tooltip';
import { FlexLayoutBoxPanel } from './PosterTemplateEditor';
import { useNumericInput } from '../hooks/useNumericInput';


const ColorSwatch = ({ label, value, onChange }: { label?: string, value: string, onChange: (v: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    return (
        <div>
            {label && <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>}
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
                />
            )}
        </div>
    );
};

const FlexGrowPreview = ({ sections }: { sections: ArticleSection[] }) => {
    const flexibleSections = sections.filter(s => (s.flexGrow ?? 0) > 0);
    const totalGrow = useMemo(() => flexibleSections.reduce((sum, s) => sum + (s.flexGrow ?? 0), 0), [flexibleSections]);

    if (totalGrow === 0) return null;

    return (
        <div className="w-full h-3 bg-gray-600 rounded-full flex overflow-hidden my-1">
            {flexibleSections.map(s => (
                <div key={s.id} className="h-full bg-blue-500" style={{ width: `${((s.flexGrow ?? 0) / totalGrow) * 100}%` }} />
            ))}
        </div>
    );
};

export const BlockEditorPanel = ({
    section,
    parentBox,
    onUpdate,
    onDelete,
    isTemplateMode = false,
    onRegenerate,
    onUpload,
    isProcessing,
    isFormatPainterActive,
    onCopyStyle,
}: {
    section: ArticleSection;
    parentBox?: LayoutBox; // Pass the parent to get siblings for the preview
    onUpdate: (updates: Partial<ArticleSection>) => void;
    onDelete: () => void;
    isTemplateMode?: boolean,
    onRegenerate?: (prompt: string, aspectRatio: AspectRatio) => void,
    onUpload?: (file: File) => void,
    isProcessing?: boolean;
    isFormatPainterActive?: boolean;
    onCopyStyle?: () => void;
}) => {
    
    const handleStyleUpdate = (updates: Partial<TextStyleDefinition>) => {
        if (section.type !== 'text') return;
        onUpdate({ style: { ...section.style, ...updates } });
    };

    const parseCssUnit = (cssString: string | undefined): { value: number, unit: string } => {
        if (!cssString) return { value: 0, unit: 'px' };
        const match = cssString.match(/(-?\d+\.?\d*)([a-z%]*)/);
        return match ? { value: parseFloat(match[1]), unit: match[2] } : { value: 0, unit: 'px' };
    };

    let shadowOffsetX = 0, shadowOffsetY = 0, shadowBlur = 0, shadowColor = 'rgba(0,0,0,0.5)';
    if (section.type === 'text' && section.style.textShadow) {
        const shadowString = section.style.textShadow;
        const colorMatch = shadowString.match(/rgba?\(.+?\)|#([0-9a-fA-F]{3,8})/);
        shadowColor = colorMatch ? colorMatch[0] : 'rgba(0,0,0,0.5)';
        const offsetString = colorMatch ? shadowString.replace(colorMatch[0], '').trim() : shadowString;
        const offsets = offsetString.split(' ').map(p => parseCssUnit(p).value);
        shadowOffsetX = offsets[0] || 0;
        shadowOffsetY = offsets[1] || 0;
        shadowBlur = offsets[2] || 0;
    }

    let strokeWidth = 0, strokeColor = 'rgba(0,0,0,1)';
    if (section.type === 'text' && section.style.textStroke) {
        const [widthPart, ...colorParts] = section.style.textStroke.split(' ');
        strokeWidth = parseCssUnit(widthPart).value;
        strokeColor = colorParts.join(' ') || 'rgba(0,0,0,1)';
    }

    const handleTextShadowChange = (key: 'offsetX' | 'offsetY' | 'blur' | 'color', value: string | number) => {
        if (section.type !== 'text') return;
        const newValues = { offsetX: shadowOffsetX, offsetY: shadowOffsetY, blur: shadowBlur, color: shadowColor };
        if (key === 'color' && typeof value === 'string') newValues.color = value;
        else if (typeof value === 'number') newValues[key as 'offsetX' | 'offsetY' | 'blur'] = value;
        handleStyleUpdate({ textShadow: `${newValues.offsetX}px ${newValues.offsetY}px ${newValues.blur}px ${newValues.color}` });
    };

    const handleTextStrokeChange = (key: 'width' | 'color', value: string | number) => {
        if (section.type !== 'text') return;
        const newValues = { width: strokeWidth, color: strokeColor };
        if (key === 'width' && typeof value === 'number') newValues.width = value;
        else if (key === 'color' && typeof value === 'string') newValues.color = value;
        handleStyleUpdate({ textStroke: `${newValues.width}px ${newValues.color}` });
    };

    const flexGrowProps = useNumericInput(section.flexGrow, (val) => onUpdate({ flexGrow: val }));
    const rotationProps = useNumericInput(section.rotation, (val) => onUpdate({ rotation: val }));
    
    const fontSizeProps = section.type === 'text' ? useNumericInput(section.style.fontSize, (val) => handleStyleUpdate({ fontSize: val })) : null;
    const lineHeightProps = section.type === 'text' ? useNumericInput(section.style.lineHeight, (val) => handleStyleUpdate({ lineHeight: val }), 1.5) : null;
    const letterSpacingProps = section.type === 'text' ? useNumericInput(section.style.letterSpacing, (val) => handleStyleUpdate({ letterSpacing: val })) : null;
    const shadowXProps = useNumericInput(shadowOffsetX, (val) => handleTextShadowChange('offsetX', val));
    const shadowYProps = useNumericInput(shadowOffsetY, (val) => handleTextShadowChange('offsetY', val));
    const shadowBlurProps = useNumericInput(shadowBlur, (val) => handleTextShadowChange('blur', val));
    const strokeWidthProps = useNumericInput(strokeWidth, (val) => handleTextStrokeChange('width', val));
    const imageHeightProps = section.type === 'image' ? useNumericInput(section.height, (val) => onUpdate({ height: val })) : null;
    
    if (section.type === 'layout_box') {
        return (
             <div className="space-y-4 animate-pop-in">
                 <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open>
                    <summary className="font-semibold cursor-pointer">Flexbox 布局</summary>
                    <div className="mt-4">
                        <FlexLayoutBoxPanel box={section} onUpdate={(u) => onUpdate(u)} />
                    </div>
                </details>
             </div>
        )
    }

    return (
        <div className="space-y-4 animate-pop-in">
             <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open>
                <summary className="font-semibold cursor-pointer">AI 与布局</summary>
                <div className="mt-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">区块角色</label>
                        <input
                            list="role-suggestions"
                            value={section.role}
                            onChange={(e) => onUpdate({ role: e.target.value })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        />
                         <datalist id="role-suggestions">
                            {TEMPLATE_TEXT_ROLES.map(role => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                        </datalist>
                    </div>
                     <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-gray-300 mb-1">
                            给 AI 的指令
                             <Tooltip text="为这个区块添加特别说明，帮助 AI 更准确地生成内容。例如：'这是一个促销活动的截止日期，请使用醒目的风格'。">
                                <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                            </Tooltip>
                        </label>
                        <textarea
                            value={section.aiInstructions || ''}
                            onChange={e => onUpdate({ aiInstructions: e.target.value })}
                            placeholder="例如：这是logo，请保持不变"
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
                            onClick={() => onUpdate({ isContentLocked: !section.isContentLocked })}
                            className={`${
                                section.isContentLocked ? 'bg-red-600' : 'bg-gray-500'
                            } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`}
                            role="switch"
                            aria-checked={section.isContentLocked}
                            id="content-lock-toggle"
                        >
                            <span
                                aria-hidden="true"
                                className={`${
                                    section.isContentLocked ? 'translate-x-5' : 'translate-x-0'
                                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
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
                            value={section.importance || 'required'}
                            onChange={(e) => onUpdate({ importance: e.target.value as any })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                        >
                            <option value="required">必需</option>
                            <option value="recommended">推荐</option>
                            <option value="optional">可选</option>
                        </select>
                    </div>
                     <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-gray-300 mb-1">
                            空间分配权重
                            <Tooltip text="当容器内有剩余空间时，此元素将按此权重比例拉伸以填充空间。0代表不拉伸。系统会自动计算比例，无需加到100。">
                                <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                            </Tooltip>
                        </label>
                        <input type="number" {...flexGrowProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
                        {parentBox && <FlexGrowPreview sections={parentBox.sections} />}
                    </div>
                    <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-md">
                        <label htmlFor="compress-toggle" className="flex items-center gap-1 text-sm font-medium text-gray-300">
                            防止内容被压缩
                            <Tooltip text="开启后，当容器空间不足时，此元素将顽固地保持其原始尺寸，不会被压缩。适合Logo和重要标题。">
                                <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                            </Tooltip>
                        </label>
                        <button
                            type="button"
                            onClick={() => onUpdate({ flexShrink: (section.flexShrink ?? 1) === 0 ? 1 : 0 })}
                            className={`${
                                (section.flexShrink ?? 1) === 0 ? 'bg-blue-600' : 'bg-gray-500'
                            } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`}
                            role="switch"
                            aria-checked={(section.flexShrink ?? 1) === 0}
                            id="compress-toggle"
                        >
                            <span
                                aria-hidden="true"
                                className={`${
                                    (section.flexShrink ?? 1) === 0 ? 'translate-x-5' : 'translate-x-0'
                                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                        </button>
                    </div>
                </div>
            </details>

            {section.type === 'text' && (
                <div className="space-y-4">
                    <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">内容和字体</summary><div className="mt-4 space-y-4">
                        <div className="flex justify-between items-center mb-1">
                             <label className="block text-sm font-medium text-gray-400">文本内容</label>
                            {isTemplateMode && onCopyStyle && section.type === 'text' && (
                                <Tooltip text={isFormatPainterActive ? "点击文本区块以粘贴样式" : "复制此文本样式"}>
                                    <button
                                        onClick={onCopyStyle}
                                        className={`p-2 rounded-md ${isFormatPainterActive ? 'bg-blue-600 animate-pulse' : 'bg-gray-600 hover:bg-gray-500'}`}
                                    >
                                        <HighlighterIcon className="w-5 h-5"/>
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                         <p className="text-xs text-gray-400 p-2 bg-gray-800 rounded-md">请直接在画布上修改文本内容。</p>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">字体</label>
                            <select value={section.style.fontFamily} onChange={e => handleStyleUpdate({ fontFamily: e.target.value })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white">
                            {FONT_FAMILIES.map(font => <option key={font.name} value={font.family}>{font.name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1"><label className="block text-sm font-medium text-gray-400 mb-1">字号</label><input type="number" {...fontSizeProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" /></div>
                            <div className="flex-1"><label className="block text-sm font-medium text-gray-400 mb-1">字重</label><select value={section.style.fontWeight} onChange={e => handleStyleUpdate({ fontWeight: parseInt(e.target.value, 10) })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"><option value={400}>常规</option><option value={700}>加粗</option><option value="900">特粗</option></select></div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1"><label className="block text-sm font-medium text-gray-400 mb-1">行间距</label><input type="number" step="0.1" {...lineHeightProps} disabled={!!section.style.curve && section.style.curve !== 0} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white disabled:opacity-50" /></div>
                            <div className="flex-1"><label className="block text-sm font-medium text-gray-400 mb-1">字间距 (px)</label><input type="number" {...letterSpacingProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" /></div>
                        </div>
                        <ColorSwatch label="颜色" value={section.style.color} onChange={v => handleStyleUpdate({ color: v })} />
                        <div><label className="block text-sm font-medium text-gray-400 mb-1">对齐</label><div className="grid grid-cols-4 gap-2">
                            <button onClick={() => handleStyleUpdate({ textAlign: 'left'})} className={`p-2 rounded-md ${section.style.textAlign === 'left' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextLeft className="w-5 h-5 mx-auto" /></button>
                            <button onClick={() => handleStyleUpdate({ textAlign: 'center'})} className={`p-2 rounded-md ${section.style.textAlign === 'center' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextCenter className="w-5 h-5 mx-auto" /></button>
                            <button onClick={() => handleStyleUpdate({ textAlign: 'right'})} className={`p-2 rounded-md ${section.style.textAlign === 'right' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextRight className="w-5 h-5 mx-auto" /></button>
                            <button onClick={() => handleStyleUpdate({ textAlign: 'justify'})} className={`p-2 rounded-md ${section.style.textAlign === 'justify' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextJustifyIcon className="w-5 h-5 mx-auto" /></button>
                        </div></div>
                    </div></details>
                    <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700"><summary className="font-semibold cursor-pointer">效果</summary><div className="mt-4 space-y-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">旋转 (°)</label><input type="number" {...rotationProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">文字弯曲</label><input type="range" min="-100" max="100" value={section.style.curve || 0} onChange={e => handleStyleUpdate({ curve: parseInt(e.target.value, 10) })} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" /></div>
                        <div><label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"><input type="checkbox" checked={!!section.style.textShadow} onChange={() => handleStyleUpdate({ textShadow: section.style.textShadow ? undefined : '2px 2px 4px rgba(0,0,0,0.5)' })} className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500"/>阴影</label>
                            {section.style.textShadow && <div className="space-y-2 pl-6">
                                <div className="grid grid-cols-3 gap-2 text-xs"><span>X</span><span>Y</span><span>模糊</span></div>
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="number" {...shadowXProps} className="w-full p-1 bg-gray-600 rounded-md" />
                                    <input type="number" {...shadowYProps} className="w-full p-1 bg-gray-600 rounded-md" />
                                    <input type="number" {...shadowBlurProps} className="w-full p-1 bg-gray-600 rounded-md" />
                                </div>
                                <ColorSwatch value={shadowColor} onChange={v => handleTextShadowChange('color', v)} />
                            </div>}
                        </div>
                        <div><label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"><input type="checkbox" checked={!!section.style.textStroke} onChange={() => handleStyleUpdate({ textStroke: section.style.textStroke ? undefined : '1px rgba(255,255,255,1)' })} className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500"/>描边</label>
                            {section.style.textStroke && <div className="space-y-2 pl-6">
                                <div><label className="text-xs">宽度 (px)</label><input type="number" {...strokeWidthProps} className="w-full p-1 bg-gray-600 rounded-md" /></div>
                                <ColorSwatch label="颜色" value={strokeColor} onChange={v => handleTextStrokeChange('color', v)} />
                            </div>}
                        </div>
                    </div></details>
                </div>
            )}

            {section.type === 'image' && (
                <div className="space-y-4">
                    <img src={section.imageUrl} alt="illustration" className="rounded-lg w-full"/>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">图片提示词 {isTemplateMode && "(占位符)"}</label>
                        <textarea value={section.prompt} onChange={(e) => onUpdate({ prompt: e.target.value })} placeholder="输入插图的提示词" className="w-full h-24 p-2 bg-gray-700 border border-gray-600 rounded-md text-white"/>
                    </div>
                    {(isTemplateMode) && (
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="block text-sm font-medium text-gray-300 mb-1">图片填充</label><select value={section.objectFit || 'cover'} onChange={e => onUpdate({ objectFit: e.target.value as ImageSection['objectFit'] })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"><option value="cover">裁剪填充</option><option value="contain">完整显示</option></select></div>
                            <div><label className="block text-sm font-medium text-gray-300 mb-1">区块高度 (px)</label><input type="number" {...imageHeightProps} placeholder="自动" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
                        </div>
                    )}
                     <div><label className="block text-sm font-medium text-gray-300 mb-1">旋转 (°)</label><input type="number" {...rotationProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
                    {!isTemplateMode && onRegenerate && (<button onClick={() => onRegenerate(section.prompt, '1:1')} disabled={isProcessing || !section.prompt} className="w-full flex items-center justify-center gap-2 p-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm disabled:bg-gray-500">{isProcessing ? <SpinnerIcon className="w-5 h-5"/> : <ArrowPathIcon className="w-5 h-5"/>}重新生成</button>)}
                    {onUpload && (<button onClick={() => {const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=(e)=>{const file=(e.target as HTMLInputElement).files?.[0];if(file)onUpload(file);};input.click();}} className="w-full flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm"><ArrowUpTrayIcon className="w-5 h-5"/>上传替换</button>)}
                </div>
            )}
            <button onClick={onDelete} className="w-full flex items-center justify-center gap-2 p-2 mt-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"><TrashIcon className="w-5 h-5"/> 删除区块</button>
        </div>
    );
}