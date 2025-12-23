import type { IData } from "@limanmys/frontend-kit"
import type { AxiosInstance } from "axios"
import { useLoadingBar } from "naive-ui"
import type { LoadingBarInst } from "naive-ui/es/loading-bar/src/LoadingBarProvider"
import { reactive } from "vue"
import { AxiosClient } from "@limanmys/frontend-kit"

export class HttpClient {
  axiosClient!: AxiosInstance
  isAuthenticated = reactive({
    value: false,
  })
  loadingBar: LoadingBarInst

  constructor(lmntargetFunction = "apiProxy", args?: any) {
    this.loadingBar = useLoadingBar()

    this.axiosClient = new AxiosClient({
      lmntargetFunction: lmntargetFunction,
      ...args,
    }).apiClient
  }

  async get(url: string, data?: IData, service = "admin") {
    window.$loadingBar.start()

    return this.axiosClient.post("", {
      type: "get",
      endpoint: url,
      service,
      ...data,
    })
  }

  async post(url: string, data?: IData, service = "admin") {
    window.$loadingBar.start()

    return this.axiosClient.post("", {
      type: "post",
      endpoint: url,
      service,
      ...data,
    })
  }

  async put(url: string, data?: IData, service = "admin") {
    window.$loadingBar.start()

    return this.axiosClient.post("", {
      type: "put",
      endpoint: url,
      service,
      ...data,
    })
  }

  async patch(url: string, data?: IData, service = "admin") {
    window.$loadingBar.start()

    return this.axiosClient.post("", {
      type: "patch",
      endpoint: url,
      service,
      ...data,
    })
  }

  async delete(url: string, data?: IData, service = "admin") {
    window.$loadingBar.start()

    return this.axiosClient.post("", {
      type: "delete",
      endpoint: url,
      service,
      ...data,
    })
  }

  async downloadFile(url: string, endpoint: string, data?: IData, service = "admin") {
    window.$loadingBar.start()

    const a = new AxiosClient({}).apiClient

    return a.post(
      "",
      {
        ...data,
        lmntargetFunction: url,
        type: "get",
        service,
        endpoint,
      },
      {
        responseType: "blob",
      }
    )
  }

  async php(url: string, data?: IData) {
    window.$loadingBar.start()

    const a = new AxiosClient({}).apiClient

    return a.post("", {
      ...data,
      lmntargetFunction: url,
    })
  }
}

const http = new HttpClient()

export default http
