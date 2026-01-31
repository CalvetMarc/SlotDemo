import { View, bundle } from "../../Abstractions/View";
import { Text, TextStyle, Container, Sprite, Assets, Graphics } from "pixi.js";

export class BetDisplayView extends View {
    private background!: Graphics;
    private labelText!: Text;
    private valueText!: Text;
    private upArrow!: Container;
    private downArrow!: Container;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Glassmorphism background
        this.background = new Graphics();
        this.background.roundRect(-50, -25, 140, 50, 12);
        this.background.fill({ color: 0x000000, alpha: 0.6 });
        this.addChild(this.background);

        // Label
        const labelStyle = new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 10,
            fill: 0x888888,
            fontWeight: '600',
            letterSpacing: 1
        });
        this.labelText = new Text({ text: 'BET', style: labelStyle });
        this.labelText.anchor.set(0, 0.5);
        this.labelText.position.set(-40, -10);
        this.addChild(this.labelText);

        // Value
        const valueStyle = new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 18,
            fill: 0xffffff,
            fontWeight: 'bold'
        });
        this.valueText = new Text({ text: '€1.80', style: valueStyle });
        this.valueText.anchor.set(0, 0.5);
        this.valueText.position.set(-40, 10);
        this.addChild(this.valueText);

        // Arrows from spritesheet
        const sheet = Assets.get('ui_icons');

        // Up arrow
        this.upArrow = new Container();
        const upSprite = new Sprite(sheet.textures['betUp.png']);
        upSprite.anchor.set(0.5);
        upSprite.tint = 0xffffff;
        upSprite.scale.set(0.12);
        this.upArrow.addChild(upSprite);
        this.upArrow.position.set(65, -8);
        this.upArrow.eventMode = 'static';
        this.upArrow.cursor = 'pointer';
        this.addChild(this.upArrow);

        // Down arrow
        this.downArrow = new Container();
        const downSprite = new Sprite(sheet.textures['betDown.png']);
        downSprite.anchor.set(0.5);
        downSprite.tint = 0xffffff;
        downSprite.scale.set(0.12);
        this.downArrow.addChild(downSprite);
        this.downArrow.position.set(65, 8);
        this.downArrow.eventMode = 'static';
        this.downArrow.cursor = 'pointer';
        this.addChild(this.downArrow);
    }

    public setValue(value: string): void {
        if (this.valueText) {
            this.valueText.text = value;
        }
    }
}
