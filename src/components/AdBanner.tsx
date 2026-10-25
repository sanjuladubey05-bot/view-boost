import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  style?: React.CSSProperties;
}

export const AdBanner: React.FC<AdBannerProps> = ({ slot, format = 'auto', style }) => {
  const adRef = useRef<HTMLModElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let rafId: number | null = null;

    const observer = new ResizeObserver((entries) => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          if (width > 0 && !initialized.current && adRef.current) {
            try {
              if (!adRef.current.getAttribute('data-adsbygoogle-status')) {
                initialized.current = true;
                observer.disconnect();
                // @ts-ignore
                (window.adsbygoogle = window.adsbygoogle || []).push({});
              }
            } catch (e) {
              console.error('AdSense error:', e);
            }
          }
        }
      });
    });

    observer.observe(containerRef.current);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
    };
  }, [slot]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden my-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-6 min-h-[100px] text-center">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Advertisement Hub</div>
      <ins 
        ref={adRef}
        className="adsbygoogle"
        style={style || { display: 'block', minWidth: '250px', minHeight: '100px' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXX"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
      <div className="text-[8px] font-medium text-slate-300 mt-2">
        Real Ads require an approved AdSense Publisher ID. 
        <br/>Replace "ca-pub-XXXXXXXXXXXXX" in index.html and AdBanner.tsx
      </div>
    </div>
  );
};
