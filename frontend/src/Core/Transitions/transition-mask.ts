import { Assets, Container, Graphics, Sprite, Spritesheet, Texture, Ticker } from 'pixi.js';
import { VideoAlphaFilter } from '../Filters/video-alpha-filter';
import { AudioManager } from '../Audio/audio-manager';
/** Stable mobile check using screen dimensions (immune to viewport meta). */
const isPhoneScreen = (): boolean =>
    navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) <= 500;

const COVER_PATH = 'assets/bonus/transiotionMask/fadeOut.mp4';
const REVEAL_PATH = 'assets/bonus/transiotionMask/fadeIn.mp4';
const COVER_SHEET_PATH = 'assets/bonus/transiotionMask/mobile/fadeoutBats.json';
const REVEAL_SHEET_PATH = 'assets/bonus/transiotionMask/mobile/fadeinBats.json';
const LOADING_BAR_PATH = 'assets/bonus/loadingBar/loadingBar.json';

const COVER_SPEED = 1;
const REVEAL_SPEED = 1.1;
const HOLD_DELAY_MS = 1000;
const VIDEO_CANPLAY_TIMEOUT_MS = 5000;
const VIDEO_ENDED_SAFETY_MARGIN_MS = 2000;

/** Original video FPS — used to compute sprite mask speed from playback rate. */
const SOURCE_FPS = 30;

/** How fast the fake progress creeps toward 90% while loading (fraction/ms). */
const PROGRESS_SPEED = 0.0004;

export class TransitionMask extends Container {
    private _filter: VideoAlphaFilter;
    private _videoAspect = 16 / 9;

    // Loading bar state
    private _barFill: Sprite | null = null;
    private _barFillFullW = 0;
    private _progress = 0;
    private _targetProgress = 0;

    // Cached spritesheet textures (mobile) — kept alive to prevent GC
    private _coverTextures: Texture[] | null = null;
    private _revealTextures: Texture[] | null = null;

    constructor() {
        super();
        this._filter = new VideoAlphaFilter();
        this.visible = false;
    }

