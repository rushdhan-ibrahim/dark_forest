// Glass forest visualization module - civilization nodes and sight lines
// Now with cooperation mode: One-Shot vs Iterated game

import { playGlassNodePing, playMutualAnnihilation } from '../audio/effects';
import { getAudioContext, getMasterGain, getIsAudioPlaying } from '../audio/context';

// Game mode: one-shot (instant cascade) vs iterated (trust can build)
export type GameMode = 'one-shot' | 'iterated';
export let currentGameMode: GameMode = 'one-shot';

interface GlassNode {
    el: HTMLElement;
    alive: boolean;
    x: number;
    y: number;
    color: string;
    // Trust/reputation properties for iterated mode
    trust: number;           // 0-100, starts at 50
    trustEl: HTMLElement | null;  // Visual indicator
    cooperationStreak: number;    // Consecutive rounds of non-aggression
    hasDefected: boolean;         // Has this node ever fired?
}

// Trust relationship between pairs of nodes
interface TrustRelation {
    node1: number;
    node2: number;
    trust: number;  // 0-100
    lineEl: HTMLElement | null;
}

export const glassNodes: GlassNode[] = [];
export let glassSightLines: HTMLElement[] = [];
export let trustRelations: TrustRelation[] = [];
export let glassState: 'equilibrium' | 'firing' | 'cascade' | 'dead' | 'recovering' = 'equilibrium';
let trustBuildInterval: ReturnType<typeof setInterval> | null = null;
let iteratedRound = 0;

/**
 * Play a cooperative harmony sound when trust increases
 */
function playTrustHarmony(trustLevel: number): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    // Major chord that gets brighter with higher trust
    const baseFreq = 220 + (trustLevel / 100) * 110; // 220-330 Hz
    const frequencies = [
        baseFreq,
        baseFreq * 1.25,  // Major third
        baseFreq * 1.5    // Perfect fifth
    ];

    frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.03, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + i * 0.05);
        osc.stop(now + 1.5);
    });
}

/**
 * Play a tension/warning sound when trust decreases
 */
function playTrustDecay(severity: number): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    // Dissonant interval
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.value = 150;
    osc2.frequency.value = 150 * 1.06; // Minor second - very dissonant

    filter.type = 'lowpass';
    filter.frequency.value = 400 + severity * 200;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05 * severity, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
}

/**
 * Toggle between one-shot and iterated game modes
 */
export function setGameMode(mode: GameMode): void {
    currentGameMode = mode;
    resetGlassForest();
    updateModeUI();

    if (mode === 'iterated') {
        startTrustBuilding();
    } else {
        stopTrustBuilding();
    }
}

/**
 * Debug: Set all nodes to a specific trust level (for testing)
 */
export function setAllTrust(level: number): void {
    glassNodes.forEach((node, i) => {
        node.trust = Math.max(0, Math.min(100, level));
        updateNodeTrustVisual(i);
    });
    trustRelations.forEach(relation => {
        relation.trust = level;
        updateRelationVisual(relation);
    });
    updateGlobalTrustDisplay();
    console.log(`All nodes set to ${level}% trust`);
}

/**
 * Update the UI to reflect current game mode
 */
function updateModeUI(): void {
    const container = document.getElementById('glass-forest-container');
    const messageEl = document.getElementById('glass-message');
    const modeButtons = document.querySelectorAll('.game-mode-btn');

    // Set data attribute for CSS styling
    if (container) {
        container.dataset.mode = currentGameMode;
    }

    modeButtons.forEach(btn => {
        const btnEl = btn as HTMLElement;
        btn.classList.toggle('active', btnEl.dataset.mode === currentGameMode);
    });

    if (messageEl) {
        if (currentGameMode === 'iterated') {
            messageEl.textContent = 'trust builds slowly through cooperation — click to defect';
        } else {
            messageEl.textContent = 'click any civilization to break the standoff';
        }
    }
}

/**
 * Start the trust-building interval for iterated mode
 */
