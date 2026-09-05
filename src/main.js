import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import tilt from './directives/tilt.js'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.directive('tilt', tilt)
app.mount('#app')
