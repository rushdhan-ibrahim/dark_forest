// Signal visualization module with wave animation

import { observeVisibility, prefersReducedMotion } from '../utils/visibility';

// ─── MODULE-LEVEL STATE ───
// Store intervals at module level for cleanup on reinit
let waveInterval: number | null = null;
let yearInterval: number | null = null;
let signalYear = 0;
let decodedChars: string[] = [];

function cleanupSignal(): void {
    if (waveInterval !== null) {
        clearInterval(waveInterval);
        waveInterval = null;
    }
    if (yearInterval !== null) {
        clearInterval(yearInterval);
        yearInterval = null;
    }
}

export function initSignal(): void {
    // Clean up any previous initialization
    cleanupSignal();

    const container = document.getElementById('signal-container');
    if (!container) return;

    const rnaSequence = 'G·U·A·C·G·U·A·C';
    signalYear = 0;
    decodedChars = [];

    function createWave(): void {
        if (!container || prefersReducedMotion()) return;

        const wave = document.createElement('span');
        wave.className = 'signal-wave';
        wave.innerHTML = '<span style="opacity:0.3">)</span><span style="opacity:0.5">)</span><span style="opacity:0.7">)</span><span style="opacity:0.9">)</span><span>)</span>';
        wave.style.top = (35 + (Math.random() - 0.5) * 30) + '%';
        wave.style.left = '15%';
        wave.style.color = `hsl(${300 + Math.random() * 40}, 60%, ${50 + Math.random() * 20}%)`;
        container.appendChild(wave);

        let start: number | null = null;
        function animate(timestamp: number): void {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / 4000;

            if (progress < 1) {
                wave.style.left = (15 + progress * 60) + '%';
                wave.style.opacity = String(progress < 0.1 ? progress * 10 : (progress > 0.8 ? (1 - progress) * 5 : 1));
                requestAnimationFrame(animate);
            } else {
                wave.remove();
            }
        }
        requestAnimationFrame(animate);
    }

    function updateYear(): void {
        signalYear = (signalYear + 1) % 601;
        const yearsEl = document.getElementById('years');
        if (yearsEl) yearsEl.textContent = String(signalYear);

        if (signalYear % 75 === 0 && decodedChars.length < rnaSequence.length) {
            decodedChars.push(rnaSequence[decodedChars.length]);
            const decodedEl = document.getElementById('decoded');
            if (decodedEl) decodedEl.textContent = decodedChars.join('');
        }

        if (signalYear === 600) {
            setTimeout(() => {
                decodedChars = [];
                const decodedEl = document.getElementById('decoded');
                if (decodedEl) decodedEl.textContent = '';
            }, 2000);
        }
    }

    function startAnimations(): void {
        if (waveInterval === null) {
            waveInterval = window.setInterval(createWave, 700);
        }
        if (yearInterval === null) {
            yearInterval = window.setInterval(updateYear, 50);
        }
    }

    function stopAnimations(): void {
        if (waveInterval !== null) {
            clearInterval(waveInterval);
            waveInterval = null;
        }
        if (yearInterval !== null) {
            clearInterval(yearInterval);
            yearInterval = null;
        }
    }

    // Observe container visibility
    observeVisibility(container, (visible) => {
        if (visible) {
            startAnimations();
        } else {
            stopAnimations();
        }
    });
}
