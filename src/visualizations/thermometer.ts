// Thermodynamic visualization module

export function initThermo(): void {
    const container = document.getElementById('thermo-container');
    if (!container) return;

    for (let i = 0; i < 6; i++) {
        const ring = document.createElement('div');
        ring.className = 'heat-ring';
        const size = 60;
        ring.style.width = size + 'px';
        ring.style.height = size + 'px';
        ring.style.left = `calc(50% - ${size / 2}px)`;
        ring.style.top = `calc(50% - ${size / 2}px)`;

        const hue = 35 - i * 5;
        const lightness = 55 - i * 8;
        ring.style.borderColor = `hsla(${hue}, 80%, ${lightness}%, 0.6)`;
        ring.style.animation = `heat-radiate 3s ease-out ${i * 0.5}s infinite`;

        container.appendChild(ring);
    }
}

// Inject the heat-radiate keyframe animation
const thermoStyle = document.createElement('style');
thermoStyle.textContent = `
    @keyframes heat-radiate {
        0% { transform: scale(0.5); opacity: 0.8; }
        100% { transform: scale(3); opacity: 0; }
    }
`;
document.head.appendChild(thermoStyle);
