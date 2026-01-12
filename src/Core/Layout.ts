import { Size } from "pixi.js";

export type LayoutType = 'desktop' | 'mobile';

type Point = { x: number; y: number };

type SplashLayout = {
  background: Point;
  logo: Point;
  loading: Point;
  fog: Point
};

export type LayoutComposition = {
  splash: SplashLayout;
};

export const LayoutsSize: Size = {
    width: 2500,
    height: 1583
} as const

export const LayoutsCompositions: Record<LayoutType, LayoutComposition> = {
  desktop: {
    splash: {
      background: {x: 1250, y: 791.5},
      logo: { x: 1250, y: 615 },
      loading: { x: 1250, y: 1292 },
      fog: {x: 1250, y: 791.5}
    }
  },
  mobile: {
    splash: {
      background: {x: 1250, y: 791.5},
      logo: { x: 1250, y: 615 },
      loading: { x: 1250, y: 1292 },
      fog: {x: 1250, y: 791.5}
    }
  }
};
