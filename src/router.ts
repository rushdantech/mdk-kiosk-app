import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import MyKadView from './views/MyKadView.vue'
import BillsView from './views/BillsView.vue'
import VoiceView from './views/VoiceView.vue'
import ScanView from './views/ScanView.vue'
import ScanCodesView from './views/ScanCodesView.vue'
import KeyInView from './views/KeyInView.vue'
import PayView from './views/PayView.vue'
import DoneView from './views/DoneView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/mykad', name: 'mykad', component: MyKadView },
    { path: '/bills', name: 'bills', component: BillsView },
    { path: '/voice', name: 'voice', component: VoiceView },
    { path: '/scan', name: 'scan', component: ScanView },
    { path: '/scan-codes', name: 'scan-codes', component: ScanCodesView },
    { path: '/key-in', name: 'keyin', component: KeyInView },
    { path: '/pay', name: 'pay', component: PayView },
    { path: '/done', name: 'done', component: DoneView },
  ],
})
