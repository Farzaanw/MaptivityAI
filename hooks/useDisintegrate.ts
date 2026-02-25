/**
 * useDisintegrate — stub kept for API compatibility.
 * Transition is now handled by a CSS crossfade in App.tsx.
 */
import { useCallback, RefObject } from 'react';

export function useDisintegrate(_elementRef: RefObject<HTMLElement | null>) {
    const trigger = useCallback((): Promise<void> => {
        return Promise.resolve();
    }, []);

    return { trigger };
}
