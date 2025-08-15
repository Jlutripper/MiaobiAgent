import React from 'react';
import { ResultData } from '../../../types';
import { ResultActionButtons } from './ResultActionButtons';
import { DownloadIcon } from '../../icons';

export const ImageResult = ({ result }: { result: ResultData & { type: 'image' }; }) => {
    
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = result.imageUrl; 
        link.download = "ai-generated-image.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <img src={result.imageUrl} alt="Generated result" className="rounded-lg w-full object-contain max-h-80" />
            <ResultActionButtons>
                <button 
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                    <DownloadIcon className="w-4 h-4" />
                    下载
                </button>
            </ResultActionButtons>
        </>
    );
};