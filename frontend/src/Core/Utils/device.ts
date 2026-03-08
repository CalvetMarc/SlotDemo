/** Detect mobile phones and small tablets (excludes touch laptops and large tablets). */
export function isMobileDevice(): boolean {
    return navigator.maxTouchPoints > 0
        && Math.min(window.innerWidth, window.innerHeight) <= 500;
}

/** Cross-browser fullscreen request (fire-and-forget). */
export function requestFullscreen(): void {
    const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
    };

    if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen().catch(() => {});
    }
}
