// Chain of Suspicion Builder - Interactive logical argument construction
// Readers connect the steps of the Dark Forest argument to understand how the trap closes

import { getAudioContext, getMasterGain, getIsAudioPlaying } from '../audio/context';

interface ChainStep {
    id: string;
    title: string;
    shortTitle: string;
    description: string;
    leadsTo: string[];  // Valid next steps
    el: HTMLElement | null;
    connected: boolean;
    x: number;
    y: number;
}

interface Connection {
    from: string;
    to: string;
    lineEl: HTMLElement | null;
}

// The logical steps of the Chain of Suspicion
const chainSteps: ChainStep[] = [
    {
        id: 'communication',
        title: 'Credible Communication Fails',
        shortTitle: 'No Trust',
        description: 'Any message is vulnerable to cheap talk. You cannot verify intentions.',
        leadsTo: ['explosion', 'asymmetric'],
        el: null,
        connected: false,
        x: 0,
        y: 0
    },
    {
        id: 'explosion',
        title: 'Technological Explosion',
        shortTitle: 'Rapid Change',
        description: 'Even if harmless now, you cannot know what they will become.',
        leadsTo: ['asymmetric', 'spiral'],
        el: null,
        connected: false,
        x: 0,
        y: 0
    },
    {
        id: 'asymmetric',
        title: 'Asymmetric Error Costs',
        shortTitle: 'Lopsided Risk',
        description: 'Being wrong about peace means extinction. Being wrong about war means finite loss.',
        leadsTo: ['spiral'],
        el: null,
        connected: false,
        x: 0,
        y: 0
    },
    {
        id: 'spiral',
        title: 'Common Knowledge Spiral',
        shortTitle: 'They Know',
        description: 'They know you think this. You know they know. Suspicion becomes self-fulfilling.',
        leadsTo: ['conclusion'],
        el: null,
        connected: false,
        x: 0,
        y: 0
    },
    {
        id: 'conclusion',
        title: 'The Trap Closes',
        shortTitle: 'Silence',
        description: 'The only "safe" move is to hide—or strike first.',
        leadsTo: [],
        el: null,
        connected: false,
        x: 0,
        y: 0
    }
];

let connections: Connection[] = [];
let selectedStep: string | null = null;
let isComplete = false;
let container: HTMLElement | null = null;

/**
 * Play connection sound - rising tone for correct, dissonant for wrong
 */
function playConnectionSound(correct: boolean): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    if (correct) {
        // Ascending tone - satisfying connection
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(450, now + 0.15);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.5);
    } else {
        // Dissonant buzz - wrong connection
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.value = 120;
        osc2.frequency.value = 127; // Slightly detuned for dissonance

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.25);
        osc2.stop(now + 0.25);
    }
}

/**
 * Play the "trap closing" sound when chain is complete
 */
function playTrapClosingSound(): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    // Descending minor chord that tightens
    const frequencies = [400, 480, 600, 720];

    frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        // Descend and converge
        osc.frequency.linearRampToValueAtTime(freq * 0.7, now + 2);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.linearRampToValueAtTime(300, now + 2);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.1 + i * 0.1);
        gain.gain.setValueAtTime(0.04, now + 1.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(now + i * 0.1);
        osc.stop(now + 2.5);
    });

    // Final "snap" - the trap closing
    setTimeout(() => {
        const snap = ctx.createOscillator();
        const snapGain = ctx.createGain();

        snap.type = 'square';
        snap.frequency.value = 80;

        snapGain.gain.setValueAtTime(0.1, ctx.currentTime);
        snapGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

        snap.connect(snapGain);
        snapGain.connect(masterGain);

        snap.start(ctx.currentTime);
        snap.stop(ctx.currentTime + 0.15);
    }, 2000);
}

/**
 * Draw a connection line between two steps
 */
function drawConnectionLine(fromStep: ChainStep, toStep: ChainStep): HTMLElement {
    const line = document.createElement('div');
    line.className = 'chain-connection';

    const x1 = fromStep.x + 60;
    const y1 = fromStep.y + 30;
    const x2 = toStep.x + 60;
    const y2 = toStep.y + 30;

    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

    line.style.left = x1 + 'px';
    line.style.top = y1 + 'px';
    line.style.width = length + 'px';
    line.style.transform = `rotate(${angle}deg)`;

    return line;
}

/**
 * Attempt to connect two steps
 */
