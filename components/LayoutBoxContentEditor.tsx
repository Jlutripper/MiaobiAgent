import React, { useState } from 'react';
import { LayoutBox, ArticleSection, TextSection, ImageSection, TextStyleDefinition } from '../types';
import { BlockEditorPanel } from './BlockEditorPanel';
import { XMarkIcon, AddTextIcon, PhotoIcon } from './icons';
import { resizeAndCompressImage } from './utils/imageUtils';

interface LayoutBoxContentEditorProps {
    box: LayoutBox;
    onSave: (updatedBox: LayoutBox) => void;
    onCancel: () => void;
    posterWidth: number;
}

const DEFAULT_TEXT_STYLE: TextStyleDefinition = { fontFamily: "'Noto Sans SC', sans-serif", fontSize: 24, fontWeight: 400, color: '#333333', textAlign: 'left', lineHeight: 1.8 };
const NEW_IMAGE_PLACEHOLDER = `data:image/svg+xml;base64,${btoa(`<svg width="1080" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e9e9e9"/><text x="50%" y="50%" font-family="sans-serif" font-size="48" fill="#a0a0a0" text-anchor="middle" dy=".3em">New Image Block</text></svg>`)}`;


export const LayoutBoxContentEditor = ({ box, onSave, onCancel, posterWidth }: LayoutBoxContentEditorProps) => {
    const [editedBox, setEditedBox] = useState<LayoutBox>(box);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    const selectedSection = editedBox.sections.find(s => s.id === selectedSectionId);

    const handleSectionUpdate = (id: string, updates: Partial<ArticleSection>) => {
        setEditedBox(prevBox => ({
            ...prevBox,
            sections: prevBox.sections.map(s => (s.id === id ? { ...s, ...updates } : s)) as ArticleSection[],
        }));
    };

    const handleDeleteSection = () => {
        if (!selectedSectionId) return;
        setEditedBox(prevBox => ({
            ...prevBox,
            sections: prevBox.sections.filter(s => s.id !== selectedSectionId)
        }));
        setSelectedSectionId(null);
    };

    const handleAddSection = (type: 'text' | 'image') => {
        const newId = `${type}-${Date.now()}`;
        const newSection: TextSection | ImageSection = type === 'text'
            ? { id: newId, type: 'text', role: 'body', content: [{ text: 'New Text', style: {} }], style: DEFAULT_TEXT_STYLE, flexGrow: 0, flexShrink: 1 }
            : { id: newId, type: 'image', role: 'illustration', imageUrl: NEW_IMAGE_PLACEHOLDER, prompt: 'placeholder image', flexGrow: 0, flexShrink: 1 };

        const currentIndex = selectedSectionId ? editedBox.sections.findIndex(s => s.id === selectedSectionId) : -1;

        const newSections: ArticleSection[] = [...editedBox.sections];
        newSections.splice(currentIndex + 1, 0, newSection);

        setEditedBox(prevBox => ({ ...prevBox, sections: newSections }));
    };

    const handleFileUpload = async (file: File | null, callback: (url: string) => void) => {
        if (!file) return;
        try {
            const base64 = await resizeAndCompressImage(file, { maxWidth: posterWidth, quality: 0.85 });
            callback(base64);
        } catch (error) {
            alert('File upload failed.');
        }
    };

    return (
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex animate-pop-in" onClick={onCancel}>
            <div className="bg-gray-800 w-[95vw] max-w-5xl h-[90vh] m-auto rounded-2xl shadow-2xl border border-gray-700 flex flex-col text-white" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">编辑容器内容: {box.role}</h2>
                    <div className="flex items-center gap-2">
                         <button onClick={() => onSave(editedBox)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold">
                            完成
                        </button>
                        <button onClick={onCancel} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>

                <div className="flex-grow flex overflow-hidden">
                    {/* Layers Panel */}
                    <aside className="w-64 bg-gray-900/50 p-4 flex-shrink-0 flex flex-col gap-4">
                        <h3 className="font-semibold text-lg">图层</h3>
                         <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleAddSection('text')} className="flex items-center justify-center gap-1 p-2 text-xs bg-blue-600 rounded hover:bg-blue-700"><AddTextIcon className="w-4 h-4" /> 文本</button>
                            <button onClick={() => handleAddSection('image')} className="flex items-center justify-center gap-1 p-2 text-xs bg-indigo-600 rounded hover:bg-indigo-700"><PhotoIcon className="w-4 h-4" /> 图片</button>
                        </div>
                        <ul className="flex-grow overflow-y-auto space-y-1 -mr-2 pr-2">
                            {editedBox.sections.map(section => (
                                <li key={section.id}>
                                    <button
                                        onClick={() => setSelectedSectionId(section.id)}
                                        className={`w-full text-left p-2 rounded text-sm ${selectedSectionId === section.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                                    >
                                        {section.role} ({section.type})
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </aside>

                    {/* Inspector Panel */}
                    <main className="flex-grow p-4 overflow-y-auto">
                        {selectedSection ? (
                            <BlockEditorPanel
                                section={selectedSection}
                                parentBox={editedBox}
                                onUpdate={(updates) => handleSectionUpdate(selectedSection.id, updates)}
                                onDelete={handleDeleteSection}
                                isTemplateMode={true}
                                onUpload={(file) => handleFileUpload(file, (url) => handleSectionUpdate(selectedSection.id, { imageUrl: url, prompt: 'user uploaded' }))}
                            />
                        ) : (
                            <div className="text-gray-400 text-center p-8 border-2 border-dashed border-gray-600 rounded-lg h-full flex items-center justify-center">
                                <p>从左侧图层列表中选择一个元素进行编辑。</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};