// Small original illustration used to stand in for a product photo on each
// option card. It's SVG (not a fetched image), so it renders instantly,
// costs no network request, and carries no licensing risk — and it still
// gives every card a distinct "product shot" instead of a bare spec list.

export type DeviceTier = 'value' | 'balanced' | 'premium'

const TIER_COLOR: Record<DeviceTier, string> = {
  value: '#6B6355',
  balanced: '#2B6459',
  premium: '#A5672C',
}

export function tierForRank(rank: number, total: number): DeviceTier {
  if (total <= 1) return 'balanced'
  const pct = rank / (total - 1)
  if (pct < 0.34) return 'value'
  if (pct < 0.7) return 'balanced'
  return 'premium'
}

export default function DeviceArt({ tier, className }: { tier: DeviceTier; className?: string }) {
  const accent = TIER_COLOR[tier]
  return (
    <svg
      viewBox="0 0 120 84"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${tier} laptop illustration`}
    >
      {/* screen */}
      <rect x="18" y="6" width="84" height="52" rx="4" fill="#221F1A" />
      <rect x="22" y="10" width="76" height="44" rx="1.5" fill="#F4EFE2" />
      <rect x="22" y="10" width="76" height="44" rx="1.5" fill={accent} opacity="0.12" />
      {/* screen content lines, hinting at a UI without depicting a real product */}
      <rect x="28" y="16" width="30" height="4" rx="2" fill={accent} opacity="0.65" />
      <rect x="28" y="24" width="46" height="3" rx="1.5" fill="#221F1A" opacity="0.18" />
      <rect x="28" y="30" width="38" height="3" rx="1.5" fill="#221F1A" opacity="0.18" />
      <rect x="28" y="38" width="20" height="12" rx="2" fill={accent} opacity="0.35" />
      <rect x="52" y="38" width="20" height="12" rx="2" fill="#221F1A" opacity="0.10" />
      {/* base */}
      <path d="M10 60 L110 60 L102 70 Q101 72 98 72 L22 72 Q19 72 18 70 Z" fill="#221F1A" />
      <rect x="52" y="64" width="16" height="2.4" rx="1.2" fill={accent} opacity="0.7" />
    </svg>
  )
}
