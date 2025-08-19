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

    const style: React.CSSProperties = {
        width: '100%',
        backgroundImage: `url(${section.imageUrl || PLACEHOLDER_SVG})`,
        backgroundSize: section.objectFit || 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transform: `rotate(${section.rotation || 0}deg)`,
        cursor: section.isLocked ? 'default' : 'pointer',
    };
    
    // In flow layouts (like long articles), an explicit height is needed.
    // In flex/grid layouts (like posters), '100%' allows it to fill the container.
    if (section.height) {
        style.height = `${section.height}px`;
    } else {
        style.height = '100%';
    }

    return (
        <div
            onClick={handleClick}
            className={`editable-image-section overflow-hidden ${isSelected ? 'outline outline-2 outline-blue-500 outline-offset-2' : ''}`}
            style={style}
        />
    );
};
