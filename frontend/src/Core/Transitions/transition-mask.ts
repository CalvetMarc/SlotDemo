import { Assets, Container, Graphics, Sprite, Spritesheet, Ticker } from 'pixi.js';
import { AudioManager } from '../Audio/audio-manager';

const COVER_PATH = 'assets/bonus/transiotionMask/fadeOut.mp4';
const REVEAL_PATH = 'assets/bonus/transiotionMask/fadeIn.mp4';
const LOADING_BAR_PATH = 'assets/bonus/loadingBar/loadingBar.json';

const COVER_SPEED = 0.8;
const REVEAL_SPEED = 0.75;
const HOLD_DELAY_MS = 1000;
const VIDEO_CANPLAY_TIMEOUT_MS = 5000;
const VIDEO_ENDED_SAFETY_MARGIN_MS = 2000;

/** How fast the fake progress creeps toward 90% while loading (fraction/ms). */
const PROGRESS_SPEED = 0.0004;

export class TransitionMask extends Container {
    private _videoAspect = 16 / 9;

    // Loading bar state
    private _barFill: Sprite | null = null;
    private _barFillFullW = 0;
    private _progress = 0;
    private _targetProgress = 0;

    constructor() {
        super();
        this.visible = false;
    }

    async playTransition(
        width: number,
        height: number,
        onCovered: () => Promise<void>,
    ): Promise<void> {
        this.visible = true;

        // Pre-load loading bar sheet (tiny, loads fast)
        let sheet: Spritesheet | undefined = Assets.get('loadingBar');
        if (!sheet) {
            try { sheet = await Assets.load(LOADING_BAR_PATH) as Spritesheet; } catch { /* skip */ }
        }

        // Hold layer: black bg + loading bar
        const holdLayer = new Container();
        holdLayer.visible = false;
        const bg = new Graphics();
        bg.rect(0, 0, width, height);
        bg.fill(0x000000);
        holdLayer.addChild(bg);
        this._buildLoadingBar(holdLayer, width, height, sheet);
        this.addChild(holdLayer);

        // Phase 1 – cover with HTML video overlay
        const coverVideo = this._createVideoElement(COVER_PATH);
        const coverReady = await this._waitCanPlay(coverVideo);
        holdLayer.visible = true;

        if (coverReady) {
            setTimeout(() => AudioManager.playFadeOut('bats', 500), 200);
            await this._playHtmlVideoOverlay(coverVideo, COVER_SPEED);
        }
        this._cleanupVideo(coverVideo);

        // Scene swap while loading bar progresses
        try {
            await Promise.race([
                onCovered(),
                this._delay(8000).then(() =>
                    console.warn('[TransitionMask] onCovered() timed out after 8 s')),
            ]);
        } catch (err) {
            console.error('[TransitionMask] onCovered() threw:', err);
        }

        // Fill to 100% and hold
        await this._completeLoadingBar();
        await this._delay(HOLD_DELAY_MS);

        // Phase 2 – reveal with HTML video overlay
        const revealVideo = this._createVideoElement(REVEAL_PATH);
        const revealReady = await this._waitCanPlay(revealVideo);

        if (revealReady) {
            holdLayer.visible = false;
            setTimeout(() => AudioManager.playFadeOut('bats', 500), 200);
            await this._playHtmlVideoOverlay(revealVideo, REVEAL_SPEED);
        } else {
            holdLayer.visible = false;
        }
        this._cleanupVideo(revealVideo);

        // Clean up
        this._stopLoadingBar();
        holdLayer.destroy({ children: true });
        this.visible = false;
    }

    resize(width: number, height: number): void {
        void width;
        void height;
    }

    // -- loading bar -----------------------------------------------------------

    private _buildLoadingBar(parent: Container, vw: number, vh: number, sheet?: Spritesheet): void {
        if (!sheet?.textures) return;

        const container = new Container();

        const isPortrait = vw / vh < 1;
        const barBgTex = sheet.textures['barBG.png'];
        const scale = (vw * (isPortrait ? 0.7 : 0.5)) / barBgTex.width;
        const gap = barBgTex.height * scale * 1.0;

        // "LOADING" image
        const loadingImg = new Sprite(sheet.textures['loading.png']);
        loadingImg.anchor.set(0.5);
        loadingImg.scale.set(scale);
        loadingImg.position.set(vw / 2, vh / 2 - gap);
        container.addChild(loadingImg);

        // Bar background
        const barBg = new Sprite(barBgTex);
        barBg.anchor.set(0.5);
        barBg.scale.set(scale);
        barBg.position.set(vw / 2, vh / 2 + gap);
        container.addChild(barBg);

        // Bar fill
        const fillTex = sheet.textures['barFill.png'];
        this._barFill = new Sprite(fillTex);
        this._barFill.scale.set(scale);
        this._barFillFullW = fillTex.width * scale;

        const barTopY = vh / 2 + gap - (barBgTex.height * scale) / 2;
        const barLeftX = vw / 2 - (barBgTex.width * scale) / 2;
        const fillOffsetX = (barBgTex.width - fillTex.width) / 2 * scale;
        const fillOffsetY = (barBgTex.height - fillTex.height) / 2 * scale;
        this._barFill.position.set(barLeftX + fillOffsetX, barTopY + fillOffsetY);
        this._barFill.width = 0;
        container.addChild(this._barFill);

        this._progress = 0;
        this._targetProgress = 0.9;

        parent.addChild(container);
        Ticker.shared.add(this._tickLoading, this);
    }

