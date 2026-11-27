/**
 * Illustrations de la page d'accueil (maquette « landing ») : dessinées en SVG, sans image externe.
 */

/** Cubes en 3D, fiche de contrôle et petit graphique (hero). */
export function HeroIllustration() {
  return (
    <svg viewBox="0 0 420 340" className="h-auto w-full max-w-[440px]" aria-hidden="true">
      <defs>
        <linearGradient id="hero-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ece9fe" />
          <stop offset="100%" stopColor="#f6f0ff" />
        </linearGradient>
        <linearGradient id="hero-orange-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffc38f" />
          <stop offset="100%" stopColor="#ff9f5a" />
        </linearGradient>
      </defs>
      <circle cx="215" cy="170" r="150" fill="url(#hero-glow)" />
      <circle cx="215" cy="170" r="104" fill="#ffffff" opacity=".5" />
      <circle cx="62" cy="92" r="9" fill="#6d5fe0" />
      <circle cx="372" cy="58" r="6" fill="#b9b2f4" />
      <circle cx="110" cy="300" r="5" fill="#f58a3d" opacity=".7" />

      {/* Socle */}
      <ellipse cx="200" cy="292" rx="150" ry="20" fill="#dedbfa" opacity=".7" />

      {/* Grand cube violet (centre) */}
      <polygon points="200,128 270,163 200,198 130,163" fill="#9d92f2" />
      <polygon points="130,163 200,198 200,282 130,247" fill="#6d5fe0" />
      <polygon points="270,163 200,198 200,282 270,247" fill="#5b4bdb" />

      {/* Cube orange (au-dessus) */}
      <polygon points="200,46 250,71 200,96 150,71" fill="url(#hero-orange-top)" />
      <polygon points="150,71 200,96 200,150 150,125" fill="#f58a3d" />
      <polygon points="250,71 200,96 200,150 250,125" fill="#e0742a" />

      {/* Cube lavande (gauche) */}
      <polygon points="88,190 128,210 88,230 48,210" fill="#ddd8fc" />
      <polygon points="48,210 88,230 88,282 48,262" fill="#b9b2f4" />
      <polygon points="128,210 88,230 88,282 128,262" fill="#a299f0" />

      {/* Fiche de contrôle */}
      <g transform="translate(286 96) rotate(6)">
        <rect width="104" height="126" rx="12" fill="#ffffff" stroke="#e3e3ee" />
        {[24, 52, 80].map((y) => (
          <g key={y}>
            <circle cx="22" cy={y} r="9" fill="#5b4bdb" />
            <path d={`M18 ${y}l3 3 5-6`} fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="38" y={y - 4} width="50" height="7" rx="3.5" fill="#dedbfa" />
          </g>
        ))}
        <circle cx="22" cy="106" r="9" fill="#ece9fe" />
        <rect x="38" y="102" width="38" height="7" rx="3.5" fill="#ece9fe" />
      </g>

      {/* Carte graphique */}
      <g transform="translate(262 236)">
        <rect width="136" height="72" rx="12" fill="#ffffff" stroke="#e3e3ee" />
        <rect x="16" y="44" width="11" height="14" rx="2.5" fill="#b9b2f4" />
        <rect x="32" y="34" width="11" height="24" rx="2.5" fill="#f58a3d" />
        <rect x="48" y="26" width="11" height="32" rx="2.5" fill="#6d5fe0" />
        <rect x="64" y="18" width="11" height="40" rx="2.5" fill="#5b4bdb" />
        <path d="M86 46l14-12 10 7 16-20" fill="none" stroke="#5b4bdb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M118 20h9v9" fill="none" stroke="#5b4bdb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

/** Boutique avec store rayé et sac de courses (bandeau fournisseurs). */
export function ShopIllustration() {
  return (
    <svg viewBox="0 0 150 120" className="h-28 w-auto" aria-hidden="true">
      <ellipse cx="78" cy="112" rx="66" ry="6" fill="#000000" opacity=".18" />
      <rect x="24" y="44" width="104" height="64" rx="6" fill="#ffffff" />
      <rect x="38" y="60" width="40" height="28" rx="3" fill="#ece9fe" />
      <rect x="88" y="60" width="26" height="48" rx="3" fill="#ece9fe" />
      <circle cx="108" cy="86" r="2" fill="#5b4bdb" />
      <path d="M16 26h120l-6 22H22z" fill="#ffffff" />
      <path d="M31 26h15l-3 22H26zM61 26h15l-1 22H60zM91 26h15l2 22H92zM121 26h15l-6 22h-6z" fill="#7d6ff0" />
      <path d="M22 48c0 5 3.5 8 8 8s8-3 8-8M52 48c0 5 3.5 8 8 8s8-3 8-8M82 48c0 5 3.5 8 8 8s8-3 8-8M112 48c0 5 3.5 8 8 8s8-3 8-8" fill="#b9b2f4" />
      <rect x="18" y="16" width="116" height="11" rx="4" fill="#c9c2fa" />
      <path d="M2 74h26l4 38H-2z" fill="#f58a3d" transform="translate(4 0)" />
      <path d="M12 74v-5a7 7 0 0 1 14 0v5" fill="none" stroke="#c8641c" strokeWidth="2.5" strokeLinecap="round" transform="translate(4 0)" />
    </svg>
  )
}

/** Petites icônes au trait (atouts, étapes, catégories). */
const PATHS = {
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  shield: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zM9 12l2 2 4-4',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  handshake: 'M3 12l4-4 4 2 3-2 3 1 4 3M7 8v6l4 4 2-1 2 1 3-3M11 18l-2-2M14 17l-2-2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  edit: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 17l1-3 5-5 2 2-5 5z',
  scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM12 3l-1 2h2z',
  truck: 'M2 6h11v10H2zM13 9h4l3 3v4h-7M6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  box: 'M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10',
  wheat: 'M12 21V9M12 9c-3 0-4-2-4-5 3 0 4 2 4 5zM12 9c3 0 4-2 4-5-3 0-4 2-4 5zM12 14c-3 0-4-2-4-5 3 0 4 2 4 5zM12 14c3 0 4-2 4-5-3 0-4 2-4 5z',
  laptop: 'M5 5h14v10H5zM3 19h18',
  service: 'M4 18h16M6 18a6 6 0 0 1 12 0M12 8V6M10 6h4',
  brick: 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1',
  clip: 'M8 12l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l7-7',
  tag: 'M3 12V4h8l9 9-8 8zM7.5 8.5h.01',
}

export function LineIcon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.tag} />
    </svg>
  )
}

/** Icône d'une catégorie d'après son nom. */
export function categoryIcon(name = '') {
  const value = name.toLowerCase()
  if (value.includes('emballage')) return 'box'
  if (value.includes('logistique') || value.includes('transport')) return 'truck'
  if (value.includes('agro') || value.includes('aliment')) return 'wheat'
  if (value.includes('informatique')) return 'laptop'
  if (value.includes('btp') || value.includes('matériau')) return 'brick'
  if (value.includes('équipement') || value.includes('industri')) return 'gear'
  if (value.includes('bureau')) return 'clip'
  if (value.includes('service')) return 'service'
  return 'tag'
}
