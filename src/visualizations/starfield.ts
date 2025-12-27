// Starfield visualization module

import { rememberStar, isStarRemembered } from '../utils/persistence';
import { playStarTouchSound } from '../audio/effects';

export const starChars: string[] = ['·', '∙', '*', '✦', '✧', '°', '+'];

// Nebula configuration
interface NebulaConfig {
    type: 'purple' | 'blue' | 'dust' | 'teal';
    x: number;      // percentage
    y: number;      // percentage
    width: number;  // percentage of viewport
    height: number; // percentage of viewport
    delay: number;  // animation delay in seconds
}

const nebulaConfigs: NebulaConfig[] = [
    // Large purple nebula - upper right
    { type: 'purple', x: 60, y: 10, width: 80, height: 60, delay: 0 },
    // Blue stellar nursery - lower left
    { type: 'blue', x: 5, y: 50, width: 60, height: 50, delay: 0.5 },
    // Warm dust cloud - center
    { type: 'dust', x: 30, y: 30, width: 50, height: 40, delay: 1 },
    // Small teal emission - upper left
    { type: 'teal', x: 10, y: 5, width: 40, height: 35, delay: 1.5 },
    // Secondary purple - lower right
    { type: 'purple', x: 70, y: 60, width: 45, height: 40, delay: 2 },
];

export const starConfigs: { layer: string; count: number; opacityRange: [number, number]; speed: number }[] = [
    { layer: 'star-layer-1', count: 50, opacityRange: [0.15, 0.3], speed: 0.01 },
    { layer: 'star-layer-2', count: 80, opacityRange: [0.2, 0.5], speed: 0.03 },
    { layer: 'star-layer-3', count: 100, opacityRange: [0.4, 0.8], speed: 0.06 }
];

export const starColors: string[] = ['#f0eeeb', '#b8d4ff', '#ffb8a8', '#ffe8d0', '#d0e8ff'];

export function initNebulae(): void {
    // Create nebula layer container
    let nebulaLayer = document.getElementById('nebula-layer');
    if (!nebulaLayer) {
        nebulaLayer = document.createElement('div');
        nebulaLayer.id = 'nebula-layer';
        nebulaLayer.className = 'nebula-layer';
        document.body.insertBefore(nebulaLayer, document.body.firstChild);
    }

    // Reduce nebula count on mobile for performance
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const configs = isMobile ? nebulaConfigs.slice(0, 3) : nebulaConfigs;

    configs.forEach((config) => {
        const nebula = document.createElement('div');
        nebula.className = `nebula nebula--${config.type}`;

        // Slight variation in size for more natural look
        const sizeVariation = 0.85 + Math.random() * 0.3;

        // Position and size
        nebula.style.left = `${config.x}%`;
        nebula.style.top = `${config.y}%`;
        nebula.style.width = `${config.width * sizeVariation}vw`;
        nebula.style.height = `${config.height * sizeVariation}vh`;

        // Stagger animation start
        nebula.style.animationDelay = `${config.delay}s`;

        nebulaLayer.appendChild(nebula);
    });
}

export function createShootingStar(): void {
    const startX = Math.random() * 60;
    const startY = Math.random() * 40;
    const angle = 25 + Math.random() * 20;
    const length = 80 + Math.random() * 60;
    const duration = 600 + Math.random() * 400;

    const trail = document.createElement('div');
    trail.className = 'shooting-star-trail';
    trail.style.left = startX + '%';
    trail.style.top = startY + '%';
    trail.style.width = length + 'px';
    trail.style.transform = `rotate(${angle}deg)`;
    document.body.appendChild(trail);

    const head = document.createElement('div');
    head.className = 'shooting-star-head';
    head.textContent = '✦';
    head.style.left = startX + '%';
    head.style.top = startY + '%';
    document.body.appendChild(head);

    let start: number | null = null;
    const radians = angle * Math.PI / 180;
    const dx = Math.cos(radians) * (length + 50);
    const dy = Math.sin(radians) * (length + 50);

    function animate(timestamp: number): void {
        if (!start) start = timestamp;
        const progress = (timestamp - start) / duration;

        if (progress < 1) {
            head.style.left = `calc(${startX}% + ${dx * progress}px)`;
            head.style.top = `calc(${startY}% + ${dy * progress}px)`;
            head.style.opacity = String(progress < 0.2 ? progress * 5 : (progress > 0.8 ? (1 - progress) * 5 : 1));

            trail.style.left = `calc(${startX}% + ${dx * progress}px)`;
            trail.style.top = `calc(${startY}% + ${dy * progress}px)`;
            trail.style.opacity = String(progress < 0.1 ? progress * 10 : (progress > 0.7 ? (1 - progress) * 3.3 : 1));
            trail.style.width = Math.max(0, length * (1 - progress * 0.5)) + 'px';

            requestAnimationFrame(animate);
        } else {
            head.remove();
            trail.remove();
        }
    }
    requestAnimationFrame(animate);
}

