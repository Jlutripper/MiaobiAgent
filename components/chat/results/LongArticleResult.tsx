import React from 'react';
import { ResultData } from '../../../types';
import { LongArticlePreview } from '../../LongArticlePreview';
import { ResultActionButtons } from './ResultActionButtons';
import { ArticleIcon } from '../../icons';

export const LongArticleResult = ({ result, onEdit }: { result: ResultData & { type: 'long_article' }; onEdit: (data: ResultData) => void; }) => {
    return (
        <>
            <LongArticlePreview result={result} />
            <ResultActionButtons>
                 <button 
                    onClick={() => onEdit(result)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                    <ArticleIcon className="w-4 h-4" /> 编辑长图文
                </button>
            </ResultActionButtons>
        </>
    );
};