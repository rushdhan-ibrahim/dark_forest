// Joining visualization module - individuals converging into collective

import { playJoiningStart, playJoiningConverge } from '../audio/joining';

interface Individual {
    el: HTMLElement;
    index: number;
    x: number;
    y: number;
}

export let individuals: Individual[] = [];
export const individualCount = 13;

export function resetJoining(): void {
    const container = document.getElementById('joining-container');
    if (!container) return;

    individuals.forEach(ind => ind.el.remove());
    individuals = [];

    const core = document.getElementById('collective-core');
    if (core) core.classList.remove('visible');

    const status = document.getElementById('joining-status');
    if (status) {
        status.textContent = `${individualCount} individuals remaining`;
        status.style.color = '';
    }

    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;

    // Responsive radius based on container size
    const containerMin = Math.min(container.offsetWidth, container.offsetHeight);
    const baseRadius = containerMin * 0.35; // 35% of smaller dimension
    const radiusVariation = containerMin * 0.08;

    for (let i = 0; i < individualCount; i++) {
        const ind = document.createElement('div');
        ind.className = 'individual-marker';
        ind.textContent = '○';
        ind.dataset.index = String(i);

        const angle = (i / individualCount) * Math.PI * 2 - Math.PI / 2;
        const radius = baseRadius + Math.random() * radiusVariation;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        ind.style.left = x + 'px';
        ind.style.top = y + 'px';

        container.appendChild(ind);
        individuals.push({ el: ind, index: i, x, y });
    }
}

export function startJoining(): void {
    const container = document.getElementById('joining-container');
    if (!container) return;

    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;
    const resistingX = Math.max(20, container.offsetWidth * 0.1); // 10% from left, min 20px

    // Audio: Start individual tones
    playJoiningStart();

    individuals.forEach((ind, i) => {
        setTimeout(() => {
            if (i === 0) {
                ind.el.classList.add('resisting');
                ind.el.style.left = resistingX + 'px';
                ind.el.style.top = centerY + 'px';
            } else {
                ind.el.classList.add('converging');
                ind.el.style.left = centerX + 'px';
                ind.el.style.top = centerY + 'px';
            }
        }, i * 120);
    });

    setTimeout(() => {
        const core = document.getElementById('collective-core');
        if (core) core.classList.add('visible');

        const status = document.getElementById('joining-status');
        if (status) {
            status.textContent = '1 individual resisting';
            status.style.color = 'var(--danger-red)';
        }

        // Audio: Converge tones to unison
        playJoiningConverge();
    }, individualCount * 120 + 500);
}

export function initJoining(): void {
    resetJoining();
}
