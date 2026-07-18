import { ImageResponse } from 'next/og';

// Minimal حُلّة app icon: three concentric diamonds (gold → cream → maroon)
// on a deep maroon field — the game's lattice motif reduced to a single mark.
// No text, three shapes; reads clearly from 16px favicons to 1024px.

const CREAM = '#F3E9D2';
const MAROON = '#6B1F2A';
const MAROON_DK = '#4A141C';
const GOLD = '#C9A227';

type IconOptions = {
  size: number;
  maskable?: boolean;
  apple?: boolean;
};

export function createHillaIconResponse({ size, maskable = false }: IconOptions) {
  // Maskable icons keep the mark inside the ~80% safe zone; everything else
  // can breathe a little wider. (Note: rotated squares extend to side*√2/2
  // from center, so the effective diagonal footprint is mark*1.41.)
  const mark = Math.round(size * (maskable ? 0.5 : 0.58));
  // Only the outermost square carries the 45° rotation; nested children
  // inherit it visually, and Satori cannot parse `transform: none`.
  const diamond = (side: number, color: string, rotated: boolean, radiusScale = 0.12) => ({
    width: `${side}px`,
    height: `${side}px`,
    ...(rotated ? { transform: 'rotate(45deg)' } : {}),
    background: color,
    borderRadius: `${Math.max(2, Math.round(side * radiusScale))}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(180deg, ${MAROON} 0%, ${MAROON_DK} 100%)`,
        }}
      >
        <div style={diamond(mark, GOLD, true)}>
          <div style={diamond(Math.round(mark * 0.66), CREAM, false)}>
            <div style={diamond(Math.round(mark * 0.32), MAROON, false, 0.16)} />
          </div>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
