import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { ResultData, PosterTemplate, ImageSection } from '../../../types';
import { ResultActionButtons } from './ResultActionButtons';
import { DownloadIcon, SparklesIcon, SpinnerIcon } from '../../icons';
import { EditableLayoutBox } from '../../EditableLayoutBox';
import { EditableDecorationElement } from '../../EditableDecorationElement';
import { PosterContent } from '../../PosterTemplateEditor';


const StaticPosterRenderer = ({ template }: { template: PosterTemplate }) => {
    const posterSize = { width: template.width, height: template.height };

    return (
        <PosterContent template={template}>
            {template.layoutBoxes.map((box) => (
                <EditableLayoutBox
                    key={box.id}
                    box={box}
                    path={[box.id]}
                    parentSize={posterSize}
                    zoom={1}
                    isSelected={() => false}
                    template={template}
                    otherBoxes={template.layoutBoxes.filter(b => b.id !== box.id)}
                    otherDecorations={template.decorations || []}
                    onSetGuides={() => {}}
                    onSelect={() => {}}
                    onUpdate={() => {}}
                    editorMode="instance"
                    editingTextPath={null}
                    onEnterTextEditMode={() => {}}
                    onExitTextEditMode={() => {}}
                    onSelectionChange={() => {}}
                />
            ))}
            {(template.decorations || []).map(deco => (
                <EditableDecorationElement
                    key={deco.id}
                    element={deco}
                    parentSize={posterSize}
                    template={template}
                    zoom={1}
                    isSelected={false}
                    onSetGuides={() => {}}
                    onClick={() => {}}
                    onUpdate={() => {}}
                />
            ))}
        </PosterContent>
    );
};


export const createPosterSnapshot = (
    posterData: Omit<ResultData & { type: 'poster' }, 'type' | 'prompt' | 'previewImageUrl'>,
    options: { scale: number }
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0px';
        tempContainer.style.width = `${posterData.width}px`;
        tempContainer.style.height = `${posterData.height}px`;
        document.body.appendChild(tempContainer);

        try {
            const templateForSnapshot: PosterTemplate = {
                ...(posterData as Omit<PosterTemplate, 'id' | 'name' | 'description' | 'tags' | 'coverImageUrl'>),
                id: posterData.templateId || 'snapshot-id',
                name: 'snapshot',
                description: '', tags: [], coverImageUrl: '',
            };
            
            const imageUrls = new Set<string>();
            if (templateForSnapshot.background.type === 'image' && templateForSnapshot.background.value) imageUrls.add(templateForSnapshot.background.value);
            templateForSnapshot.layoutBoxes.forEach(box => {
                if (box.backgroundImage) imageUrls.add(box.backgroundImage);
                const queue = [...box.sections];
                while(queue.length > 0) {
                    const sec = queue.shift();
                    if(!sec) continue;
                    if (sec.type === 'image' && sec.imageUrl) imageUrls.add(sec.imageUrl);
                    if (sec.type === 'layout_box' && sec.sections) queue.push(...sec.sections);
                }
            });
            (templateForSnapshot.decorations || []).forEach(deco => { if (deco.imageUrl) imageUrls.add(deco.imageUrl); });
            
            const imageLoadPromises = Array.from(imageUrls).filter(Boolean).map(src => {
                return new Promise<void>((resolveImg) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => resolveImg();
                    img.onerror = () => resolveImg();
                    img.src = src;
                });
            });
            
            await Promise.all(imageLoadPromises);
            
            const root = createRoot(tempContainer);
            root.render(<React.StrictMode><StaticPosterRenderer template={templateForSnapshot} /></React.StrictMode>);
            
            await new Promise(res => requestAnimationFrame(() => setTimeout(res, 100)));
            
            const canvas = await html2canvas(tempContainer, {
                useCORS: true,
                scale: options.scale,
                backgroundColor: null,
                width: posterData.width,
                height: posterData.height,
                allowTaint: true
            });
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);

        } catch (error) {
            console.error("Snapshot creation failed:", error);
            reject(error);
        } finally {
            // React 18's createRoot doesn't have a direct unmount on the container.
            // We find the internal root object and call unmount on it.
            const root = (tempContainer as any)._reactRootContainer;
            if (root) {
                root.unmount();
            }
            document.body.removeChild(tempContainer);
        }
    });
};


export const PosterResult = ({ result, onEdit }: { result: ResultData & { type: 'poster' }; onEdit: (data: ResultData) => void; }) => {
    const [isExporting, setIsExporting] = useState(false);

    const handlePosterExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const dataUrl = await createPosterSnapshot(result, { scale: 2 });
            const link = document.createElement('a');
            link.download = `poster-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("Failed to export poster:", error);
            alert("抱歉，导出海报时出错。");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            {result.previewImageUrl ? (
                <img src={result.previewImageUrl} alt={result.prompt} className="w-full h-auto rounded-lg object-contain" />
            ) : (
                <div className="w-full h-48 bg-gray-700 flex items-center justify-center text-gray-500 rounded-lg">
                    <SpinnerIcon className="w-8 h-8"/>
                    <span className="ml-2">生成预览中...</span>
                </div>
            )}
            <ResultActionButtons>
                <button 
                    onClick={handlePosterExport}
                    disabled={isExporting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:bg-gray-500"
                >
                    {isExporting ? <SpinnerIcon className="w-4 h-4"/> : <DownloadIcon className="w-4 h-4" />}
                    {isExporting ? "导出中..." : "导出"}
                </button>
                <button 
                  onClick={() => onEdit(result)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                    <SparklesIcon className="w-4 h-4" /> 编辑
                </button>
            </ResultActionButtons>
        </>
    );
};