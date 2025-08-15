import React, { useState, useLayoutEffect, useRef, useCallback } from 'react';
import { LongArticleTemplate, TextStyleDefinition, ResultData, ArticleSection, TextSection, ImageSection, DecorationElement, PosterTemplate } from '../types';
import { LongArticleContent } from './LongArticleEditor';
import { BlockEditorPanel } from './BlockEditorPanel';
import { DecorationPanel } from './DecorationPanel';
import { EditableDecorationElement } from './EditableDecorationElement';
import { XMarkIcon, AddTextIcon, PhotoIcon, SpinnerIcon, SparklesIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, ArrowUpTrayIcon } from './icons';
import { RgbaColorPicker as ColorPicker } from './RgbaColorPicker';
import { resizeAndCompressImage } from './utils/imageUtils';

type Guide = { x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number; dist?: number };

const NEW_IMAGE_PLACEHOLDER = `data:image/svg+xml;base64,${btoa(`<svg width="1080" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e9e9e9"/><text x="50%" y="50%" font-family="sans-serif" font-size="48" fill="#a0a0a0" text-anchor="middle" dy=".3em">New Image Block</text></svg>`)}`;
const NEW_DECORATION_PLACEHOLDER = `data:image/svg+xml;base64,${btoa(`<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#d1d5db" rx="10"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#6b7280" text-anchor="middle" dy=".3em">Decoration</text></svg>`)}`;
const DEFAULT_TEXT_STYLE: TextStyleDefinition = { fontFamily: "'Noto Sans SC', sans-serif", fontSize: 24, fontWeight: 400, color: '#333333', textAlign: 'left', lineHeight: 1.8 };

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


