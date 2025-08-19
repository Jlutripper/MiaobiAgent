import React from 'react';
import { CogIcon, WandIcon, PlusIcon, TemplateIcon } from './icons';

interface HeaderProps {
    onSettingsClick: () => void;
    onNewChatClick: () => void;
    onTemplateManagerClick: () => void;
}

export const Header = ({ onSettingsClick, onNewChatClick, onTemplateManagerClick }: HeaderProps) => {
    return (
        <header className="w-full bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 p-3 flex items-center justify-between flex-shrink-0 z-10">
            <div className="flex items-center gap-3">
                <WandIcon className="w-7 h-7 text-purple-400" />
                <h1 className="text-lg font-bold text-white">AI 创意助手</h1>
            </div>
            <div className="flex items-center gap-2">
                 <button onClick={onNewChatClick} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors" title="新对话">
                    <PlusIcon className="w-6 h-6" />
                </button>
                 <button onClick={onTemplateManagerClick} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors" title="模板管理">
                    <TemplateIcon className="w-6 h-6" />
                </button>
                 <button onClick={onSettingsClick} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors" title="设置">
                    <CogIcon className="w-6 h-6" />
                </button>
            </div>
        </header>
    );
};