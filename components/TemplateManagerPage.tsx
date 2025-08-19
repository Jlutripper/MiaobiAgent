import React, { useState, useEffect } from 'react';
import { XMarkIcon, AddTextIcon, DownloadIcon, ArrowUpTrayIcon, PencilIcon, TrashIcon, SparklesIcon, SpinnerIcon } from './icons';
import { LongArticleTemplate, PosterTemplate } from '../types';
import { LongArticleTemplateEditor } from './LongArticleTemplateEditor';
import { PosterTemplateEditor } from './PosterTemplateEditor';
import { resizeAndCompressImage } from './utils/imageUtils';
import { COMMON_POSTER_SIZES } from '../constants';
import { deconstructImageToTemplate } from '../services/visualDeconstructorService';

const CreateTemplateModal = ({ onCancel, onComplete }: { onCancel: () => void, onComplete: (name: string, description: string, type: 'long_article' | 'poster', width: number, height: number) => void }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'long_article' | 'poster'>('poster');
    const [width, setWidth] = useState(COMMON_POSTER_SIZES[0].width);
    const [height, setHeight] = useState(COMMON_POSTER_SIZES[0].height);
    const [selectedSize, setSelectedSize] = useState(COMMON_POSTER_SIZES[0].name);

    const canSubmit = name && description && width > 0 && height > 0;

    const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const sizeName = e.target.value;
        setSelectedSize(sizeName);
        if (sizeName !== 'Custom') {
            const size = COMMON_POSTER_SIZES.find(s => s.name === sizeName);
            if (size) {
                setWidth(size.width);
                setHeight(size.height);
            }
        }
    };

    return (
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-pop-in" onClick={onCancel}>
            <div className="bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6 border border-gray-700 flex flex-col gap-6 text-white" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold">创建新模板</h2>
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">模板类型</label>
                         <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                             <option value="poster">海报 (固定尺寸)</option>
                             <option value="long_article">长图文 (自动高度)</option>
                         </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">模板名称</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例如：简约商务风" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">模板描述</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="用于 AI 识别何时使用此模板" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" rows={3}></textarea>
                    </div>
                    {type === 'poster' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">画布尺寸</label>
                             <select value={selectedSize} onChange={handleSizeChange} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md mb-2">
                                {COMMON_POSTER_SIZES.map(s => <option key={s.name} value={s.name}>{s.name} ({s.width}x{s.height})</option>)}
                                <option value="Custom">自定义尺寸</option>
                             </select>
                             {selectedSize === 'Custom' && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <input type="number" value={width} onChange={e => setWidth(parseInt(e.target.value, 10) || 0)} placeholder="宽度" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
                                    <input type="number" value={height} onChange={e => setHeight(parseInt(e.target.value, 10) || 0)} placeholder="高度" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
                                </div>
                             )}
                        </div>
                    )}
                    {type === 'long_article' && (
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">内容宽度 (像素)</label>
                            <input type="number" value={width} onChange={e => setWidth(parseInt(e.target.value, 10))} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
                        </div>
                    )}
                </div>
                 <div className="flex gap-4 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">取消</button>
                    <button onClick={() => onComplete(name, description, type, width, height)} disabled={!canSubmit} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed">创建并编辑</button>
                </div>
            </div>
        </div>
    )
}

const compressBase64Image = (base64: string, options: { maxWidth: number; quality: number }): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const { width, height } = img;
            let newWidth = width;
            let newHeight = height;
            if (newWidth > options.maxWidth) {
                newWidth = options.maxWidth;
                newHeight = newWidth / (width / height);
            }
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas context failed'));
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            
            const outputMimeType = base64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
            resolve(canvas.toDataURL(outputMimeType, options.quality));
        };
        img.onerror = reject;
    });
};

