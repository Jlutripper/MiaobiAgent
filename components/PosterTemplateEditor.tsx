import React, { useState, useRef, useCallback, useLayoutEffect, useMemo, useEffect } from 'react';
import { produce } from 'immer';
import { PosterTemplate, LayoutBox, ArticleSection, TextSection, ImageSection, TextStyleDefinition, DecorationElement, TextSpan, TextSpanStyle } from '../types';
import { EditableDecorationElement } from './EditableDecorationElement';
import { XMarkIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, SpinnerIcon, ArrowUpTrayIcon, LayoutIcon, SparklesIcon } from './icons';
import { EditableLayoutBox } from './EditableLayoutBox';
import { resizeAndCompressImage } from './utils/imageUtils';
import { LayersPanel } from './LayersPanel';
import { InspectorPanel } from './InspectorPanel';
import { getPixelBounds, findBoxById } from './utils/layoutUtils';
import { applyStyleToSelection } from './utils/textUtils';

export const FlexLayoutBoxPanel = ({ box, onUpdate }: { box: LayoutBox, onUpdate: (updates: Partial<LayoutBox>) => void }) => (
    <div className="space-y-4">
        <div><label className="block text-sm font-medium text-gray-300 mb-1">方向</label><select value={box.flexDirection || 'column'} onChange={e => onUpdate({ flexDirection: e.target.value as any })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"><option value="column">纵向</option><option value="row">横向</option></select></div>
        <div><label className="block text-sm font-medium text-gray-300 mb-1">间距 (px)</label><input type="number" value={box.columnGap || 0} onChange={e => onUpdate({ columnGap: parseInt(e.target.value) || 0 })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
        <div><label className="block text-sm font-medium text-gray-300 mb-1">主轴对齐</label><select value={box.justifyContent || 'flex-start'} onChange={e => onUpdate({ justifyContent: e.target.value as any })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"><option value="flex-start">头部对齐</option><option value="center">居中对齐</option><option value="flex-end">尾部对齐</option><option value="space-between">两端对齐</option><option value="space-around">分散对齐</option></select></div>
        <div><label className="block text-sm font-medium text-gray-300 mb-1">交叉轴对齐</label><select value={box.alignItems || 'stretch'} onChange={e => onUpdate({ alignItems: e.target.value as any })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"><option value="stretch">拉伸</option><option value="flex-start">头部对齐</option><option value="center">居中对齐</option><option value="flex-end">尾部对齐</option></select></div>
    </div>
);

type Guide = { x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number; dist?: number };

const parseValue = (val: string | undefined): { value: number, unit: string } => {
    if (!val) return { value: 0, unit: 'px' };
    const match = val.match(/(-?\d+\.?\d*)\s*(px|%)?/);
    if (!match) return { value: 0, unit: 'px' };
    return { value: parseFloat(match[1]), unit: match[2] || 'px' };
};

export const PosterContent = ({ template, children }: { template: PosterTemplate, children?: React.ReactNode }) => {
    const { background, width, height } = template;

    const backgroundBlurValue = {
        'light': '8px',
        'dark': '16px',
        'none': '0px'
    }[background.blur || 'none'];

    // --- UNIFIED BACKGROUND LOGIC ---
    // This object holds the correct background style property,
    // whether it's a color, gradient, or image.
    const backgroundStyle: React.CSSProperties = {};
    if (background.type === 'image' && background.value) {
        backgroundStyle.backgroundImage = `url(${background.value})`;
        backgroundStyle.backgroundSize = 'cover';
        backgroundStyle.backgroundPosition = 'center';
    } else {
        // This now correctly handles both solid colors and gradients.
        backgroundStyle.background = background.value;
    }

    return (
        <div
            className="font-sans relative"
            style={{
                width: width,
                height: height,
                overflow: 'hidden'
                // The main container no longer sets any background itself.
            }}
        >
            {/* Layer 1: The unified background layer */}
            <div
                className="absolute inset-0"
                style={{
                    ...backgroundStyle,
                    filter: `blur(${backgroundBlurValue})`,
                    // Scale up to hide hard edges that can result from blurring
                    transform: 'scale(1.05)',
                    zIndex: -2
                }}
            />

            {/* Layer 2: The tint color overlay */}
            <div
                className="absolute inset-0 w-full h-full"
                style={{
                    backgroundColor: background.tintColor || 'transparent',
                    zIndex: -1,
                }}
            />

            {/* Layer 3: The actual content */}
            <div className="relative w-full h-full pointer-events-auto">
                {children}
            </div>
        </div>
    );
};


export const PosterTemplateEditor = ({ initialTemplate, onSave, onCancel }: { initialTemplate: PosterTemplate, onSave: (template: PosterTemplate) => void; onCancel: () => void; }) => {
    const [template, setTemplate] = useState(initialTemplate);
    const [selectedPath, setSelectedPath] = useState<string[]>([]);
    const [editingTextPath, setEditingTextPath] = useState<string[] | null>(null);
    const [activeTextSelection, setActiveTextSelection] = useState<{ start: number, end: number} | null>(null);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [guides, setGuides] = useState<Guide[]>([]);
    
    const editorWrapperRef = useRef<HTMLDivElement>(null);
    const lastPanPointRef = useRef({ x: 0, y: 0 });
    
    const findElementByPath = useCallback((path: string[]): any => {
        if (!path || path.length === 0) return null;
    
        let currentLevelItems: any[] = [...template.layoutBoxes, ...(template.decorations || [])];
        let element: any = null;
    
        for (const id of path) {
            element = currentLevelItems.find(item => item.id === id);
            if (element && element.type === 'layout_box' && path.indexOf(id) < path.length - 1) {
                currentLevelItems = element.sections;
            } else if (element) {
                break; 
            } else {
                return null;
            }
        }
        return element;
    }, [template]);

    const selectedElement = useMemo(() => findElementByPath(selectedPath), [selectedPath, findElementByPath]);

    const handleSelectPath = (path: string[]) => {
        // If we are currently editing text and we are selecting a *different* path,
        // the blur event on the current text editor should fire first and handle saving and exiting.
        // Selecting a new path should not preemptively exit edit mode.
        if (editingTextPath && JSON.stringify(path) !== JSON.stringify(editingTextPath)) {
             // Let the blur event handle exiting edit mode.
        } else if (JSON.stringify(path) === JSON.stringify(editingTextPath)) {
            // Clicking the already-editing text box should do nothing here.
            return;
        }
        
        if (JSON.stringify(path) !== JSON.stringify(selectedPath)) {
            setSelectedPath(path);
            setActiveTextSelection(null);
        }
    }

    const handleCanvasClick = (e: React.MouseEvent) => {
        // Only deselect if the click is directly on the canvas background, not on a child element.
        if (e.target === e.currentTarget) {
            handleSelectPath([]);
            // The blur event on any active text editor will handle exiting edit mode.
        }
    };

    const posterSize = { width: template.width, height: template.height };
    
    const isIdSelected = (id: string) => selectedPath.includes(id);


    const fitToScreen = useCallback(() => {
        const wrapper = editorWrapperRef.current;
        if (!wrapper || !posterSize.width || !posterSize.height) return;
        const { clientWidth: wrapperWidth, clientHeight: wrapperHeight } = wrapper;

        if (wrapperWidth === 0 || wrapperHeight === 0) return;

        const scaleX = wrapperWidth / posterSize.width;
        const scaleY = wrapperHeight / posterSize.height;
        const newZoom = Math.min(scaleX, scaleY) * 0.95; 

        const newPanX = (wrapperWidth - posterSize.width * newZoom) / 2;
        const newPanY = (wrapperHeight - posterSize.height * newZoom) / 2;
        
        setZoom(newZoom); 
        setPan({ x: newPanX, y: newPanY });
    }, [posterSize.width, posterSize.height]);

    useLayoutEffect(() => {
        fitToScreen();
        const observer = new ResizeObserver(fitToScreen);
        const currentWrapper = editorWrapperRef.current;
        if (currentWrapper) observer.observe(currentWrapper);
        return () => { if (currentWrapper) observer.unobserve(currentWrapper); };
    }, [fitToScreen]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
        const target = e.target as HTMLElement;
        // Only allow panning when clicking directly on the canvas background
        if (target !== editorWrapperRef.current) return;
        
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        target.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        e.preventDefault();

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - lastPanPointRef.current.x;
            const dy = moveEvent.clientY - lastPanPointRef.current.y;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastPanPointRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
        };

        const handleMouseUp = () => {
             target.style.cursor = 'grab';
            document.body.style.userSelect = '';
            setGuides([]);
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
        let newZoom = zoom * (1 - deltaY * 0.001);
        newZoom = Math.max(0.1, Math.min(10, newZoom));
        setZoom(newZoom);
        setPan({ x: mouseX - pointX * newZoom, y: mouseY - pointY * newZoom });
    };
    
    const updateElementByPath = useCallback((path: string[], updates: any) => {
        setTemplate(
            produce(draft => {
                if (path.length === 0) { // Global update
                    Object.assign(draft, updates);
                    return;
                }
    
                let items: any[] = [...(draft.layoutBoxes || []), ...(draft.decorations || [])];
                let parent: any = draft;
    
                for (let i = 0; i < path.length; i++) {
                    const id = path[i];
                    const index = items.findIndex(item => item.id === id);
    
                    if (index === -1) {
                        console.error("Element not found at path:", path);
                        return;
                    }
    
                    if (i === path.length - 1) { // Target element
                        Object.assign(items[index], updates);
                    } else { // It's a container, traverse deeper
                        parent = items[index];
                        items = parent.sections;
                    }
                }
            })
        );
    }, []);

    const handleApplyStyleToSelection = (style: TextSpanStyle) => {
        if (!activeTextSelection || !selectedElement || selectedElement.type !== 'text') return;

        const newSpans = applyStyleToSelection(selectedElement.content, style, activeTextSelection);
        updateElementByPath(selectedPath, { content: newSpans });
    };

    const handleFileUpload = async (file: File | null, options: { maxWidth: number; quality: number }, callback: (base64: string) => void) => {
        if (!file) return;
        setIsProcessing(true);
        try { const base64 = await resizeAndCompressImage(file, options); callback(base64); setSaveError(''); }
        catch (error) { alert("文件上传失败"); } finally { setIsProcessing(false); }
    };
    
    const handleSave = () => { if (!template.name || !template.description || !template.coverImageUrl) { setSaveError("请填写模板名称、描述并上传封面图片。"); return; } setSaveError(''); onSave(template); };

    const renderGuide = (guide: Guide, index: number) => {
        const style: React.CSSProperties = { position: 'absolute', background: 'rgba(239, 68, 68, 0.8)' };
        if (guide.x !== undefined) { // Vertical guide
            style.left = guide.x; style.top = 0; style.height = '100%'; style.width = '1px';
        } else { // Horizontal guide
            style.top = guide.y; style.left = 0; style.width = '100%'; style.height = '1px';
        }
    
        return (
            <div key={`guide-${index}`} style={style}>
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
                    <div><h2 className="text-xl font-bold">编辑海报模板: {template.name}</h2>{saveError && <p className="text-red-400 text-sm mt-1">{saveError}</p>}</div>
                    <div className="flex gap-2"><button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">取消</button><button onClick={handleSave} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold">保存</button></div>
                </header>
                <div className="flex-grow flex flex-row overflow-hidden">
                    {/* Left Panel: Layers & Tools */}
                    <aside className="w-80 bg-gray-800 border-r border-gray-700 flex-shrink-0 flex flex-col">
                        <div className="flex-grow min-h-0 overflow-y-auto p-2">
                             <LayersPanel 
                                template={template}
                                selectedPath={selectedPath}
                                onSelect={handleSelectPath}
                                onUpdate={updater => setTemplate(produce(template, updater))}
                            />
                        </div>
                    </aside>

                    {/* Center Panel: Canvas */}
                    <main ref={editorWrapperRef} className="flex-grow bg-gray-900 flex items-start justify-center p-4 overflow-hidden relative cursor-grab" onMouseDown={handleCanvasMouseDown} onWheel={handleWheel} onClick={handleCanvasClick}>
                        <div 
                            style={{ 
                                position: 'absolute',
                                top: pan.y,
                                left: pan.x,
                                transform: `scale(${zoom})`, 
                                transformOrigin: 'top left',
                            }} 
                        >
                             <PosterContent template={template}>
                                 {template.layoutBoxes.map((box) => (
                                    <EditableLayoutBox 
                                        key={box.id} 
                                        box={box}
                                        path={[box.id]}
                                        parentSize={posterSize} 
                                        zoom={zoom} 
                                        isSelected={isIdSelected}
                                        template={template}
                                        otherBoxes={template.layoutBoxes.filter(b => b.id !== box.id)}
                                        otherDecorations={template.decorations || []}
                                        onSetGuides={setGuides}
                                        onSelect={handleSelectPath}
                                        onUpdate={updateElementByPath}
                                        editingTextPath={editingTextPath}
                                        onEnterTextEditMode={setEditingTextPath}
                                        onExitTextEditMode={() => setEditingTextPath(null)}
                                        onSelectionChange={setActiveTextSelection}
                                    />
                                ))}
                                {(template.decorations || []).map(deco => (
                                    <EditableDecorationElement
                                        key={deco.id}
                                        element={deco}
                                        parentSize={posterSize}
                                        template={template}
                                        zoom={zoom}
                                        isSelected={isIdSelected(deco.id)}
                                        onSetGuides={setGuides}
                                        onClick={(e) => { e.stopPropagation(); handleSelectPath([deco.id]); }}
                                        onUpdate={(id, updates) => updateElementByPath([id], updates)}
                                    />
                                ))}
                            </PosterContent>
                        </div>
                        
                        {/* Guide Container */}
                        <div
                            className="absolute pointer-events-none"
                            style={{
                                top: pan.y,
                                left: pan.x,
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top left',
                                width: posterSize.width,
                                height: posterSize.height,
                                zIndex: 9998,
                            }}
                        >
                            {guides.map(renderGuide)}
                        </div>

                        <div className="absolute bottom-4 right-4 bg-gray-800 text-white rounded-lg shadow-2xl p-1 flex items-center gap-1 z-30">
                            <button onClick={() => setZoom(z => Math.max(0.1, z - 0.2))} title="缩小" className="p-1.5 hover:bg-gray-700 rounded"><MagnifyingGlassMinusIcon className="w-5 h-5" /></button>
                            <button onClick={fitToScreen} className="w-16 text-sm font-semibold hover:bg-gray-700 rounded p-1">{Math.round(zoom * 100)}%</button>
                            <button onClick={() => setZoom(z => Math.min(10, z + 0.2))} title="放大" className="p-1.5 hover:bg-gray-700 rounded"><MagnifyingGlassPlusIcon className="w-5 h-5" /></button>
                        </div>
                    </main>

                    {/* Right Panel: Inspector */}
                     <aside className="w-96 bg-gray-800 border-l border-gray-700 flex-shrink-0 flex flex-col">
                        <div className="flex-grow min-h-0 overflow-y-auto p-4">
                             <InspectorPanel 
                                selectedElement={{ element: selectedElement, path: selectedPath }}
                                onUpdate={updates => updateElementByPath(selectedPath, updates)}
                                onGlobalUpdate={updates => updateElementByPath([], updates)}
                                template={template}
                                posterWidth={posterSize.width}
                                onFileUpload={handleFileUpload}
                                isProcessing={isProcessing}
                                activeTextSelection={activeTextSelection}
                                onApplyStyleToSelection={handleApplyStyleToSelection}
                            />
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};