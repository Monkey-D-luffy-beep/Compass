import { ImageResponse } from 'next/og';

export const contentType = 'image/png';
export const size = { width: 512, height: 512 };
export default function Icon() {
  const s = 512;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0b0e' }}>
        <div style={{ width: s * 0.66, height: s * 0.66, borderRadius: s * 0.2, background: '#6ea8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={s * 0.4} height={s * 0.4} viewBox="0 0 24 24" fill="none" stroke="#0a0b0e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
