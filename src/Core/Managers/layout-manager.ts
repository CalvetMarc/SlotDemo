import { Container } from 'pixi.js';
import { DesignCanvas } from '../Layout/design-canvas';

export class LayoutManager {
  public readonly root = new Container();

  private _canvases: DesignCanvas[];
  private _activeCanvas!: DesignCanvas;

  public onCanvasChanged?: (canvas: DesignCanvas) => void;

  constructor(canvases: DesignCanvas[]) {
    this._canvases = canvases;
    this._activeCanvas = canvases[0]; 
  }

  resize(viewportW: number, viewportH: number) {
    const canvas = this.pickCanvas(viewportW, viewportH);

    if (canvas !== this._activeCanvas) {
      this._activeCanvas = canvas;
      this.onCanvasChanged?.(canvas);
    }

    // No scaling here - layers will handle their own scaling
    // This container just holds the canvas selection logic
  }

  private pickCanvas(viewportW: number, viewportH: number): DesignCanvas {
    const ratio = viewportW / viewportH;

    let best = this._canvases[0];
    let minDiff = Math.abs(ratio - best.aspect);

    for (const canvas of this._canvases) {
      const diff = Math.abs(ratio - canvas.aspect);
      if (diff < minDiff) {
        minDiff = diff;
        best = canvas;
      }
    }

    return best;
  }

  getCanvas(): DesignCanvas {
    return this._activeCanvas;
  }
}
