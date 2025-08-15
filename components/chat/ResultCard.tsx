import React from 'react';
import { ResultData } from '../../types';
import { PosterResult } from './results/PosterResult';
import { LongArticleResult } from './results/LongArticleResult';
import { ImageResult } from './results/ImageResult';

export const ResultCard = ({ result, onEditPoster, onEditArticle }: { result: ResultData; onEditPoster: (posterData: ResultData) => void; onEditArticle: (articleData: ResultData) => void; }) => {
    
    const renderContent = () => {
        switch (result.type) {
            case 'poster':
                return <PosterResult result={result} onEdit={onEditPoster} />;
            case 'long_article':
                return <LongArticleResult result={result} onEdit={onEditArticle} />;
            case 'image':
                return <ImageResult result={result} />;
            default:
                // This will handle the case where result might have an unhandled type in the future.
                const exhaustiveCheck: never = result;
                return null;
        }
    }

    return (
        <div className="mt-2 border-t border-gray-600 pt-3 animate-pop-in">
            {renderContent()}
        </div>
    );
};