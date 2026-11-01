import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import router from './router'
// Self-hosted fonts (latin subset, font-display: swap): Playfair Display for display/headlines, Lato for the rest
import '@fontsource/playfair-display/latin-400.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/playfair-display/latin-900.css'
import '@fontsource/playfair-display/latin-400-italic.css'
import '@fontsource/playfair-display/latin-700-italic.css'
import '@fontsource/lato/latin-400.css'
import '@fontsource/lato/latin-700.css'
import '@fontsource/lato/latin-900.css'
import './assets/tokens.css'
import './assets/main.css'
import VueDOMPurifyHTML from 'vue-dompurify-html';

const app = createApp(App)
app.use(createPinia())
app.use(createHead()) // per-route <title> and description (App.vue)
app.use(router)
app.use(VueDOMPurifyHTML);
app.mount('#app')
