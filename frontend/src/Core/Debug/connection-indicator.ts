type Status = 'online' | 'offline' | 'unknown';

let dot: HTMLDivElement | null = null;

function ensureDot(): HTMLDivElement {
    if (dot) return dot;
    dot = document.createElement('div');
    dot.id = 'connection-dot';
    Object.assign(dot.style, {
        position: 'fixed',
        bottom: '8px',
        right: '8px',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: '#888',
        zIndex: '99999',
        pointerEvents: 'none',
        transition: 'background 0.3s',
    });
    document.body.appendChild(dot);
    return dot;
}

const COLORS: Record<Status, string> = {
    online: '#22c55e',
    offline: '#ef4444',
    unknown: '#888',
};

export const ConnectionIndicator = {
    set(status: Status): void {
        ensureDot().style.background = COLORS[status];
    },
};
