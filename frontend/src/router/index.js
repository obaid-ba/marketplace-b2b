import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ROLES } from '@/utils/roles'
import { resolveAccess } from './guard'

const routes = [
  // Pages publiques
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
  {
    path: '/connexion',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { guest: true },
  },

  // Espace fournisseur
  {
    path: '/fournisseur',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { roles: [ROLES.SUPPLIER] },
    children: [
      {
        path: '',
        name: 'supplier.dashboard',
        component: () => import('@/views/supplier/SupplierDashboard.vue'),
      },
    ],
  },

  // Espace porteur de projet
  {
    path: '/porteur',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { roles: [ROLES.BUYER] },
    children: [
      {
        path: '',
        name: 'buyer.dashboard',
        component: () => import('@/views/buyer/BuyerDashboard.vue'),
      },
    ],
  },

  // Back-office
  {
    path: '/admin',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { roles: [ROLES.ADMIN] },
    children: [
      {
        path: '',
        name: 'admin.dashboard',
        component: () => import('@/views/admin/AdminDashboard.vue'),
      },
    ],
  },

  // Erreurs
  { path: '/acces-refuse', name: 'forbidden', component: () => import('@/views/errors/ForbiddenView.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/errors/NotFoundView.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loaded) {
    await auth.fetchMe()
  }
  return resolveAccess(to, auth)
})

export default router
