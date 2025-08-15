import React, { useRef, useState, useLayoutEffect } from 'react';
import { ResultData } from '../types';
import { LongArticleContent } from './LongArticleEditor';

export const LongArticlePreview = ({ result }: { result: ResultData & { type: 'long_article' } }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);

    useLayoutEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                const containerWidth = entries[0].contentRect.width;
                if (containerWidth > 0 && result.width > 0) {
                    const calculatedScale = Math.min(1, containerWidth / result.width);
                    setScale(calculatedScale);
                }
            }
        });
        const currentContainer = containerRef.current;
        if (currentContainer) {
            observer.observe(currentContainer);
        }
        return () => {
            if (currentContainer) {
                observer.unobserve(currentContainer);
            }
        };
    }, [result.width]);

    useLayoutEffect(() => {
        if (contentRef.current) {
            setContentHeight(contentRef.current.scrollHeight);
        }
    }, [result, scale]); // Recalculate height if content or scale changes

    return (
        <div 
            ref={containerRef} 
            className="w-full rounded-lg bg-gray-800 max-h-96 overflow-y-auto"
        >
            {/* This wrapper div constrains the scrollable area to the exact scaled height of the content */}
            <div style={{ height: scale > 0 ? contentHeight * scale : 0, width: scale > 0 ? result.width * scale : '100%' }}>
                {scale > 0 && (
                    <div 
                        ref={contentRef}
                        style={{
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                            width: result.width,
                        }}
                    >
                        <LongArticleContent data={result} />
                    </div>
                )}
            </div>
        </div>
    );
};