import { Link } from 'react-router'
import { PATHS } from '@/router/paths'

/**
 * Mise en page des écrans d'authentification (maquette Figma A5) : panneau violet à gauche
 * (logo, accroche, arguments, illustration) et contenu centré sur fond clair à droite.
 * Prévue pour être partagée avec la connexion et l'inscription (F01, F02).
 *
 * Mobile : le panneau devient un bandeau avec le logo, le contenu occupe toute la largeur.
 *
 * <AuthLayout><div className="…">contenu</div></AuthLayout>
 */
const ARGUMENTS = [
  'Fournisseurs validés par notre équipe',
  'Devis comparables en un clic',
  'Paiement sécurisé et suivi de commande',
]

function Logo() {
  return (
    <Link to={PATHS.home} className="inline-flex items-center gap-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-base font-bold text-brand-600">M</span>
      <span className="text-[17px] font-semibold text-white">Marketplace B2B</span>
    </Link>
  )
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Cube isométrique décoratif. */
function Cube({ x, y, size, top, left, right }) {
  const h = size / 2
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 ${h / 2} L${h} 0 L${size} ${h / 2} L${h} ${h} Z`} fill={top} />
      <path d={`M0 ${h / 2} L${h} ${h} L${h} ${h + size * 0.6} L0 ${h / 2 + size * 0.6} Z`} fill={left} />
      <path d={`M${size} ${h / 2} L${h} ${h} L${h} ${h + size * 0.6} L${size} ${h / 2 + size * 0.6} Z`} fill={right} />
    </g>
  )
}

function Illustration() {
  return (
    <svg viewBox="0 0 360 230" className="h-auto w-full max-w-[360px]" aria-hidden="true">
      <Cube x={20} y={90} size={110} top="#efeefe" left="#d9d6fb" right="#bdb7f5" />
      <Cube x={120} y={20} size={110} top="#ffd9bf" left="#f58a3d" right="#e57328" />
      <Cube x={230} y={95} size={110} top="#c9c3f8" left="#9d93ef" right="#8478e8" />
    </svg>
  )
}

function Panel() {
  return (
    <aside className="relative hidden w-[39%] max-w-[560px] shrink-0 flex-col overflow-hidden bg-[linear-gradient(160deg,#1c1850_0%,#3a2fb0_45%,#5b4bdb_100%)] p-14 text-white lg:flex">
      {/* Halo lumineux et grille de points (décor) */}
      <div className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />
      <div
        className="pointer-events-none absolute top-36 right-6 h-36 w-60 bg-[radial-gradient(rgba(255,255,255,0.35)_1.5px,transparent_1.5px)] bg-[length:25px_25px]"
        aria-hidden="true"
      />

      <div className="relative">
        <Logo />
      </div>

      {/* L'illustration a sa propre zone : elle ne passe jamais sous le titre. */}
      <div className="relative flex flex-1 items-center justify-center py-10">
        <Illustration />
      </div>

      <div className="relative">
        <p className="text-[32px] leading-tight font-bold xl:text-[34px]">
          La marketplace B2B des fournisseurs et porteurs de projet tunisiens
        </p>
        <ul className="mt-6 space-y-3 text-[15px] text-white/85">
          {ARGUMENTS.map((argument) => (
            <li key={argument} className="flex items-center gap-2.5">
              <Check />
              {argument}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-page lg:flex-row">
      <Panel />

      {/* Bandeau mobile / tablette */}
      <header className="bg-[linear-gradient(120deg,#1c1850,#5b4bdb)] px-4 py-4 lg:hidden">
        <Logo />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-6 sm:items-center sm:px-8 sm:py-12">
        {children}
      </main>
    </div>
  )
}
