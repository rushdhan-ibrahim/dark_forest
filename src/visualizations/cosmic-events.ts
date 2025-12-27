// Cosmic Events - rare astronomical phenomena that create moments of wonder

interface CosmicEvent {
    type: 'pulsar' | 'supernova' | 'gamma-ray-burst';
    weight: number;  // Probability weight
}

const cosmicEvents: CosmicEvent[] = [
    { type: 'pulsar', weight: 25 },
    { type: 'supernova', weight: 60 },
    { type: 'gamma-ray-burst', weight: 15 }
];

let pulsarInterval: ReturnType<typeof setInterval> | null = null;
let eventContainer: HTMLElement | null = null;

// Audio context and nodes (lazy initialized)
let cosmicAudioContext: AudioContext | null = null;
let cosmicGainNode: GainNode | null = null;

function getAudioContext(): AudioContext | null {
    if (!cosmicAudioContext) {
        try {
            cosmicAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            cosmicGainNode = cosmicAudioContext.createGain();
            cosmicGainNode.gain.value = 0.15;
            cosmicGainNode.connect(cosmicAudioContext.destination);
        } catch {
            return null;
        }
    }
    return cosmicAudioContext;
}

function playPulsarPing(): void {
    const ctx = getAudioContext();
    if (!ctx || !cosmicGainNode) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(cosmicGainNode);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
}

function playSupernovaSound(): void {
    const ctx = getAudioContext();
    if (!ctx || !cosmicGainNode) return;

    // Low rumble that builds
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(40, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 3);
    osc.frequency.linearRampToValueAtTime(30, ctx.currentTime + 8);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(800, ctx.currentTime + 3);
    filter.frequency.linearRampToValueAtTime(100, ctx.currentTime + 8);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 3);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(cosmicGainNode);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 8);
}

function playGammaRayBurst(): void {
    const ctx = getAudioContext();
    if (!ctx || !cosmicGainNode) return;

    // Sharp, bright sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(2000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(cosmicGainNode);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
}

function createEventContainer(): HTMLElement {
    if (eventContainer) return eventContainer;

    eventContainer = document.createElement('div');
    eventContainer.id = 'cosmic-events';
    eventContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
        overflow: hidden;
    `;
    document.body.appendChild(eventContainer);
    return eventContainer;
}

function createPulsar(): void {
    const container = createEventContainer();
    const x = 10 + Math.random() * 80;
    const y = 10 + Math.random() * 60;

    const pulsar = document.createElement('div');
    pulsar.className = 'cosmic-pulsar';
    pulsar.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        width: 4px;
        height: 4px;
        background: #fff;
        border-radius: 50%;
        box-shadow: 0 0 10px 3px rgba(180, 200, 255, 0.8),
                    0 0 20px 6px rgba(180, 200, 255, 0.4),
                    0 0 30px 10px rgba(180, 200, 255, 0.2);
        opacity: 0;
    `;
    container.appendChild(pulsar);

    // Pulse pattern: 3 rapid pulses, then pause
    let pulseCount = 0;
    const maxPulses = 15;  // 5 sets of 3 pulses

    pulsarInterval = setInterval(() => {
        if (pulseCount >= maxPulses) {
            if (pulsarInterval) clearInterval(pulsarInterval);
            pulsar.remove();
            return;
        }

        // Pulse animation
        pulsar.style.opacity = '1';
        pulsar.style.transform = 'scale(1.5)';
        playPulsarPing();

        setTimeout(() => {
            pulsar.style.opacity = '0.2';
            pulsar.style.transform = 'scale(1)';
        }, 80);

        pulseCount++;
    }, pulseCount % 3 === 2 ? 600 : 200);  // Longer pause after every 3rd pulse
}

