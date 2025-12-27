// Chain visualization module - civilization transmission chain

interface ChainDataItem {
    name: string;
    label: string;
    color: string;
}

interface ChainNode {
    el: HTMLElement;
    alive: boolean;
    data: ChainDataItem;
}

export const chainData: ChainDataItem[] = [
    { name: '???', label: 'origin?', color: 'var(--text-tertiary)' },
    { name: '· · ·', label: 'unknown', color: 'var(--text-tertiary)' },
    { name: 'KEPLER', label: '22b', color: 'var(--cold-blue)' },
    { name: 'EARTH', label: 'now', color: 'var(--joining-glow)' },
    { name: '???', label: 'next', color: 'var(--text-tertiary)' }
];

export let chainNodes: ChainNode[] = [];

export function initChain(): void {
    const container = document.getElementById('chain-container');
    if (!container) return;

    const width = container.offsetWidth;
    const isMobile = width < 480;
    const isSmallMobile = width < 360;

    // Responsive node sizing
    const nodeWidth = isSmallMobile ? 45 : isMobile ? 52 : 60;
    const arrowText = isMobile ? '→' : '──▶';
    const arrowWidth = isMobile ? 15 : 25;
    const minSpacing = 5;

    const totalContentWidth = nodeWidth * chainData.length + arrowWidth * (chainData.length - 1);
    let spacing = Math.max(minSpacing, (width - totalContentWidth) / (chainData.length + 1));

    // If still too cramped, enable horizontal scroll
    if (spacing < minSpacing) {
        container.style.overflowX = 'auto';
        container.style.justifyContent = 'flex-start';
        container.style.paddingLeft = '10px';
        spacing = minSpacing;
    }

    chainData.forEach((data, i) => {
        const node = document.createElement('div');
        node.className = 'chain-node';
        node.id = `chain-node-${i}`;

        // Shorter labels on mobile
        const boxWidth = isSmallMobile ? 5 : 7;
        const displayName = data.name.substring(0, boxWidth);
        // Center the text properly within the box
        const padTotal = boxWidth - displayName.length;
        const padLeft = Math.floor(padTotal / 2);
        const padRight = padTotal - padLeft;
        const centeredName = ' '.repeat(padLeft) + displayName + ' '.repeat(padRight);
        node.innerHTML = `╭${'─'.repeat(boxWidth)}╮<br>│${centeredName}│<br>╰${'─'.repeat(boxWidth)}╯`;

        node.style.left = (spacing + i * (nodeWidth + arrowWidth + spacing)) + 'px';
        node.style.color = data.color;
        node.style.fontSize = isMobile ? '10px' : '12px';
        container.appendChild(node);
        chainNodes.push({ el: node, alive: true, data });

        if (i < chainData.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'chain-arrow';
            arrow.id = `chain-arrow-${i}`;
            arrow.textContent = arrowText;
            arrow.style.left = (spacing + i * (nodeWidth + arrowWidth + spacing) + nodeWidth + 2) + 'px';
            container.appendChild(arrow);
        }
    });
}

export function sendChainPulse(): void {
    let i = 0;

    function pulse(): void {
        if (i > 0) {
            const prevNode = document.getElementById(`chain-node-${i - 1}`);
            const prevArrow = document.getElementById(`chain-arrow-${i - 1}`);
            if (prevNode) prevNode.classList.remove('active');
            if (prevArrow) prevArrow.classList.remove('active');
        }

        if (i >= chainNodes.length) return;
        if (!chainNodes[i].alive) return;

        const node = document.getElementById(`chain-node-${i}`);
        const arrow = document.getElementById(`chain-arrow-${i}`);
        if (node) node.classList.add('active');
        if (arrow) arrow.classList.add('active');

        i++;
        setTimeout(pulse, 400);
    }

    pulse();
}

export function resetChain(): void {
    chainNodes.forEach(n => {
        n.alive = true;
        n.el.classList.remove('dead', 'active');
        n.el.style.color = n.data.color;
    });
    document.querySelectorAll('.chain-arrow').forEach(a => a.classList.remove('active'));
}
