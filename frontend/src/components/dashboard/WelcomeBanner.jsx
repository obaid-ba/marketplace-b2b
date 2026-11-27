/** Illustration de la bannière : une boutique, un chariot et une coche de validation. */
function ShopIllustration() {
  return (
    <svg viewBox="0 0 220 120" className="h-28 w-auto" aria-hidden="true">
      <ellipse cx="120" cy="112" rx="92" ry="6" fill="#dedbfa" />
      <rect x="70" y="40" width="110" height="68" rx="6" fill="#ffffff" />
      <rect x="84" y="56" width="46" height="30" rx="3" fill="#eeedfd" />
      <path d="M90 64h34M90 72h26M90 80h30" stroke="#b9b2f4" strokeWidth="3" strokeLinecap="round" />
      <rect x="140" y="56" width="26" height="52" rx="3" fill="#eeedfd" />
      <circle cx="160" cy="84" r="2" fill="#6d5fe0" />
      <path d="M62 26h126l-6 20H68z" fill="#5b4bdb" />
      <path d="M77 26h16l-3 20H73zM109 26h16l-1 20h-16zM141 26h16l2 20h-16zM173 26h15l-6 20h-13z" fill="#ffffff" opacity=".9" />
      <path d="M68 46c0 5 3.5 8 8 8s8-3 8-8M100 46c0 5 3.5 8 8 8s8-3 8-8M132 46c0 5 3.5 8 8 8s8-3 8-8M164 46c0 5 3.5 8 8 8s8-3 8-8" fill="#6d5fe0" />
      <rect x="66" y="18" width="118" height="9" rx="3" fill="#4a3bc4" />
      <path d="M14 66h8l7 28h30l6-20H26" fill="none" stroke="#4a3bc4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="30" y="64" width="9" height="12" rx="2" fill="#f58a3d" />
      <rect x="41" y="60" width="10" height="16" rx="2" fill="#6d5fe0" />
      <circle cx="34" cy="102" r="4.5" fill="#4a3bc4" />
      <circle cx="54" cy="102" r="4.5" fill="#4a3bc4" />
      <circle cx="186" cy="92" r="16" fill="#12a06b" />
      <path d="M178 92l6 6 10-11" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="200" cy="30" r="10" fill="#ffffff" />
      <path d="M195 31l3-6 3 4 2-2 2 4z" fill="#6d5fe0" />
    </svg>
  )
}

/**
 * Bannière d'accueil des tableaux de bord : salutation (« Bonjour {name} 👋 » ou `title`), sous-titre,
 * boutons facultatifs (`actions`) et illustration (cachée sur mobile).
 */
export default function WelcomeBanner({ name, subtitle, title, actions }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-linear-to-r from-[#f1efff] via-[#ece9fe] to-[#ddd8fc] px-6 py-6 sm:px-8">
      <div aria-hidden="true" className="absolute -top-10 right-40 h-32 w-32 rounded-full bg-white/40" />
      <div className="relative flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            {title ?? `Bonjour ${name ?? ''}`.trim()}
            {!title && (
              <>
                {' '}
                <span aria-hidden="true">👋</span>
              </>
            )}
          </h1>
          <p className="mt-2 text-sm text-muted sm:text-[15px]">{subtitle}</p>
          <span aria-hidden="true" className="mt-4 block h-1 w-12 rounded-full bg-brand-600" />
          {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
        </div>
        <div className="hidden shrink-0 md:block">
          <ShopIllustration />
        </div>
      </div>
    </section>
  )
}
