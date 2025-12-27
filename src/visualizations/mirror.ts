// Mirror visualization module - glitch effect

export function initMirror(): void {
    const reflection = document.getElementById('reflection');
    if (!reflection) return;

    function glitch(): void {
        if (!reflection) return;

        if (Math.random() > 0.85) {
            reflection.style.transform = `scaleX(-1) skewX(${(Math.random() - 0.5) * 4}deg)`;
            reflection.style.filter = `hue-rotate(${Math.random() * 30}deg)`;

            setTimeout(() => {
                if (!reflection) return;
                reflection.style.transform = 'scaleX(-1)';
                reflection.style.filter = 'none';
            }, 100 + Math.random() * 100);
        }
        setTimeout(glitch, 3000 + Math.random() * 4000);
    }

    reflection.style.transform = 'scaleX(-1)';
    setTimeout(glitch, 2000);
}