    async playTransition(
        width: number,
        height: number,
        onCovered: () => Promise<void>,
    ): Promise<void> {
        this.visible = true;
        const mobile = isPhoneScreen();

        // On-screen debug overlay
        const debugEl = document.createElement('div');
        Object.assign(debugEl.style, {
            position: 'fixed', top: '10px', left: '10px', zIndex: '99999',
            background: 'rgba(0,0,0,0.85)', color: '#0f0', fontFamily: 'monospace',
            fontSize: '13px', padding: '8px 12px', borderRadius: '6px',
            pointerEvents: 'none', whiteSpace: 'pre-line', lineHeight: '1.5',
        });
        const debugLines: string[] = [
            `mobile: ${mobile} | touch: ${navigator.maxTouchPoints} | screen: ${screen.width}x${screen.height}`,
            `cachedSheets: cover=${!!this._coverTextures} reveal=${!!this._revealTextures}`,
        ];
        const updateDebug = () => { debugEl.textContent = debugLines.join('\n'); };
        updateDebug();
        document.body.appendChild(debugEl);

        // Pre-load loading bar sheet (tiny, loads fast)
        let sheet: Spritesheet | undefined = Assets.get('loadingBar');
        if (!sheet) {
            try { sheet = await Assets.load(LOADING_BAR_PATH) as Spritesheet; } catch { /* skip */ }
        }

        // On mobile, preload both spritesheets once and cache textures
        if (mobile && !this._coverTextures) {
            await this._preloadSheets();
        }

        // Hold layer: black bg + loading bar — masked by bats
        // Starts hidden to prevent a flash before the cover mask is applied
        const holdLayer = new Container();
        holdLayer.visible = false;
        const bg = new Graphics();
        bg.rect(0, 0, width, height);
        bg.fill(0x000000);
        holdLayer.addChild(bg);
        this._buildLoadingBar(holdLayer, width, height, sheet);
        this.addChild(holdLayer);

        // Phase 1 – cover
        // holdLayer stays hidden until the mask is applied inside the play methods
        if (this._coverTextures) {

            debugLines.push(`COVER: spritesheet (${this._coverTextures.length} frames, speed=${COVER_SPEED})`);
            updateDebug();
            setTimeout(() => AudioManager.playFadeOut('bats', 500), 200);
            await this._playSpriteMasked(this._coverTextures, width, height, COVER_SPEED, holdLayer);

        } else if (!mobile) {

            const coverVideo = this._createVideoElement(COVER_PATH);
            const coverReady = await this._waitCanPlay(coverVideo);
            if (coverReady) {
                debugLines.push(`COVER: video (dur=${coverVideo.duration.toFixed(2)}s, rate=${COVER_SPEED})`);
                updateDebug();
                setTimeout(() => AudioManager.playFadeOut('bats', 500), 200);
                await this._playMaskedVideo(coverVideo, width, height, COVER_SPEED, holdLayer);
            } else {
                debugLines.push('COVER: video FAILED — instant cut');
                updateDebug();
                holdLayer.visible = true;
            }
            this._cleanupVideo(coverVideo);
        } else {

            debugLines.push(`COVER: no assets — instant cut`);
            updateDebug();
            holdLayer.visible = true;
        }

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

        // Phase 2 – reveal
        if (this._revealTextures) {

            debugLines.push(`REVEAL: spritesheet (${this._revealTextures.length} frames, speed=${REVEAL_SPEED})`);
            updateDebug();
            setTimeout(() => AudioManager.playFadeOut('bats', 500), 200);
            await this._playSpriteMasked(this._revealTextures, width, height, REVEAL_SPEED, holdLayer, true);

        } else if (!mobile) {

            const revealVideo = this._createVideoElement(REVEAL_PATH);
            const revealReady = await this._waitCanPlay(revealVideo);
            if (revealReady) {
                debugLines.push(`REVEAL: video (dur=${revealVideo.duration.toFixed(2)}s, rate=${REVEAL_SPEED})`);
                updateDebug();
                setTimeout(() => AudioManager.playFadeOut('bats', 500), 200);
                await this._playMaskedVideo(revealVideo, width, height, REVEAL_SPEED, holdLayer, true);
            } else {
                debugLines.push('REVEAL: video FAILED — instant cut');
                updateDebug();
                holdLayer.visible = false;
            }
            this._cleanupVideo(revealVideo);
        } else {
            debugLines.push('REVEAL: no assets — instant cut');
            updateDebug();
            holdLayer.visible = false;
        }

        // Clean up
        this._stopLoadingBar();
        holdLayer.destroy({ children: true });
        this.visible = false;

        // Keep debug overlay visible for 4s then fade out
        setTimeout(() => {
            debugEl.style.transition = 'opacity 0.5s';
            debugEl.style.opacity = '0';
            setTimeout(() => debugEl.remove(), 500);
        }, 4000);
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

    // -- spritesheet mask (mobile) ---------------------------------------------

    /** Preloads both spritesheets and caches the texture arrays. */
    private async _preloadSheets(): Promise<void> {
        try {
            const [coverSheet, revealSheet] = await Promise.all([
                Assets.load(COVER_SHEET_PATH) as Promise<Spritesheet>,
                Assets.load(REVEAL_SHEET_PATH) as Promise<Spritesheet>,
            ]);
            this._coverTextures = this._extractTextures(coverSheet);
            this._revealTextures = this._extractTextures(revealSheet);
            // Pin atlas sources so PixiJS GC won't unload the CPU image data
            this._pinSources(this._coverTextures);
            this._pinSources(this._revealTextures);
        } catch (err) {
            console.warn('[TransitionMask] failed to preload sheets:', err);
        }
    }

    /** Prevents GC from unloading the atlas image data. */
    private _pinSources(textures: Texture[]): void {
        const seen = new Set<typeof textures[0]['source']>();
        for (const tex of textures) {
            if (tex.source && !seen.has(tex.source)) {
                seen.add(tex.source);
                tex.source.autoGarbageCollect = false;
            }
        }
    }

    /** Extracts sorted texture array from a spritesheet. */
    private _extractTextures(sheet: Spritesheet): Texture[] {
        const keys = Object.keys(sheet.textures).sort();
        if (keys.length > 0) {
            this._videoAspect = sheet.textures[keys[0]].width / sheet.textures[keys[0]].height;
        }
        return keys.map((k) => sheet.textures[k]);
    }

    /**
     * Plays spritesheet frames as a mask on `target` using an offscreen
     * canvas. Each tick draws the current frame from the atlas image and
     * re-uploads the small canvas to the GPU, avoiding atlas UV issues
     * with PixiJS sprite masks.
     */
    private async _playSpriteMasked(
        textures: Texture[],
        w: number,
        h: number,
        speed: number,
        target: Container,
        hideOnComplete = false,
    ): Promise<void> {
        if (textures.length === 0) return;

        const frameW = textures[0].frame.width;
        const frameH = textures[0].frame.height;
        this._videoAspect = frameW / frameH;

        const atlasImg = textures[0].source.resource as HTMLImageElement | ImageBitmap;

        const canvas = document.createElement('canvas');
        canvas.width = frameW;
        canvas.height = frameH;
        const ctx = canvas.getContext('2d')!;

        // Draw first frame with INVERTED alpha: opaque white everywhere
        // EXCEPT where the bats are (transparent). This way the mask hides
        // the holdLayer where bats are, letting the game show through.
        const f0 = textures[0].frame;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, frameW, frameH);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(atlasImg, f0.x, f0.y, f0.width, f0.height, 0, 0, frameW, frameH);
        ctx.globalCompositeOperation = 'source-over';

        const texture = Texture.from(canvas, true);
        const source = texture.source;

        const maskSprite = new Sprite(texture);
        this._applyCover(maskSprite, w, h);
        this.addChild(maskSprite);
        target.mask = maskSprite;
        target.visible = true;

        let frameIndex = 0;
        const framesPerTick = (SOURCE_FPS * speed) / 60;

        await new Promise<void>((resolve) => {
            const advance = () => {
                frameIndex += framesPerTick;
                const idx = Math.min(Math.floor(frameIndex), textures.length - 1);

                const frame = textures[idx].frame;
                ctx.globalCompositeOperation = 'source-over';
                ctx.clearRect(0, 0, frameW, frameH);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, frameW, frameH);
                ctx.globalCompositeOperation = 'destination-out';
                ctx.drawImage(atlasImg, frame.x, frame.y, frame.width, frame.height, 0, 0, frameW, frameH);
                source.update();

                if (idx >= textures.length - 1) {
                    Ticker.shared.remove(advance);
                    resolve();
                }
            };
            Ticker.shared.add(advance);
        });

