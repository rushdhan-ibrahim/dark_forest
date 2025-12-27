// Constellation overlays with star distances and names

import constellationData from '../data/constellations.json';

interface Star {
    name: string;
    x: number;
    y: number;
    distance: number;  // light-years
    magnitude: number;
}

interface Constellation {
    name: string;
    description: string;
    stars: Star[];
    lines: [number, number][];
}

let constellationLayer: HTMLElement | null = null;
let tooltipElement: HTMLElement | null = null;
let isVisible = false;

function getDistanceNarrative(distance: number): string {
    const currentYear = new Date().getFullYear();
    const lightLeftYear = currentYear - Math.round(distance);

    if (distance < 50) {
        return `Light from this star left ${Math.round(distance)} years ago—within your grandparents' lifetime.`;
    } else if (distance < 100) {
        return `This light began its journey ${Math.round(distance)} years ago, before the World Wars.`;
    } else if (distance < 500) {
        return `Light from this star left in ${lightLeftYear}—${Math.round(distance)} years before you were born.`;
    } else if (distance < 1000) {
        return `This light has been traveling since ${lightLeftYear}, before the fall of Rome.`;
    } else if (distance < 2000) {
        return `This starlight predates human civilization—${Math.round(distance)} years in flight.`;
    } else {
        return `This light left its star ${Math.round(distance)} years ago—when mammoths still roamed Earth.`;
    }
}

