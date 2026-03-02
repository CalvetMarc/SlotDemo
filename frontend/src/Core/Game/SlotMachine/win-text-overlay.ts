import { Container, Text, TextStyle } from 'pixi.js';
import { GRID_WIDTH, GRID_HEIGHT } from './slot-config';

const FONT_FAMILY = 'Forte, Arial, sans-serif';
const STROKE_WIDTH = 4;

const TOTAL_FONT_SIZE = 70;
const LINE_FONT_SIZE = 55;

export class WinTextOverlay extends Container {
    private _text: Text;

    constructor() {
        super();

        this._text = new Text({
            text: '',
            style: new TextStyle({
                fontFamily: FONT_FAMILY,
                fontSize: TOTAL_FONT_SIZE,
                fill: 0xffffff,
                fontWeight: 'bold',
                stroke: { color: 0x000000, width: STROKE_WIDTH },
            }),
        });
        this._text.anchor.set(0.5);
        this._text.position.set(GRID_WIDTH / 2, GRID_HEIGHT  * 0.66);
        this.addChild(this._text);

        this._text.alpha = 0;
    }

    showTotal(amount: number): void {
        this._text.style.fontSize = TOTAL_FONT_SIZE;
        this._text.text = `Total \u20AC${amount.toFixed(2)}`;
        this._text.alpha = 1;
    }

    showLine(lineIndex: number, amount: number): void {
        this._text.style.fontSize = LINE_FONT_SIZE;
        this._text.text = `Line ${lineIndex + 1}  \u20AC${amount.toFixed(2)}`;
        this._text.alpha = 1;
    }

    showWilds(amount: number): void {
        this._text.style.fontSize = LINE_FONT_SIZE;
        this._text.text = `Wilds  \u20AC${amount.toFixed(2)}`;
        this._text.alpha = 1;
    }

    showBonusEnter(amount: number): void {
        this._text.style.fontSize = TOTAL_FONT_SIZE;
        this._text.text = `Bonus Enter  \u20AC${amount.toFixed(2)}`;
        this._text.alpha = 1;
    }

    showBonusTotal(amount: number): void {
        this._text.style.fontSize = TOTAL_FONT_SIZE;
        this._text.text = `Bonus Total  \u20AC${amount.toFixed(2)}`;
        this._text.alpha = 1;
    }

    showMessage(message: string): void {
        this._text.style.fontSize = LINE_FONT_SIZE;
        this._text.text = message;
        this._text.alpha = 1;
    }

    hide(): void {
        this._text.alpha = 0;
    }
}
