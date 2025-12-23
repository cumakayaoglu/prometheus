import type { IData, IDataCreate } from "@/models/Data"
import http from "@/utils/http-common"
import { i18n } from "@/utils/i18n"
import type { IFilter, IPaginator } from "@limanmys/frontend-kit"
import { defineStore } from "pinia"

export const useDataStore = defineStore({
  id: "data",
  state: () => ({
    filter: {} as IFilter,
    data: {} as IPaginator<IData>,
  }),
  getters: {
    get: (state) => state.data,
  },
  actions: {
    async fetch(payload: IFilter = {} as IFilter) {
      let q = payload
      if (Object.keys(payload).length < 1) {
        q = this.filter
      } else {
        this.filter = q
      }
      const query = new URLSearchParams(q as Record<string, string>).toString()

      return http.get(`endpoint?${query}`).then((res) => {
        if (res.status == 200) {
          if (res.data) {
            this.data = res.data
          }
        } else {
          window.$notification.error({
            duration: 5000,
            title: i18n.t("common.error"),
            content: i18n.t("data.fetch.messages.error"),
          })
        }
      })
    },
    async fetchUsers() {
      return http.php(`getUsers`).then((res) => {
        if (res.status == 200) {
          if (res.data) {
            this.data = res.data
          }
        } else {
          window.$notification.error({
            duration: 5000,
            title: i18n.t("common.error"),
            content: i18n.t("data.fetch.messages.error"),
          })
        }
      })
    },
    async create(payload: IDataCreate) {
      return http
        .post(`endpoint`, {
          data: JSON.stringify(payload),
        })
        .then((res) => {
          if (res.status == 200) {
            window.$notification.success({
              title: i18n.t("common.success"),
              content: i18n.t("data.create.messages.success"),
              duration: 3000,
            })
            this.fetch()
          } else {
            window.$notification.error({
              duration: 5000,
              title: i18n.t("common.error"),
              content: i18n.t("data.create.messages.error"),
            })
          }
        })
    },
    async update(id: string, payload: IDataCreate) {
      return http
        .patch(`endpoint/${id}`, {
          data: JSON.stringify(payload),
        })
        .then((res) => {
          if (res.status == 200) {
            window.$notification.success({
              title: i18n.t("common.success"),
              content: i18n.t("data.update.messages.success"),
              duration: 3000,
            })
            this.fetch()
          } else {
            window.$notification.error({
              duration: 5000,
              title: i18n.t("common.error"),
              content: i18n.t("data.update.messages.error"),
            })
          }
        })
    },
    async delete(id: string) {
      window.$dialog.warning({
        title: i18n.t("common.warning"),
        content: i18n.t("common.are_you_sure"),
        positiveText: i18n.t("common.yes"),
        negativeText: i18n.t("common.no"),
        onPositiveClick: () => {
          return http.delete(`endpoint/${id}`).then((res) => {
            if (res.status == 200) {
              window.$notification.success({
                title: i18n.t("common.success"),
                content: i18n.t("data.delete.messages.success"),
                duration: 3000,
              })
              this.fetch()
            } else {
              window.$notification.error({
                duration: 5000,
                title: i18n.t("common.error"),
                content: i18n.t("data.delete.messages.error"),
              })
            }
          })
        },
      })
    },
  },
})
