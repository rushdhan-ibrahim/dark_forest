// Payoff Matrix Visualizer - Interactive game theory demonstration
// Shows how rational actors end up in suboptimal equilibria

import { getAudioContext, getMasterGain, getIsAudioPlaying } from '../audio/context';

interface Payoffs {
    // Payoffs are [Player A, Player B]
    bothCooperate: [number, number];
    aDefects: [number, number];     // A defects, B cooperates
    bDefects: [number, number];     // A cooperates, B defects
    bothDefect: [number, number];
}

interface MatrixCell {
    el: HTMLElement;
    row: 'cooperate' | 'defect';
    col: 'cooperate' | 'defect';
}

let container: HTMLElement | null = null;
let cells: MatrixCell[] = [];
let payoffs: Payoffs = {
    bothCooperate: [3, 3],
    aDefects: [5, 0],
    bDefects: [0, 5],
    bothDefect: [1, 1]
};

let isAnimating = false;

/**
 * Play a tone for equilibrium discovery
 */
function playEquilibriumSound(isNash: boolean): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    if (isNash) {
        // Resolving chord - the "answer" sound
        const freqs = [220, 277, 330]; // A minor chord
        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.06, now + 0.05 + i * 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(now + i * 0.03);
            osc.stop(now + 1.3);
        });
    } else {
        // Single tone for non-Nash highlight
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = 440;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.4);
    }
}

/**
 * Play reasoning step sound
 */
function playReasoningStep(step: number): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 300 + step * 50;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
}

/**
 * Get payoff for a specific cell
 */
function getPayoff(row: 'cooperate' | 'defect', col: 'cooperate' | 'defect'): [number, number] {
    if (row === 'cooperate' && col === 'cooperate') return payoffs.bothCooperate;
    if (row === 'defect' && col === 'cooperate') return payoffs.aDefects;
    if (row === 'cooperate' && col === 'defect') return payoffs.bDefects;
    return payoffs.bothDefect;
}

/**
 * Find Nash equilibria in the current payoff matrix
 */
function findNashEquilibria(): Array<{ row: 'cooperate' | 'defect'; col: 'cooperate' | 'defect' }> {
    const equilibria: Array<{ row: 'cooperate' | 'defect'; col: 'cooperate' | 'defect' }> = [];
    const rows: Array<'cooperate' | 'defect'> = ['cooperate', 'defect'];
    const cols: Array<'cooperate' | 'defect'> = ['cooperate', 'defect'];

    for (const row of rows) {
        for (const col of cols) {
            const currentPayoff = getPayoff(row, col);
            const otherRow = row === 'cooperate' ? 'defect' : 'cooperate';
            const otherCol = col === 'cooperate' ? 'defect' : 'cooperate';

            // Check if A can improve by changing strategy (given B's choice)
            const aAltPayoff = getPayoff(otherRow, col);
            const aCanImprove = aAltPayoff[0] > currentPayoff[0];

            // Check if B can improve by changing strategy (given A's choice)
            const bAltPayoff = getPayoff(row, otherCol);
            const bCanImprove = bAltPayoff[1] > currentPayoff[1];

            // Nash equilibrium: neither player can unilaterally improve
            if (!aCanImprove && !bCanImprove) {
                equilibria.push({ row, col });
            }
        }
    }

    return equilibria;
}

/**
 * Find the Pareto optimal outcomes
 */
function findParetoOptimal(): Array<{ row: 'cooperate' | 'defect'; col: 'cooperate' | 'defect' }> {
    const outcomes: Array<{ row: 'cooperate' | 'defect'; col: 'cooperate' | 'defect'; payoff: [number, number] }> = [];
    const rows: Array<'cooperate' | 'defect'> = ['cooperate', 'defect'];
    const cols: Array<'cooperate' | 'defect'> = ['cooperate', 'defect'];

    for (const row of rows) {
        for (const col of cols) {
            outcomes.push({ row, col, payoff: getPayoff(row, col) });
        }
    }

    // Find Pareto optimal: no other outcome is better for both players
    return outcomes.filter(outcome => {
        return !outcomes.some(other =>
            other.payoff[0] >= outcome.payoff[0] &&
            other.payoff[1] >= outcome.payoff[1] &&
            (other.payoff[0] > outcome.payoff[0] || other.payoff[1] > outcome.payoff[1])
        );
    });
}

/**
 * Update the visual display of the matrix
 */
function updateMatrixDisplay(): void {
    const equilibria = findNashEquilibria();
    const paretoOptimal = findParetoOptimal();

    cells.forEach(cell => {
        const payoff = getPayoff(cell.row, cell.col);
        const payoffEl = cell.el.querySelector('.cell-payoff');
        if (payoffEl) {
            payoffEl.innerHTML = `<span class="payoff-a">${payoff[0]}</span>, <span class="payoff-b">${payoff[1]}</span>`;
        }

        // Clear previous states
        cell.el.classList.remove('nash', 'pareto', 'reasoning', 'dominated');

        // Mark Nash equilibria
        const isNash = equilibria.some(e => e.row === cell.row && e.col === cell.col);
        if (isNash) {
            cell.el.classList.add('nash');
        }

        // Mark Pareto optimal (if not Nash)
        const isPareto = paretoOptimal.some(p => p.row === cell.row && p.col === cell.col);
        if (isPareto && !isNash) {
            cell.el.classList.add('pareto');
        }
    });

    // Update status message
    updateStatusMessage(equilibria, paretoOptimal);
}

