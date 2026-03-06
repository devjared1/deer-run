import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import VueDOMPurifyHTML from 'vue-dompurify-html';

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(VueDOMPurifyHTML);
app.mount('#app')
