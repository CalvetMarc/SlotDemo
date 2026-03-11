import { Howler } from 'howler';

/**
 * Temporary on-screen overlay to diagnose iOS audio issues.
 * Shows AudioContext state, mute state, and visibility events.
 * DELETE THIS FILE once the bug is resolved.
 */

const MAX_LOG_LINES = 12;

let overlay: HTMLDivElement | null = null;
let logLines: string[] = [];
let updateInterval: ReturnType<typeof setInterval> | null = null;

function ts(): string {
  const d = new Date();
  return `${d.getMinutes()}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export function audioDebugLog(msg: string): void {
  logLines.push(`[${ts()}] ${msg}`);
  if (logLines.length > MAX_LOG_LINES) logLines.shift();
  render();
}

function render(): void {
  if (!overlay) return;
  const ctx = Howler.ctx;
  const state = ctx ? ctx.state : 'no-ctx';

  const header = [
    `ctx: ${state}`,
    `hidden: ${document.hidden}`,
  ].join(' | ');

  overlay.innerHTML =
    `<div style="font-weight:bold;margin-bottom:4px">${header}</div>` +
    logLines.map((l) => `<div>${l}</div>`).join('');
}

export function initAudioDebugOverlay(): void {
  if (overlay) return;

  overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '99999',
    background: 'rgba(0,0,0,0.8)',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: '10px',
    lineHeight: '1.3',
    padding: '6px',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  });
  document.body.appendChild(overlay);

  // Log visibility changes
  document.addEventListener('visibilitychange', () => {
    const ctx = Howler.ctx;
    audioDebugLog(`visibility: ${document.hidden ? 'HIDDEN' : 'VISIBLE'} ctx=${ctx?.state ?? '?'}`);
  });

  // Log AudioContext state changes
  const ctx = Howler.ctx;
  if (ctx) {
    ctx.addEventListener('statechange', () => {
      audioDebugLog(`ctx statechange → ${ctx.state}`);
    });
  }

  // Periodic refresh of header
  updateInterval = setInterval(render, 500);

  audioDebugLog('overlay init');
}

export function destroyAudioDebugOverlay(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  logLines = [];
}
