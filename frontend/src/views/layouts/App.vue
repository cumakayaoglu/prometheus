<script setup lang="ts">
import { ref } from "vue"
import VErrorBoundary from "vue-error-boundary"
import { RouterView, useRoute } from "vue-router"
import AppProvider from "./AppProvider.vue"
import { Error } from "@limanmys/frontend-kit"
import Navigation from "./Navigation.vue"
import { PageHeader } from "@limanmys/frontend-kit"
import { useI18n } from "vue-i18n"

const err = ref()
const stack = ref()
const route = useRoute()
const { t } = useI18n()
const errorCapture = (error: any) => {
  err.value = error.error.toString()
  stack.value = error.error.stack as string
}
</script>

<template>
  <AppProvider>
    <Navigation />

    <RouterView v-slot="{ Component }">
      <div style="padding: 30px; width: 100%">
        <VErrorBoundary stop-propagation @error-captured="errorCapture">
          <template #boundary="{ hasError }">
            <div v-if="hasError">
              <Error :error="err" :stack="stack" />
            </div>
            <template v-else>
              <PageHeader
                :title="t(`navigation.${String(route.name)}.title`)"
                :description="t(`navigation.${String(route.name)}.description`)"
              />
              <component :is="Component" />
            </template>
          </template>
        </VErrorBoundary>
      </div>
    </RouterView>
  </AppProvider>
  <n-back-top :right="50" :bottom="60" />
</template>

<style lang="scss">
@import "@/../node_modules/@limanmys/frontend-kit/dist/style.css";
</style>