function startTrustBuilding(): void {
    stopTrustBuilding();

    // Build trust every 2 seconds when in equilibrium
    trustBuildInterval = setInterval(() => {
        if (glassState !== 'equilibrium' || currentGameMode !== 'iterated') return;

        iteratedRound++;
        let anyTrustIncreased = false;

        // Each living node builds trust
        glassNodes.forEach((node, i) => {
            if (!node.alive || node.hasDefected) return;

            node.cooperationStreak++;

            // Trust increases logarithmically (harder to reach 100)
            const trustGain = Math.max(1, 5 - Math.floor(node.trust / 25));
            node.trust = Math.min(100, node.trust + trustGain);

            if (trustGain > 0) anyTrustIncreased = true;

            updateNodeTrustVisual(i);
        });

        // Update trust relations
        trustRelations.forEach(relation => {
            const node1 = glassNodes[relation.node1];
            const node2 = glassNodes[relation.node2];
            if (!node1?.alive || !node2?.alive) return;

            // Relation trust is average of both nodes
            const newTrust = (node1.trust + node2.trust) / 2;
            relation.trust = newTrust;
            updateRelationVisual(relation);
        });

        // Play harmony sound occasionally when trust is high
        if (anyTrustIncreased && iteratedRound % 3 === 0) {
            const avgTrust = glassNodes.reduce((sum, n) => sum + n.trust, 0) / glassNodes.length;
            if (avgTrust > 60) {
                playTrustHarmony(avgTrust);
            }
        }

        updateGlobalTrustDisplay();
    }, 2000);
}

/**
 * Stop the trust-building interval
 */
function stopTrustBuilding(): void {
    if (trustBuildInterval) {
        clearInterval(trustBuildInterval);
        trustBuildInterval = null;
    }
}

/**
 * Update visual representation of a node's trust level
 */
function updateNodeTrustVisual(nodeIndex: number): void {
    const node = glassNodes[nodeIndex];
    if (!node || !node.trustEl) return;

    const trustPercent = node.trust;
    node.trustEl.style.width = `${trustPercent}%`;

    // Color shifts from red (low trust) to green (high trust)
    if (trustPercent < 30) {
        node.trustEl.style.background = 'rgba(200, 80, 80, 0.6)';
    } else if (trustPercent < 60) {
        node.trustEl.style.background = 'rgba(200, 180, 80, 0.6)';
    } else {
        node.trustEl.style.background = 'rgba(80, 180, 100, 0.6)';
    }

    // Add glow for high trust
    if (trustPercent > 80) {
        node.el.classList.add('high-trust');
    } else {
        node.el.classList.remove('high-trust');
    }
}

/**
 * Update visual representation of a trust relation (sight line)
 */
function updateRelationVisual(relation: TrustRelation): void {
    if (!relation.lineEl) return;

    const trustPercent = relation.trust;

    // Line gets thicker and greener with trust
    if (trustPercent < 30) {
        relation.lineEl.style.background = 'rgba(180, 80, 80, 0.3)';
        relation.lineEl.style.height = '1px';
    } else if (trustPercent < 60) {
        relation.lineEl.style.background = 'rgba(180, 180, 80, 0.4)';
        relation.lineEl.style.height = '1px';
    } else {
        relation.lineEl.style.background = `rgba(80, 180, 100, ${0.3 + (trustPercent - 60) / 100})`;
        relation.lineEl.style.height = trustPercent > 80 ? '2px' : '1px';
    }
}

/**
 * Update the global trust display
 */
function updateGlobalTrustDisplay(): void {
    const phaseEl = document.getElementById('glass-phase');
    if (!phaseEl || currentGameMode !== 'iterated') return;

    const avgTrust = glassNodes.filter(n => n.alive).reduce((sum, n) => sum + n.trust, 0) /
        Math.max(1, glassNodes.filter(n => n.alive).length);

    if (avgTrust > 80) {
        phaseEl.textContent = 'STABLE COOPERATION';
        phaseEl.style.color = 'rgba(100, 200, 120, 0.9)';
    } else if (avgTrust > 60) {
        phaseEl.textContent = 'TRUST BUILDING';
        phaseEl.style.color = 'rgba(180, 200, 100, 0.9)';
    } else if (avgTrust > 40) {
        phaseEl.textContent = 'CAUTIOUS PEACE';
        phaseEl.style.color = 'rgba(200, 180, 100, 0.9)';
    } else {
        phaseEl.textContent = 'TENSE STANDOFF';
        phaseEl.style.color = 'rgba(200, 150, 100, 0.9)';
    }
}

