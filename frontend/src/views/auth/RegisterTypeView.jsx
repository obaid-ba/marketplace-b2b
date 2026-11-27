import { Link } from 'react-router'
import AuthLayout, { AuthCard, BackHome } from '@/layouts/AuthLayout'
import { PATHS } from '@/router/paths'

const CHOICES = [
  {
    role: 'fournisseur',
    title: 'Je suis fournisseur',
    description: 'Vendez vos produits et services aux entreprises.',
    to: PATHS.register,
  },
  {
    role: 'porteur',
    title: 'Je suis porteur de projet',
    description: 'Publiez vos besoins et recevez des devis de fournisseurs.',
    to: PATHS.registerBuyer,
  },
]

export default function RegisterTypeView() {
  return (
    <AuthLayout>
      <AuthCard className="max-w-2xl">
        <BackHome />
        <h1 className="mt-5 text-[28px] font-bold tracking-tight text-ink">Créer un compte</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choisissez le type de compte qui vous correspond.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {CHOICES.map((choice) => (
            <Link
              key={choice.role}
              to={choice.to}
              className="rounded-lg border border-slate-200 px-4 py-3 transition hover:border-brand-300 hover:shadow-sm"
            >
              <span className="block font-medium text-brand-700">{choice.title}</span>
              <span className="mt-1 block text-sm text-slate-600">{choice.description}</span>
              <span className="mt-3 block text-sm font-medium text-brand-600">Continuer →</span>
            </Link>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Vous avez déjà un compte ?{' '}
          <Link to={PATHS.login} className="font-medium text-brand-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}
