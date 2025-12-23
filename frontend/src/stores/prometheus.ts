import { defineStore } from "pinia"
import http from "@/utils/http-common"

export interface ChartSeries {
  name: string
  data: [number, number][]
  labels: Record<string, string> 
}

export interface SuggestionItem {
  type: 'metric' | 'function' | 'aggregation'
  label: string
  detail?: string
}


const CONSTANT_SUGGESTIONS: SuggestionItem[] = [
  { type: 'aggregation', label: 'sum', detail: 'calculate sum over dimensions' },
  { type: 'aggregation', label: 'min', detail: 'select minimum over dimensions' },
  { type: 'aggregation', label: 'max', detail: 'select maximum over dimensions' },
  { type: 'aggregation', label: 'avg', detail: 'calculate average over dimensions' },
  { type: 'aggregation', label: 'count', detail: 'count number of elements in vector' },
  { type: 'aggregation', label: 'stddev', detail: 'calculate population standard deviation' },
  { type: 'aggregation', label: 'stdvar', detail: 'calculate population standard variance' },
  { type: 'function', label: 'rate', detail: 'per-second average rate of increase' },
  { type: 'function', label: 'irate', detail: 'instant rate of increase' },
  { type: 'function', label: 'increase', detail: 'increase in the time range' },
  { type: 'function', label: 'sum_over_time', detail: 'sum of values in interval' },
  { type: 'function', label: 'avg_over_time', detail: 'average value in interval' },
  { type: 'function', label: 'min_over_time', detail: 'minimum value in interval' },
  { type: 'function', label: 'max_over_time', detail: 'maximum value in interval' },
  { type: 'function', label: 'count_over_time', detail: 'count of values in interval' },
  { type: 'function', label: 'abs', detail: 'absolute value' },
  { type: 'function', label: 'ceil', detail: 'round up to nearest integer' },
  { type: 'function', label: 'floor', detail: 'round down to nearest integer' },
  { type: 'function', label: 'clamp', detail: 'clamp values between min and max' },
  { type: 'function', label: 'clamp_max', detail: 'clamp values to max' },
  { type: 'function', label: 'clamp_min', detail: 'clamp values to min' },
  { type: 'function', label: 'delta', detail: 'difference between first and last value' },
  { type: 'function', label: 'idelta', detail: 'difference between last two values' },
  { type: 'function', label: 'deriv', detail: 'per-second derivative' },
  { type: 'function', label: 'predict_linear', detail: 'predict value based on linear regression' },
]


const STATIC_METRICS = [
  'mppt_values',
  'up',
  'scrape_duration_seconds',
  'scrape_samples_scraped',
  'scrape_samples_post_metric_relabeling',
  'scrape_series_added',
  'go_goroutines',
  'go_threads',
  'go_memstats_alloc_bytes',
  'go_memstats_heap_inuse_bytes',
  'go_memstats_heap_alloc_bytes',
  'go_memstats_sys_bytes',
  'go_gc_duration_seconds',
  'go_info',
  'net_conntrack_dialer_conn_attempted_total',
  'net_conntrack_dialer_conn_established_total',
  'net_conntrack_dialer_conn_failed_total',
  'process_cpu_seconds_total',
  'process_open_fds',
  'process_max_fds',
  'process_resident_memory_bytes',
  'process_start_time_seconds',
  'process_virtual_memory_bytes',
  'prometheus_http_requests_total',
  'prometheus_http_request_duration_seconds_bucket',
  'prometheus_tsdb_head_series',
  'prometheus_tsdb_head_samples_appended_total',
  'prometheus_tsdb_head_chunks',
  'prometheus_tsdb_compaction_duration_seconds_bucket',
  'prometheus_target_scrapes_sample_out_of_bounds_total',
  'prometheus_target_scrapes_sample_duplicate_timestamp_total',
  'prometheus_target_sync_failed_total',
  'prometheus_remote_storage_samples_total',
  'prometheus_remote_storage_samples_failed_total',
  'prometheus_remote_storage_queue_highest_timestamp_seconds',
  'prometheus_rule_evaluation_failures_total',
  'prometheus_rule_group_duration_seconds',
  'prometheus_sd_discovered_targets',
  'prometheus_sd_failed_configs',
  'prometheus_build_info',
  'prometheus_ready',
  'promhttp_metric_handler_requests_total',
  'promhttp_metric_handler_requests_in_flight',
  'node_cpu_seconds_total',
  'node_memory_MemTotal_bytes',
  'node_filesystem_size_bytes',
  'container_cpu_usage_seconds_total',
  'container_memory_usage_bytes',
  'go_sched_latencies_seconds_bucket',
  'go_mutex_wait_seconds_total',
  'go_gc_mark_assist_cpu_seconds_total',
  'go_gc_cpu_seconds_total',
  'go_gc_pauses_seconds_bucket',
  'go_scavenge_cpu_seconds_total',
  'go_memlimit_bytes',
  'go_memstats_alloc_bytes_total',
  'go_memstats_buck_hash_sys_bytes',
  'go_memstats_frees_total',
  'go_memstats_gc_cpu_fraction',
  'go_memstats_gc_sys_bytes',
  'go_memstats_heap_idle_bytes',
  'go_memstats_heap_objects',
  'go_memstats_heap_released_bytes',
  'go_memstats_heap_sys_bytes',
  'go_memstats_last_gc_time_seconds',
  'go_memstats_lookups_total',
  'go_memstats_mallocs_total',
  'go_memstats_mcache_inuse_bytes',
  'go_memstats_mcache_sys_bytes',
  'go_memstats_mspan_inuse_bytes',
  'go_memstats_mspan_sys_bytes',
  'go_memstats_next_gc_bytes',
  'go_memstats_other_sys_bytes',
  'go_memstats_stack_inuse_bytes',
  'go_memstats_stack_sys_bytes',
  'go_memstats_sys_bytes',
  'go_cgo_calls_count',
  'go_cpu_count',
  'go_gc_forced_count',
  'go_gomaxprocs',
  'process_cpu_seconds_system_total',
  'process_cpu_seconds_user_total',
  'process_major_pagefaults_total',
  'process_minor_pagefaults_total',
  'process_num_threads',
  'process_resident_memory_peak_bytes',
  'process_resident_memory_anon_bytes',
  'process_resident_memory_file_bytes',
  'process_resident_memory_shared_bytes',
  'process_io_read_bytes_total',
  'process_io_written_bytes_total',
  'process_io_read_syscalls_total',
  'process_io_write_syscalls_total',
  'process_io_storage_read_bytes_total',
  'process_io_storage_written_bytes_total',
  'process_pressure_cpu_waiting_seconds_total',
  'process_pressure_cpu_stalled_seconds_total',
  'process_pressure_io_waiting_seconds_total',
  'process_pressure_io_stalled_seconds_total',
  'process_pressure_memory_waiting_seconds_total',
  'process_pressure_memory_stalled_seconds_total'
]

