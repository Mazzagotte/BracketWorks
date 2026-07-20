import type { LucideIcon } from 'lucide-react';

type FeatureIconCardProps = {
  icon: LucideIcon;
  label: string;
  className?: string;
};

export default function FeatureIconCard({
  icon: Icon,
  label,
  className = '',
}: FeatureIconCardProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`group relative grid h-14 w-14 place-items-center rounded-xl border border-[#34343A] bg-[#17171B] text-[#FF7A00] shadow-[0_10px_18px_rgba(0,0,0,0.42),0_0_0_1px_rgba(255,255,255,0.02)_inset] transition-all duration-200 ease-out before:pointer-events-none before:absolute before:inset-[1px] before:rounded-[11px] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0)_38%)] before:content-[''] hover:-translate-y-0.5 hover:border-[#5A4130] ${className}`.trim()}
    >
      <Icon size={28} strokeWidth={2} aria-hidden="true" className="relative z-10" />
    </div>
  );
}