function createTooltip(): HTMLElement {
    if (tooltipElement) return tooltipElement;

    tooltipElement = document.createElement('div');
    tooltipElement.className = 'constellation-tooltip';
    tooltipElement.style.cssText = `
        position: fixed;
        padding: 12px 16px;
        background: rgba(10, 12, 20, 0.95);
        border: 1px solid rgba(150, 180, 220, 0.3);
        border-radius: 6px;
        font-family: 'Cormorant Garamond', serif;
        font-size: 14px;
        color: #b8d4ff;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: 1000;
        max-width: 280px;
        line-height: 1.5;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;
    document.body.appendChild(tooltipElement);
    return tooltipElement;
}

function showTooltip(star: Star, x: number, y: number, isTouch = false): void {
    const tooltip = createTooltip();

    tooltip.innerHTML = `
        <div style="font-size: 18px; color: #fff; margin-bottom: 6px; font-weight: 500;">
            ${star.name}
        </div>
        <div style="font-size: 13px; color: #8aa8cc; margin-bottom: 8px;">
            ${star.distance.toLocaleString()} light-years away
        </div>
        <div style="font-size: 13px; color: #a0b8d4; font-style: italic;">
            ${getDistanceNarrative(star.distance)}
        </div>
    `;

    // Position tooltip avoiding edges
    // On touch devices, position above finger so it's visible
    const tooltipWidth = 280;
    const tooltipHeight = 150;
    const offset = isTouch ? -tooltipHeight - 30 : 15; // Above finger on touch, below cursor on mouse

    let left = x + 15;
    let top = isTouch ? y + offset : y + 15;

    // Keep within viewport horizontally
    if (left + tooltipWidth > window.innerWidth) {
        left = x - tooltipWidth - 10;
    }
    if (left < 10) {
        left = 10;
    }

    // Keep within viewport vertically
    if (top < 10) {
        top = y + 30; // Below finger if no room above
    }
    if (top + tooltipHeight > window.innerHeight) {
        top = y - tooltipHeight - 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.opacity = '1';
}

function updateTooltipPosition(x: number, y: number, isTouch = false): void {
    if (!tooltipElement || tooltipElement.style.opacity !== '1') return;

    const tooltipWidth = 280;
    const tooltipHeight = 150;
    const offset = isTouch ? -tooltipHeight - 30 : 15;

    let left = x + 15;
    let top = isTouch ? y + offset : y + 15;

    // Keep within viewport
    if (left + tooltipWidth > window.innerWidth) {
        left = x - tooltipWidth - 10;
    }
    if (left < 10) {
        left = 10;
    }
    if (top < 10) {
        top = y + 30;
    }
    if (top + tooltipHeight > window.innerHeight) {
        top = y - tooltipHeight - 10;
    }

    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.top = `${top}px`;
}

function hideTooltip(): void {
    if (tooltipElement) {
        tooltipElement.style.opacity = '0';
    }
}

function createConstellationElements(): HTMLElement {
    if (constellationLayer) return constellationLayer;

    constellationLayer = document.createElement('div');
    constellationLayer.id = 'constellation-layer';
    constellationLayer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 4;
        opacity: 0;
        transition: opacity 1s ease;
    `;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = 'position: absolute; top: 0; left: 0;';

    const constellations = constellationData.constellations as Constellation[];

    constellations.forEach(constellation => {
        // Create group for each constellation
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'constellation-group');

        // Draw connecting lines
        constellation.lines.forEach(([startIdx, endIdx]) => {
            const start = constellation.stars[startIdx];
            const end = constellation.stars[endIdx];

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', `${start.x}%`);
            line.setAttribute('y1', `${start.y}%`);
            line.setAttribute('x2', `${end.x}%`);
            line.setAttribute('y2', `${end.y}%`);
            line.setAttribute('stroke', 'rgba(150, 180, 220, 0.25)');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('stroke-dasharray', '4,4');
            group.appendChild(line);
        });

        // Draw stars
        constellation.stars.forEach(star => {
            // Star glow
            const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            glow.setAttribute('cx', `${star.x}%`);
            glow.setAttribute('cy', `${star.y}%`);
            glow.setAttribute('r', `${4 - star.magnitude * 0.5}`);
            glow.setAttribute('fill', 'rgba(180, 200, 255, 0.3)');
            glow.setAttribute('filter', 'blur(3px)');
            group.appendChild(glow);

            // Star point
            const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            point.setAttribute('cx', `${star.x}%`);
            point.setAttribute('cy', `${star.y}%`);
            point.setAttribute('r', `${3 - star.magnitude * 0.4}`);
            point.setAttribute('fill', '#e8f0ff');
            point.style.cursor = 'pointer';
            point.style.pointerEvents = 'auto';

            // Hover/touch interactions
            point.addEventListener('mouseenter', (e) => {
                showTooltip(star, e.clientX, e.clientY, false);
                point.setAttribute('fill', '#fff');
                point.setAttribute('r', `${4 - star.magnitude * 0.4}`);
            });

            point.addEventListener('mousemove', (e) => {
                updateTooltipPosition(e.clientX, e.clientY, false);
            });

            point.addEventListener('mouseleave', () => {
                hideTooltip();
                point.setAttribute('fill', '#e8f0ff');
                point.setAttribute('r', `${3 - star.magnitude * 0.4}`);
            });

            // Touch support - position tooltip above finger
            point.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                showTooltip(star, touch.clientX, touch.clientY, true);
                point.setAttribute('fill', '#fff');
                point.setAttribute('r', `${4 - star.magnitude * 0.4}`);
            });

            point.addEventListener('touchmove', (e) => {
                if (e.touches.length > 0) {
                    const touch = e.touches[0];
                    updateTooltipPosition(touch.clientX, touch.clientY, true);
                }
            });

            point.addEventListener('touchend', () => {
                point.setAttribute('fill', '#e8f0ff');
                point.setAttribute('r', `${3 - star.magnitude * 0.4}`);
                setTimeout(hideTooltip, 2000);
            });

            group.appendChild(point);

            // Star label (hidden by default, shown on constellation hover)
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', `${star.x + 1.5}%`);
            label.setAttribute('y', `${star.y - 1}%`);
            label.setAttribute('fill', 'rgba(180, 200, 230, 0.6)');
            label.setAttribute('font-size', '10');
            label.setAttribute('font-family', 'JetBrains Mono, monospace');
            label.setAttribute('class', 'star-label');
            label.textContent = star.name;
            label.style.opacity = '0';
            label.style.transition = 'opacity 0.3s ease';
            group.appendChild(label);
        });

        // Constellation name label
        const nameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const centerX = constellation.stars.reduce((sum, s) => sum + s.x, 0) / constellation.stars.length;
        const centerY = constellation.stars.reduce((sum, s) => sum + s.y, 0) / constellation.stars.length;
        nameLabel.setAttribute('x', `${centerX}%`);
        nameLabel.setAttribute('y', `${centerY - 5}%`);
        nameLabel.setAttribute('fill', 'rgba(150, 180, 220, 0.4)');
        nameLabel.setAttribute('font-size', '12');
        nameLabel.setAttribute('font-family', 'Cinzel Decorative, serif');
        nameLabel.setAttribute('text-anchor', 'middle');
        nameLabel.setAttribute('class', 'constellation-name');
        nameLabel.textContent = constellation.name;
        group.appendChild(nameLabel);

        svg.appendChild(group);
    });

    constellationLayer.appendChild(svg);
    document.body.appendChild(constellationLayer);

    return constellationLayer;
}

export function showConstellations(): void {
    const layer = createConstellationElements();
    layer.style.opacity = '1';
    isVisible = true;
}

export function hideConstellations(): void {
    if (constellationLayer) {
        constellationLayer.style.opacity = '0';
        isVisible = false;
    }
}

export function toggleConstellations(): void {
    if (isVisible) {
        hideConstellations();
    } else {
        showConstellations();
    }
}

export function initConstellations(): void {
    // Pre-create constellation elements
    createConstellationElements();

    // Show constellations after a delay (creates discovery moment)
    setTimeout(() => {
        showConstellations();
    }, 5000);

    // Add keyboard toggle (C key)
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
            toggleConstellations();
        }
    });
}