/**
 * Update the status/explanation message
 */
function updateStatusMessage(
    equilibria: Array<{ row: 'cooperate' | 'defect'; col: 'cooperate' | 'defect' }>,
    paretoOptimal: Array<{ row: 'cooperate' | 'defect'; col: 'cooperate' | 'defect' }>
): void {
    const statusEl = container?.querySelector('.matrix-status');
    if (!statusEl) return;

    const nashStr = equilibria.map(e =>
        `(${e.row === 'defect' ? 'Defect' : 'Cooperate'}, ${e.col === 'defect' ? 'Defect' : 'Cooperate'})`
    ).join(', ');

    // Check for the classic Prisoner's Dilemma tragedy
    const hasCoopNash = equilibria.some(e => e.row === 'cooperate' && e.col === 'cooperate');
    const hasDefectNash = equilibria.some(e => e.row === 'defect' && e.col === 'defect');
    const coopIsPareto = paretoOptimal.some(p => p.row === 'cooperate' && p.col === 'cooperate');

    let message = '';
    if (equilibria.length === 0) {
        message = 'No pure strategy Nash equilibrium exists. Mixed strategies would be needed.';
    } else if (hasDefectNash && !hasCoopNash && coopIsPareto) {
        message = `Nash equilibrium: ${nashStr}. The tragedy: mutual cooperation would be better for both, but rational self-interest drives defection.`;
    } else if (hasCoopNash) {
        message = `Nash equilibrium: ${nashStr}. Cooperation is stable here—neither player gains by defecting alone.`;
    } else {
        message = `Nash equilibrium: ${nashStr}.`;
    }

    statusEl.textContent = message;
}

/**
 * Animate the reasoning path to Nash equilibrium
 */
export function animateReasoning(): void {
    if (isAnimating) return;
    isAnimating = true;

    const statusEl = container?.querySelector('.matrix-status');

    // Clear all states
    cells.forEach(c => c.el.classList.remove('reasoning', 'dominated', 'nash', 'pareto'));

    const steps = [
        {
            message: "A thinks: 'If B cooperates, I get 3 by cooperating or 5 by defecting. Defect is better.'",
            highlight: ['defect-cooperate'],
            delay: 0
        },
        {
            message: "A thinks: 'If B defects, I get 0 by cooperating or 1 by defecting. Defect is still better.'",
            highlight: ['defect-defect'],
            delay: 1500
        },
        {
            message: "A concludes: 'No matter what B does, I should defect.' (Defect dominates Cooperate for A)",
            highlight: ['defect-cooperate', 'defect-defect'],
            dominated: ['cooperate-cooperate', 'cooperate-defect'],
            delay: 3000
        },
        {
            message: "B reasons identically: 'No matter what A does, I should defect.'",
            highlight: ['cooperate-defect', 'defect-defect'],
            delay: 4500
        },
        {
            message: "Both defect. Both get 1. Both could have had 3. This is the Nash equilibrium—stable, but tragic.",
            nash: ['defect-defect'],
            delay: 6000
        }
    ];

    steps.forEach((step, i) => {
        setTimeout(() => {
            playReasoningStep(i);

            if (statusEl) {
                statusEl.textContent = step.message;
            }

            cells.forEach(c => {
                c.el.classList.remove('reasoning', 'dominated');
                const cellKey = `${c.row}-${c.col}`;

                if (step.highlight?.includes(cellKey)) {
                    c.el.classList.add('reasoning');
                }
                if (step.dominated?.includes(cellKey)) {
                    c.el.classList.add('dominated');
                }
                if (step.nash?.includes(cellKey)) {
                    c.el.classList.add('nash');
                    playEquilibriumSound(true);
                }
            });

            if (i === steps.length - 1) {
                isAnimating = false;
            }
        }, step.delay);
    });
}

/**
 * Handle payoff slider change
 */
function handlePayoffChange(key: keyof Payoffs, player: 0 | 1, value: number): void {
    payoffs[key][player] = value;
    updateMatrixDisplay();

    // Update slider label
    const sliderId = `${key}-${player === 0 ? 'a' : 'b'}`;
    const label = container?.querySelector(`label[for="${sliderId}"] .slider-value`);
    if (label) {
        label.textContent = String(value);
    }
}

/**
 * Reset to classic Prisoner's Dilemma payoffs
 */
