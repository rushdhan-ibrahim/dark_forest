// Visibility utilities for pausing animations when offscreen

type VisibilityCallback = (isVisible: boolean) => void;

/**
 * Create an IntersectionObserver that calls a callback when element visibility changes
 */
export function observeVisibility(
    element: HTMLElement,
    callback: VisibilityCallback,
    threshold: number = 0.1
): IntersectionObserver {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                callback(entry.isIntersecting);
            });
        },
        { threshold }
    );

    observer.observe(element);
    return observer;
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Watch for reduced motion preference changes
 */
export function watchReducedMotion(callback: (reduced: boolean) => void): MediaQueryList {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    callback(mediaQuery.matches);

    mediaQuery.addEventListener('change', (e) => {
        callback(e.matches);
    });

    return mediaQuery;
}
