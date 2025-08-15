import React from 'react';
import { ImageSection } from '../types';

interface EditableImageSectionProps {
    section: ImageSection;
    isSelected: boolean;
    onSelect: (e: React.MouseEvent) => void;
}

const PLACEHOLDER_SVG = `data:image/svg+xml;base64,${btoa(`<svg width="1080" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e9e9e9"/><text x="50%" y="50%" font-family="sans-serif" font-size="48" fill="#a0a0a0" text-anchor="middle" dy=".3em">Image Block</text></svg>`)}`;

export const EditableImageSection = ({ section, isSelected, onSelect }: EditableImageSectionProps) => {
    
    const handleClick = (e: React.MouseEvent) => {
        onSelect(e);
    };

    return (
        <div
            onClick={handleClick}
            className={`w-full h-full editable-image-section ${isSelected ? 'outline outline-2 outline-blue-500 outline-offset-2' : ''}`}
            style={{
                cursor: section.isLocked ? 'not-allowed' : 'default',
            }}
        >
            <img 
                src={section.imageUrl || PLACEHOLDER_SVG} 
                alt={section.prompt || "AI-generated image"} 
                className="w-full h-full pointer-events-none" // prevent img from capturing clicks
                style={{
                    objectFit: section.objectFit || 'cover',
                    transform: `rotate(${section.rotation || 0}deg)`,
                }}
            />
        </div>
    );
};
