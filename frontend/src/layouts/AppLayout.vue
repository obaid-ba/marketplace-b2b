<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ROLE_LABELS, homeRouteFor } from '@/utils/roles'

const auth = useAuthStore()
const router = useRouter()

const homeRoute = computed(() => ({ name: homeRouteFor(auth.role) }))

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <RouterLink :to="homeRoute" class="text-lg font-semibold text-brand-700">
          Marketplace B2B
        </RouterLink>

        <div class="flex items-center gap-3">
          <!-- La cloche de notifications arrive en S5 (SCRUM-62) -->
          <div class="hidden text-right text-sm sm:block">
            <p class="font-medium">{{ auth.user?.name }}</p>
            <p class="text-slate-500">{{ ROLE_LABELS[auth.role] }}</p>
          </div>
          <button type="button" class="btn-ghost" @click="logout">Déconnexion</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-8">
      <RouterView />
    </main>
  </div>
</template>
