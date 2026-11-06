<script setup>
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <h1 class="text-2xl font-semibold">Bonjour {{ auth.user?.name }}</h1>
  <p class="mt-1 text-slate-500">Tableau de bord fournisseur</p>

  <!-- Indicateurs complets en S6 (SCRUM-68) -->
  <div class="card mt-6 text-slate-600">
    Votre espace fournisseur est prêt. Produits, demandes reçues et devis arrivent dans les prochains sprints.
  </div>
</template>
