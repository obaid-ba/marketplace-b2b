import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import RegisterView from './RegisterView'

vi.mock('@/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn() },
  onAuthError: vi.fn(),
}))

const regions = [
  { id: 1, name: 'Tunis' },
  { id: 2, name: 'Sfax' },
]

const categories = [
  { id: 10, parent_id: null, name: 'BTP et matériaux', position: 1 },
  { id: 11, parent_id: 10, name: 'Ciment et béton', position: 1 },
  { id: 20, parent_id: null, name: 'Informatique', position: 2 },
]

function renderView() {
  render(
    <MemoryRouter>
      <RegisterView />
    </MemoryRouter>,
  )
}

function fillStepOne(email = 'amina@exemple.tn') {
  fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Amina' } })
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Trabelsi' } })
  fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '71000000' } })
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'Password123' } })
  fireEvent.change(screen.getByLabelText('Confirmation du mot de passe'), {
    target: { value: 'Password123' },
  })
}

async function goToStepTwo() {
  fillStepOne()
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
  await screen.findByLabelText("Nom de l'entreprise")
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null, loaded: true })

  http.get.mockImplementation((url) =>
    Promise.resolve({ data: url === '/reference/regions' ? regions : categories }),
  )

  http.post.mockImplementation((url) => {
    if (url === '/auth/register/supplier/check-email') {
      return Promise.resolve({ data: { available: true } })
    }

    return Promise.resolve({
      data: {
        message: 'Votre compte a été créé.',
        user: { email: 'amina@exemple.tn' },
        profile: { company_name: 'Amina Bâtiment SARL' },
      },
    })
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RegisterView', () => {
  it("affiche l'étape 1 et refuse un mot de passe trop faible", async () => {
    renderView()

    expect(screen.getByRole('heading', { name: 'Inscription fournisseur' })).toBeTruthy()

    fillStepOne()
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'faible' } })
    fireEvent.change(screen.getByLabelText('Confirmation du mot de passe'), { target: { value: 'faible' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    expect(
      await screen.findByText(
        'Mot de passe trop faible : 8 caractères minimum, une majuscule, une minuscule et un chiffre.',
      ),
    ).toBeTruthy()
    expect(screen.queryByLabelText("Nom de l'entreprise")).toBeNull()
  })

  it('exige un téléphone de 8 chiffres', async () => {
    renderView()
    fillStepOne()
    fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    expect(
      await screen.findByText('Le téléphone doit contenir 8 chiffres (préfixe +216).'),
    ).toBeTruthy()
  })

  it("conserve les données saisies quand on revient à l'étape précédente", async () => {
    renderView()
    await goToStepTwo()

    fireEvent.change(screen.getByLabelText("Nom de l'entreprise"), {
      target: { value: 'Amina Bâtiment SARL' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))

    expect(screen.getByLabelText('Adresse e-mail').value).toBe('amina@exemple.tn')

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    expect((await screen.findByLabelText("Nom de l'entreprise")).value).toBe('Amina Bâtiment SARL')
  })

  it('envoie le compte, le profil et les justificatifs puis affiche la confirmation', async () => {
    renderView()
    await goToStepTwo()

    fireEvent.change(screen.getByLabelText("Nom de l'entreprise"), {
      target: { value: 'Amina Bâtiment SARL' },
    })
    fireEvent.change(screen.getByLabelText('Forme juridique'), { target: { value: 'SARL' } })
    fireEvent.change(screen.getByLabelText('Matricule fiscal'), { target: { value: '1234567A' } })
    fireEvent.change(screen.getByLabelText('Numéro RNE (registre de commerce)'), {
      target: { value: 'RNE-2026-001' },
    })
    fireEvent.change(screen.getByLabelText("Secteur d'activité"), {
      target: { value: 'Construction' },
    })
    fireEvent.change(screen.getByLabelText("Description de l'entreprise"), {
      target: { value: 'Entreprise générale de bâtiment.' },
    })
    await screen.findByLabelText('Tunis')
    fireEvent.change(screen.getByLabelText('Région du siège'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Adresse'), { target: { value: '12 rue du marché' } })
    fireEvent.change(screen.getByLabelText('Ville (délégation)'), { target: { value: 'Tunis' } })
    fireEvent.change(screen.getByLabelText('Nom et prénom'), {
      target: { value: 'Amina Trabelsi' },
    })
    fireEvent.change(screen.getByLabelText('Fonction'), { target: { value: 'Gérante' } })
    fireEvent.change(screen.getByLabelText('Téléphone du contact'), {
      target: { value: '+216 71 000 001' },
    })
    fireEvent.click(screen.getByLabelText('Tunis'))
    fireEvent.click(screen.getByLabelText('Sfax'))
    fireEvent.click(screen.getByLabelText('BTP et matériaux'))
    fireEvent.click(screen.getByLabelText('Informatique'))

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    await screen.findByLabelText('Registre de commerce')

    fireEvent.change(screen.getByLabelText('Registre de commerce'), {
      target: { files: [new File(['registre'], 'registre.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.change(screen.getByLabelText('Attestation fiscale / patente'), {
      target: { files: [new File(['fiscale'], 'attestation.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.change(screen.getByLabelText('CIN du gérant'), {
      target: { files: [new File(['cin'], 'cin.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.change(screen.getByLabelText('Certifications (facultatif)'), {
      target: {
        files: [new File(['certification'], 'certification.pdf', { type: 'application/pdf' })],
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByRole('heading', { name: 'Vérifiez votre boîte e-mail' })).toBeTruthy()

    const registration = http.post.mock.calls.find(([url]) => url === '/auth/register/supplier')
    expect(registration).toBeTruthy()

    const payload = registration[1]
    expect(payload.get('first_name')).toBe('Amina')
    expect(payload.get('last_name')).toBe('Trabelsi')
    expect(payload.get('email')).toBe('amina@exemple.tn')
    expect(payload.get('phone')).toBe('+216 71000000')
    expect(payload.get('company_name')).toBe('Amina Bâtiment SARL')
    expect(payload.get('legal_form')).toBe('SARL')
    expect(payload.get('tax_id')).toBe('1234567A')
    expect(payload.get('rne_number')).toBe('RNE-2026-001')
    expect(payload.get('sector')).toBe('Construction')
    expect(payload.get('address')).toBe('12 rue du marché')
    expect(payload.get('city')).toBe('Tunis')
    expect(payload.get('contact_name')).toBe('Amina Trabelsi')
    expect(payload.get('region_id')).toBe('1')
    expect(payload.getAll('coverage_regions[]')).toEqual(['1', '2'])
    expect(payload.getAll('categories[]')).toEqual(['10', '20'])
    expect(payload.get('commercial_register').name).toBe('registre.pdf')
    expect(payload.get('tax_certificate').name).toBe('attestation.pdf')
    expect(payload.get('manager_id').name).toBe('cin.pdf')
    expect(payload.get('certifications[]').name).toBe('certification.pdf')

    await waitFor(() => expect(screen.getByText(/Votre profil/)).toBeTruthy())
  })

  it('exige les trois justificatifs obligatoires', async () => {
    renderView()
    await goToStepTwo()

    fireEvent.change(screen.getByLabelText("Nom de l'entreprise"), {
      target: { value: 'Amina Bâtiment SARL' },
    })
    fireEvent.change(screen.getByLabelText('Forme juridique'), { target: { value: 'SARL' } })
    fireEvent.change(screen.getByLabelText('Matricule fiscal'), { target: { value: '1234567A' } })
    fireEvent.change(screen.getByLabelText('Numéro RNE (registre de commerce)'), {
      target: { value: 'RNE-2026-001' },
    })
    fireEvent.change(screen.getByLabelText("Secteur d'activité"), {
      target: { value: 'Construction' },
    })
    fireEvent.change(screen.getByLabelText("Description de l'entreprise"), {
      target: { value: 'Entreprise générale de bâtiment.' },
    })
    await screen.findByLabelText('Tunis')
    fireEvent.change(screen.getByLabelText('Région du siège'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Adresse'), { target: { value: '12 rue du marché' } })
    fireEvent.change(screen.getByLabelText('Ville (délégation)'), { target: { value: 'Tunis' } })
    fireEvent.change(screen.getByLabelText('Nom et prénom'), {
      target: { value: 'Amina Trabelsi' },
    })
    fireEvent.change(screen.getByLabelText('Fonction'), { target: { value: 'Gérante' } })
    fireEvent.change(screen.getByLabelText('Téléphone du contact'), {
      target: { value: '+216 71 000 001' },
    })
    fireEvent.click(screen.getByLabelText('Tunis'))
    fireEvent.click(screen.getByLabelText('BTP et matériaux'))

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    await screen.findByLabelText('Registre de commerce')
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText('Le registre de commerce est obligatoire.')).toBeTruthy()
    expect(screen.getByText("L'attestation fiscale est obligatoire.")).toBeTruthy()
    expect(screen.getByText('La CIN du gérant est obligatoire.')).toBeTruthy()
  })
})
