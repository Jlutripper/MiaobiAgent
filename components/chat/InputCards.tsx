import React, { useState, useCallback } from 'react';
import { AspectRatio } from '../../types';
import { ASPECT_RATIOS } from '../../constants';
import { PhotoIcon } from '../icons';

interface AspectRatioSelectorProps {
    onSelect: (aspectRatio: AspectRatio) => void;
}

export const AspectRatioSelector = ({ onSelect }: AspectRatioSelectorProps) => {
    return (
        <div className="grid grid-cols-3 gap-2 mt-3 animate-pop-in">
            {ASPECT_RATIOS.map(ratio => (
                <button
                    key={ratio.value}
                    onClick={() => onSelect(ratio.value)}
                    className="p-2 bg-gray-600 text-white rounded-md hover:bg-purple-600 transition-all transform hover:scale-105 text-xs sm:text-sm"
                >
                    {ratio.label}
                </button>
            ))}
        </div>
    );
};

interface LongArticleDetailsInputProps {
    onSubmit: (content: string, width: number, generateIllustrations: boolean) => void;
    initialContent?: string;
}

export const LongArticleDetailsInput = ({ onSubmit, initialContent }: LongArticleDetailsInputProps) => {
    const [content, setContent] = useState(initialContent || '');
    const [width, setWidth] = useState(1080);
    const [generateIllustrations, setGenerateIllustrations] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(content, width || 1080, generateIllustrations);
    };

    return (
         <form onSubmit={handleSubmit} className="space-y-4 mt-3 animate-pop-in">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">长文内容 (选填)</label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="请在此处输入您的文章内容。如果留空，AI将根据主题为您创作。"
                    className="w-full h-32 p-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400"
                />
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">图片宽度 (像素)</label>
                 <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value, 10))}
                    className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-white"
                />
            </div>
            <div className="flex items-center justify-between bg-gray-600/50 p-3 rounded-md">
                <label htmlFor="illustrations-toggle" className="text-sm font-medium text-gray-300">
                    AI 生成段落插图
                </label>
                <button
                    type="button"
                    onClick={() => setGenerateIllustrations(!generateIllustrations)}
                    className={`${
                        generateIllustrations ? 'bg-purple-600' : 'bg-gray-500'
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800`}
                    role="switch"
                    aria-checked={generateIllustrations}
                    id="illustrations-toggle"
                >
                    <span
                        aria-hidden="true"
                        className={`${
                            generateIllustrations ? 'translate-x-5' : 'translate-x-0'
                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                </button>
            </div>
            <button
                type="submit"
                className="w-full p-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition-colors"
            >
                生成长图文
            </button>
        </form>
    );
}

interface FileUploadProps {
    onUpload: (base64Image: string) => void;
}

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const FileUpload = ({ onUpload }: FileUploadProps) => {
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (file: File | null) => {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('请选择一个有效的图片文件。');
            return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            setError(`文件大小不能超过 ${MAX_FILE_SIZE_MB}MB。`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                onUpload(e.target.result as string);
                setError('');
            }
        };
        reader.readAsDataURL(file);
    };

    const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            handleFileChange(event.dataTransfer.files[0]);
        }
    }, [handleFileChange]);

    const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
    }, []);

    return (
        <div className="mt-3 animate-pop-in">
            <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center text-center gap-3 ${isDragging ? 'border-purple-500 bg-gray-600' : 'border-gray-500 hover:border-purple-400'}`}
                onClick={() => document.getElementById('chat-file-upload')?.click()}
            >
                <input type="file" id="chat-file-upload" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} />
                <PhotoIcon className="w-10 h-10 animate-pulse-bright" />
                <div>
                    <p className="text-gray-300 text-sm">拖拽图片到这里, 或 <span className="font-semibold text-purple-400">点击选择</span></p>
                    <p className="text-xs text-gray-400 mt-1">最大 {MAX_FILE_SIZE_MB}MB</p>
                </div>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
    );
};