import { Cat } from 'lucide-react';

export function BrandMark({ light = false }: { light?: boolean }) {
  return <span className={`inline-flex items-center gap-2.5 ${light ? 'text-white' : 'text-[#142f39]'}`}>
    <span className="grid size-10 place-items-center rounded-2xl bg-[#ffbb55] text-[#142f39]"><Cat size={25} strokeWidth={2.2} aria-hidden="true" /></span>
    <span className="text-[29px] font-black leading-none tracking-[-1.8px]">CAT<span className="text-[#c26421]">ch.</span></span>
  </span>;
}
