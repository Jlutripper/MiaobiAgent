import React from 'react';

export const ResultActionButtons = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="mt-3 flex gap-2">
            {children}
        </div>
    );
};