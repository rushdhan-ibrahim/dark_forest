// Window visualization module - closing window animation

import { observeVisibility, prefersReducedMotion } from '../utils/visibility';

export function initWindow(): void {
    const container = document.getElementById('window-container');
    const closer = document.getElementById('window-closing');
    if (!closer) return;

    let position = 33.33;
    let animationFrame: number | null = null;
    let isVisible = false;

    function animateWindow(): void {
        if (!closer || !isVisible || prefersReducedMotion()) return;

        position += 0.015;
        if (position > 66.66) position = 33.33;
        closer.style.right = position + '%';
        animationFrame = requestAnimationFrame(animateWindow);
    }

    function startAnimation(): void {
        if (animationFrame) return;
        animationFrame = requestAnimationFrame(animateWindow);
    }

    function stopAnimation(): void {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
    }

    // Observe container visibility
    if (container) {
        observeVisibility(container, (visible) => {
            isVisible = visible;
            if (visible) {
                startAnimation();
            } else {
                stopAnimation();
            }
        });
    } else {
        // Fallback: always animate if no container
        isVisible = true;
        animateWindow();
    }
}