function tryConnect(fromId: string, toId: string): boolean {
    const fromStep = chainSteps.find(s => s.id === fromId);
    const toStep = chainSteps.find(s => s.id === toId);

    if (!fromStep || !toStep || !container) return false;

    // Check if this is a valid connection
    const isValid = fromStep.leadsTo.includes(toId);

    if (isValid) {
        // Create and animate connection line
        const line = drawConnectionLine(fromStep, toStep);
        container.appendChild(line);

        // Animate in
        requestAnimationFrame(() => {
            line.classList.add('active');
        });

        connections.push({ from: fromId, to: toId, lineEl: line });
        toStep.connected = true;
        toStep.el?.classList.add('connected');

        playConnectionSound(true);

        // Check if chain is complete
        checkCompletion();

        return true;
    } else {
        // Invalid connection - flash red
        fromStep.el?.classList.add('invalid');
        toStep.el?.classList.add('invalid');
        playConnectionSound(false);

        setTimeout(() => {
            fromStep.el?.classList.remove('invalid');
            toStep.el?.classList.remove('invalid');
        }, 300);

        return false;
    }
}

/**
 * Check if the chain is complete
 */
function checkCompletion(): void {
    const conclusion = chainSteps.find(s => s.id === 'conclusion');

    if (conclusion?.connected && !isComplete) {
        isComplete = true;

        // Trigger trap closing effect
        setTimeout(() => {
            container?.classList.add('complete');
            playTrapClosingSound();

            // Show completion message
            const message = container?.querySelector('.chain-message');
            if (message) {
                message.textContent = 'The trap closes. Not through malice, but through logic.';
                message.classList.add('complete');
            }

            // Animate all nodes to "trapped" state
            chainSteps.forEach((step, i) => {
                setTimeout(() => {
                    step.el?.classList.add('trapped');
                }, i * 150);
            });
        }, 300);
    }
}

/**
 * Handle step click
 */
function handleStepClick(stepId: string): void {
    if (isComplete) return;

    const step = chainSteps.find(s => s.id === stepId);
    if (!step) return;

    if (selectedStep === null) {
        // First selection
        selectedStep = stepId;
        step.el?.classList.add('selected');
    } else if (selectedStep === stepId) {
        // Deselect
        step.el?.classList.remove('selected');
        selectedStep = null;
    } else {
        // Try to connect
        const fromStep = chainSteps.find(s => s.id === selectedStep);
        fromStep?.el?.classList.remove('selected');

        tryConnect(selectedStep, stepId);
        selectedStep = null;
    }
}

/**
 * Reset the chain builder
 */
export function resetSuspicionChain(): void {
    isComplete = false;
    selectedStep = null;
    connections.forEach(c => c.lineEl?.remove());
    connections = [];

    chainSteps.forEach(step => {
        step.connected = step.id === 'communication'; // First step is always connected
        step.el?.classList.remove('selected', 'connected', 'trapped', 'invalid');
        if (step.id === 'communication') {
            step.el?.classList.add('connected');
        }
    });

    container?.classList.remove('complete');
    const message = container?.querySelector('.chain-message');
    if (message) {
        message.textContent = 'Click two steps to connect them. Build the chain of suspicion.';
        message.classList.remove('complete');
    }
}

/**
 * Initialize the Chain of Suspicion builder
 */
export function initSuspicionChain(): void {
    container = document.getElementById('suspicion-chain-container');
    if (!container) return;

    // Create the step nodes
    const positions = [
        { x: 20, y: 20 },    // communication
        { x: 180, y: 80 },   // explosion
        { x: 20, y: 140 },   // asymmetric
        { x: 180, y: 200 },  // spiral
        { x: 100, y: 280 }   // conclusion
    ];

    chainSteps.forEach((step, i) => {
        const node = document.createElement('div');
        node.className = 'chain-step';
        node.dataset.id = step.id;

        const title = document.createElement('div');
        title.className = 'chain-step-title';
        title.textContent = step.shortTitle;

        const desc = document.createElement('div');
        desc.className = 'chain-step-desc';
        desc.textContent = step.description;

        node.appendChild(title);
        node.appendChild(desc);

        // Position
        step.x = positions[i].x;
        step.y = positions[i].y;
        node.style.left = step.x + 'px';
        node.style.top = step.y + 'px';

        // First step starts connected
        if (step.id === 'communication') {
            node.classList.add('connected', 'origin');
            step.connected = true;
        }

        node.addEventListener('click', () => handleStepClick(step.id));

        container!.appendChild(node);
        step.el = node;
    });

    // Add instruction message
    const message = document.createElement('div');
    message.className = 'chain-message';
    message.textContent = 'Click two steps to connect them. Build the chain of suspicion.';
    container.appendChild(message);
}