    private _tickLoading(): void {
        if (!this._barFill) return;
        const dt = Ticker.shared.deltaMS;
        const diff = this._targetProgress - this._progress;
        this._progress += diff * PROGRESS_SPEED * dt;
        if (this._progress > this._targetProgress) this._progress = this._targetProgress;
        this._barFill.width = this._barFillFullW * this._progress;
    }

    private async _completeLoadingBar(): Promise<void> {
        if (!this._barFill) return;
        this._targetProgress = 1;

        await new Promise<void>((resolve) => {
            const fill = () => {
                this._progress += (1 - this._progress) * 0.08;
                if (this._progress >= 0.995) {
                    this._progress = 1;
                    if (this._barFill) this._barFill.width = this._barFillFullW;
                    Ticker.shared.remove(fill);
                    resolve();
                    return;
                }
                if (this._barFill) this._barFill.width = this._barFillFullW * this._progress;
            };
            Ticker.shared.add(fill);
        });
    }

    /** Stop ticker only — sprites are destroyed with holdLayer. */
    private _stopLoadingBar(): void {
        Ticker.shared.remove(this._tickLoading, this);
        this._barFill = null;
    }

    // -- HTML video overlay ----------------------------------------------------

    /**
     * Plays a video as an HTML element overlaid on top of the PixiJS canvas.
     * This avoids feeding the video into WebGL (which crashes iOS Safari).
     * The video covers the entire viewport — bats animate over a white/black bg.
     */
    private async _playHtmlVideoOverlay(
        video: HTMLVideoElement,
        speed: number,
    ): Promise<void> {
        // Style video to cover the entire viewport on top of the canvas
        Object.assign(video.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            objectFit: 'cover',
            zIndex: '9999',
            pointerEvents: 'none',
        });
        document.body.appendChild(video);

        video.playbackRate = speed;
        await new Promise<void>((resolve) => {
            let resolved = false;
            const done = () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(safetyTimer);
                resolve();
            };

            const duration = (video.duration || 3) * 1000;
            const safetyMs = duration / speed + VIDEO_ENDED_SAFETY_MARGIN_MS;
            const safetyTimer = setTimeout(() => {
                console.warn(`[TransitionMask] video ended safety timeout (${safetyMs}ms)`);
                done();
            }, safetyMs);

            video.addEventListener('ended', done, { once: true });

            video.play().catch((err) => {
                console.warn('[TransitionMask] video.play() REJECTED:', err);
                done();
            });
        });

        // Remove from DOM
        if (video.parentNode) {
            video.parentNode.removeChild(video);
        }
    }

    // -- internals ---------------------------------------------------------

    /** Waits for the video to be ready. Returns false if it fails or times out. */
    private _waitCanPlay(video: HTMLVideoElement): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
                resolve(true);
                return;
            }

            let settled = false;
            const settle = (ok: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(ok);
            };

            video.addEventListener('canplaythrough', () => settle(true), { once: true });
            video.addEventListener('error', () => {
                console.warn('[TransitionMask] video error:', video.error?.message);
                settle(false);
            }, { once: true });

            const timer = setTimeout(() => {
                console.warn('[TransitionMask] video canplay timeout');
                settle(false);
            }, VIDEO_CANPLAY_TIMEOUT_MS);
        });
    }

    /** Forces iOS Safari to release the hardware video decoder. */
    private _cleanupVideo(video: HTMLVideoElement): void {
        if (video.parentNode) {
            video.parentNode.removeChild(video);
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
    }

    private _delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private _createVideoElement(src: string): HTMLVideoElement {
        const video = document.createElement('video');
        video.src = src;
        video.crossOrigin = 'anonymous';
        video.playsInline = true;
        video.muted = true;
        video.preload = 'auto';
        return video;
    }

    destroy(): void {
        this._stopLoadingBar();
        super.destroy({ children: true });
    }
}
