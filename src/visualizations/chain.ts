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
    const nodeWidth = 60;
    const totalWidth = nodeWidth * chainData.length;
    const spacing = (width - totalWidth) / (chainData.length + 1);

    chainData.forEach((data, i) => {
        const node = document.createElement('div');
        node.className = 'chain-node';
        node.id = `chain-node-${i}`;
        node.innerHTML = `╭───────╮<br>│${data.name.substring(0, 7).padStart(4).padEnd(7)}│<br>╰───────╯`;
        node.style.left = (spacing + i * (nodeWidth + spacing)) + 'px';
        node.style.color = data.color;
        container.appendChild(node);
        chainNodes.push({ el: node, alive: true, data });

        if (i < chainData.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'chain-arrow';
            arrow.id = `chain-arrow-${i}`;
            arrow.textContent = '──▶';
            arrow.style.left = (spacing + i * (nodeWidth + spacing) + nodeWidth + 5) + 'px';
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
