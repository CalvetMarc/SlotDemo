import { AnimatedSprite, Assets, Container, Graphics, Sprite, Spritesheet, Texture, Ticker } from 'pixi.js';
import { VideoAlphaFilter } from '../Filters/video-alpha-filter';
import { AudioManager } from '../Audio/audio-manager';
import { isMobileDevice } from '../Utils/device';

const COVER_PATH = 'assets/bonus/transiotionMask/fadeOut.mp4';
const REVEAL_PATH = 'assets/bonus/transiotionMask/fadeIn.mp4';
const COVER_SHEET_PATH = 'assets/bonus/transiotionMask/mobile/fadeoutBats.json';
const REVEAL_SHEET_PATH = 'assets/bonus/transiotionMask/mobile/fadeinBats.json';
const LOADING_BAR_PATH = 'assets/bonus/loadingBar/loadingBar.json';

const COVER_SPEED = 0.8;
const REVEAL_SPEED = 0.75;
const HOLD_DELAY_MS = 1000;
const VIDEO_CANPLAY_TIMEOUT_MS = 5000;
const VIDEO_ENDED_SAFETY_MARGIN_MS = 2000;

/** Original video FPS — used to compute AnimatedSprite speed from playback rate. */
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
        const mobile = isMobileDevice();

        // Pre-load loading bar sheet (tiny, loads fast)
        let sheet: Spritesheet | undefined = Assets.get('loadingBar');
        if (!sheet) {
            try { sheet = await Assets.load(LOADING_BAR_PATH) as Spritesheet; } catch { /* skip */ }
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
        if (mobile) {
            const coverSheet = await this._loadSheet(COVER_SHEET_PATH);
            if (coverSheet) {
                setTimeout(() => AudioManager.playFadeOut('bats', 500), 200);
                await this._playSpriteAnimation(coverSheet, width, height, COVER_SPEED, holdLayer);
            } else {
                holdLayer.visible = true;
            }
        } else {
            const coverVideo = this._createVideoElement(COVER_PATH);
            const coverReady = await this._waitCanPlay(coverVideo);
            if (coverReady) {
                setTimeout(() => AudioManager.playFadeOut('bats', 500), 200);
                await this._playMaskedVideo(coverVideo, width, height, COVER_SPEED, holdLayer);
            } else {
                holdLayer.visible = true;
            }
            this._cleanupVideo(coverVideo);
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
        if (mobile) {
            const revealSheet = await this._loadSheet(REVEAL_SHEET_PATH);
            if (revealSheet) {
                setTimeout(() => AudioManager.playFadeOut('bats', 500), 200);
                await this._playSpriteAnimation(revealSheet, width, height, REVEAL_SPEED, holdLayer, true);
            } else {
                holdLayer.visible = false;
            }
        } else {
            const revealVideo = this._createVideoElement(REVEAL_PATH);
            const revealReady = await this._waitCanPlay(revealVideo);
            if (revealReady) {
                setTimeout(() => AudioManager.playFadeOut('bats', 500), 200);
                await this._playMaskedVideo(revealVideo, width, height, REVEAL_SPEED, holdLayer, true);
            } else {
                holdLayer.visible = false;
            }
            this._cleanupVideo(revealVideo);
        }

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

    // -- spritesheet animation (mobile) ----------------------------------------

    /** Loads a spritesheet, returns undefined on failure. */
    private async _loadSheet(path: string): Promise<Spritesheet | undefined> {
        try {
            let s: Spritesheet | undefined = Assets.get(path);
            if (!s) s = await Assets.load(path) as Spritesheet;
            return s;
        } catch {
            console.warn('[TransitionMask] failed to load sheet:', path);
            return undefined;
        }
    }

    /**
     * Plays a spritesheet animation as a mask on `target`.
     * The spritesheet frames have real alpha (bats opaque, bg transparent),
     * so PixiJS native masking works directly — no shader needed.
     */
    private async _playSpriteAnimation(
        sheet: Spritesheet,
        w: number,
        h: number,
        speed: number,
        target: Container,
        hideOnComplete = false,
    ): Promise<void> {
        const frameKeys = Object.keys(sheet.textures).sort();
        const textures = frameKeys.map((k) => sheet.textures[k]);
        if (textures.length === 0) return;

        this._videoAspect = textures[0].width / textures[0].height;

        const anim = new AnimatedSprite(textures);
        anim.animationSpeed = (SOURCE_FPS * speed) / 60;
        anim.loop = false;
        this._applyCover(anim, w, h);
        this.addChild(anim);
        target.mask = anim;
        target.visible = true;

        await new Promise<void>((resolve) => {
            anim.onComplete = () => resolve();
            anim.play();
        });

        if (hideOnComplete) target.visible = false;
        target.mask = null;
        this.removeChild(anim);
        anim.destroy();
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
    private _applyCover(sprite: Sprite | AnimatedSprite, vw: number, vh: number): void {
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
        super.destroy({ children: true });
    }
}
