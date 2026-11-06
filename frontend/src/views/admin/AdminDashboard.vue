<script setup>
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <h1 class="text-2xl font-semibold">Bonjour {{ auth.user?.name }}</h1>
  <p class="mt-1 text-slate-500">Back-office administrateur</p>

  <!-- Validation des fournisseurs en S1 (SCRUM-31), indicateurs en S6 (SCRUM-70) -->
  <div class="card mt-6 text-slate-600">
    Le back-office est prêt. La validation des fournisseurs arrive au sprint S1.
  </div>
</template>
