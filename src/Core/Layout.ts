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

export const LayoutsSize = {
    desktop: {
        width: 1920,
        height: 1080
    },
    mobile: {
        width: 1080,
        height: 1920
    }
} as const

export const LayoutsCompositions: Record<LayoutType, LayoutComposition> = {
  desktop: {
    splash: {
      background: {x: 960, y: 540},
      logo: { x: 960, y: 420 },
      loading: { x: 960, y: 950 },
      fog: {x: 960, y: 540}
    }
  },
  mobile: {
    splash: {
      background: {x: 540, y: 960},
      logo: { x: 540, y: 720 },
      loading: { x: 540, y: 1300 },
      fog: {x: 540, y: 960}
    }
  }
};
