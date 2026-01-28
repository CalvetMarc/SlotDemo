export interface DesignCanvas {
  width: number;
  height: number;
  aspect: number;
}

export const CANVAS_16_9: DesignCanvas = {
  width: 1920,
  height: 1080,
  aspect: 16 / 9,
};

export const CANVAS_9_16: DesignCanvas = {
  width: 1080,
  height: 1920,
  aspect: 9 / 16,
};

export const CANVAS_4_3: DesignCanvas = {
  width: 1440,
  height: 1080,
  aspect: 4 / 3,
};
