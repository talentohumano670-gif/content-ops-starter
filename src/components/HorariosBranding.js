import React from 'react';

export function BrandMarks() {
    return (
        <>
            <div className="fixed top-4 right-4 z-50 bg-slate-900 rounded-lg px-3 py-2 shadow-md">
                <img src="/images/liderman-logo.png" alt="Liderman" className="h-6 w-auto" />
            </div>
            <img
                src="/images/ecuador-flag.webp"
                alt="Ecuador"
                className="fixed bottom-4 right-4 z-50 h-8 w-auto rounded shadow-md border border-black/10"
            />
        </>
    );
}

export function BrandFooter() {
    return (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-12 pb-4">
            El uso de esta plataforma le corresponde a Liderman Ecuador.
        </p>
    );
}