export function drawGlassSightLines(): void {
    const container = document.getElementById('glass-forest-container');
    if (!container) return;

    glassSightLines.forEach(l => l.remove());
    glassSightLines = [];
    trustRelations = [];

    const alive = glassNodes.filter(n => n.alive);
    const aliveIndices = glassNodes.map((n, i) => n.alive ? i : -1).filter(i => i >= 0);

    for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
            const line = document.createElement('div');
            line.className = 'sight-line';
            const fromId = aliveIndices[i];
            const toId = aliveIndices[j];
            line.dataset.from = String(fromId);
            line.dataset.to = String(toId);

            const x1 = alive[i].x + 9;
            const y1 = alive[i].y + 9;
            const x2 = alive[j].x + 9;
            const y2 = alive[j].y + 9;

            const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

            line.style.left = x1 + 'px';
            line.style.top = y1 + 'px';
            line.style.width = length + 'px';
            line.style.transform = `rotate(${angle}deg)`;

            container.appendChild(line);
            glassSightLines.push(line);

            // Create trust relation for iterated mode
            const node1Trust = glassNodes[fromId]?.trust || 50;
            const node2Trust = glassNodes[toId]?.trust || 50;
            trustRelations.push({
                node1: fromId,
                node2: toId,
                trust: (node1Trust + node2Trust) / 2,
                lineEl: line
            });

            // Apply initial trust visual in iterated mode
            if (currentGameMode === 'iterated') {
                updateRelationVisual(trustRelations[trustRelations.length - 1]);
            }
        }
    }
}

export function fireGlassNode(shooterId: number): void {
    if (glassState !== 'equilibrium') return;

    const shooter = glassNodes[shooterId];
    if (!shooter || !shooter.alive) return;

    // Route to appropriate mode handler
    if (currentGameMode === 'iterated') {
        fireGlassNodeIterated(shooterId);
    } else {
        fireGlassNodeOneShot(shooterId);
    }
}

/**
 * One-shot mode: Instant cascade, mutual annihilation
 */
function fireGlassNodeOneShot(shooterId: number): void {
    const shooter = glassNodes[shooterId];
    const phaseEl = document.getElementById('glass-phase');
    const messageEl = document.getElementById('glass-message');

    glassState = 'firing';

    shooter.el.classList.add('firing');
    if (phaseEl) {
        phaseEl.textContent = 'SHOT FIRED';
        phaseEl.style.color = 'var(--warning-amber)';
    }

    // Audio: Initial shot ping
    playGlassNodePing(shooterId, shooter.color);

    setTimeout(() => {
        if (phaseEl) {
            phaseEl.textContent = '⚠ MUZZLE FLASH DETECTED';
            phaseEl.style.color = 'var(--danger-red)';
        }
        if (messageEl) {
            messageEl.textContent = 'all observers have detected the shot';
        }

        glassSightLines.forEach(line => {
            if (line.dataset.from == String(shooterId) || line.dataset.to == String(shooterId)) {
                line.classList.add('to-shooter');
            }
        });

        glassNodes.forEach((n, i) => {
            if (n.alive && i !== shooterId) {
                n.el.classList.add('observing');
                // Audio: Observer detection pings (staggered)
                setTimeout(() => playGlassNodePing(i, n.color), i * 80);
            }
        });
    }, 400);

    setTimeout(() => {
        if (phaseEl) {
            phaseEl.textContent = 'POSITION REVEALED TO ALL';
        }
        if (messageEl) {
            messageEl.textContent = `${glassNodes.filter(n => n.alive).length - 1} civilizations targeting ${shooter.el.dataset.name}`;
        }

        glassSightLines.forEach(line => {
            line.classList.remove('to-shooter');
            line.classList.add('alert');
        });
    }, 1200);

    setTimeout(() => {
        if (phaseEl) {
            phaseEl.textContent = 'CHAIN REACTION';
        }

        glassNodes.forEach((n, i) => {
            if (n.alive) {
                n.el.classList.remove('observing');
                n.el.classList.add('firing');
                // Audio: Rapid fire pings
                setTimeout(() => playGlassNodePing(i, n.color), i * 50);
            }
        });
    }, 2000);

    setTimeout(() => {
        glassNodes.forEach(n => {
            n.alive = false;
            n.el.classList.remove('firing', 'observing');
            n.el.classList.add('dead');
        });

        glassSightLines.forEach(l => {
            l.classList.remove('alert', 'to-shooter');
            l.style.opacity = '0.1';
        });

        if (phaseEl) {
            phaseEl.textContent = 'MUTUAL ANNIHILATION';
            phaseEl.style.color = 'var(--text-tertiary)';
        }
        if (messageEl) {
            messageEl.textContent = 'the only winning move is not to play';
        }

        // Audio: Destruction sound
        playMutualAnnihilation();

        glassState = 'dead';
    }, 2800);
}

