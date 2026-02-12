import { Filter, GlProgram, defaultFilterVert } from 'pixi.js';

const FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;

void main(void)
{
    float a = 1.0 - texture(uTexture, vTextureCoord).r;
    finalColor = vec4(0.0, 0.0, 0.0, a);
}
`;

/**
 * Converts a grayscale video (where RGB encodes opacity) into black pixels
 * with alpha derived from the red channel.
 *
 * Black (0.0) -> fully visible black
 * White (1.0) -> fully transparent
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
            resources: {},
        });
    }
}