export const usePrometheusStore = defineStore({
  id: "prometheus",

  state: () => ({
    currentQuery: '', 
    metricsData: [] as ChartSeries[], 
    metricNamesList: [... STATIC_METRICS] as string[], 
    loading: false,
    error: null as string | null,
    rangePreset: "last1h" as "last1h" | "last6h" | "last24h" | "last7d" | "custom",
    currentRange: { start: 0, end: 0 },
    customDateRange: { gte: null as string | null, lte: null as string | null },
  }),

  getters: {
    getChartSeries: (state) => state. metricsData,
    getSuggestions: (state) => (input: string): SuggestionItem[] => {
      if (!input || input.length < 1) return []
      const lower = input.toLowerCase()
      const allItems: SuggestionItem[] = [
        ... CONSTANT_SUGGESTIONS,
        ...state.metricNamesList.map(m => ({
          type: 'metric' as const,
          label: m,
          detail: 'Time series metric'
        }))
      ]

      const filtered = allItems.filter(item => 
        item.label.toLowerCase().includes(lower)
      )

      return filtered.sort((a, b) => {
        const aLabel = a.label.toLowerCase()
        const bLabel = b.label.toLowerCase()

        if (aLabel === lower && bLabel !== lower) return -1
        if (bLabel === lower && aLabel !== lower) return 1

        const aStarts = aLabel.startsWith(lower)
        const bStarts = bLabel.startsWith(lower)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1

        if (aLabel.length !== bLabel.length) {
          return aLabel.length - bLabel.length
        }

        return aLabel.localeCompare(bLabel)
      }). slice(0, 50)
    }
  },

  actions: {
    setQuery(query: string) {
      this.currentQuery = query
      this.fetchMetricsData()
    },

    setRange(preset: "last1h" | "last6h" | "last24h" | "last7d" | "custom") {
      this.rangePreset = preset
      if (preset !== 'custom') {
        this. customDateRange = { gte: null, lte: null }
      }
      this.fetchMetricsData()
    },

    async apiCall(path: string, params: Record<string, any> = {}, method: 'GET' | 'POST' = 'GET') {
      try {
        const response = await http.php('prometheus_proxy', { 
          path, 
          params: JSON.stringify(params), 
          method 
        })
        return response.data || response
      } catch (error: any) {
        throw new Error(error.message || 'API çağrısı başarısız')
      }
    },

    
    async fetchInstantQuery(query: string): Promise<any[]> {
      try {
        const res = await this.apiCall("api/v1/query", { query }, 'GET')
        const responseData = res.data || res
        
        if (responseData?. status === 'success' && responseData?. data?. result) {
          return responseData.data.result
        } else if (responseData?.result) {
          return responseData. result
        } else if (Array.isArray(responseData)) {
          return responseData
        }
        return []
      } catch (error: any) {
        console.error("Instant query error:", error)
        return []
      }
    },

    
    async fetchRangeQuery(
      query: string, 
      startTime?: number, 
      endTime?: number, 
      step?: number
    ): Promise<ChartSeries[]> {
      try {
        const now = Math.floor(Date.now() / 1000)
        let start = startTime || (now - 3600)
        let end = endTime || now
        let stepVal = step || 60

        
        if (! startTime) {
          switch (this.rangePreset) {
            case "last1h": 
              start = now - 3600
              stepVal = 15
              break
            case "last6h": 
              start = now - (6 * 3600)
              stepVal = 60
              break
            case "last24h": 
              start = now - (24 * 3600)
              stepVal = 300
              break
            case "last7d": 
              start = now - (7 * 24 * 3600)
              stepVal = 1800
              break
            case "custom":
              if (this.customDateRange. gte) {
                start = Math.floor(new Date(this.customDateRange. gte).getTime() / 1000)
              }
              if (this.customDateRange. lte) {
                end = Math.floor(new Date(this.customDateRange.lte). getTime() / 1000)
              }
              stepVal = Math.max(60, Math.floor((end - start) / 120))
              break
          }
        }

        const res = await this.apiCall("api/v1/query_range", {
          query,
          start,
          end,
          step: stepVal
        }, 'GET')

        const responseData = res.data || res
        let result = []
        
        if (responseData?.status === 'success' && responseData?.data?.result) {
          result = responseData. data.result
        } else if (responseData?.result) {
          result = responseData.result
        } else if (Array.isArray(responseData)) {
          result = responseData
        }

        if (Array.isArray(result) && result.length > 0) {
          return result. map((item: any) => {
            const labels = item.metric || {}
            let name = labels.sensor || labels.__name__ || 'Unknown'
            
            if (labels.role) name += ` (${labels.role})`
            else if (labels.job && labels.job !== 'isa') name += ` (${labels.job})`
            else if (labels.instance && ! labels.sensor) name += ` (${labels.instance})`
            
            if (labels.sensor) name = labels.sensor

            const dataPoints = (item.values || []).map((val: any) => [
              parseInt(val[0]) * 1000,
              parseFloat(val[1])
            ])

            return { name, data: dataPoints, labels }
          })
        }
        return []
      } catch (error: any) {
        console.error("Range query error:", error)
        return []
      }
    },

    
    async fetchPanelValue(query: string): Promise<number | null> {
      try {
        const result = await this.fetchInstantQuery(query)
        if (result && result.length > 0 && result[0].value) {
          return parseFloat(result[0].value[1])
        }
        return null
      } catch (error) {
        console.error("Panel value fetch error:", error)
        return null
      }
    },

    
    async fetchPanelChartData(query: string): Promise<ChartSeries[]> {
      return await this.fetchRangeQuery(query)
    },

    
    async fetchLabelValues(metricName: string, labelName: string): Promise<string[]> {
      try {
        const res = await this.apiCall(
          `api/v1/label/${labelName}/values`,
          { match: `${metricName}` },
          'GET'
        )
        
        const responseData = res.data || res
        if (responseData?.status === 'success' && Array.isArray(responseData?.data)) {
          return responseData. data
        } else if (Array.isArray(responseData)) {
          return responseData
        }
        return []
      } catch (error) {
        console. error("Label values fetch error:", error)
        return []
      }
    },

    async fetchAutocompleteDataOnInput() {
      if (this.metricNamesList.length > 200) return

      try {
        const response = await http.php('prometheus_proxy', {
          path: 'api/v1/label/__name__/values',
          params: JSON.stringify({}),
          method: 'GET'
        })

        let fetchedMetrics: string[] = []
        if (response && typeof response === 'object') {
          const data = (response as any)
          if (data. message?. data && Array.isArray(data.message. data)) {
            fetchedMetrics = data.message.data
          } else if (data.data && Array.isArray(data.data)) {
            fetchedMetrics = data.data
          } else if (Array.isArray(data)) {
            fetchedMetrics = data
          }
        }

        if (Array.isArray(fetchedMetrics) && fetchedMetrics.length > 0) {
          const uniqueMetrics = new Set([... STATIC_METRICS, ...fetchedMetrics])
          this.metricNamesList = Array.from(uniqueMetrics)
            .filter(s => s && s.trim() !== '')
            .sort()
        }

      } catch (e) {
        console.error("Autocomplete fetch error (Using static fallback):", e)
      }
    },

    async fetchMetricsData() {
      if (! this.currentQuery) return 

      this.loading = true
      this. error = null
      try {
        this.metricsData = await this.fetchRangeQuery(this.currentQuery)
        this.error = null
      } catch (e: any) {
        this.error = e.message || "Veri çekilemedi"
        this.metricsData = []
      } finally {
        this.loading = false
      }
    }
  }
})