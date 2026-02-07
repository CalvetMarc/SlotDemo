import { ButtonView } from "../../Abstractions/ButtonView";
import { bundle } from "../../Abstractions/View";
import { Text, TextStyle, Graphics } from "pixi.js";

export class InfoButtonView extends ButtonView {
    private background!: Graphics;
    private iconText!: Text;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Dark magical background with subtle transparency
        this.background = new Graphics();
        this.background.roundRect(-22, -22, 44, 44, 10);
        this.background.fill({ color: 0x141824, alpha: 0.85 });  // Deep dark blue
        this.addChild(this.background);

        const style = new TextStyle({
            fontFamily: 'Georgia, Times, serif',
            fontSize: 26,
            fill: 0xc8cdd8,  // Soft off-white
            fontWeight: 'normal',
            fontStyle: 'italic'
        });
        this.iconText = new Text({ text: 'i', style });
        this.iconText.anchor.set(0.5, 0.5);
        this.addChild(this.iconText);

        this.setupInteractivity();
    }

    onMouseClick(): void {
        // TODO: Open info panel
    }
}
