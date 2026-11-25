import { useId } from 'react'
import { APP_NAME } from '@/config/brand'

/**
 * Emblème TijaraLink : un « T » dont la barre relie deux points, le porteur de projet et le fournisseur.
 * variant « light » pour un fond foncé (pied de page, panneau d'authentification).
 */
export function LogoMark({ size = 36, className = '' }) {
  const gradient = useId()

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d5fe0" />
          <stop offset="1" stopColor="#4a3bc4" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradient})`} />
      <path d="M17 22h30" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <path d="M32 22v26" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <circle cx="17" cy="22" r="6.5" fill="#fff" />
      <circle cx="47" cy="22" r="6.5" fill="#f58a3d" />
      <circle cx="47" cy="22" r="2.6" fill="#fff" />
    </svg>
  )
}

export default function Logo({ size = 36, variant = 'default', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className={`text-[18px] font-bold tracking-tight ${variant === 'light' ? 'text-white' : 'text-ink'}`}>
        Tijara<span className={variant === 'light' ? 'text-accent-soft' : 'text-brand-600'}>Link</span>
        <span className="sr-only"> — {APP_NAME}</span>
      </span>
    </span>
  )
}
