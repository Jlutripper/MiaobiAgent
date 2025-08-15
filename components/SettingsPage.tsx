import React, { useState } from 'react';
import { XMarkIcon, AddTextIcon } from './icons';
import { CustomTool } from '../types';
import { PREDEFINED_TOOLS } from '../constants';

interface SettingsPageProps {
    onClose: () => void;
    customTools: CustomTool[];
    setCustomTools: React.Dispatch<React.SetStateAction<CustomTool[]>>;
}

export const SettingsPage = ({ onClose, customTools, setCustomTools }: SettingsPageProps) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [requiresText, setRequiresText] = useState(false);
    const [requiresImage, setRequiresImage] = useState(false);
    
    const isFormIncomplete = !name || !description || !systemPrompt || (!requiresText && !requiresImage);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isFormIncomplete) return;

        const newTool: CustomTool = {
            id: `custom-tool-${Date.now()}`,
            name,
            description,
            systemPrompt,
            requiresText,
            requiresImage
        };
        setCustomTools(prev => [...prev, newTool]);

        // Reset form
        setName('');
        setDescription('');
        setSystemPrompt('');
        setRequiresText(false);
        setRequiresImage(false);
    };

    const handleDelete = (id: string) => {
        setCustomTools(prev => prev.filter(tool => tool.id !== id));
    };

    return (
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center animate-pop-in z-30" onClick={onClose}>
            <div className="bg-gray-800 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 border border-gray-700 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-white">AI 功能管理</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-grow min-h-0">
                    {/* Form for new tool */}
                    <div className="bg-gray-900/50 p-4 rounded-lg flex flex-col gap-4 border border-gray-700">
                        <h3 className="text-lg font-semibold text-white">创建新功能</h3>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto pr-2">
                             <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">功能名称</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例如：表情包制作器" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">功能描述 (用于AI识别意图)</label>
                                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="例如：给图片加上文字制作成梗图" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">需要用户输入</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-white">
                                        <input type="checkbox" checked={requiresText} onChange={e => setRequiresText(e.target.checked)} className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500" />
                                        文本
                                    </label>
                                    <label className="flex items-center gap-2 text-white">
                                        <input type="checkbox" checked={requiresImage} onChange={e => setRequiresImage(e.target.checked)} className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500" />
                                        图片
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">系统指令 (告诉AI该做什么)</label>
                                <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={5} placeholder="你是一个表情包制作器。根据用户的文字和图片，用一种有趣的方式把文字放在图片上，然后输出最终图片。" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"></textarea>
                            </div>
                            <button type="submit" disabled={isFormIncomplete} className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                                <AddTextIcon className="w-5 h-5" /> 添加功能
                            </button>
                        </form>
                    </div>

                    {/* List of existing tools */}
                    <div className="flex flex-col gap-4 overflow-y-auto">
                        {/* Built-in Tools */}
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">内置功能</h3>
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                <ul className="space-y-3">
                                    {PREDEFINED_TOOLS.map(tool => (
                                        <li key={tool.id} className="bg-gray-700/50 p-3 rounded-md">
                                            <h4 className="font-bold text-white">{tool.name}</h4>
                                            <p className="text-sm text-gray-400">{tool.description}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        {/* Custom Tools */}
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">自定义功能</h3>
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                {customTools.length > 0 ? (
                                    <ul className="space-y-3">
                                        {customTools.map(tool => (
                                            <li key={tool.id} className="bg-gray-700 p-3 rounded-md flex justify-between items-start gap-2">
                                                <div>
                                                    <h4 className="font-bold text-white">{tool.name}</h4>
                                                    <p className="text-sm text-gray-400">{tool.description}</p>
                                                    <div className="mt-1 flex gap-2 text-xs">
                                                        {tool.requiresText && <span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">需要文本</span>}
                                                        {tool.requiresImage && <span className="bg-green-900 text-green-300 px-2 py-0.5 rounded-full">需要图片</span>}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDelete(tool.id)} className="text-red-400 hover:text-red-300 font-bold flex-shrink-0 p-1">删除</button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-gray-400 text-center p-4 border-2 border-dashed border-gray-600 rounded-lg h-full flex items-center justify-center">
                                        还没有自定义功能。
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