export function initStarfield(): void {
    // Reduce star count on mobile for performance
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const starMultiplier = isMobile ? 0.5 : 1;

    starConfigs.forEach((config, layerIndex) => {
        const layer = document.getElementById(config.layer);
        if (!layer) return;

        const count = Math.floor(config.count * starMultiplier);
        for (let i = 0; i < count; i++) {
            const star = document.createElement('span');
            star.className = 'ascii-star';
            star.textContent = starChars[Math.floor(Math.random() * starChars.length)];

            const x = Math.random() * 100;
            const y = Math.random() * 100;
            star.style.left = x + '%';
            star.style.top = y + '%';
            star.style.color = starColors[Math.floor(Math.random() * starColors.length)];

            let opacity = config.opacityRange[0] + Math.random() * (config.opacityRange[1] - config.opacityRange[0]);

            // Check if this star was previously touched - remembered stars are brighter
            const remembered = isStarRemembered(layerIndex, i);
            if (remembered) {
                opacity = Math.min(1, opacity + 0.25);
                star.classList.add('remembered');
            }

            star.style.opacity = String(opacity);
            (star as HTMLElement).dataset.baseOpacity = String(opacity);
            (star as HTMLElement).dataset.x = String(x);
            (star as HTMLElement).dataset.y = String(y);
            (star as HTMLElement).dataset.layerIndex = String(layerIndex);
            (star as HTMLElement).dataset.starIndex = String(i);

            layer.appendChild(star);
        }
    });

    let starMouseX = 0;
    let starMouseY = 0;

    // Unified brightness update for mouse and touch
    function updateStarBrightness(clientX: number, clientY: number): void {
        starMouseX = (clientX / window.innerWidth) * 100;
        starMouseY = (clientY / window.innerHeight) * 100;

        document.querySelectorAll('#starfield .ascii-star').forEach(starEl => {
            const star = starEl as HTMLElement;
            const sx = parseFloat(star.dataset.x || '0');
            const sy = parseFloat(star.dataset.y || '0');
            const dist = Math.sqrt((sx - starMouseX) ** 2 + (sy - starMouseY) ** 2);
            const baseOpacity = parseFloat(star.dataset.baseOpacity || '0');

            if (dist < 40) {
                const brightness = 1 - (dist / 40);
                star.style.opacity = String(Math.min(1, baseOpacity + brightness * 0.6));

                // When brightness is high enough, remember this star
                if (brightness > 0.5 && !star.classList.contains('remembered')) {
                    const layerIndex = parseInt(star.dataset.layerIndex || '0', 10);
                    const starIndex = parseInt(star.dataset.starIndex || '0', 10);
                    rememberStar(layerIndex, starIndex);
                    star.classList.add('remembered');

                    // Play spatial sound based on star's screen position
                    const starX = sx / 100; // Normalize to 0-1
                    playStarTouchSound(starX, brightness);

                    // Boost the base opacity for this session too
                    const newBase = Math.min(1, baseOpacity + 0.15);
                    star.dataset.baseOpacity = String(newBase);
                }

                star.classList.toggle('bright', brightness > 0.3);
            } else {
                star.style.opacity = String(baseOpacity);
                star.classList.remove('bright');
            }
        });
    }

    // Mouse tracking
    document.addEventListener('mousemove', (e: MouseEvent) => {
        updateStarBrightness(e.clientX, e.clientY);
    });

    // Touch tracking
    document.addEventListener('touchmove', (e: TouchEvent) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            updateStarBrightness(touch.clientX, touch.clientY);
        }
    }, { passive: true });

    document.addEventListener('touchstart', (e: TouchEvent) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            updateStarBrightness(touch.clientX, touch.clientY);
        }
    }, { passive: true });

    // Shooting stars - less frequent on mobile
    const shootingStarInterval = isMobile ? 8000 : 4000;
    setInterval(() => {
        if (Math.random() > 0.7) createShootingStar();
    }, shootingStarInterval);
    setTimeout(createShootingStar, 2000);
}
