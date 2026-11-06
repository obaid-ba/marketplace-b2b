<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { homeRouteFor } from '@/utils/roles'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const error = ref('')
const fieldErrors = ref({})

async function submit() {
  loading.value = true
  error.value = ''
  fieldErrors.value = {}
  try {
    const user = await auth.login(form.email, form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    router.push(redirect ?? { name: homeRouteFor(user.role) })
  } catch (e) {
    error.value = e.userMessage ?? 'Connexion impossible.'
    fieldErrors.value = e.fieldErrors ?? {}
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="card w-full max-w-md">
      <RouterLink :to="{ name: 'home' }" class="text-sm text-brand-600">← Accueil</RouterLink>
      <h1 class="mt-3 text-2xl font-semibold">Connexion</h1>
      <p class="mt-1 text-sm text-slate-500">Accédez à votre espace fournisseur, porteur de projet ou administrateur.</p>

      <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
        <div>
          <label for="email" class="mb-1 block text-sm font-medium">Adresse e-mail</label>
          <input id="email" v-model.trim="form.email" type="email" autocomplete="email" class="input" required />
          <p v-if="fieldErrors.email" class="mt-1 text-sm text-red-600">{{ fieldErrors.email[0] }}</p>
        </div>

        <div>
          <label for="password" class="mb-1 block text-sm font-medium">Mot de passe</label>
          <input id="password" v-model="form.password" type="password" autocomplete="current-password" class="input" required />
          <p v-if="fieldErrors.password" class="mt-1 text-sm text-red-600">{{ fieldErrors.password[0] }}</p>
        </div>

        <p v-if="error && !Object.keys(fieldErrors).length" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {{ error }}
        </p>

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>

      <!-- "Mot de passe oublié" et "S'inscrire" arrivent en S1 (SCRUM-21 à SCRUM-26) -->
    </div>
  </div>
</template>
