import React, { useState, useRef, ReactNode } from 'react';

interface TooltipProps {
    children: ReactNode;
    text: string;
}

export const Tooltip = ({ children, text }: TooltipProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    return (
        <div 
            className="relative flex items-center" 
            onMouseEnter={() => setIsVisible(true)} 
            onMouseLeave={() => setIsVisible(false)}
            ref={ref}
        >
            {children}
            {isVisible && (
                <div 
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 bg-gray-900 text-white text-xs rounded-md shadow-lg z-50 animate-pop-in"
                >
                    {text}
                </div>
            )}
        </div>
    );
};