export const TemplateManagerPage = ({
    longArticleTemplates,
    setLongArticleTemplates,
    posterTemplates,
    setPosterTemplates,
    onClose
}: {
    longArticleTemplates: LongArticleTemplate[];
    setLongArticleTemplates: React.Dispatch<React.SetStateAction<LongArticleTemplate[]>>;
    posterTemplates: PosterTemplate[];
    setPosterTemplates: React.Dispatch<React.SetStateAction<PosterTemplate[]>>;
    onClose: () => void;
}) => {
    const [activeTab, setActiveTab] = useState<'poster' | 'long_article'>('poster');
    const [editingTemplate, setEditingTemplate] = useState<LongArticleTemplate | PosterTemplate | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeconstructing, setIsDeconstructing] = useState(false);
    
    const templates = activeTab === 'long_article' ? longArticleTemplates : posterTemplates;
    
    const handleStartCreate = () => setIsCreating(true);

    const handleCompleteCreate = (name: string, description: string, type: 'long_article' | 'poster', width: number, height: number) => {
        if (type === 'long_article') {
            const newTemplate: LongArticleTemplate = { id: `template-${Date.now()}`, name, description, width, tags: [], coverImageUrl: '', background: { type: 'color', value: '#F3F4F6', blur: 'none', tintColor: 'rgba(0,0,0,0)' }, contentContainer: { backgroundColor: 'rgba(255,255,255,0.9)', backgroundImage: null, backgroundBlur: 'none', borderRadius: 16, marginTop: 60, marginBottom: 60, marginX: 40, paddingTop: 40, paddingRight: 40, paddingBottom: 40, paddingLeft: 40 }, sections: [], decorations: [] };
            setEditingTemplate(newTemplate);
        } else {
             const newTemplate: PosterTemplate = { id: `poster-template-${Date.now()}`, name, description, width, height, tags: [], coverImageUrl: '', background: { type: 'color', value: '#374151', blur: 'none', tintColor: 'rgba(0,0,0,0)' }, layoutBoxes: [], decorations: [] };
             setEditingTemplate(newTemplate);
        }
        setIsCreating(false);
    }
    
    const handleSaveTemplate = (template: LongArticleTemplate | PosterTemplate) => {
        // This logic correctly determines the template type by checking for a unique property.
        if ('layoutBoxes' in template) { // It's a PosterTemplate
            setPosterTemplates(prev => {
                const existingIndex = prev.findIndex(t => t.id === template.id);
                if (existingIndex > -1) {
                    const newTemplates = [...prev];
                    newTemplates[existingIndex] = template;
                    return newTemplates;
                }
                return [...prev, template];
            });
        } else if ('contentContainer' in template) { // It's a LongArticleTemplate
             setLongArticleTemplates(prev => {
                const existingIndex = prev.findIndex(t => t.id === template.id);
                if (existingIndex > -1) {
                    const newTemplates = [...prev];
                    newTemplates[existingIndex] = template;
                    return newTemplates;
                }
                return [...prev, template];
            });
        }
        setEditingTemplate(null);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("确定要删除这个模板吗？")) {
            if (activeTab === 'long_article') {
                setLongArticleTemplates(prev => prev.filter(t => t.id !== id));
            } else {
                setPosterTemplates(prev => prev.filter(t => t.id !== id));
            }
            setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
        }
    };

    const handleExport = () => {
        if (selectedIds.length === 0) return;
        const templatesToExport = templates.filter(t => selectedIds.includes(t.id));
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(templatesToExport, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `ai_assistant_templates_${activeTab}_${selectedIds.length}_items.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        setSelectedIds([]);
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        try {
            const importedTemplatesUntyped = JSON.parse(text);
            if (!Array.isArray(importedTemplatesUntyped)) throw new Error("Invalid format: Not an array.");
            if (importedTemplatesUntyped.length === 0) return;
            
            const compressTemplateImages = async (template: any) => {
                const compress = (b64: string) => b64 ? compressBase64Image(b64, { maxWidth: 1280, quality: 0.85 }) : Promise.resolve(null);
                
                if (template.coverImageUrl) template.coverImageUrl = await compress(template.coverImageUrl);
                if (template.background?.type === 'image') template.background.value = await compress(template.background.value);
                if (template.contentContainer?.backgroundImage) template.contentContainer.backgroundImage = await compress(template.contentContainer.backgroundImage);
                if (template.decorations) {
                    for(const deco of template.decorations) {
                         if (deco.imageUrl) deco.imageUrl = await compress(deco.imageUrl);
                    }
                }
                const sections = template.sections || template.layoutBoxes?.flatMap((b:any) => b.sections) || [];
                 for(const section of sections) {
                    if (section.type === 'image' && section.imageUrl) section.imageUrl = await compress(section.imageUrl);
                }
                return template;
            }
            
            const compressedTemplates = await Promise.all(importedTemplatesUntyped.map(compressTemplateImages));

            const isLongArticle = compressedTemplates[0].hasOwnProperty('contentContainer');
            const isPoster = compressedTemplates[0].hasOwnProperty('layoutBoxes');

            if (isLongArticle) {
                setLongArticleTemplates(prev => [...prev, ...compressedTemplates]);
                setActiveTab('long_article');
            } else if (isPoster) {
                setPosterTemplates(prev => [...prev, ...compressedTemplates]);
                setActiveTab('poster');
            } else {
                throw new Error("Unknown template format.");
            }
            alert(`成功导入 ${compressedTemplates.length} 个模板。`);

        } catch (e) {
            console.error("Import error:", e);
            alert(`导入失败: ${e instanceof Error ? e.message : '无效的JSON文件'}`);
        }
        event.target.value = ''; // Reset file input
    };

    const handleImageImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsDeconstructing(true);
        try {
            const base64Image = await resizeAndCompressImage(file, { maxWidth: 1080, quality: 0.9 });
            
            const img = new Image();
            await new Promise(resolve => {
                img.onload = resolve;
                img.src = base64Image;
            });

            const originalAspectRatio = img.width / img.height;
            let bestMatch = COMMON_POSTER_SIZES[0];
            let minDiff = Infinity;

            COMMON_POSTER_SIZES.forEach(size => {
                const sizeAspectRatio = size.width / size.height;
                const diff = Math.abs(originalAspectRatio - sizeAspectRatio);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestMatch = size;
                }
            });

            const targetDimensions = { width: bestMatch.width, height: bestMatch.height };
            const newTemplate = await deconstructImageToTemplate(base64Image, targetDimensions);
            
            newTemplate.id = `poster-template-${Date.now()}`;
            if (!newTemplate.coverImageUrl) {
                newTemplate.coverImageUrl = base64Image;
            }

            setActiveTab('poster');
            setEditingTemplate(newTemplate);

        } catch (e) {
            console.error("Image deconstruction failed:", e);
            alert(`从图片导入失败: ${e instanceof Error ? e.message : '未知错误'}`);
        } finally {
            setIsDeconstructing(false);
            event.target.value = ''; // Reset file input to allow re-uploading the same file
        }
    };

    const toggleSelection = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    const toggleSelectAll = () => setSelectedIds(selectedIds.length === templates.length ? [] : templates.map(t => t.id));
    
    useEffect(() => {
        setSelectedIds([]);
    }, [activeTab]);

    if (editingTemplate) {
        if (editingTemplate.hasOwnProperty('contentContainer')) {
            return <LongArticleTemplateEditor initialTemplate={editingTemplate as LongArticleTemplate} onSave={handleSaveTemplate as any} onCancel={() => setEditingTemplate(null)} />;
        }
        if (editingTemplate.hasOwnProperty('layoutBoxes')) {
            return <PosterTemplateEditor initialTemplate={editingTemplate as PosterTemplate} onSave={handleSaveTemplate as any} onCancel={() => setEditingTemplate(null)} />;
        }
    }

    return (
        <>
            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center animate-pop-in z-30" onClick={onClose}>
                <div className="bg-gray-800 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 border border-gray-700 flex flex-col gap-4 text-white" onClick={e => e.stopPropagation()}>
                    <header className="flex justify-between items-center flex-shrink-0">
                        <h2 className="text-xl sm:text-2xl font-bold">模板管理</h2>
                        <div className="flex items-center gap-2">
                            <button onClick={handleExport} disabled={selectedIds.length === 0} title="导出所选模板" className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 font-semibold rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"><DownloadIcon className="w-5 h-5" /> ({selectedIds.length})</button>
                            <input type="file" id="import-templates" className="hidden" accept=".json" onChange={handleImport} />
                            <label htmlFor="import-templates" title="导入模板" className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 font-semibold rounded-lg hover:bg-gray-500 transition-colors cursor-pointer"><ArrowUpTrayIcon className="w-5 h-5" /></label>
                            <input type="file" id="import-from-image" className="hidden" accept="image/*" onChange={handleImageImport} />
                            <label htmlFor="import-from-image" title="从图片导入模板 (AI)" className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 font-semibold rounded-lg hover:bg-purple-700 transition-colors cursor-pointer"><SparklesIcon className="w-5 h-5" /> 图片导入</label>
                            <button onClick={handleStartCreate} className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition-colors"><AddTextIcon className="w-5 h-5" /> 创建</button>
                            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"><XMarkIcon className="w-6 h-6" /></button>
                        </div>
                    </header>
                    
                    <div className="border-b border-gray-700">
                        <nav className="flex gap-4">
                            <button onClick={() => setActiveTab('poster')} className={`py-2 px-4 font-semibold ${activeTab === 'poster' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}>海报模板</button>
                            <button onClick={() => setActiveTab('long_article')} className={`py-2 px-4 font-semibold ${activeTab === 'long_article' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}>长图文模板</button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4 py-2 border-b border-gray-700">
                        <input type="checkbox" className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500" checked={templates.length > 0 && selectedIds.length === templates.length} onChange={toggleSelectAll} disabled={templates.length === 0} />
                        <label className="text-sm text-gray-300">已选择 {selectedIds.length} / {templates.length}</label>
                    </div>

                    <div className="flex-grow min-h-0 overflow-y-auto pr-2 -mr-2">
                        {templates.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {templates.map(template => (
                                    <div key={template.id} className={`bg-gray-700 rounded-lg shadow-lg flex flex-col group relative transition-all duration-200 cursor-pointer ${selectedIds.includes(template.id) ? 'ring-2 ring-blue-500' : 'ring-1 ring-transparent'}`} onClick={() => toggleSelection(template.id)}>
                                        <div className="absolute top-2 left-2 z-10">
                                            <input type="checkbox" className="h-4 w-4 rounded bg-gray-800/50 text-purple-600 focus:ring-purple-500 border-gray-500" checked={selectedIds.includes(template.id)} readOnly />
                                        </div>
                                        <img src={template.coverImageUrl || `data:image/svg+xml;base64,${btoa(`<svg width="300" height="150" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#555"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#fff" text-anchor="middle" dy=".3em">No Cover</text></svg>`)}`} alt={template.name} className="w-full h-32 object-cover rounded-t-lg bg-gray-600"/>
                                        <div className="p-4 flex flex-col flex-grow">
                                            <h3 className="font-bold text-white">{template.name}</h3>
                                            <p className="text-sm text-gray-400 mt-1 flex-grow">{template.description}</p>
                                        </div>
                                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                             <button onClick={(e) => { e.stopPropagation(); setEditingTemplate(template)}} className="p-1.5 bg-blue-600/80 text-white rounded-full hover:bg-blue-500"><PencilIcon className="w-4 h-4"/></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(template.id)}} className="p-1.5 bg-red-600/80 text-white rounded-full hover:bg-red-500"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-gray-400 text-center p-4 border-2 border-dashed border-gray-600 rounded-lg h-full flex items-center justify-center">
                                <p>还没有模板。<br/>点击“创建”或“图片导入”来添加一个吧！</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {isCreating && <CreateTemplateModal onCancel={() => setIsCreating(false)} onComplete={handleCompleteCreate} />}
            {isDeconstructing && (
                <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 text-white">
                    <SpinnerIcon className="w-12 h-12" />
                    <p className="text-xl font-semibold">AI 正在解析您的图片布局...</p>
                    <p className="text-gray-400">这可能需要一点时间</p>
                </div>
            )}
        </>
    );
};