/**
 * Icônes pleines et colorées des cartes d'indicateurs (maquette du tableau de bord porteur de projet).
 * tone : couleur du rond et de l'icône (voir TONES) ; name : clé de ICONS.
 */
export const TONES = {
  violet: { circle: 'bg-[#ece9fe]', icon: 'text-[#5b4bdb]', line: '#6d5fe0', text: 'text-[#5b4bdb]' },
  green: { circle: 'bg-[#dcf5ea]', icon: 'text-[#12a06b]', line: '#12a06b', text: 'text-[#12a06b]' },
  orange: { circle: 'bg-[#ffeedd]', icon: 'text-[#f58a3d]', line: '#f58a3d', text: 'text-[#c8641c]' },
  blue: { circle: 'bg-[#e2efff]', icon: 'text-[#2f6fe4]', line: '#2f6fe4', text: 'text-[#2f6fe4]' },
  pink: { circle: 'bg-[#fde4ec]', icon: 'text-[#e0457b]', line: '#e0457b', text: 'text-[#c23367]' },
  mint: { circle: 'bg-[#dff7ec]', icon: 'text-[#1fb57a]', line: '#1fb57a', text: 'text-[#12a06b]' },
}

const ICONS = {
  // Chariot
  cart: (
    <>
      <path d="M2.5 3.5h2.2c.5 0 .9.3 1 .8l.4 1.7h13.6c.7 0 1.2.7 1 1.3l-1.8 6.3c-.1.5-.6.8-1.1.8H8.2l.4 1.6h9.6a1 1 0 1 1 0 2H7.8c-.5 0-.9-.3-1-.8L4 5.5H2.5a1 1 0 0 1 0-2z" />
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="17" cy="20" r="1.6" />
    </>
  ),
  // Colis (cube)
  box: (
    <>
      <path d="M12 2.2 3.6 6.5 12 10.8l8.4-4.3z" />
      <path d="M2.8 8.1v9.3c0 .4.2.7.5.9l7.7 3.9v-9.8z" opacity=".75" />
      <path d="M21.2 8.1v9.3c0 .4-.2.7-.5.9L13 22.2v-9.8z" opacity=".55" />
    </>
  ),
  // Cible avec flèche : commandes en cours
  target: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7z" />
      <path d="M12 7a5 5 0 1 0 5 5h-2a3 3 0 1 1-3-3z" />
      <path d="M15.6 3.2 17 1.8l.4 2.8 2.8.4-1.4 1.4-2-.3-4.1 4.1a1 1 0 1 1-1.4-1.4l4.1-4.1z" />
    </>
  ),
  // Mégaphone : demandes publiées
  megaphone: (
    <>
      <path d="M18.5 3.3c.6-.3 1.5.1 1.5.9v13.6c0 .8-.9 1.2-1.5.9L12 15H7.5a4 4 0 0 1 0-8H12z" />
      <path d="M7.5 16.5h3l1.2 4.2c.2.7-.3 1.3-1 1.3H9.4c-.5 0-.9-.3-1-.7z" opacity=".75" />
      <rect x="21" y="9" width="2" height="4" rx="1" opacity=".6" />
    </>
  ),
  // Sablier : devis en attente
  hourglass: (
    <>
      <path d="M5 2h14a1 1 0 1 1 0 2h-1v2.6c0 1.6-.8 3.1-2.1 4L13.6 12l2.3 1.4c1.3.9 2.1 2.4 2.1 4V20h1a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2h1v-2.6c0-1.6.8-3.1 2.1-4L10.4 12 8.1 10.6C6.8 9.7 6 8.2 6 6.6V4H5a1 1 0 0 1 0-2z" opacity=".35" />
      <path d="M8.5 6.5h7c-.2.8-.7 1.6-1.4 2L12 9.8 9.9 8.5c-.7-.4-1.2-1.2-1.4-2zM12 14.5l3.4 2.2c.4.3.6.8.6 1.3v.5H8V18c0-.5.2-1 .6-1.3z" />
    </>
  ),
  // Œil : vues des produits
  eye: (
    <>
      <path d="M12 5C6.5 5 2.7 9.3 1.6 11.4a1.3 1.3 0 0 0 0 1.2C2.7 14.7 6.5 19 12 19s9.3-4.3 10.4-6.4a1.3 1.3 0 0 0 0-1.2C21.3 9.3 17.5 5 12 5z" opacity=".35" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  // Cloche : notifications
  bell: (
    <>
      <path d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 5.2-2 7-2 7a1 1 0 0 0 .7 1.7h15.6a1 1 0 0 0 .7-1.7s-2-1.8-2-7A6.5 6.5 0 0 0 12 2.5z" />
      <path d="M9.5 20a2.6 2.6 0 0 0 5 0z" opacity=".6" />
    </>
  ),
  // Personnes : utilisateurs
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M1.5 20a7.5 7.5 0 0 1 15 0z" />
      <circle cx="17.5" cy="9" r="3" opacity=".55" />
      <path d="M17 13.5a6 6 0 0 1 5.5 6.5H18a9 9 0 0 0-2.5-6.3z" opacity=".55" />
    </>
  ),
  // Badge validé : fournisseurs validés
  check: (
    <>
      <path d="M12 2l2.4 1.8 3-.2 1 2.8 2.6 1.6-.9 2.9.9 2.9-2.6 1.6-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8L3 16l.9-2.9L3 10.2l2.6-1.6 1-2.8 3 .2z" opacity=".35" />
      <path d="M10.6 15.6 7.3 12.3l1.4-1.4 1.9 1.9 4.7-4.7 1.4 1.4z" />
    </>
  ),
  // Étoile : fournisseurs favoris
  star: (
    <path d="M12 2.5c.4 0 .7.2.9.6l2.4 5 5.4.8c.8.1 1.1 1.1.5 1.7l-3.9 3.8.9 5.4c.1.8-.7 1.4-1.4 1L12 18.3l-4.8 2.5c-.7.4-1.5-.2-1.4-1l.9-5.4-3.9-3.8c-.6-.6-.3-1.6.5-1.7l5.4-.8 2.4-5c.2-.4.5-.6.9-.6z" />
  ),
}

export default function KpiIcon({ name, tone = 'violet', size = 'h-12 w-12' }) {
  const colors = TONES[tone] ?? TONES.violet

  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${size} ${colors.circle}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" className={`h-6 w-6 ${colors.icon}`}>
        {ICONS[name]}
      </svg>
    </span>
  )
}