export const LongArticleTemplateEditor = ({ initialTemplate, onSave, onCancel }: { initialTemplate: LongArticleTemplate, onSave: (template: LongArticleTemplate) => void; onCancel: () => void; }) => {
    const [template, setTemplate] = useState<LongArticleTemplate>(initialTemplate);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<'section' | 'decoration' | null>(null);
    const [activeTab, setActiveTab] = useState('block');
    const [isProcessing, setIsProcessing] = useState(false);
    const [copiedStyle, setCopiedStyle] = useState<TextStyleDefinition | null>(null);
    const [saveError, setSaveError] = useState('');

    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [guides, setGuides] = useState<Guide[]>([]);
    const editorWrapperRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [contentHeight, setContentHeight] = useState(0);

    const lastPanPointRef = useRef({ x: 0, y: 0 });

    const handleCopyStyle = () => {
        if (selectedType === 'section') {
            const section = template.sections.find(s => s.id === selectedId);
            if (section?.type === 'text') setCopiedStyle(section.style);
        }
    };
    
    const handleElementClick = (id: string, type: 'section' | 'decoration') => {
        if (copiedStyle && type === 'section') {
            const targetSection = template.sections.find(s => s.id === id);
            if (targetSection?.type === 'text') {
                handleSectionUpdate(id, { style: copiedStyle });
                setCopiedStyle(null);
                setSelectedId(id); setSelectedType(type);
                return;
            }
        }
        setSelectedId(id); setSelectedType(type); setCopiedStyle(null);
    };

    const fitToScreen = useCallback(() => {
        const wrapper = editorWrapperRef.current;
        if (!wrapper || !template.width) return;
        const wrapperWidth = wrapper.clientWidth;
        if (wrapperWidth === 0) return;
        const scale = (wrapperWidth / template.width) * 0.95;
        const newPanX = (wrapperWidth - template.width * scale) / 2;
        const newPanY = 20;
        setZoom(scale); setPan({ x: newPanX, y: newPanY });
    }, [template.width]);

    useLayoutEffect(() => {
        const observer = new ResizeObserver(() => {
            fitToScreen();
            if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
        });
        const currentWrapper = editorWrapperRef.current;
        if (currentWrapper) observer.observe(currentWrapper);
        return () => { if (currentWrapper) observer.unobserve(currentWrapper); };
    }, [fitToScreen]);
    
    useLayoutEffect(() => {
        if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
    }, [template]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target !== editorWrapperRef.current) return;
        
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        editorWrapperRef.current!.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        e.preventDefault();

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - lastPanPointRef.current.x;
            const dy = moveEvent.clientY - lastPanPointRef.current.y;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastPanPointRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
        };

        const handleMouseUp = () => {
            if (editorWrapperRef.current) editorWrapperRef.current.style.cursor = 'grab';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, []);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const { clientX, clientY, deltaY } = e;
        const wrapperRect = editorWrapperRef.current!.getBoundingClientRect();
        const mouseX = clientX - wrapperRect.left, mouseY = clientY - wrapperRect.top;
        const pointX = (mouseX - pan.x) / zoom, pointY = (mouseY - pan.y) / zoom;
        const newZoom = Math.max(0.1, Math.min(5, zoom * (1 - deltaY * 0.001)));
        setZoom(newZoom);
        setPan({ x: mouseX - pointX * newZoom, y: mouseY - pointY * newZoom });
    };

    const handleUpdate = <K extends keyof LongArticleTemplate>(key: K, value: LongArticleTemplate[K]) => {
        setTemplate(prev => ({ ...prev, [key]: value })); setSaveError('');
    };
    
    const handleBackgroundUpdate = (updates: Partial<LongArticleTemplate['background']>) => setTemplate(prev => ({ ...prev, background: {...prev.background, ...updates} }));
    const handleContentContainerUpdate = (updates: Partial<LongArticleTemplate['contentContainer']>) => setTemplate(prev => ({ ...prev, contentContainer: {...prev.contentContainer, ...updates} }));
    const handleSectionUpdate = (id: string, updates: Partial<ArticleSection>) => setTemplate(prev => ({ ...prev, sections: prev.sections.map(s => s.id === id ? ({ ...s, ...updates }) : s) as (TextSection | ImageSection)[]}));
    const handleDecorationUpdate = (id: string, updates: Partial<DecorationElement>) => setTemplate(prev => ({ ...prev, decorations: (prev.decorations || []).map(d => d.id === id ? { ...d, ...updates } : d)}));
    
    const handleAddBlock = (type: 'text' | 'image' | 'decoration') => {
        const newId = `${type}-${Date.now()}`;
        if (type === 'decoration') {
            const newDeco: DecorationElement = { id: newId, type: 'decoration', role: 'new-decoration', imageUrl: NEW_DECORATION_PLACEHOLDER, position: { xPercent: 30, yPx: 100 }, sizePercent: { width: 20 }, angle: 0, zIndex: 10, scope: 'page' };
            setTemplate(prev => ({ ...prev, decorations: [...(prev.decorations || []), newDeco] }));
            setSelectedId(newId); setSelectedType('decoration');
            return;
        }
        const newBlock: TextSection | ImageSection = type === 'text'
            ? { id: newId, type: 'text', role: 'body', content: [{ text: '新文本区块', style: {} }], style: DEFAULT_TEXT_STYLE, marginTop: 0, marginBottom: 16 }
            : { id: newId, type: 'image', role: 'illustration', imageUrl: NEW_IMAGE_PLACEHOLDER, prompt: 'placeholder image', marginTop: 0, marginBottom: 16 };
        setTemplate(prev => {
            const newSections = [...prev.sections];
            const currentIndex = selectedId && selectedType === 'section' ? newSections.findIndex(s => s.id === selectedId) : -1;
            newSections.splice(currentIndex + 1, 0, newBlock);
            return { ...prev, sections: newSections };
        });
        setSelectedId(newId); setSelectedType('section');
    };

    const handleDelete = () => {
        if (!selectedId || !selectedType) return;
        if (selectedType === 'section') setTemplate(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== selectedId) }));
        else setTemplate(prev => ({ ...prev, decorations: (prev.decorations || []).filter(d => d.id !== selectedId) }));
        setSelectedId(null); setSelectedType(null);
    }
    
    const handleFileUpload = async (file: File | null, options: { maxWidth: number; quality: number }, callback: (base64: string) => void) => {
        if (!file) return;
        setIsProcessing(true);
        try { const base64 = await resizeAndCompressImage(file, options); callback(base64); setSaveError(''); }
        catch (error) { alert("文件上传失败"); } finally { setIsProcessing(false); }
    };
    
    const handleSave = () => {
        if (!template.name || !template.description || !template.coverImageUrl) {
            setSaveError("请填写模板名称、描述并上传封面图片。"); setActiveTab('global'); return;
        }
        setSaveError(''); onSave(template);
    }
    
    const selectedSection = selectedType === 'section' ? template.sections.find(s => s.id === selectedId) : null;
    const selectedDecoration = selectedType === 'decoration' ? (template.decorations || []).find(d => d.id === selectedId) : null;
    const previewData: ResultData & { type: 'long_article' } = { type: 'long_article', templateId: template.id, width: template.width, background: template.background, contentContainer: template.contentContainer, sections: template.sections, decorations: template.decorations || [] };

    const pseudoTemplateForDeco: PosterTemplate = {
        ...template,
        height: contentHeight,
        layoutBoxes: [],
    };

    const renderGuide = (guide: Guide, index: number) => {
        const style: React.CSSProperties = { position: 'absolute' };
        if (guide.x !== undefined) { // Vertical guide
            style.left = guide.x; style.top = guide.y1; style.height = (guide.y2 || 0) - (guide.y1 || 0); style.width = '1px';
        } else { // Horizontal guide
            style.top = guide.y; style.left = guide.x1; style.width = (guide.x2 || 0) - (guide.x1 || 0); style.height = '1px';
        }
    
        return (
            <div key={`guide-${index}`} className="bg-red-500/80" style={style}>
                {guide.dist !== undefined && (
                    <span className="absolute bg-red-500 text-white text-xs px-1 rounded" style={{
                         ...(guide.x !== undefined ? { top: '50%', left: '4px' } : { left: '50%', top: '4px' }),
                         transform: 'translate(-50%, -50%)',
                    }}>
                        {guide.dist}px
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-40 flex flex-col p-2 sm:p-4 animate-pop-in">
             <div className="bg-gray-800 w-full h-full rounded-2xl shadow-2xl border border-gray-700 flex flex-col text-white">
                <header className="flex justify-between items-center p-3 border-b border-gray-700 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold">编辑模板: {template.name}</h2>
                        {saveError && <p className="text-red-400 text-sm mt-1">{saveError}</p>}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">取消</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-semibold">保存模板</button>
                    </div>
                </header>

                <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                    <aside className="w-full md:w-96 lg:w-[420px] flex-shrink-0 p-4 flex flex-col overflow-y-hidden">
                       <div className="flex-shrink-0 border-b border-gray-600 mb-4">
                           <nav className="flex gap-4">
                               <button onClick={() => setActiveTab('block')} className={`py-2 px-4 font-semibold ${activeTab === 'block' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}>元素设置</button>
                               <button onClick={() => setActiveTab('global')} className={`py-2 px-4 font-semibold ${activeTab === 'global' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}>全局设置</button>
                           </nav>
                       </div>
                       <div className="flex-grow overflow-y-auto pr-2 -mr-4 space-y-4">
                           {activeTab === 'block' && (
                               <div>
                                   <div className="grid grid-cols-3 gap-2 mb-4">
                                       <button onClick={() => handleAddBlock('text')} className="flex items-center justify-center gap-2 p-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"><AddTextIcon className="w-5 h-5" /> 文本</button>
                                       <button onClick={() => handleAddBlock('image')} className="flex items-center justify-center gap-2 p-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm"><PhotoIcon className="w-5 h-5" /> 图片</button>
                                       <button onClick={() => handleAddBlock('decoration')} className="flex items-center justify-center gap-2 p-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors text-sm"><SparklesIcon className="w-5 h-5" /> 装饰</button>
                                   </div>
                                    {selectedSection ? <BlockEditorPanel section={selectedSection} onUpdate={(u) => handleSectionUpdate(selectedId!, u)} onDelete={handleDelete} isTemplateMode onUpload={(f) => handleFileUpload(f, { maxWidth: template.width, quality: 0.85 }, (b64) => handleSectionUpdate(selectedId!, { imageUrl: b64 }))} isFormatPainterActive={!!copiedStyle} onCopyStyle={handleCopyStyle} />
                                    : selectedDecoration ? <DecorationPanel decoration={selectedDecoration} onUpdate={(u) => handleDecorationUpdate(selectedId!, u)} onDelete={handleDelete} onUpload={(f) => handleFileUpload(f, { maxWidth: 800, quality: 0.8 }, (b64) => handleDecorationUpdate(selectedId!, { imageUrl: b64 }))} availableLayoutBoxes={[]} parentSize={{ width: template.width, height: contentHeight }} template={pseudoTemplateForDeco} />
                                    : <div className="text-gray-400 text-center p-4 border-2 border-dashed border-gray-600 rounded-lg h-full flex items-center justify-center"><p>从右侧画布中选择一个元素进行编辑。</p></div>}
                               </div>
                           )}
                           {activeTab === 'global' && (
                                <div className="space-y-4">
                                    <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">模板信息</summary><div className="mt-4 space-y-4">
                                        <div><label className="block text-sm font-medium text-gray-300 mb-1">模板名称*</label><input type="text" value={template.name} onChange={e => handleUpdate('name', e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
                                        <div><label className="block text-sm font-medium text-gray-300 mb-1">模板描述*</label><textarea value={template.description} onChange={e => handleUpdate('description', e.target.value)} rows={3} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"></textarea></div>
                                        <div><label className="block text-sm font-medium text-gray-300 mb-1">封面图片*</label><img src={template.coverImageUrl || `data:image/svg+xml;base64,${btoa(`<svg width="300" height="150" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#555"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#fff" text-anchor="middle" dy=".3em">Upload Cover</text></svg>`)}`} alt="Cover" className="w-full h-32 object-cover rounded-md bg-gray-600 mb-2" /><button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = e => handleFileUpload((e.target as HTMLInputElement).files?.[0], { maxWidth: 512, quality: 0.7 }, b64 => handleUpdate('coverImageUrl', b64)); i.click(); }} disabled={isProcessing} className="w-full flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm disabled:bg-gray-500">{isProcessing ? <SpinnerIcon className="w-5 h-5"/> : <ArrowUpTrayIcon className="w-5 h-5"/>} 上传封面</button></div>
                                    </div></details>
                                    <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">页面背景</summary><div className="mt-4 space-y-4">
                                        <ColorSwatch label="背景" value={template.background.value} onChange={v => handleBackgroundUpdate({ value: v })} />
                                        <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = e => handleFileUpload((e.target as HTMLInputElement).files?.[0], { maxWidth: 1280, quality: 0.8 }, b64 => handleBackgroundUpdate({ type: 'image', value: b64 })); i.click(); }} disabled={isProcessing} className="w-full flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm disabled:bg-gray-500">{isProcessing ? <SpinnerIcon className="w-5 h-5"/> : <ArrowUpTrayIcon className="w-5 h-5"/>} 上传背景图</button>
                                        <div><label className="block text-sm font-medium text-gray-300 mb-1">背景模糊</label><select value={template.background.blur} onChange={e => handleBackgroundUpdate({ blur: e.target.value as any })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"><option value="none">无</option><option value="light">轻微</option><option value="dark">明显</option></select></div>
                                        <ColorSwatch label="背景染色" value={template.background.tintColor} onChange={v => handleBackgroundUpdate({ tintColor: v })} />
                                    </div></details>
                                    <details className="bg-gray-900/50 p-3 rounded-lg border border-gray-700" open><summary className="font-semibold cursor-pointer">内容容器</summary><div className="mt-4 space-y-4">
                                        <ColorSwatch label="背景" value={template.contentContainer.backgroundColor} onChange={v => handleContentContainerUpdate({ backgroundColor: v })} />
                                        <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = e => handleFileUpload((e.target as HTMLInputElement).files?.[0], { maxWidth: 1080, quality: 0.8 }, b64 => handleContentContainerUpdate({ backgroundImage: b64 })); i.click(); }} disabled={isProcessing} className="w-full flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm disabled:bg-gray-500">{isProcessing ? <SpinnerIcon className="w-5 h-5"/> : <ArrowUpTrayIcon className="w-5 h-5"/>} 上传背景图</button>
                                        {template.contentContainer.backgroundImage && <button onClick={() => handleContentContainerUpdate({ backgroundImage: null })} className="w-full p-1 bg-gray-600 text-xs rounded-md">移除图片</button>}
                                        <div><label className="block text-sm font-medium text-gray-300 mb-1">背景模糊 (玻璃效果)</label><select value={template.contentContainer.backgroundBlur} onChange={e => handleContentContainerUpdate({ backgroundBlur: e.target.value as any })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"><option value="none">无</option><option value="light">轻微</option><option value="dark">明显</option></select></div>
                                        <div><label className="block text-sm font-medium text-gray-300 mb-1">圆角 (px)</label><input type="number" value={template.contentContainer.borderRadius} onChange={e => handleContentContainerUpdate({ borderRadius: parseInt(e.target.value) })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"/></div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="text-sm">水平外边距</label><input type="number" value={template.contentContainer.marginX} onChange={e => handleContentContainerUpdate({ marginX: parseInt(e.target.value) })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"/></div>
                                            <div><label className="text-sm">上下外边距</label><div className="flex gap-1"><input type="number" value={template.contentContainer.marginTop} onChange={e => handleContentContainerUpdate({ marginTop: parseInt(e.target.value) })} placeholder="上" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"/><input type="number" value={template.contentContainer.marginBottom} onChange={e => handleContentContainerUpdate({ marginBottom: parseInt(e.target.value) })} placeholder="下" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"/></div></div>
                                        </div>
                                        <div><label className="text-sm">内边距</label><div className="grid grid-cols-2 gap-1"><input type="number" value={template.contentContainer.paddingTop} onChange={e => handleContentContainerUpdate({ paddingTop: parseInt(e.target.value) })} placeholder="上" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"/><input type="number" value={template.contentContainer.paddingBottom} onChange={e => handleContentContainerUpdate({ paddingBottom: parseInt(e.target.value) })} placeholder="下" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"/><input type="number" value={template.contentContainer.paddingLeft} onChange={e => handleContentContainerUpdate({ paddingLeft: parseInt(e.target.value) })} placeholder="左" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"/><input type="number" value={template.contentContainer.paddingRight} onChange={e => handleContentContainerUpdate({ paddingRight: parseInt(e.target.value) })} placeholder="右" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"/></div></div>
                                    </div></details>
                                </div>
                           )}
                       </div>
                    </aside>

                     <main ref={editorWrapperRef} className={`flex-grow bg-gray-900 flex items-start justify-center p-4 overflow-hidden relative cursor-grab ${!!copiedStyle ? 'format-painter-active' : ''}`} onMouseDown={handleMouseDown} onWheel={handleWheel}>
                        <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }} onClick={() => { setSelectedId(null); setSelectedType(null); setCopiedStyle(null); }}>
                            <div ref={contentRef} className="shadow-2xl rounded-lg ring-1 ring-white/10 relative" style={{width: template.width}}>
                                <LongArticleContent data={previewData} selectedId={selectedId} onElementClick={handleElementClick} isFormatPainterActive={!!copiedStyle}>
                                    {(template.decorations || []).map(deco => (
                                        <EditableDecorationElement
                                            key={deco.id}
                                            element={deco}
                                            parentSize={{ width: template.width, height: contentHeight }}
                                            template={pseudoTemplateForDeco}
                                            zoom={zoom}
                                            isSelected={deco.id === selectedId}
                                            onSetGuides={setGuides}
                                            onClick={(e) => { e.stopPropagation(); handleElementClick(deco.id, 'decoration'); }}
                                            onUpdate={(id, updates) => handleDecorationUpdate(id, updates)}
                                        />
                                    ))}
                                </LongArticleContent>
                            </div>
                        </div>
                        
                        <div
                            className="absolute pointer-events-none top-0 left-0"
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                transformOrigin: 'top left',
                                width: template.width,
                                height: contentHeight,
                                overflow: 'hidden',
                                zIndex: 9998,
                            }}
                        >
                            {guides.map((guide, i) => renderGuide(guide, i))}
                        </div>

                         <div className="absolute bottom-4 right-4 bg-gray-800 text-white rounded-lg shadow-2xl p-1 flex items-center gap-1 z-10">
                            <button onClick={() => setZoom(z => Math.max(0.1, z - 0.2))} title="缩小" className="p-1.5 hover:bg-gray-700 rounded"><MagnifyingGlassMinusIcon className="w-5 h-5" /></button>
                            <button onClick={fitToScreen} className="w-16 text-sm font-semibold hover:bg-gray-700 rounded p-1">{Math.round(zoom * 100)}%</button>
                            <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} title="放大" className="p-1.5 hover:bg-gray-700 rounded"><MagnifyingGlassPlusIcon className="w-5 h-5" /></button>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};