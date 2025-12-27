// Mirror visualization module - glitch effect with touch/mouse interactivity

export function initMirror(): void {
    const reflection = document.getElementById('reflection');
    const container = document.getElementById('mirror-container');
    if (!reflection || !container) return;

    let isGlitching = false;

    // Apply distortion based on pointer position
    function distortReflection(intensity: number, skewAmount: number): void {
        if (isGlitching || !reflection) return;
        isGlitching = true;

        const hueShift = intensity * 60;
        const skew = skewAmount * 8;
        const scale = 1 + (intensity * 0.1);

        reflection.style.transform = `scaleX(-1) skewX(${skew}deg) scale(${scale})`;
        reflection.style.filter = `hue-rotate(${hueShift}deg) brightness(${1 + intensity * 0.3})`;
        reflection.style.transition = 'transform 0.1s ease-out, filter 0.1s ease-out';
    }

    // Reset to normal reflection
    function resetReflection(): void {
        if (!reflection) return;
        isGlitching = false;
        reflection.style.transform = 'scaleX(-1)';
        reflection.style.filter = 'none';
        reflection.style.transition = 'transform 0.3s ease-out, filter 0.3s ease-out';
    }

    // Handle pointer movement over the mirror
    function handlePointerMove(clientX: number, clientY: number): void {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;

        // Intensity increases toward edges
        const centerX = Math.abs(x - 0.5) * 2;
        const centerY = Math.abs(y - 0.5) * 2;
        const intensity = Math.max(centerX, centerY);

        // Skew based on horizontal position
        const skewAmount = (x - 0.5) * 2;

        distortReflection(intensity * 0.8, skewAmount);
    }

    // Mouse events
    container.addEventListener('mousemove', (e: MouseEvent) => {
        handlePointerMove(e.clientX, e.clientY);
    });

    container.addEventListener('mouseleave', () => {
        resetReflection();
    });

    // Touch events
    container.addEventListener('touchmove', (e: TouchEvent) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            handlePointerMove(touch.clientX, touch.clientY);
        }
    }, { passive: true });

    container.addEventListener('touchstart', (e: TouchEvent) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            handlePointerMove(touch.clientX, touch.clientY);
        }
    }, { passive: true });

    container.addEventListener('touchend', () => {
        resetReflection();
    });

    // Random auto-glitch for ambient effect
    function autoGlitch(): void {
        if (!reflection) return;

        if (Math.random() > 0.85 && !isGlitching) {
            distortReflection(Math.random() * 0.5, (Math.random() - 0.5));

            setTimeout(() => {
                resetReflection();
            }, 100 + Math.random() * 100);
        }
        setTimeout(autoGlitch, 3000 + Math.random() * 4000);
    }

    reflection.style.transform = 'scaleX(-1)';
    setTimeout(autoGlitch, 2000);
}
