// Vue app
import { autoAnimatePlugin } from "@formkit/auto-animate/vue"
import { createApp } from "vue"

// Store app
import { createPinia } from "pinia"

// Hot reload support on embedded vite applications
import "vite/modulepreload-polyfill"

import mitt from "mitt"
import naive from "naive-ui"
import VueApexCharts from "vue3-apexcharts"

// --- BURASI DEĞİŞTİ ---
// Eski: import { GridLayout, GridItem } from "vue-grid-layout"
// Yeni:
import { GridLayout, GridItem } from "vue3-grid-layout" 
// ----------------------

import router from "./router"
import i18nInstance from "./utils/i18n"
import App from "./views/layouts/App.vue"

const app = createApp(App)
const emitter = mitt()
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(naive)
app.use(autoAnimatePlugin)
app.use(i18nInstance)
app.use(VueApexCharts)

// ============= GRID LAYOUT GLOBAL REGISTRATION =============
// Bunu burada tanımladığın için diğer dosyalarda tekrar import etmene 
// gerek kalmayabilir ama Type desteği için dosya bazlı import genelde daha iyidir.
app.component('GridLayout', GridLayout)
app.component('GridItem', GridItem)

app.config.globalProperties.emitter = emitter

app.mount("#app")