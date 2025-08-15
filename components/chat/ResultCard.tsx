import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { ResultData, PosterTemplate } from '../../types';
import { DownloadIcon, SparklesIcon, SpinnerIcon, ArticleIcon } from '../icons';
import { PosterPreview, PosterPreviewRenderer } from '../PosterPreview';
import { LongArticlePreview } from '../LongArticlePreview';

export const ResultCard = ({ result, onEditPoster, onEditArticle }: { result: ResultData; onEditPoster: (posterData: ResultData) => void; onEditArticle: (articleData: ResultData) => void; }) => {
    const [isExporting, setIsExporting] = useState(false);

    // Download for simple images
    const handleSimpleImageDownload = () => {
        if (result.type !== 'image') return;
        const link = document.createElement('a');
        link.href = result.imageUrl; 
        link.download = "ai-generated-image.png";
        link.click();
    };
    
    // Export for posters
    const handlePosterExport = async () => {
        if (isExporting || result.type !== 'poster') return;
        setIsExporting(true);

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        tempContainer.style.width = `${result.width}px`;
        document.body.appendChild(tempContainer);
        const root = createRoot(tempContainer);
        
        const templateForExport: PosterTemplate = {
            ...result,
            id: result.templateId || 'export-poster',
            name: result.prompt,
            description: '',
            tags: [],
            coverImageUrl: ''
        };

        try {
            await new Promise<void>((resolve) => {
                 root.render(
                    <React.StrictMode>
                        <PosterPreviewRenderer template={templateForExport} onRendered={resolve} />
                    </React.StrictMode>
                );
            });

            const canvas = await html2canvas(tempContainer.firstChild as HTMLElement, {
                 useCORS: true,
                 scale: 2, // Export at 2x resolution
                 backgroundColor: null,
                 width: result.width,
                 height: result.height, // FIX: Use explicit height, not scrollHeight
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
            root.unmount();
            document.body.removeChild(tempContainer);
            setIsExporting(false);
        }
    };


    return (
        <div className="mt-2 border-t border-gray-600 pt-3 animate-pop-in">
            {result.type === 'poster' ? (
                <PosterPreview result={result} />
            ) : result.type === 'long_article' ? (
                <LongArticlePreview result={result} />
            ) : (
                <img src={result.imageUrl} alt="Generated result" className="rounded-lg w-full object-contain max-h-80" />
            )}
            <div className="mt-3 flex gap-2">
                {result.type === 'image' && (
                     <button 
                        onClick={handleSimpleImageDownload}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        下载
                    </button>
                )}
               
                {result.type === 'poster' && (
                    <>
                        <button 
                            onClick={handlePosterExport}
                            disabled={isExporting}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:bg-gray-500"
                        >
                            {isExporting ? <SpinnerIcon className="w-4 h-4"/> : <DownloadIcon className="w-4 h-4" />}
                            {isExporting ? "导出中..." : "导出"}
                        </button>
                        <button 
                          onClick={() => onEditPoster(result)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                            <SparklesIcon className="w-4 h-4" /> 编辑
                        </button>
                    </>
                )}

                {result.type === 'long_article' && (
                    <button 
                      onClick={() => onEditArticle(result)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                        <ArticleIcon className="w-4 h-4" /> 编辑长图文
                    </button>
                )}
            </div>
        </div>
    );
};