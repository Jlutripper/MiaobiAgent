import React from 'react';
import { PencilIcon, TrashIcon } from './icons';

interface LayoutBoxToolbarProps {
    onEnterEditMode: () => void;
    onDelete: () => void;
}

export const LayoutBoxToolbar = ({ onEnterEditMode, onDelete }: LayoutBoxToolbarProps) => {
    return (
        <div className="flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm rounded-lg p-1 shadow-lg">
            <button onClick={onEnterEditMode} className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors">
                <PencilIcon className="w-3 h-3" />
                编辑内容
            </button>
            <button onClick={onDelete} className="p-1.5 text-white bg-red-600 rounded hover:bg-red-700 transition-colors">
                <TrashIcon className="w-3 h-3" />
            </button>
        </div>
    );
};
