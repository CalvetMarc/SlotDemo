import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import { VideoAlphaFilter } from '../Filters/video-alpha-filter';

const FADE_IN_PATH = 'assets/bonus/transiotionMask/fadeIn.mp4';
const FADE_OUT_PATH = 'assets/bonus/transiotionMask/fadeOut.mp4';

const FADE_IN_SPEED = 0.75;
const FADE_OUT_SPEED = 0.8;
const HOLD_DELAY_MS = 1000;

export type TransitionType = 'fadeIn' | 'fadeOut';

export class TransitionMask extends Container {
    private _sprite: Sprite | null = null;
    private _filter: VideoAlphaFilter;
    private _solidCover: Graphics;
    private _videoAspect = 16 / 9;

    constructor() {
        super();
        this._filter = new VideoAlphaFilter();

        this._solidCover = new Graphics();
        this._solidCover.rect(0, 0, 1, 1).fill(0x000000);
        this._solidCover.visible = false;
        this.addChild(this._solidCover);

        this.visible = false;
    }

    async playTransition(
        width: number,
        height: number,
        onCovered: () => Promise<void>,
    ): Promise<void> {
        this.visible = true;

        console.log('[TransitionMask] Loading both videos…');
        const fadeInVideo = this._createVideoElement(FADE_IN_PATH);
        const fadeOutVideo = this._createVideoElement(FADE_OUT_PATH);
        await Promise.all([
            this._waitCanPlay(fadeInVideo),
            this._waitCanPlay(fadeOutVideo),
        ]);
        console.log('[TransitionMask] Both videos ready');

        // Phase 1 – cover
        console.log('[TransitionMask] Phase 1 – fadeIn start');
        await this._showVideo(fadeInVideo, width, height, FADE_IN_SPEED);
        console.log('[TransitionMask] Phase 1 – fadeIn done');

        // Hold
        this._solidCover.scale.set(width, height);
        this._solidCover.visible = true;

        try {
            console.log('[TransitionMask] onCovered() start');
            await Promise.race([
                onCovered(),
                this._delay(8000).then(() =>
                    console.warn('[TransitionMask] onCovered() timed out after 8 s')),
            ]);
            console.log('[TransitionMask] onCovered() done');
        } catch (err) {
            console.error('[TransitionMask] onCovered() threw:', err);
        }

        console.log(`[TransitionMask] Waiting ${HOLD_DELAY_MS} ms…`);
        await this._delay(HOLD_DELAY_MS);
        console.log('[TransitionMask] Delay done');

        // Phase 2 – reveal
        console.log('[TransitionMask] Phase 2 – fadeOut start');
        this._solidCover.visible = false;
        await this._showVideo(fadeOutVideo, width, height, FADE_OUT_SPEED);
        console.log('[TransitionMask] Phase 2 – fadeOut done');

        this.visible = false;
    }

    async play(type: TransitionType, width: number, height: number): Promise<void> {
        this.visible = true;
        const video = this._createVideoElement(
            type === 'fadeIn' ? FADE_IN_PATH : FADE_OUT_PATH,
        );
        const speed = type === 'fadeIn' ? FADE_IN_SPEED : FADE_OUT_SPEED;
        await this._waitCanPlay(video);
        await this._showVideo(video, width, height, speed);
        this.visible = false;
    }

    resize(width: number, height: number): void {
        if (this._sprite) {
            this._applyCover(this._sprite, width, height);
        }
        if (this._solidCover.visible) {
            this._solidCover.scale.set(width, height);
        }
    }

    // -- internals ---------------------------------------------------------

    /** Scale sprite to cover the viewport while keeping the video aspect ratio. */
    private _applyCover(sprite: Sprite, vw: number, vh: number): void {
        const viewportAspect = vw / vh;
        let sw: number;
        let sh: number;

        if (viewportAspect > this._videoAspect) {
            // Viewport is wider than video — match width, crop top/bottom
            sw = vw;
            sh = vw / this._videoAspect;
        } else {
            // Viewport is taller than video — match height, crop left/right
            sh = vh;
            sw = vh * this._videoAspect;
        }

        sprite.width = sw;
        sprite.height = sh;
        sprite.x = (vw - sw) / 2;
        sprite.y = (vh - sh) / 2;
    }

    private async _showVideo(
        video: HTMLVideoElement,
        w: number,
        h: number,
        speed = 1,
    ): Promise<void> {
        console.log(
            `[TransitionMask] _showVideo src=${video.src.split('/').pop()}`
            + ` readyState=${video.readyState}`
            + ` videoW=${video.videoWidth} videoH=${video.videoHeight}`,
        );

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1;
        canvas.height = video.videoHeight || 1;
        const ctx = canvas.getContext('2d')!;

        this._videoAspect = canvas.width / canvas.height;

        // Draw first frame so it's not blank
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const texture = Texture.from(canvas, true);   // skipCache = true
        const source = texture.source;

        const sprite = new Sprite(texture);
        this._applyCover(sprite, w, h);
        sprite.filters = [this._filter];
        this._sprite = sprite;
        this.addChild(sprite);

        const drawFrame = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            source.update();
        };
        Ticker.shared.add(drawFrame);

        video.playbackRate = speed;
        console.log(`[TransitionMask] calling video.play() (speed=${speed})…`);
        await new Promise<void>((resolve) => {
            video.addEventListener('ended', () => {
                console.log('[TransitionMask] video ended');
                drawFrame();
                Ticker.shared.remove(drawFrame);
                resolve();
            }, { once: true });

            video.play().then(() => {
                console.log('[TransitionMask] video.play() resolved ok');
            }).catch((err) => {
                console.warn('[TransitionMask] video.play() REJECTED:', err);
                Ticker.shared.remove(drawFrame);
                resolve();
            });
        });

        this.removeChild(sprite);
        Ticker.shared.remove(drawFrame);
        sprite.destroy({ texture: true, textureSource: true });
        this._sprite = null;
    }

    private _waitCanPlay(video: HTMLVideoElement): Promise<void> {
        return new Promise<void>((resolve) => {
            if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
                resolve();
                return;
            }
            video.addEventListener('canplaythrough', () => resolve(), { once: true });
        });
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
        if (this._sprite) {
            this.removeChild(this._sprite);
            this._sprite.destroy({ texture: true, textureSource: true });
            this._sprite = null;
        }
        this._solidCover.destroy();
        this._filter.destroy();
        super.destroy({ children: true });
    }
}