        if (hideOnComplete) target.visible = false;
        target.mask = null;
        this.removeChild(maskSprite);
        maskSprite.destroy({ texture: true, textureSource: true });
        // Release canvas backing store
        canvas.width = 0;
        canvas.height = 0;
    }

    // -- video mask (desktop) --------------------------------------------------

    /**
     * Plays a video and uses it as a sprite mask on `target`.
     * The filter in mask mode outputs r = (1 - videoRed), so:
     *   Black pixels (bats) → r=1 → target visible
     *   White pixels         → r=0 → target hidden
     */
    private async _playMaskedVideo(
        video: HTMLVideoElement,
        w: number,
        h: number,
        speed: number,
        target: Container,
        hideOnComplete = false,
    ): Promise<void> {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1;
        canvas.height = video.videoHeight || 1;
        const ctx = canvas.getContext('2d')!;

        this._videoAspect = canvas.width / canvas.height;

        // Pre-fill white so the filter outputs 1-1=0 (target hidden) on the first frame,
        // preventing a flash before the video starts playing
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const texture = Texture.from(canvas, true);
        const source = texture.source;

        const maskSprite = new Sprite(texture);
        this._applyCover(maskSprite, w, h);
        this._filter.maskMode = true;
        maskSprite.filters = [this._filter];
        this.addChild(maskSprite);
        target.mask = maskSprite;

        // Show target only after mask is fully configured
        target.visible = true;

        const drawFrame = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            source.update();
        };
        Ticker.shared.add(drawFrame);

        video.playbackRate = speed;
        await new Promise<void>((resolve) => {
            let resolved = false;
            const done = () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(safetyTimer);
                drawFrame();
                Ticker.shared.remove(drawFrame);
                resolve();
            };

            // Safety timeout: video duration / speed + margin
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

        if (hideOnComplete) target.visible = false;
        target.mask = null;
        this.removeChild(maskSprite);
        Ticker.shared.remove(drawFrame);
        this._filter.maskMode = false;
        maskSprite.destroy({ texture: true, textureSource: true });
    }

    // -- internals ---------------------------------------------------------

    /** Scale sprite to cover the viewport while keeping the video aspect ratio. */
    private _applyCover(sprite: Sprite, vw: number, vh: number): void {
        const viewportAspect = vw / vh;
        let sw: number;
        let sh: number;

        if (viewportAspect > this._videoAspect) {
            sw = vw;
            sh = vw / this._videoAspect;
        } else {
            sh = vh;
            sw = vh * this._videoAspect;
        }

        sprite.width = sw;
        sprite.height = sh;
        sprite.x = (vw - sw) / 2;
        sprite.y = (vh - sh) / 2;
    }

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
        this._filter.destroy();
        if (this._coverTextures) this._unpinSources(this._coverTextures);
        if (this._revealTextures) this._unpinSources(this._revealTextures);
        this._coverTextures = null;
        this._revealTextures = null;
        super.destroy({ children: true });
    }

    private _unpinSources(textures: Texture[]): void {
        const seen = new Set<typeof textures[0]['source']>();
        for (const tex of textures) {
            if (tex.source && !seen.has(tex.source)) {
                seen.add(tex.source);
                tex.source.autoGarbageCollect = true;
            }
        }
    }
}
