import React, { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { ResultData, ArticleSection, TextSection, ImageSection, AspectRatio, TextStyleDefinition, LongArticleTemplate, DecorationElement, Guide, PosterTemplate } from '../types';
import { DownloadIcon, XMarkIcon, SpinnerIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, ArrowPathIcon, ArrowUpTrayIcon, AddTextIcon, PhotoIcon, SparklesIcon } from './icons';
import { generateStandaloneImage } from '../services/imageToolsService';
import { adaptArticleToTemplate } from '../services/longArticleAgentService';
import { BlockEditorPanel } from './BlockEditorPanel';
import { DecorationPanel } from './DecorationPanel';
import { EditableDecorationElement } from './EditableDecorationElement';
import { resizeAndCompressImage } from './utils/imageUtils';
import { isGradient, parseGradientString } from './utils/colorUtils';
import { EditableTextSection } from './EditableTextSection';
import { EditableImageSection } from './EditableImageSection';

const NEW_IMAGE_PLACEHOLDER = `data:image/svg+xml;base64,${btoa(`<svg width="1080" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e9e9e9"/><text x="50%" y="50%" font-family="sans-serif" font-size="48" fill="#a0a0a0" text-anchor="middle" dy=".3em">New Image Block</text></svg>`)}`;
const NEW_DECORATION_PLACEHOLDER = `data:image/svg+xml;base64,${btoa(`<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#d1d5db" rx="10"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#6b7280" text-anchor="middle" dy=".3em">Decoration</text></svg>`)}`;

export const LongArticleContent = ({ data, onRendered, selectedId, onElementClick, isFormatPainterActive, children }: { data: ResultData & { type: 'long_article' }, onRendered?: () => void, selectedId?: string | null, onElementClick?: (id: string, type: 'section' | 'decoration') => void, isFormatPainterActive?: boolean, children?: React.ReactNode }) => {
    const { sections, decorations, background, contentContainer, width } = data;
    
    const [imagesLoaded, setImagesLoaded] = useState(false);
    
    const allImages = [
        background.type === 'image' ? background.value : null,
        contentContainer.backgroundImage,
        ...sections.filter(s => s.type === 'image').map(s => (s as ImageSection).imageUrl),
        ...(decorations || []).map(d => d.imageUrl)
    ].filter(Boolean) as string[];

    useEffect(() => {
        let loadedCount = 0;
        const totalImages = allImages.length;
        if (totalImages === 0) {
            setImagesLoaded(true);
            return;
        }

        const onFinish = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
                setImagesLoaded(true);
            }
        };

        allImages.forEach(src => {
            if (!src) {
                onFinish();
                return;
            }
            const img = new Image();
            img.src = src;
            img.onload = onFinish;
            img.onerror = onFinish;
        });
    }, [allImages.join(',')]);

    useEffect(() => {
        if (imagesLoaded) {
             setTimeout(() => onRendered?.(), 100);
        }
    }, [imagesLoaded, onRendered]);

    const backgroundBlurValue = {
        'light': '8px',
        'dark': '16px',
        'none': '0px'
    }[background.blur || 'none'];

    const contentBlurClass = {
        'light': 'backdrop-blur-md',
        'dark': 'backdrop-blur-xl',
        'none': ''
    }[contentContainer.backgroundBlur || 'none'];
    
    const renderSection = (section: TextSection | ImageSection) => {
        const isSelected = section.id === selectedId;
        const interactiveClass = onElementClick ? 'cursor-pointer' : '';
        const formatPainterClass = section.type === 'text' && isFormatPainterActive ? 'cursor-copy' : '';

        // ** UNIFIED RENDERER **
        // All rendering logic is now delegated to the canonical components,
        // ensuring consistency and eliminating the source of duplication bugs.
        return (
             <div 
                key={section.id} 
                className={`transition-all duration-200 ${interactiveClass} ${formatPainterClass}`}
                style={{
                    marginTop: `${section.marginTop || 0}px`,
                    marginBottom: `${section.marginBottom || 0}px`,
                }}
            >
                {section.type === 'text' ? (
                    <EditableTextSection 
                        section={section}
                        isSelected={isSelected}
                        isEditing={false} // Static rendering in this context
                        onSelect={(e) => { e.stopPropagation(); onElementClick?.(section.id, 'section'); }}
                        // These props are for editing mode, which is disabled here.
                        onEnterEditMode={() => {}} 
                        onExitEditMode={() => {}}
                        onUpdateContent={() => {}}
                        onSelectionChange={() => {}}
                    />
                ) : (
                    <EditableImageSection
                        section={section}
                        isSelected={isSelected}
                        onSelect={(e) => { e.stopPropagation(); onElementClick?.(section.id, 'section'); }}
                    />
                )}
            </div>
        )
    }

    const renderDecoration = (deco: DecorationElement) => {
        const isSelected = deco.id === selectedId;
        const interactiveClass = onElementClick ? 'cursor-pointer' : '';

        return (
            <div
                key={deco.id}
                style={{
                    position: 'absolute',
                    left: `${deco.position.xPercent}%`,
                    top: `${deco.position.yPx}px`,
                    width: `${deco.sizePercent.width}%`,
                    zIndex: deco.zIndex,
                    transform: `rotate(${deco.angle}deg)`,
                    outline: isSelected ? '2px solid #f97316' : 'none',
                    outlineOffset: '4px',
                }}
                className={interactiveClass}
                onClick={(e) => { e.stopPropagation(); onElementClick?.(deco.id, 'decoration'); }}
            >
                <img src={deco.imageUrl} alt="decoration" className="w-full h-auto object-contain" />
            </div>
        )
    }
    
    const pageDecorations = (decorations || []).filter(d => (d.scope ?? 'page') === 'page');
    const contentDecorations = (decorations || []).filter(d => d.scope === 'content');

    return (
        <div
            className="font-sans"
            style={{
                width: width,
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <div className="absolute inset-0" style={{ zIndex: -2 }}>
                 <div
                    className="w-full h-full"
                    style={{
                        ...(background.type === 'image'
                            ? { backgroundImage: `url(${background.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                            : { backgroundColor: background.value }
                        ),
                        filter: `blur(${backgroundBlurValue})`,
                        transform: 'scale(1.05)',
                    }}
                />
            </div>
            
            <div
                className="absolute inset-0 w-full h-full"
                style={{
                    backgroundColor: background.tintColor || 'transparent',
                    zIndex: -1,
                }}
            />
            
            {pageDecorations.map(renderDecoration)}
            
            <div className="absolute inset-0 pointer-events-none">
                {children}
            </div>

            <div
                className="relative"
                style={{
                    paddingTop: contentContainer.marginTop,
                    paddingBottom: contentContainer.marginBottom,
                    paddingLeft: contentContainer.marginX,
                    paddingRight: contentContainer.marginX,
                }}
            >
                <div 
                    className={`relative overflow-hidden flex flex-col ${contentBlurClass}`}
                    style={{
                        backgroundColor: contentContainer.backgroundColor,
                        ...(contentContainer.backgroundImage && {
                            backgroundImage: `url(${contentContainer.backgroundImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }),
                        borderRadius: `${contentContainer.borderRadius}px`,
                        paddingTop: contentContainer.paddingTop,
                        paddingBottom: contentContainer.paddingBottom,
                        paddingLeft: contentContainer.paddingLeft,
                        paddingRight: contentContainer.paddingRight,
                    }}
                >
                    {contentDecorations.map(renderDecoration)}
                    {sections.map(renderSection)}
                </div>
            </div>
        </div>
    );
};

interface LongArticleEditorProps {
    initialData: ResultData & { type: 'long_article' };
    templates: LongArticleTemplate[];
    onExit: () => void;
}

export const LongArticleEditor = ({ initialData, templates, onExit }: LongArticleEditorProps) => {
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'section' | 'decoration' | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [guides, setGuides] = useState<Guide[]>([]);

  const [isProcessing, setIsProcessing] = useState<'illustration' | 'background' | 'template' | 'upload' | null>(null);
  const [backgroundPrompt, setBackgroundPrompt] = useState('');

  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null); 
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const lastPanPointRef = useRef({ x: 0, y: 0 });

  const selectedSection = selectedType === 'section' ? data.sections.find(s => s.id === selectedId) : null;
  const selectedDecoration = selectedType === 'decoration' ? (data.decorations || []).find(d => d.id === selectedId) : null;

  const handleElementClick = (id: string, type: 'section' | 'decoration') => {
      setSelectedId(id);
      setSelectedType(type);
  }

  const fitToScreen = useCallback(() => {
    const wrapper = editorWrapperRef.current;
    if (!wrapper || !data.width ) return;

    const wrapperWidth = wrapper.clientWidth;
    const scale = (wrapperWidth / data.width) * 0.95;

    const newPanX = (wrapperWidth - data.width * scale) / 2;
    const newPanY = 20;

    setZoom(scale);
    setPan({ x: newPanX, y: newPanY });
  }, [data.width]);

   useLayoutEffect(() => {
    fitToScreen();
    const observer = new ResizeObserver(() => fitToScreen());
    const currentWrapper = editorWrapperRef.current;
    if (currentWrapper) {
        observer.observe(currentWrapper);
    }
    return () => { 
        if (currentWrapper) {
            observer.unobserve(currentWrapper);
        }
    };
  }, [fitToScreen]);
  
  useLayoutEffect(() => {
    const wrapper = contentWrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => {
        setContentHeight(wrapper.scrollHeight);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [data]);


  const handleWrapperMouseDown = useCallback((e: React.MouseEvent) => {
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
    if (editorWrapperRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        const { clientX, clientY, deltaY } = e;
        const wrapperRect = editorWrapperRef.current!.getBoundingClientRect();
        
        const mouseX = clientX - wrapperRect.left;
        const mouseY = clientY - wrapperRect.top;
        
        const pointX = (mouseX - pan.x) / zoom;
        const pointY = (mouseY - pan.y) / zoom;
        
        const scaleFactor = -deltaY * 0.001;
        let newZoom = zoom * (1 + scaleFactor);
        newZoom = Math.max(0.1, Math.min(5, newZoom));
        
        const newPanX = mouseX - pointX * newZoom;
        const newPanY = mouseY - pointY * newZoom;

        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
    }
  };
  
  const handleUpdate = (updates: Partial<ResultData & {type: 'long_article'}>) => {
      setData(prev => ({ ...prev, ...updates }));
  };

  const handleSectionUpdate = (id: string, updates: Partial<ArticleSection>) => {
      setData(prev => ({
          ...prev,
          sections: prev.sections.map(s => s.id === id ? ({ ...s, ...updates } as TextSection | ImageSection) : s)
      }));
  }

  const handleDecorationUpdate = (id: string, updates: Partial<DecorationElement>) => {
    setData(prev => ({
        ...prev,
        decorations: (prev.decorations || []).map(d => d.id === id ? { ...d, ...updates } : d)
    }));
  }

  const handleDelete = () => {
      if(!selectedId || !selectedType) return;
      if (selectedType === 'section') {
        setData(prev => ({...prev, sections: prev.sections.filter(s => s.id !== selectedId)}));
      } else {
        setData(prev => ({...prev, decorations: (prev.decorations || []).filter(d => d.id !== selectedId)}));
      }
      setSelectedId(null);
      setSelectedType(null);
  }

  const handleAddBlock = (type: 'text' | 'image' | 'decoration') => {
    const newId = `${type}-${Date.now()}`;
    
    if (type === 'decoration') {
        const newDeco: DecorationElement = {
            id: newId,
            type: 'decoration',
            imageUrl: NEW_DECORATION_PLACEHOLDER,
            position: { xPercent: 30, yPx: 100 },
            sizePercent: { width: 20 },
            angle: 0,
            zIndex: 20,
            scope: 'page',
        };
        setData(prev => ({ ...prev, decorations: [...(prev.decorations || []), newDeco] }));
        setSelectedId(newId);
        setSelectedType('decoration');
        return;
    }

    const newBlock: TextSection | ImageSection = (() => {
        if (type === 'text') {
            const templateStyle = templates.find(t => t.id === data.templateId)?.sections.find(s => s.type === 'text' && s.role === 'body') as TextSection | undefined;
            const defaultStyle: TextStyleDefinition = templateStyle?.style || { fontFamily: "'Noto Sans SC', sans-serif", fontSize: 24, fontWeight: 400, color: '#374151', textAlign: 'left', lineHeight: 1.8 };
            
            return {
                id: newId,
                type: 'text',
                role: 'body',
                content: [{ text: '新文本段落', style: {} }],
                style: defaultStyle,
                marginTop: 0,
                marginBottom: 16,
            };
        }
        return { 
            id: newId, 
            type: 'image', 
            role: 'illustration', 
            imageUrl: NEW_IMAGE_PLACEHOLDER, 
            prompt: 'A beautiful landscape',
            marginTop: 0,
            marginBottom: 16,
        };
    })();
    
    setData(prev => {
        const newSections = [...prev.sections];
        const currentIndex = selectedId && selectedType === 'section' ? newSections.findIndex(s => s.id === selectedId) : newSections.length - 1;
        newSections.splice(currentIndex + 1, 0, newBlock);
        return { ...prev, sections: newSections };
    });

    setSelectedId(newId);
    setSelectedType('section');
  };
  
  const handleTemplateSwitch = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTemplateId = e.target.value === 'none' ? null : e.target.value;
    setIsProcessing('template');
    try {
        const adaptedArticle = await adaptArticleToTemplate(data, newTemplateId, templates);
        setData(prev => ({ ...prev, ...adaptedArticle }));
    } catch (e) {
        console.error("Failed to adapt to template", e);
        alert('应用模板失败。');
    } finally {
        setIsProcessing(null);
    }
  };

  const handleFileUpload = async (file: File, options: { maxWidth: number; quality: number }, callback: (base64: string) => void) => {
    if (!file) return;
    setIsProcessing('upload');
    try {
        const base64 = await resizeAndCompressImage(file, options);
        callback(base64);
    } catch (error) {
        console.error("File upload failed", error);
        alert("文件上传失败");
    } finally {
        setIsProcessing(null);
    }
  };

  const handleRegenerateIllustration = async (prompt: string, aspectRatio: AspectRatio) => {
    if (!selectedId || !prompt) return;
    setIsProcessing('illustration');
    try {
        const imageUrl = await generateStandaloneImage(prompt, aspectRatio);
        handleSectionUpdate(selectedId, { imageUrl, prompt });
    } catch (e) {
        console.error("Failed to regenerate illustration", e);
        alert('插图生成失败。');
    } finally {
        setIsProcessing(null);
    }
  };

  const handleGenerateBackground = async () => {
      if (!backgroundPrompt) return;
      setIsProcessing('background');
      try {
          const imageUrl = await generateStandaloneImage(backgroundPrompt, '9:16');
          handleUpdate({ background: { ...data.background, type: 'image', value: imageUrl } });
      } catch (e) {
          console.error("Failed to generate background", e);
          alert('背景生成失败。');
      } finally {
          setIsProcessing(null);
      }
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setSelectedId(null);
    setSelectedType(null);
    
    await new Promise(res => setTimeout(res, 50));
    
    const sourceElement = canvasRef.current;
    if (!sourceElement) {
        setIsExporting(false);
        return;
    }

    const originalHeight = sourceElement.scrollHeight;
    const clone = sourceElement.cloneNode(true) as HTMLElement;

    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0px';
    clone.style.transform = 'none';
    clone.style.width = `${data.width}px`;

    document.body.appendChild(clone);

    try {
        const canvas = await html2canvas(clone, {
            useCORS: true,
            scale: 2,
            backgroundColor: null,
            width: data.width,
            height: originalHeight,
            allowTaint: true
        });

        const link = document.createElement('a');
        link.download = `long-article-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (error) {
        console.error("Failed to export article:", error);
        alert("抱歉，导出时出错。");
    } finally {
        document.body.removeChild(clone);
        setIsExporting(false);
    }
  };


  const renderGuide = (guide: Guide, index: number) => {
    const style: React.CSSProperties = { position: 'absolute' };
    if (guide.x !== undefined) {
        style.left = guide.x; style.top = guide.y1; style.height = (guide.y2 || 0) - (guide.y1 || 0); style.width = '1px';
    } else {
        style.top = guide.y; style.left = guide.x1; style.width = (guide.x2 || 0) - (guide.x1 || 0); style.height = '1px';
    }
    
    return <div key={`guide-${index}`} className="bg-red-500/80" style={style} />;
  };

  const pseudoTemplateForDeco: PosterTemplate = {
      id: data.templateId || `long-article-${Date.now()}`,
      name: 'long-article-editor-template',
      description: '',
      tags: [],
      coverImageUrl: '',
      width: data.width,
      height: contentHeight,
      background: data.background,
      layoutBoxes: [],
      decorations: data.decorations || [],
  };


  return (
    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-40 flex flex-col p-2 sm:p-4 animate-pop-in">
         <div className="bg-gray-800 w-full h-full rounded-2xl shadow-2xl border border-gray-700 flex flex-col text-white">
            <header className="flex justify-between items-center p-3 border-b border-gray-700 flex-shrink-0">
                <h2 className="text-xl font-bold">长图文编辑器</h2>
                <div className="flex gap-2">
                    <button onClick={onExit} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">关闭</button>
                    <button onClick={handleExport} disabled={isExporting} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500">
                        {isExporting ? <SpinnerIcon className="w-5 h-5" /> : <DownloadIcon className="w-5 h-5" />}
                        {isExporting ? '导出中...' : '导出'}
                    </button>
                </div>
            </header>

            <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                <aside className="w-full md:w-96 lg:w-[420px] flex-shrink-0 p-4 flex flex-col overflow-y-hidden">
                   <div className="flex-grow overflow-y-auto pr-2 -mr-4 space-y-4">
                        <details className="bg-gray-700/50 rounded-lg" open>
                            <summary className="font-semibold text-white p-3 cursor-pointer select-none">模板和布局</summary>
                            <div className="p-3 border-t border-gray-600 space-y-2">
                                <label className="block text-sm font-medium text-gray-300 mb-1">切换模板</label>
                                <div className="flex gap-2">
                                    <select
                                        value={data.templateId || 'none'}
                                        onChange={handleTemplateSwitch}
                                        disabled={isProcessing === 'template'}
                                        className="flex-1 w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-white"
                                    >
                                        <option value="none">无模板 (自动生成)</option>
                                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    {isProcessing === 'template' && <SpinnerIcon className="w-5 h-5 text-white" />}
                                </div>
                            </div>
                        </details>

                        <details className="bg-gray-700/50 rounded-lg" open>
                            <summary className="font-semibold text-white p-3 cursor-pointer select-none">编辑元素</summary>
                            <div className="p-3 border-t border-gray-600">
                                {selectedSection ? (
                                    <BlockEditorPanel 
                                        section={selectedSection}
                                        onUpdate={(updates) => handleSectionUpdate(selectedId!, updates)}
                                        onDelete={handleDelete}
                                        isProcessing={isProcessing === 'illustration' || isProcessing === 'upload'}
                                        onRegenerate={handleRegenerateIllustration}
                                        onUpload={(file) => handleFileUpload(file, { maxWidth: data.width, quality: 0.85 }, base64 => handleSectionUpdate(selectedId!, { imageUrl: base64, prompt: 'Uploaded by user' }))}
                                    />
                                ) : selectedDecoration ? (
                                     <DecorationPanel
                                        decoration={selectedDecoration}
                                        onUpdate={(updates) => handleDecorationUpdate(selectedId!, updates)}
                                        onDelete={handleDelete}
                                        onUpload={(file) => handleFileUpload(file, { maxWidth: 800, quality: 0.8 }, base64 => handleDecorationUpdate(selectedId!, { imageUrl: base64 }))}
                                        availableLayoutBoxes={[]}
                                        parentSize={{ width: data.width, height: contentHeight }}
                                        template={pseudoTemplateForDeco}
                                     />
                                ) : (
                                    <div className="text-gray-400 text-center p-4 border-2 border-dashed border-gray-600 rounded-lg h-full flex items-center justify-center">
                                        <p>从预览中选择一个元素进行编辑。</p>
                                    </div>
                                )}
                            </div>
                        </details>
                        <details className="bg-gray-700/50 rounded-lg">
                            <summary className="font-semibold text-white p-3 cursor-pointer select-none">添加新元素</summary>
                            <div className="p-3 border-t border-gray-600 space-y-2">
                                <p className="text-sm text-gray-400">在当前选中的区块下方添加:</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => handleAddBlock('text')} className="flex items-center justify-center gap-2 p-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"><AddTextIcon className="w-5 h-5" /> 文本</button>
                                    <button onClick={() => handleAddBlock('image')} className="flex items-center justify-center gap-2 p-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm"><PhotoIcon className="w-5 h-5" /> 图片</button>
                                    <button onClick={() => handleAddBlock('decoration')} className="flex items-center justify-center gap-2 p-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors text-sm"><SparklesIcon className="w-5 h-5" /> 装饰</button>
                                </div>
                            </div>
                        </details>
                        <details className="bg-gray-700/50 rounded-lg">
                            <summary className="font-semibold text-white p-3 cursor-pointer select-none">背景设置</summary>
                            <div className="p-3 border-t border-gray-600 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">背景图提示词</label>
                                    <textarea value={backgroundPrompt} onChange={(e) => setBackgroundPrompt(e.target.value)} placeholder="例如：subtle gradient, minimalist texture" className="w-full h-24 p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                                </div>
                                <button onClick={handleGenerateBackground} disabled={isProcessing === 'background' || !backgroundPrompt} className="w-full flex items-center justify-center gap-2 p-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm disabled:bg-gray-500">{isProcessing === 'background' ? <SpinnerIcon className="w-5 h-5"/> : <ArrowPathIcon className="w-5 h-5"/>} 生成新背景</button>
                                <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) { handleFileUpload(file, { maxWidth: data.width, quality: 0.8 }, base64 => { handleUpdate({ background: { ...data.background, type: 'image', value: base64 } }); }); } }; input.click(); }} disabled={isProcessing === 'upload'} className="w-full flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm disabled:bg-gray-500">{isProcessing === 'upload' ? <SpinnerIcon className="w-5 h-5"/> : <ArrowUpTrayIcon className="w-5 h-5"/>} 上传背景图</button>
                            </div>
                        </details>
                   </div>
                </aside>

                <main ref={editorWrapperRef} className="flex-grow bg-gray-900 flex items-start justify-center p-4 overflow-hidden relative cursor-grab" onMouseDown={handleWrapperMouseDown} onWheel={handleWheel}>
                    <div ref={canvasRef} style={{ position: 'absolute', top: pan.y, left: pan.x, transform: `scale(${zoom})`, transformOrigin: 'top left' }} onClick={() => { setSelectedId(null); setSelectedType(null); }}>
                        <div ref={contentWrapperRef} className="shadow-2xl rounded-lg ring-1 ring-white/10 relative" style={{width: data.width}}>
                            <LongArticleContent data={data} selectedId={selectedId} onElementClick={handleElementClick}>
                                {(data.decorations || []).map(deco => (
                                    <EditableDecorationElement
                                        key={deco.id}
                                        element={deco}
                                        parentSize={{ width: data.width, height: contentHeight }}
                                        template={pseudoTemplateForDeco}
                                        zoom={zoom}
                                        isSelected={deco.id === selectedId}
                                        onSetGuides={setGuides}
                                        onClick={(e) => { e.stopPropagation(); handleElementClick(deco.id, 'decoration'); }}
                                        onUpdate={handleDecorationUpdate}
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
                            width: data.width,
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