function createSupernova(): void {
    const container = createEventContainer();
    const x = 15 + Math.random() * 70;
    const y = 15 + Math.random() * 50;

    const supernova = document.createElement('div');
    supernova.className = 'cosmic-supernova';
    supernova.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        width: 6px;
        height: 6px;
        background: radial-gradient(circle, #fff 0%, #ffeedd 30%, #ffaa66 60%, transparent 100%);
        border-radius: 50%;
        transform: translate(-50%, -50%) scale(0.5);
        opacity: 0;
        transition: none;
    `;
    container.appendChild(supernova);

    playSupernovaSound();

    // Phase 1: Slow brightening (0-4s)
    setTimeout(() => {
        supernova.style.transition = 'all 4s ease-out';
        supernova.style.opacity = '1';
        supernova.style.transform = 'translate(-50%, -50%) scale(8)';
        supernova.style.boxShadow = `
            0 0 30px 10px rgba(255, 200, 150, 0.8),
            0 0 60px 20px rgba(255, 150, 100, 0.5),
            0 0 100px 40px rgba(255, 100, 50, 0.3)
        `;
    }, 100);

    // Phase 2: Peak brightness (4-5s)
    setTimeout(() => {
        supernova.style.transition = 'all 1s ease-in-out';
        supernova.style.transform = 'translate(-50%, -50%) scale(12)';
        supernova.style.background = 'radial-gradient(circle, #fff 0%, #fff 20%, #ffeedd 50%, transparent 100%)';
    }, 4100);

    // Phase 3: Fade to remnant (5-10s)
    setTimeout(() => {
        supernova.style.transition = 'all 5s ease-in';
        supernova.style.opacity = '0.3';
        supernova.style.transform = 'translate(-50%, -50%) scale(20)';
        supernova.style.background = 'radial-gradient(circle, rgba(100,150,200,0.5) 0%, rgba(80,100,150,0.2) 50%, transparent 100%)';
        supernova.style.boxShadow = 'none';
    }, 5100);

    // Cleanup
    setTimeout(() => {
        supernova.style.transition = 'opacity 2s ease-out';
        supernova.style.opacity = '0';
    }, 10000);

    setTimeout(() => supernova.remove(), 12000);
}

function createGammaRayBurst(): void {
    const container = createEventContainer();

    // Direction: random angle across the screen
    const angle = Math.random() * 360;
    const startX = 50 + Math.cos(angle * Math.PI / 180) * 60;
    const startY = 50 + Math.sin(angle * Math.PI / 180) * 60;

    const burst = document.createElement('div');
    burst.className = 'cosmic-grb';
    burst.style.cssText = `
        position: absolute;
        left: ${startX}%;
        top: ${startY}%;
        width: 200vmax;
        height: 3px;
        background: linear-gradient(90deg,
            transparent 0%,
            rgba(150, 200, 255, 0.3) 20%,
            rgba(200, 220, 255, 0.8) 45%,
            #fff 50%,
            rgba(200, 220, 255, 0.8) 55%,
            rgba(150, 200, 255, 0.3) 80%,
            transparent 100%
        );
        transform-origin: center center;
        transform: translate(-50%, -50%) rotate(${angle}deg) scaleX(0);
        opacity: 0;
    `;
    container.appendChild(burst);

    // Screen flash overlay
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(200, 220, 255, 0.15);
        opacity: 0;
        pointer-events: none;
    `;
    container.appendChild(flash);

    playGammaRayBurst();

    // Quick flash
    setTimeout(() => {
        burst.style.transition = 'transform 0.15s ease-out, opacity 0.1s ease-out';
        burst.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scaleX(1)`;
        burst.style.opacity = '1';
        flash.style.transition = 'opacity 0.1s ease-out';
        flash.style.opacity = '1';
    }, 50);

    // Fade
    setTimeout(() => {
        burst.style.transition = 'opacity 0.4s ease-in';
        burst.style.opacity = '0';
        flash.style.transition = 'opacity 0.3s ease-in';
        flash.style.opacity = '0';
    }, 200);

    // Cleanup
    setTimeout(() => {
        burst.remove();
        flash.remove();
    }, 700);
}

function selectRandomEvent(): CosmicEvent['type'] {
    const totalWeight = cosmicEvents.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const event of cosmicEvents) {
        random -= event.weight;
        if (random <= 0) return event.type;
    }
    return 'pulsar';
}

function triggerRandomEvent(): void {
    const eventType = selectRandomEvent();

    switch (eventType) {
        case 'pulsar':
            createPulsar();
            break;
        case 'supernova':
            createSupernova();
            break;
        case 'gamma-ray-burst':
            createGammaRayBurst();
            break;
    }
}

export function initCosmicEvents(): void {
    // Reduce frequency on mobile
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const baseInterval = isMobile ? 60000 : 40000;  // 60s or 40s base

    // Initial delay before first event
    setTimeout(() => {
        triggerRandomEvent();

        // Schedule recurring events with randomized timing
        setInterval(() => {
            // 30% chance to trigger on each interval
            if (Math.random() < 0.3) {
                triggerRandomEvent();
            }
        }, baseInterval + Math.random() * 20000);
    }, 15000 + Math.random() * 15000);  // First event 15-30s after load
}

// Export individual event creators for testing/manual triggering
export { createPulsar, createSupernova, createGammaRayBurst };
