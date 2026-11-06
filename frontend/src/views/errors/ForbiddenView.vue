<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-4 text-center">
    <p class="text-6xl font-bold text-slate-300">403</p>
    <h1 class="mt-4 text-2xl font-semibold">Accès refusé</h1>
    <p class="mt-2 text-slate-600">Cette page n'est pas disponible pour votre type de compte.</p>
    <RouterLink :to="{ name: 'home' }" class="btn-primary mt-6">Retour à l'accueil</RouterLink>
  </div>
</template>
