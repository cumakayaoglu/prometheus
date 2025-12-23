import { createRouter, createWebHashHistory } from "vue-router"

// Imports
import NoPermission from "@/views/pages/NoPermission.vue"
import Home from "@/views/pages/Home.vue"
import { can } from "@limanmys/frontend-kit"

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/permission",
      name: "permission",
      component: NoPermission,
    },
    {
      path: "/home",
      name: "home",
      component: Home,
      beforeEnter: async () => {
        return (await can('mya_monitoring_services')) || { name: "permission" };
      }
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/home",
    },
  ],
})

export default router
