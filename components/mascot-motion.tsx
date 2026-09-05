'use client';

import Image from 'next/image';
import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function MascotMotion() {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const manuallyPaused = useRef(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !motion.matches && !connection?.saveData && !manuallyPaused.current) {
        setEnabled(true);
        video.current?.play().catch(() => setPlaying(false));
      }
      else { video.current?.pause(); setPlaying(false); }
    }, { threshold: 0.2 });
    if (root.current) observer.observe(root.current);
    const onMotion = () => { if (motion.matches) { video.current?.pause(); setPlaying(false); } };
    motion.addEventListener('change', onMotion);
    return () => { observer.disconnect(); motion.removeEventListener('change', onMotion); };
  }, []);

  async function toggle() {
    if (!enabled) { manuallyPaused.current = false; setEnabled(true); return; }
    if (!video.current) return;
    if (video.current.paused) { manuallyPaused.current = false; await video.current.play().catch(() => setPlaying(false)); }
    else { manuallyPaused.current = true; video.current.pause(); }
  }

  return <div ref={root} className="relative isolate aspect-[11/7] w-full overflow-hidden rounded-[28px] bg-[#c2dae0] sm:aspect-[16/10]">
    <Image src="/brand/catch-hero.webp" alt="CATch, nosso gato laranja, saltando para alcançar uma moeda dourada de desconto." fill priority sizes="(max-width: 767px) 100vw, 48vw" className="object-cover" />
    {enabled && <video ref={video} autoPlay muted loop playsInline preload="none" poster="/brand/catch-hero.webp" aria-hidden="true" onPlaying={() => { setPlaying(true); setReady(true); }} onPause={() => setPlaying(false)} onError={() => { setReady(false); setPlaying(false); }} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <source src="/brand/catch-hero.webm" type="video/webm" />
      <source src="/brand/catch-hero.mp4" type="video/mp4" />
    </video>}
    <span className="absolute bottom-3 left-4 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-medium text-[#36515a] backdrop-blur">Mascote ilustrativo · descontos variam por oferta</span>
    <button onClick={toggle} type="button" aria-label={playing ? 'Pausar animação do CATch' : 'Reproduzir animação do CATch'} className="absolute right-3 top-3 grid size-11 place-items-center rounded-full border border-white/80 bg-white/90 text-[#142f39] shadow-sm transition hover:bg-white">{playing ? <Pause size={16} /> : <Play size={16} />}</button>
  </div>;
}
