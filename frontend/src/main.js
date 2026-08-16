import { createApp } from 'vue';
import App from './App.vue';
import './assets/global.less';
import Router from './router/index';

const app = createApp(App);
app.config.productionTip = false;

app.use(Router).mount('#app');
