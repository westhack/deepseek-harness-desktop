import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Manager',
    component: () => import('@/views/dsh/Manager.vue'),
  },
];

const Router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default Router;
