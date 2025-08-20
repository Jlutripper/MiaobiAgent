import React, { useState, useRef, useCallback, useLayoutEffect, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { produce } from 'immer';
import { ResultData, ArticleSection, LayoutBox, PosterTemplate, DecorationElement, TextSpanStyle } from '../types';
import { DownloadIcon, XMarkIcon, SpinnerIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon } from './icons';
import { PosterContent } from './PosterTemplateEditor';
import { EditableLayoutBox } from './EditableLayoutBox';
import { EditableDecorationElement } from './EditableDecorationElement';
import { InspectorPanel } from './InspectorPanel';
import { LayersPanel } from './LayersPanel';
import { applyStyleToSelection } from './utils/textUtils';

type Guide = { x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number; dist?: number };

interface PosterEditorProps {
  initialData: ResultData & { type: 'poster' };
  templates: PosterTemplate[];
  onExit: () => void;
}

const findElementByPath = (path: string[], template: PosterTemplate): any => {
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
};

export const PosterEditor = ({ initialData, templates, onExit }: PosterEditorProps) => {
  const [data, setData] = useState<PosterTemplate>({
      ...initialData,
      id: initialData.templateId || 'editor-poster',
      name: initialData.prompt,
      description: '',
      tags: [],
      coverImageUrl: '',
  });
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [editingTextPath, setEditingTextPath] = useState<string[] | null>(null);
  const [activeTextSelection, setActiveTextSelection] = useState<{ start: number, end: number} | null>(null);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [guides, setGuides] = useState<Guide[]>([]);

  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null); // Ref for the actual canvas content
  const lastPanPointRef = useRef({ x: 0, y: 0 });
  
  const posterSize = { width: data.width, height: data.height };
  
  const selectedElement = useMemo(() => findElementByPath(selectedPath, data), [selectedPath, data]);
  const isIdSelected = (id: string) => selectedPath.includes(id);

  const handleSelectPath = (path: string[]) => {
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
    if (e.target === e.currentTarget) {
        handleSelectPath([]);
    }
  };

  const updateElementByPath = useCallback((path: string[], updates: any) => {
    setData(
        produce(draft => {
            if (path.length === 0) { // Global update
                Object.assign(draft, updates);
                return;
            }
            
            let items: any[] = [...(draft.layoutBoxes || []), ...(draft.decorations || [])];

            for (let i = 0; i < path.length; i++) {
                const id = path[i];
                const index = items.findIndex(item => item.id === id);
                if (index === -1) return;
                if (i === path.length - 1) {
                    Object.assign(items[index], updates);
                } else {
                    const container = items[index];
                    if (container.type === 'layout_box') {
                        items = container.sections;
                    } else {
                        return;
                    }
                }
            }
        })
    );
  }, [setData]);

  const handleApplyStyleToSelection = (style: TextSpanStyle) => {
      if (!activeTextSelection || !selectedElement || selectedElement.type !== 'text') return;
      const newSpans = applyStyleToSelection(selectedElement.content, style, activeTextSelection);
      updateElementByPath(selectedPath, { content: newSpans });
  };

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
    const observer = new ResizeObserver(() => fitToScreen());
    const currentWrapper = editorWrapperRef.current;
    if (currentWrapper) observer.observe(currentWrapper);
    return () => { if (currentWrapper) observer.unobserve(currentWrapper); };
  }, [fitToScreen]);
  
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target !== editorWrapperRef.current) return;
    
    lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    if (editorWrapperRef.current) editorWrapperRef.current.style.cursor = 'grabbing';
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
    setZoom(newZoom); setPan({ x: mouseX - pointX * newZoom, y: mouseY - pointY * newZoom });
  };
  
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setSelectedPath([]); // Deselect everything before export for a clean snapshot
    
    // Allow deselection to render before cloning
    await new Promise(res => setTimeout(res, 50)); 
    
    const sourceElement = canvasRef.current;
    if (!sourceElement) {
        setIsExporting(false);
        return;
    }

    const clone = sourceElement.cloneNode(true) as HTMLElement;

    // "Pristine" clone styles for 1:1 rendering
    clone.style.position = 'absolute';
    clone.style.left = '-9999px'; // Move off-screen
    clone.style.top = '0px';
    clone.style.transform = 'none'; // Remove any scaling
    clone.style.width = `${data.width}px`;
    clone.style.height = `${data.height}px`;

    document.body.appendChild(clone);

    try {
        const canvas = await html2canvas(clone, {
            useCORS: true,
            scale: 2, // Export at 2x resolution for better quality
            backgroundColor: null,
            width: data.width,
            height: data.height,
            allowTaint: true
        });
        
        const link = document.createElement('a');
        link.download = `poster-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
    } catch (error) { 
        console.error("Failed to export poster:", error); 
        alert("抱歉，导出海报时出错。");
    } finally {
        document.body.removeChild(clone);
        setIsExporting(false);
    }
  };


  const renderGuide = (guide: Guide, index: number) => {
    const style: React.CSSProperties = { position: 'absolute', background: 'rgba(239, 68, 68, 0.8)' };
    if (guide.x !== undefined) {
        style.left = guide.x; style.top = 0; style.height = '100%'; style.width = '1px';
    } else {
        style.top = guide.y; style.left = 0; style.width = '100%'; style.height = '1px';
    }
    return <div key={`guide-${index}`} style={style} />;
  };

  return (
    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-40 flex flex-col p-2 sm:p-4 animate-pop-in">
        <div className="bg-gray-800 w-full h-full rounded-2xl shadow-2xl border border-gray-700 flex flex-col text-white">
             <header className="flex justify-between items-center p-3 border-b border-gray-700 flex-shrink-0">
                <h2 className="text-xl font-bold">编辑海报</h2>
                <div className="flex gap-2">
                    <button onClick={onExit} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">完成</button>
                    <button onClick={handleExport} disabled={isExporting} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500">{isExporting ? <SpinnerIcon className="w-5 h-5" /> : <DownloadIcon className="w-5 h-5" />} {isExporting ? '导出中...' : '导出'}</button>
                </div>
            </header>
             <div className="flex-grow flex flex-row overflow-hidden">
                <aside className="w-80 bg-gray-800 border-r border-gray-700 flex-shrink-0 flex flex-col">
                    <div className="flex-grow min-h-0 overflow-y-auto p-2">
                         <LayersPanel 
                            template={data}
                            selectedPath={selectedPath}
                            onSelect={handleSelectPath}
                            onUpdate={updater => setData(produce(data, updater))}
                        />
                    </div>
                </aside>

                <main ref={editorWrapperRef} className="flex-grow bg-gray-900 flex items-start justify-center p-4 overflow-hidden relative cursor-grab" onMouseDown={handleCanvasMouseDown} onWheel={handleWheel} onClick={handleCanvasClick}>
                    <div ref={canvasRef} style={{ position: 'absolute', top: pan.y, left: pan.x, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                        <div style={{ width: data.width, height: data.height }}>
                            <PosterContent template={data}>
                                {data.layoutBoxes.map((box) => (
                                    <EditableLayoutBox
                                        key={box.id}
                                        box={box}
                                        path={[box.id]}
                                        editorMode="instance"
                                        parentSize={posterSize}
                                        zoom={zoom}
                                        isSelected={isIdSelected}
                                        template={data}
                                        otherBoxes={data.layoutBoxes.filter(b => b.id !== box.id)}
                                        otherDecorations={data.decorations || []}
                                        onSetGuides={setGuides}
                                        onSelect={handleSelectPath}
                                        onUpdate={updateElementByPath}
                                        editingTextPath={editingTextPath}
                                        onEnterTextEditMode={setEditingTextPath}
                                        onExitTextEditMode={() => setEditingTextPath(null)}
                                        onSelectionChange={setActiveTextSelection}
                                    />
                                ))}
                                {(data.decorations || []).map((deco) => (
                                    <EditableDecorationElement 
                                        key={deco.id} 
                                        element={deco} 
                                        parentSize={posterSize} 
                                        template={data}
                                        zoom={zoom} 
                                        isSelected={isIdSelected(deco.id)}
                                        onSetGuides={setGuides}
                                        onClick={(e) => { e.stopPropagation(); handleSelectPath([deco.id]); }}
                                        onUpdate={(id, updates) => updateElementByPath([id], updates)}
                                    />
                                ))}
                            </PosterContent>
                        </div>
                    </div>
            
                    <div
                        className="absolute pointer-events-none top-0 left-0"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
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
                 <aside className="w-96 bg-gray-800 border-l border-gray-700 flex-shrink-0 flex flex-col">
                     <div className="flex-grow min-h-0 overflow-y-auto p-4">
                        <InspectorPanel 
                            mode="instance"
                            selectedElement={{ element: selectedElement, path: selectedPath }}
                            onUpdate={updates => updateElementByPath(selectedPath, updates)}
                            onGlobalUpdate={updates => setData(prev => ({...prev, ...updates}))}
                            template={data}
                            posterWidth={posterSize.width}
                            onFileUpload={() => alert('File upload from instance inspector is not implemented yet.')}
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