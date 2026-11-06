<script setup>
import { useAuthStore } from '@/stores/auth'
import { homeRouteFor } from '@/utils/roles'

const auth = useAuthStore()
</script>

<template>
  <div class="min-h-screen">
    <header class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
      <span class="text-lg font-semibold text-brand-700">Marketplace B2B</span>
      <RouterLink v-if="auth.isAuthenticated" :to="{ name: homeRouteFor(auth.role) }" class="btn-primary">
        Mon espace
      </RouterLink>
      <RouterLink v-else :to="{ name: 'login' }" class="btn-primary">Se connecter</RouterLink>
    </header>

    <!-- Page d'accueil complète (recherche, catégories, produits mis en avant) : S2, SCRUM-38 -->
    <section class="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 class="text-4xl font-bold tracking-tight">Achetez et vendez entre professionnels</h1>
      <p class="mt-4 text-lg text-slate-600">
        Publiez un besoin, recevez des devis de fournisseurs tunisiens et suivez vos commandes jusqu'à la facture.
      </p>
    </section>
  </div>
</template>
