export function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];
}

export function hexToRgbString(hex: string): string {
  return hexToRgb(hex).join(', ');
}

export interface RgbChannels {
  r: number;
  g: number;
  b: number;
}

export function hexToRgbChannels(hex: string): RgbChannels {
  const [r, g, b] = hexToRgb(hex);
  return { r, g, b };
}

export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Classify hue as warm, cool, or transition zone.
 *   warm:  0°–60° (red→yellow) + 300°–360° (magenta→red)
 *   cool:  120°–270° (green→violet)
 *   blend: 60°–120° (yellow→green) + 270°–300° (violet→magenta)
 *
 * Returns { saturation, hueShift } — cool tones get lower sat + a subtle hue shift toward blue.
 */
export function computeBackgroundTint(h: number): { sat: number; hueShift: number } {
  const WARM_SAT = 10;
  const COOL_SAT = 2;
  const COOL_SHIFT = -20;

  if (h >= 0 && h <= 60) return { sat: WARM_SAT, hueShift: 0 };
  if (h >= 300 && h <= 360) return { sat: WARM_SAT, hueShift: 0 };
  if (h >= 120 && h <= 270) return { sat: COOL_SAT, hueShift: COOL_SHIFT };

  // Transition: 60→120
  if (h > 60 && h < 120) {
    const t = (h - 60) / 60;
    return {
      sat: WARM_SAT + t * (COOL_SAT - WARM_SAT),
      hueShift: t * COOL_SHIFT,
    };
  }
  // Transition: 270→300
  if (h > 270 && h < 300) {
    const t = (h - 270) / 30;
    return {
      sat: COOL_SAT + t * (WARM_SAT - COOL_SAT),
      hueShift: (1 - t) * COOL_SHIFT,
    };
  }

  return { sat: WARM_SAT, hueShift: 0 };
}