/**
 * Iterated mode: Trust-based response, possible forgiveness or slower cascade
 */
function fireGlassNodeIterated(shooterId: number): void {
    const shooter = glassNodes[shooterId];
    const phaseEl = document.getElementById('glass-phase');
    const messageEl = document.getElementById('glass-message');

    glassState = 'firing';
    stopTrustBuilding();

    // Mark shooter as defector
    shooter.hasDefected = true;
    shooter.trust = 0;
    shooter.cooperationStreak = 0;
    updateNodeTrustVisual(shooterId);

    shooter.el.classList.add('firing', 'defector');
    if (phaseEl) {
        phaseEl.textContent = 'DEFECTION';
        phaseEl.style.color = 'var(--warning-amber)';
    }

    playGlassNodePing(shooterId, shooter.color);
    playTrustDecay(1);

    // Calculate average trust of other nodes toward shooter
    const otherNodes = glassNodes.filter((n, i) => n.alive && i !== shooterId);
    const avgTrust = otherNodes.reduce((sum, n) => sum + n.trust, 0) / Math.max(1, otherNodes.length);
    const willForgive = avgTrust > 75; // High trust = chance for forgiveness

    setTimeout(() => {
        if (phaseEl) {
            phaseEl.textContent = '⚠ BETRAYAL DETECTED';
            phaseEl.style.color = 'var(--danger-red)';
        }
        if (messageEl) {
            messageEl.textContent = willForgive
                ? 'trust was high... calculating response'
                : 'trust shattered — retaliation inevitable';
        }

        // All nodes lose trust
        glassNodes.forEach((n, i) => {
            if (n.alive && i !== shooterId) {
                n.trust = Math.max(0, n.trust - 30);
                n.cooperationStreak = 0;
                updateNodeTrustVisual(i);
                n.el.classList.add('observing');
                setTimeout(() => playGlassNodePing(i, n.color), i * 100);
            }
        });

        // Update relations
        trustRelations.forEach(relation => {
            relation.trust = Math.max(0, relation.trust - 40);
            updateRelationVisual(relation);
        });

        glassSightLines.forEach(line => {
            if (line.dataset.from == String(shooterId) || line.dataset.to == String(shooterId)) {
                line.classList.add('to-shooter');
            }
        });
    }, 600);

    setTimeout(() => {
        glassSightLines.forEach(line => {
            line.classList.remove('to-shooter');
            line.classList.add('alert');
        });

        if (willForgive) {
            // High trust scenario: forgiveness possible
            if (phaseEl) {
                phaseEl.textContent = 'DELIBERATION';
            }
            if (messageEl) {
                messageEl.textContent = 'years of cooperation weigh against one betrayal';
            }
        } else {
            if (phaseEl) {
                phaseEl.textContent = 'RETALIATION IMMINENT';
            }
        }
    }, 1800);

    setTimeout(() => {
        if (willForgive) {
            // Forgiveness path: shooter survives but isolated
            glassState = 'recovering';

            shooter.el.classList.remove('firing');
            shooter.el.classList.add('isolated');

            glassNodes.forEach((n, i) => {
                if (n.alive && i !== shooterId) {
                    n.el.classList.remove('observing');
                }
            });

            glassSightLines.forEach(l => {
                l.classList.remove('alert', 'to-shooter');
                // Lines to shooter become dim
                if (l.dataset.from == String(shooterId) || l.dataset.to == String(shooterId)) {
                    l.style.opacity = '0.2';
                }
            });

            if (phaseEl) {
                phaseEl.textContent = 'FORGIVENESS (WITH SUSPICION)';
                phaseEl.style.color = 'rgba(180, 180, 100, 0.9)';
            }
            if (messageEl) {
                messageEl.textContent = 'the defector survives, but trust must be rebuilt';
            }

            // Play harmony but muted
            playTrustHarmony(30);

            // Resume trust building after delay
            setTimeout(() => {
                glassState = 'equilibrium';
                startTrustBuilding();
                updateGlobalTrustDisplay();
            }, 2000);
        } else {
            // Retaliation path: cascade but slower
            glassState = 'cascade';

            if (phaseEl) {
                phaseEl.textContent = 'CASCADE';
            }

            // Slower cascade - nodes fire one by one
            const livingNodes = glassNodes
                .map((n, i) => ({ node: n, index: i }))
                .filter(({ node, index }) => node.alive && index !== shooterId);

            livingNodes.forEach(({ node, index }, delay) => {
                setTimeout(() => {
                    node.el.classList.remove('observing');
                    node.el.classList.add('firing');
                    playGlassNodePing(index, node.color);
                }, delay * 400);
            });

            // Final annihilation
            setTimeout(() => {
                glassNodes.forEach(n => {
                    n.alive = false;
                    n.trust = 0;
                    n.el.classList.remove('firing', 'observing', 'defector');
                    n.el.classList.add('dead');
                    if (n.trustEl) n.trustEl.style.width = '0%';
                });

                glassSightLines.forEach(l => {
                    l.classList.remove('alert', 'to-shooter');
                    l.style.opacity = '0.1';
                });

                if (phaseEl) {
                    phaseEl.textContent = 'MUTUAL ANNIHILATION';
                    phaseEl.style.color = 'var(--text-tertiary)';
                }
                if (messageEl) {
                    messageEl.textContent = 'trust, once broken, cannot hold';
                }

                playMutualAnnihilation();
                glassState = 'dead';
            }, livingNodes.length * 400 + 800);
        }
    }, 3000);
}

