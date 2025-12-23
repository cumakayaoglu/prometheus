<script setup lang="ts">
import { ColumnSelector, formatDate, type IData } from "@limanmys/frontend-kit"
import { NButton, NButtonGroup, NInput, NSpace } from "naive-ui"
import { computed, h, reactive, ref, toRefs } from "vue"
import { useI18n } from "vue-i18n"

export interface Props {
  columns: any[]
  data: IData[]
  loading: boolean
  pageSize?: number
  title?: string
  searchable?: boolean
  selected?: string[]
  rowKey?: string
  columnSelectable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 10,
  title: "",
  searchable: true,
  columnSelectable: true,
  loading: false,
  rowKey: "id",
})

const { t } = useI18n()
const { columns, data, pageSize } = toRefs(props)

const pagination = reactive({
  page: 1,
  pageSize: pageSize.value,
  showSizePicker: true,
  pageSizes: [...Array(15).keys()].map((i) => i * 5 + pageSize.value),
  onChange: (page: number) => {
    pagination.page = page
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
  },
  prefix({ itemCount }: { itemCount: number }) {
    return `${t("common.total")}: ${itemCount}`
  },
})

// Column filter handler
columns.value.forEach((_, i) => {
  const column = ref(columns.value[i])

  column.value = {
    ...column.value,
    show: true,
  }

  if (column.value.type === "date") {
    column.value.width = 170

    column.value.render = (row: any) => {
      return formatDate(row[column.value.key])
    }
  }

  if (column.value.key == "actions") {
    column.value = {
      ...column.value,
      className: "text-right",
    }
  }

  if (column.value.filterable) {
    column.value = {
      ...column.value,
      filterOptionValue: null,
      filter(value: any, row: any) {
        if (row[column.value.key]) {
          return !!~row[column.value.key]
            .toString()
            .toLowerCase()
            .indexOf(value.toString().toLowerCase())
        }
        return false
      },
      renderFilterMenu: ({ hide }: { hide: any }) => {
        return h(NSpace, { style: { padding: "12px" }, vertical: true }, [
          h(NInput, {
            placeholder: t("table.filter.placeholder"),
            id: column.value.key + "-filter",
            defaultValue: column.value.filterOptionValue,
            maxlength: 60,
            showCount: true,
          }),
          h(
            NButtonGroup,
            {
              style: "float: right",
            },
            [
              h(NButton, {
                size: "tiny",
                "on-click": () => {
                  const filter: any = document.querySelector(
                    "#" + column.value.key + "-filter input",
                  )
                  filter.value = ""
                  column.value.filterOptionValue = null
                  hide()
                },
                innerHTML: t("table.filter.clear"),
              }),
              h(NButton, {
                size: "tiny",
                type: "primary",
                "on-click": () => {
                  const filter: any = document.querySelector(
                    "#" + column.value.key + "-filter input",
                  )

                  if (filter.value.length > 0) {
                    column.value.filterOptionValue = filter.value
                  } else {
                    column.value.filterOptionValue = null
                  }
                  hide()
                },
                innerHTML: t("common.approve"),
              }),
            ],
          ),
        ])
      },
    }
  }

  columns.value[i] = column.value
})

// Table search handler
const search = ref("")
const tableData = computed<IData[]>(() => {
  if (search.value.length <= 0) {
    return data.value
  }
  return data.value.filter((row: any) => {
    for (const column of columns.value) {
      if (
        row[column.key] &&
        row[column.key]
          .toString()
          .toLowerCase()
          .indexOf(search.value.toString().toLowerCase()) > -1
      ) {
        return true
      }
    }
    return false
  })
})

const emit = defineEmits<{
  (event: "update:selected", ...args: any[]): void
}>()

const selectedKeys = computed({
  get() {
    return props.selected
  },
  set(value) {
    emit("update:selected", value)
  },
})

const filteredColumns = computed(() => {
  return columns.value.filter((column) => column.show)
})
</script>

<template>
  <n-space
    justify="space-between"
    style="margin-bottom: 15px; align-items: center !important"
  >
    <div class="table-left-side">
      <n-space size="small">
        <slot name="buttons"></slot>
      </n-space>
    </div>
    <div class="table-right-side">
      <n-space>
        <template v-if="props.searchable">
          <n-input
            v-model:value="search"
            :placeholder="t('table.search.placeholder')"
          >
            <template #prefix>
              <i class="fas fa-search mr-1"></i>
            </template>
          </n-input>
          <ColumnSelector
            v-if="props.columnSelectable"
            :columns="columns"
            :data="tableData"
          />
        </template>
      </n-space>
    </div>
  </n-space>

  <n-data-table
    v-model:checked-row-keys="selectedKeys"
    :row-key="(rowData: IData) => rowData[`${props.rowKey}`]"
    :columns="filteredColumns"
    :data="tableData"
    :loading="props.loading"
    :pagination="pagination"
    striped
    :single-line="false"
    size="small"
  />
</template>
