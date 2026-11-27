import { Link } from 'react-router'
import BrandLogo from '@/components/Logo'
import { APP_NAME } from '@/config/brand'
import { PATHS } from '@/router/paths'

/**
 * Mise en page des écrans d'authentification (connexion, inscription) : fond lavande, accueil et atouts
 * à gauche, carte blanche du formulaire à droite. Sur mobile, seuls le logo et la carte sont affichés.
 *
 * <AuthLayout><AuthCard>contenu</AuthCard></AuthLayout>
 */
const FEATURES = [
  {
    title: 'Sécurité garantie',
    text: 'Vos données sont protégées',
    icon: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zM9 12l2 2 4-4',
  },
  {
    title: 'Accès rapide',
    text: 'Gérez vos demandes en un clic',
    icon: 'M13 2 4 14h7l-1 8 9-12h-7z',
  },
  {
    title: 'Développement commercial',
    text: 'Boostez votre visibilité',
    icon: 'M5 20V13M10 20V9M15 20v-5M20 20V5',
  },
]

/** Ordinateur portable ouvert sur une boutique en ligne, avec sac et pastilles flottantes. */
function Illustration() {
  return (
    <svg viewBox="0 0 320 260" className="h-auto w-full max-w-[320px]" aria-hidden="true">
      <defs>
        <linearGradient id="auth-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f2ff" />
          <stop offset="100%" stopColor="#e4dffd" />
        </linearGradient>
        <linearGradient id="auth-base" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c9c2fa" />
          <stop offset="100%" stopColor="#a99ef0" />
        </linearGradient>
      </defs>
      <ellipse cx="165" cy="236" rx="130" ry="14" fill="#dedbfa" />
      {/* Écran */}
      <g transform="rotate(-8 165 130)">
        <rect x="70" y="40" width="190" height="140" rx="12" fill="#4a3bc4" />
        <rect x="80" y="50" width="170" height="120" rx="6" fill="url(#auth-screen)" />
        {/* Store rayé */}
        <path d="M92 70h146l-6 22H98z" fill="#ffffff" />
        <path d="M107 70h16l-3 22h-16zM139 70h16l-1 22h-16zM171 70h16l1 22h-16zM203 70h16l3 22h-16z" fill="#6d5fe0" />
        <path d="M98 92c0 6 4 9 9 9s9-3 9-9M130 92c0 6 4 9 9 9s9-3 9-9M162 92c0 6 4 9 9 9s9-3 9-9M194 92c0 6 4 9 9 9s9-3 9-9M226 92c0 6 3 9 6 9" fill="#b9b2f4" />
        {/* Chariot */}
        <path d="M132 118h8l7 26h34l6-18h-43" fill="none" stroke="#5b4bdb" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="151" cy="154" r="4.5" fill="#5b4bdb" />
        <circle cx="176" cy="154" r="4.5" fill="#5b4bdb" />
      </g>
      {/* Clavier */}
      <path d="M48 196 L262 168 L290 196 L76 226 Z" fill="url(#auth-base)" />
      <path d="M76 226 L290 196 L290 202 L78 232 Z" fill="#8f82ea" />
      <path d="M150 204 l50 -7 6 6 -50 7z" fill="#ffffff" opacity=".5" />
      {/* Sac de courses */}
      <rect x="22" y="132" width="52" height="60" rx="8" fill="#7d6ff0" />
      <path d="M36 134v-8a12 12 0 0 1 24 0v8" fill="none" stroke="#4a3bc4" strokeWidth="4" strokeLinecap="round" />
      {/* Pastille graphique */}
      <g transform="translate(250 22)">
        <rect width="48" height="48" rx="12" fill="#ffffff" />
        <path d="M14 34v-6M22 34V22M30 34V18M38 34V14" stroke="#6d5fe0" strokeWidth="4" strokeLinecap="round" />
      </g>
      {/* Pastille profil */}
      <g transform="translate(268 108)">
        <rect width="44" height="44" rx="12" fill="#ffffff" />
        <circle cx="22" cy="22" r="13" fill="#ece9fe" />
        <circle cx="22" cy="18" r="5" fill="#6d5fe0" />
        <path d="M13 31a10 9 0 0 1 18 0" fill="#6d5fe0" />
      </g>
      {/* Traits d'animation */}
      <path d="M104 22l-6-10M118 16l-1-12M90 32l-10-6" stroke="#5b4bdb" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Welcome() {
  return (
    <aside className="relative hidden flex-col lg:flex lg:w-[46%] lg:max-w-[600px]">
      <div>
        <Link to={PATHS.home} className="inline-flex items-center" aria-label={`${APP_NAME} — accueil`}>
          <BrandLogo size={44} />
        </Link>

        <div className="mt-10 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-2">
          <div>
            <p className="text-[34px] leading-tight font-bold text-ink xl:text-[40px]">
              <span className="whitespace-nowrap">Bienvenue sur</span>
              <span className="relative mt-1 block w-fit text-brand-600">
                {APP_NAME}
                <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="absolute -bottom-3 left-0 h-3.5 w-full" aria-hidden="true">
                  <path d="M3 11C50 3 140 1 197 6" fill="none" stroke="#5b4bdb" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
            </p>
            <p className="mt-7 text-[15px] leading-relaxed text-muted">
              Connectez-vous pour accéder à votre espace fournisseur, gérer vos projets et développer votre activité.
            </p>
          </div>
          <Illustration />
        </div>

        <ul className="mt-10 space-y-5">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface text-brand-600 shadow-sm ring-1 ring-brand-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
                  <path d={feature.icon} />
                </svg>
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ink">{feature.title}</span>
                <span className="block text-sm text-muted">{feature.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

    </aside>
  )
}

/** Carte blanche qui contient le formulaire (largeur par défaut adaptée à la connexion). */
export function AuthCard({ children, className = 'max-w-md', ...props }) {
  return (
    <div {...props} className={`w-full rounded-3xl border border-white/80 bg-surface p-6 shadow-[0_20px_60px_-25px_rgba(91,75,219,0.45)] sm:p-9 ${className}`}>
      {children}
    </div>
  )
}

/** Lien « ← Accueil » en tête des cartes. */
export function BackHome() {
  return (
    <Link to={PATHS.home} className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
      Accueil
    </Link>
  )
}

export default function AuthLayout({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-[#f6f4ff] via-[#efecff] to-[#e7e2ff]">
      {/* Décor : halos, grille de points et vagues */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#d9d3fb]/70" />
      <div aria-hidden="true" className="pointer-events-none absolute top-40 left-[30%] h-72 w-72 rounded-full bg-white/50 blur-2xl" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-6 left-[38%] h-24 w-56 bg-[radial-gradient(rgba(91,75,219,0.25)_1.5px,transparent_1.5px)] bg-[length:22px_22px]"
      />
      <svg aria-hidden="true" viewBox="0 0 1440 220" preserveAspectRatio="none" className="pointer-events-none absolute bottom-0 left-0 h-40 w-full">
        <path d="M0 140C240 60 420 200 720 150S1200 40 1440 110V220H0z" fill="#ddd7fc" opacity=".7" />
        <path d="M0 180C300 120 520 220 820 180S1260 120 1440 160V220H0z" fill="#cfc7fa" opacity=".6" />
      </svg>

      <div className="relative mx-auto flex min-h-screen max-w-[1276px] flex-col gap-8 px-4 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:py-12">
        <Welcome />

        {/* Logo seul sur mobile et tablette */}
        <header className="lg:hidden">
          <Link to={PATHS.home} className="inline-flex items-center" aria-label={`${APP_NAME} — accueil`}>
            <BrandLogo size={36} />
          </Link>
        </header>

        <main className="flex flex-1 justify-center lg:justify-end">{children}</main>
      </div>
    </div>
  )
}
