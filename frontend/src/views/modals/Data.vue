<script setup lang="ts">
import type { IData, IDataCreate } from "@/models/Data"
import { useDataStore } from "@/stores/data"
import useEmitter from "@/utils/emitter"
import { isUndefined } from "lodash"
import type { FormInst } from "naive-ui"
import { onBeforeUnmount, ref } from "vue"
import { useI18n } from "vue-i18n"

const { t } = useI18n()
const emitter = useEmitter()
const store = useDataStore()

const formRef = ref<FormInst | null>(null)
const show = ref(false)
const id = ref<string>("")

// TRUE means UPDATE
// FALSE means CREATE
const mode = ref(false)
const defaultValues = {
  name: "",
}

const values = ref<IDataCreate>({
  ...defaultValues,
})

emitter.on("showDataModal", (data: IData) => {
  if (!isUndefined(data)) {
    mode.value = true
    id.value = data.id
    values.value = { ...data }
  } else {
    mode.value = false
    values.value = { ...defaultValues }
  }
  show.value = true
})

onBeforeUnmount(() => {
  emitter.off("showModal")
})

const rules = {
  name: {
    required: true,
    trigger: "input",
    message: t("data.create.rules.name"),
  },
}

const submit = (e: MouseEvent) => {
  e.preventDefault()
  formRef.value?.validate(async (errors) => {
    if (!errors) {
      !mode.value
        ? store.create(values.value)
        : store.update(id.value, values.value)
      show.value = false
    }
  })
}
</script>

<template>
  <n-drawer v-model:show="show" :width="500">
    <n-drawer-content
      :title="!mode ? t('data.create.title') : t('data.update.title')"
    >
      <n-form :model="values" ref="formRef" :rules="rules">
        <n-form-item :label="t('data.table.name')" path="name">
          <n-input
            v-model:value="values.name"
            maxlength="30"
            show-count
            clearable
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button type="primary" @click="submit">
            {{ !mode ? t("common.create") : t("common.save") }}
          </n-button>
        </n-space>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>