export function resetPayoffMatrix(): void {
    payoffs = {
        bothCooperate: [3, 3],
        aDefects: [5, 0],
        bDefects: [0, 5],
        bothDefect: [1, 1]
    };

    // Reset sliders
    const sliders = container?.querySelectorAll('input[type="range"]');
    sliders?.forEach(slider => {
        const input = slider as HTMLInputElement;
        const [key, player] = input.id.split('-') as [string, string];
        const fullKey = key === 'cc' ? 'bothCooperate' :
                       key === 'dc' ? 'aDefects' :
                       key === 'cd' ? 'bDefects' : 'bothDefect';
        const playerIndex = player === 'a' ? 0 : 1;
        input.value = String(payoffs[fullKey as keyof Payoffs][playerIndex]);

        const label = container?.querySelector(`label[for="${input.id}"] .slider-value`);
        if (label) {
            label.textContent = input.value;
        }
    });

    cells.forEach(c => c.el.classList.remove('reasoning', 'dominated'));
    updateMatrixDisplay();
}

/**
 * Create a payoff slider
 */
function createSlider(
    id: string,
    label: string,
    value: number,
    onChange: (val: number) => void
): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'payoff-slider';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.innerHTML = `${label}: <span class="slider-value">${value}</span>`;

    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = '-2';
    input.max = '10';
    input.value = String(value);
    input.addEventListener('input', () => {
        onChange(parseInt(input.value));
        const valSpan = labelEl.querySelector('.slider-value');
        if (valSpan) valSpan.textContent = input.value;
    });

    wrapper.appendChild(labelEl);
    wrapper.appendChild(input);
    return wrapper;
}

/**
 * Initialize the Payoff Matrix visualizer
 */
export function initPayoffMatrix(): void {
    container = document.getElementById('payoff-matrix-container');
    if (!container) return;

    // Create the matrix grid
    const matrix = document.createElement('div');
    matrix.className = 'payoff-matrix';

    // Header row
    const headerRow = document.createElement('div');
    headerRow.className = 'matrix-row header';
    headerRow.innerHTML = `
        <div class="matrix-cell corner"></div>
        <div class="matrix-cell header-cell">B: Cooperate</div>
        <div class="matrix-cell header-cell">B: Defect</div>
    `;
    matrix.appendChild(headerRow);

    // Data rows
    const rows: Array<'cooperate' | 'defect'> = ['cooperate', 'defect'];
    const cols: Array<'cooperate' | 'defect'> = ['cooperate', 'defect'];

    rows.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'matrix-row';

        const rowHeader = document.createElement('div');
        rowHeader.className = 'matrix-cell row-header';
        rowHeader.textContent = `A: ${row === 'cooperate' ? 'Cooperate' : 'Defect'}`;
        rowEl.appendChild(rowHeader);

        cols.forEach(col => {
            const cell = document.createElement('div');
            cell.className = 'matrix-cell data-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            const payoff = getPayoff(row, col);
            cell.innerHTML = `
                <div class="cell-payoff">
                    <span class="payoff-a">${payoff[0]}</span>, <span class="payoff-b">${payoff[1]}</span>
                </div>
                <div class="cell-label">(A, B)</div>
            `;

            rowEl.appendChild(cell);
            cells.push({ el: cell, row, col });
        });

        matrix.appendChild(rowEl);
    });

    container.appendChild(matrix);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'matrix-legend';
    legend.innerHTML = `
        <span class="legend-item"><span class="legend-color nash"></span> Nash Equilibrium</span>
        <span class="legend-item"><span class="legend-color pareto"></span> Pareto Optimal</span>
    `;
    container.appendChild(legend);

    // Status message
    const status = document.createElement('div');
    status.className = 'matrix-status';
    container.appendChild(status);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'matrix-controls';

    const animateBtn = document.createElement('button');
    animateBtn.className = 'ascii-btn';
    animateBtn.textContent = 'Show Reasoning';
    animateBtn.addEventListener('click', animateReasoning);
    controls.appendChild(animateBtn);

    container.appendChild(controls);

    // Sliders section (collapsible)
    const slidersToggle = document.createElement('details');
    slidersToggle.className = 'sliders-section';
    slidersToggle.innerHTML = `<summary>Adjust Payoffs</summary>`;

    const slidersContent = document.createElement('div');
    slidersContent.className = 'sliders-content';

    // Create sliders for each payoff
    const sliderConfigs = [
        { key: 'bothCooperate' as const, label: 'Both Cooperate', short: 'cc' },
        { key: 'aDefects' as const, label: 'A Defects, B Cooperates', short: 'dc' },
        { key: 'bDefects' as const, label: 'A Cooperates, B Defects', short: 'cd' },
        { key: 'bothDefect' as const, label: 'Both Defect', short: 'dd' }
    ];

    sliderConfigs.forEach(config => {
        const group = document.createElement('div');
        group.className = 'slider-group';
        group.innerHTML = `<div class="slider-group-label">${config.label}</div>`;

        group.appendChild(createSlider(
            `${config.short}-a`,
            'A gets',
            payoffs[config.key][0],
            (val) => handlePayoffChange(config.key, 0, val)
        ));

        group.appendChild(createSlider(
            `${config.short}-b`,
            'B gets',
            payoffs[config.key][1],
            (val) => handlePayoffChange(config.key, 1, val)
        ));

        slidersContent.appendChild(group);
    });

    slidersToggle.appendChild(slidersContent);
    container.appendChild(slidersToggle);

    // Initial display
    updateMatrixDisplay();
}
