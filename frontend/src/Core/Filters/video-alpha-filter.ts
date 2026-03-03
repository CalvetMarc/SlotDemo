import { Filter, GlProgram, defaultFilterVert } from 'pixi.js';

const FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uMaskMode;

void main(void)
{
    float a = 1.0 - texture(uTexture, vTextureCoord).r;

    // Overlay: black pixels with variable alpha (for rendering on screen)
    // Mask:    grayscale with full opacity   (PixiJS reads red channel)
    finalColor = mix(vec4(0.0, 0.0, 0.0, a), vec4(a, a, a, 1.0), uMaskMode);
}
`;

/**
 * Converts a grayscale video into either:
 *  - Overlay mode (default): black pixels with alpha from red channel
 *  - Mask mode: grayscale suitable for PixiJS sprite masking (r channel = visibility)
 */
export class VideoAlphaFilter extends Filter {
    constructor() {
        const glProgram = GlProgram.from({
            vertex: defaultFilterVert,
            fragment: FRAGMENT,
            name: 'video-alpha-filter',
        });

        super({
            glProgram,
            resources: {
                videoAlphaUniforms: {
                    uMaskMode: { value: 0, type: 'f32' },
                },
            },
        });
    }

    get maskMode(): boolean {
        return (this.resources.videoAlphaUniforms.uniforms as { uMaskMode: number }).uMaskMode === 1;
    }

    set maskMode(value: boolean) {
        (this.resources.videoAlphaUniforms.uniforms as { uMaskMode: number }).uMaskMode = value ? 1 : 0;
    }
}
