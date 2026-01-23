import { Container } from "pixi.js";
import { Layer } from "./Layer";
import { BackgroundLayer } from "../Game/Layers/BackgroundLayer";
import { UiLayer } from "../Game/Layers/UiLayer";
import { GameLayer } from "../Game/Layers/GameLayer";

export interface IGameScreen {
    onEnter(): Promise<void>;
    onUpdate(deltaMS: number): void;
    onExit(): Promise<void>;
}

export abstract class GameScreen extends Container implements IGameScreen {
    protected backgroundLayer!: Container;
    protected uiLayer!: Container;
    protected gameLayer!: Container;

    abstract onEnter(): Promise<void>;
    abstract onUpdate(deltaMS: number): void;
    abstract onExit(): Promise<void>;

    constructor(backgroundLayer?: Layer, uiLayer?: Layer, gameLayer?: Layer){
        super();

        this.backgroundLayer = backgroundLayer ?? new BackgroundLayer();
        this.uiLayer = uiLayer ?? new UiLayer();
        this.gameLayer = gameLayer ?? new GameLayer();
    }
}