import { useEffect, useState } from 'react';

const STORAGE_KEY = 'horarios-theme';

export function useTheme() {
    const [theme, setTheme] = useState('light');

    useEffect(() => {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const initial = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        setTheme(initial);
        document.documentElement.classList.toggle('dark', initial === 'dark');
    }, []);

    function toggleTheme() {
        setTheme((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            window.localStorage.setItem(STORAGE_KEY, next);
            document.documentElement.classList.toggle('dark', next === 'dark');
            return next;
        });
    }

    return { theme, toggleTheme };
}
