<script setup lang="ts">
import { useI18n } from "vue-i18n"

const { t } = useI18n()
</script>

<template>
    <n-empty :description="t('common.no_permission')">
        <template #icon>
            <n-icon> <i class="fa-solid fa-triangle-exclamation"></i> </n-icon>
        </template>
    </n-empty>
</template>