export function resetGlassForest(): void {
    const phaseEl = document.getElementById('glass-phase');
    const messageEl = document.getElementById('glass-message');

    stopTrustBuilding();
    iteratedRound = 0;

    glassNodes.forEach((n, i) => {
        n.alive = true;
        n.trust = 50;
        n.cooperationStreak = 0;
        n.hasDefected = false;
        n.el.classList.remove('dead', 'firing', 'observing', 'defector', 'isolated', 'high-trust');
        updateNodeTrustVisual(i);
    });

    glassSightLines.forEach(l => {
        l.classList.remove('alert', 'to-shooter');
        l.style.opacity = '';
        l.style.background = '';
        l.style.height = '';
    });

    drawGlassSightLines();

    if (phaseEl) {
        phaseEl.textContent = currentGameMode === 'iterated' ? 'CAUTIOUS PEACE' : 'EQUILIBRIUM';
        phaseEl.style.color = '';
    }
    if (messageEl) {
        messageEl.textContent = currentGameMode === 'iterated'
            ? 'trust builds slowly through cooperation — click to defect'
            : 'click any civilization to break the standoff';
    }

    glassState = 'equilibrium';

    if (currentGameMode === 'iterated') {
        startTrustBuilding();
    }
}

export function initGlassForest(): void {
    const container = document.getElementById('glass-forest-container');
    if (!container) return;

    // Create mode toggle buttons
    createModeToggle(container);

    const colors = ['#d46b6b', '#e0b285', '#6a9e9e', '#5a6a7f', '#d48db8', '#8aa4c6', '#9e8a6a', '#6a9e7a'];

    // Responsive layout calculations
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const isMobile = containerWidth < 480;
    const isSmallMobile = containerWidth < 360;

    // Reduce node count on very small screens
    const nodeCount = isSmallMobile ? 6 : 8;
    const nodeSize = isMobile ? 40 : 60;
    const padding = isMobile ? 25 : 50;

    // Use grid-based positioning to prevent overlap
    const cols = Math.ceil(Math.sqrt(nodeCount * (containerWidth / Math.max(containerHeight, 200))));
    const rows = Math.ceil(nodeCount / cols);
    const cellWidth = (containerWidth - padding * 2) / cols;
    const cellHeight = (containerHeight - padding * 2 - 50) / rows;

    for (let i = 0; i < nodeCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);

        // Position within grid cell with jitter for organic feel
        const jitterX = (Math.random() - 0.5) * cellWidth * 0.4;
        const jitterY = (Math.random() - 0.5) * cellHeight * 0.4;
        const x = padding + col * cellWidth + cellWidth / 2 + jitterX;
        const y = padding + row * cellHeight + cellHeight / 2 + jitterY;

        const node = document.createElement('div');
        node.className = 'glass-node';
        node.textContent = '◉';
        node.style.color = colors[i % colors.length];
        node.style.left = x + 'px';
        node.style.top = y + 'px';
        node.style.fontSize = nodeSize + 'px';
        node.dataset.id = String(i);
        node.dataset.name = `CIV-${i + 1}`;

        // Create trust bar for iterated mode
        const trustBar = document.createElement('div');
        trustBar.className = 'trust-bar';
        const trustFill = document.createElement('div');
        trustFill.className = 'trust-fill';
        trustFill.style.width = '50%';
        trustBar.appendChild(trustFill);
        node.appendChild(trustBar);

        // Optimize for touch - faster response, no 300ms delay
        node.style.touchAction = 'manipulation';
        node.addEventListener('click', () => fireGlassNode(i));

        container.appendChild(node);
        glassNodes.push({
            el: node,
            alive: true,
            x: parseFloat(node.style.left),
            y: parseFloat(node.style.top),
            color: colors[i % colors.length],
            trust: 50,
            trustEl: trustFill,
            cooperationStreak: 0,
            hasDefected: false
        });
    }

    drawGlassSightLines();
    updateModeUI();
}

/**
 * Create game mode toggle buttons
 */
function createModeToggle(container: HTMLElement): void {
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'game-mode-toggle';

    const oneShotBtn = document.createElement('button');
    oneShotBtn.className = 'game-mode-btn active';
    oneShotBtn.dataset.mode = 'one-shot';
    oneShotBtn.textContent = 'One-Shot';
    oneShotBtn.title = 'Single interaction — instant cascade';
    oneShotBtn.addEventListener('click', () => setGameMode('one-shot'));

    const iteratedBtn = document.createElement('button');
    iteratedBtn.className = 'game-mode-btn';
    iteratedBtn.dataset.mode = 'iterated';
    iteratedBtn.textContent = 'Iterated';
    iteratedBtn.title = 'Repeated interactions — trust can build';
    iteratedBtn.addEventListener('click', () => setGameMode('iterated'));

    toggleContainer.appendChild(oneShotBtn);
    toggleContainer.appendChild(iteratedBtn);

    // Find the header in the parent ascii-interactive container
    const parent = container.parentElement;
    if (parent) {
        const header = parent.querySelector('.ascii-header');
        if (header) {
            header.appendChild(toggleContainer);
        } else {
            parent.insertBefore(toggleContainer, container);
        }
    }
}
