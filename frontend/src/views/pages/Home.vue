<template>
  <div class="prometheus-container">
   
    <div class="prometheus-header">
      <div class="header-wrapper">
        <h1 class="header-title">
          <i class="fas fa-chart-line"></i>
          Prometheus Monitoring
        </h1>
        <button 
          class="btn-dashboard"
          @click="showDashboardModal = true"
          title="Dashboardlara git"
        >
          <i class="fas fa-th-large"></i>
          <span>Dashboardlar</span>
          <span class="badge-count">{{ dashboardStore.getAllDashboards. length }}</span>
        </button>
      </div>
    </div>

    
    <div class="prometheus-content">
      <div class="query-section">
        <div class="query-input-wrapper">
          <span class="query-icon">&gt;_</span>
          <div class="input-container">
            <input 
              v-model="queryInput" 
              @keyup.enter="handleQuerySubmit" 
              @input="handleInput" 
              @focus="handleInput" 
              @blur="handleBlur" 
              type="text" 
              class="query-input" 
              placeholder="Prometheus sorgusu girin (Örn: mppt_values)" 
            />
            <div v-if="showSuggestions && filteredSuggestions.length > 0" class="autocomplete-dropdown">
              <ul>
                <li 
                  v-for="(suggestion, index) in filteredSuggestions" 
                  :key="index"
                  @mousedown. prevent="selectSuggestion(suggestion)"
                  class="suggestion-item"
                >
                  <div class="suggestion-left">
                    <span :class="['suggestion-badge', suggestion.type]">
                      {{ getBadgeLetter(suggestion.type) }}
                    </span>
                    <span class="suggestion-label">{{ suggestion.label }}</span>
                  </div>
                  <div class="suggestion-right">
                    <span class="suggestion-type">{{ suggestion.type }}</span>
                    <span v-if="suggestion.detail" class="suggestion-detail">{{ suggestion.detail }}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div class="history-container">
            <button class="btn-history" @click="showHistory = ! showHistory" title="Sorgu Geçmişi">
              <i class="fas fa-history"></i>
            </button>
            <div v-if="showHistory" class="history-dropdown">
              <div class="history-header">
                <span>Son Aramalar</span>
                <button @click="clearHistory" class="clear-btn">Temizle</button>
              </div>
              <ul v-if="queryHistory.length > 0">
                <li v-for="(q, index) in queryHistory" :key="index" @click="selectHistory(q)">
                  {{ q }}
                </li>
              </ul>
              <div v-else class="history-empty">Geçmiş boş</div>
            </div>
          </div>

          <button class="btn-execute" @click="handleQuerySubmit" :disabled="store.loading">
            <i class="fas fa-play" style="margin-right: 5px;"></i> Çalıştır
          </button>
        </div>
      </div>

      <div class="filters-container" v-if="store.getChartSeries.length > 0">
        <div class="filters-header">
          <div class="filters-title">
            <i class="fas fa-filter"></i> Sonuçları Filtrele
          </div>
          <button @click="addFilter" class="btn-add-filter">
            <i class="fas fa-plus"></i> Filtre Ekle
          </button>
          <button v-if="activeFilters.length > 0" @click="activeFilters = []" class="btn-clear-all">
            Temizle
          </button>
        </div>

        <div class="active-filters-list" v-if="activeFilters. length > 0">
          <div v-for="(filter, idx) in activeFilters" :key="idx" class="filter-row">
            <select v-model="filter.key" class="filter-select key-select">
              <option :value="null" disabled>Etiket Seçin</option>
              <option v-for="key in availableLabelKeys" :key="key" :value="key">{{ key }}</option>
            </select>

            <span class="filter-separator">=</span>

            <select v-model="filter.value" class="filter-select value-select" :disabled="! filter.key">
              <option :value="null" disabled>Değer Seçin</option>
              <option v-for="val in getLabelValues(filter.key)" :key="val" :value="val">{{ val }}</option>
            </select>

            <button @click="removeFilter(idx)" class="btn-remove-filter" title="Filtreyi Kaldır">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="stats-grid" v-if="finalFilteredSeries.length > 0">
        <div class="stat-card">
          <div class="stat-icon" style="background: #e0f2fe; color: #0284c7;">
            <i class="fas fa-layer-group"></i>
          </div>
          <div class="stat-info">
            <span class="stat-label">Toplam Seri</span>
            <span class="stat-value">{{ finalFilteredSeries.length }}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #fee2e2; color: #dc2626;">
            <i class="fas fa-arrow-up"></i>
          </div>
          <div class="stat-info">
            <span class="stat-label">En Yüksek Değer</span>
            <span class="stat-value">{{ globalMax.value }}</span>
            <span class="stat-subtext" v-if="globalMax.name" :title="globalMax.name">{{ globalMax.name }}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #dcfce7; color: #16a34a;">
            <i class="fas fa-arrow-down"></i>
          </div>
          <div class="stat-info">
            <span class="stat-label">En Düşük Değer</span>
            <span class="stat-value">{{ globalMin.value }}</span>
            <span class="stat-subtext" v-if="globalMin.name" :title="globalMin.name">{{ globalMin.name }}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #f3f4f6; color: #4b5563;">
            <i class="fas fa-clock"></i>
          </div>
          <div class="stat-info">
            <span class="stat-label">Son Güncelleme</span>
            <span class="stat-value" style="font-size: 16px;">{{ lastUpdateTime }}</span>
          </div>
        </div>
      </div>

      <div class="toolbar-section">
        <div class="toolbar-group">
          <button 
            v-for="preset in timePresets" 
            :key="preset.value"
            class="time-btn"
            :class="{ active: store.rangePreset === preset.value }"
            @click="handleTimePresetClick(preset.value)">
            {{ preset.label }}
          </button>
        </div>

        <div class="custom-date-picker">
          <div class="date-input-group">
            <label>Başlangıç:</label>
            <input v-model="customStartDate" type="datetime-local" class="date-input" />
          </div>
          <div class="date-input-group">
            <label>Bitiş:</label>
            <input v-model="customEndDate" type="datetime-local" class="date-input" />
          </div>
          <button class="btn-apply-dates" @click="applyCustomDateRange" title="Uygula">
            <i class="fas fa-check"></i>
          </button>
          <button class="btn-reset-dates" @click="resetDateRange" title="Sıfırla">
            <i class="fas fa-redo"></i>
          </button>
        </div>

        <div class="toolbar-actions">
          <div class="refresh-control">
            <select v-model="refreshRate" @change="handleRefreshChange" class="refresh-select">
              <option :value="0">Yenileme: Kapalı</option>
              <option :value="10000">10 Saniye</option>
              <option :value="30000">30 Saniye</option>
              <option :value="60000">1 Dakika</option>
              <option :value="300000">5 Dakika</option>
            </select>
          </div>

          <button class="action-btn" @click="downloadCSV" title="CSV Olarak İndir" :disabled="store.getChartSeries.length === 0">
            <i class="fas fa-download"></i>
          </button>

          <button class="action-btn" @click="refreshData" :disabled="store.loading" title="Şimdi Yenile">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': store.loading }"></i>
          </button>
        </div>
      </div>

      <div v-if="store.error" class="error-alert">
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <h4>Sorgu Hatası</h4>
          <p>{{ store.error }}</p>
        </div>
      </div>

      <div v-if="store.loading" class="loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Veriler getiriliyor...</p>
      </div>

      <div v-else class="charts-section">
        <div class="chart-card main-chart-card">
          <div class="chart-header">
            <h3>Metrik Zaman Serisi</h3>
            <div class="chart-type-switcher">
              <button :class="{ active: chartType === 'line' }" @click="chartType = 'line'" title="Çizgi Grafik">
                <i class="fas fa-chart-line"></i>
              </button>
              <button :class="{ active: chartType === 'area' }" @click="chartType = 'area'" title="Alan Grafik">
                <i class="fas fa-chart-area"></i>
              </button>
              <button :class="{ active: chartType === 'bar' }" @click="chartType = 'bar'" title="Çubuk Grafik">
                <i class="fas fa-chart-bar"></i>
              </button>
            </div>
          </div>

          <div class="chart-body">
            <apexchart
              v-if="finalFilteredSeries.length > 0"
              :type="chartType"
              height="500"
              :options="chartOptions"
              :series="displayedSeries"
            />
            <div v-else class="chart-empty">
              <i class="fas fa-search"></i>
              <p v-if="store.getChartSeries.length > 0">Seçilen filtrelere uygun veri bulunamadı.</p>
              <p v-else>Veri görüntülemek için yukarıya bir sorgu girin ve 'Çalıştır'a basın.</p>
            </div>
          </div>

          <div v-if="finalFilteredSeries.length > 0" class="table-legend">
            <table class="legend-table">
              <thead>
                <tr>
                  <th class="col-color"></th>
                  <th class="col-metric">Etiketler (Labels)</th>
                  <th class="col-value">Son Değer</th>
                  <th class="col-min">Min</th>
                  <th class="col-max">Max</th>
                  <th class="col-avg">Ortalama</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(series, idx) in finalFilteredSeries" 
                  :key="idx" 
                  class="legend-row"
                  :class="{ 
                    'dimmed-row': focusedSeriesIndex !== null && focusedSeriesIndex !== idx,
                    'active-row': focusedSeriesIndex === idx
                  }"
                  @click="toggleSeriesFocus(idx)"
                  title="Sadece bu grafiği görmek için tıklayın"
                >
                  <td class="col-color">
                    <span class="legend-dot" :style="{ backgroundColor: getColor(idx) }"></span>
                  </td>
                  <td class="col-metric">{{ generatePrometheusString(series) }}</td>
                  <td class="col-value">{{ getLastValue(series) }}</td>
                  <td class="col-min">{{ getMinValue(series) }}</td>
                  <td class="col-max">{{ getMaxValue(series) }}</td>
                  <td class="col-avg">{{ getAvgValue(series) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- DASHBOARD MODAL -->
    <dashboards-modal 
      :is-open="showDashboardModal"
      @close="showDashboardModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePrometheusStore, type SuggestionItem } from '@/stores/prometheus'
import { useDashboardStore } from '@/stores/dashboardStore'
import VueApexCharts from 'vue3-apexcharts'
import DashboardsModal from '@/views/pages/DashboardsModal.vue'

const apexchart = VueApexCharts
const store = usePrometheusStore()
const dashboardStore = useDashboardStore()

const queryInput = ref(store.currentQuery) 
const customStartDate = ref<string>('')
const customEndDate = ref<string>('')
const refreshRate = ref(60000) 
const lastUpdateTime = ref<string>('-')
const chartType = ref<'line' | 'area' | 'bar'>('line') 

const showHistory = ref(false)
const showSuggestions = ref(false)
const showDashboardModal = ref(false)
const queryHistory = ref<string[]>([])
const filteredSuggestions = ref<SuggestionItem[]>([])

const focusedSeriesIndex = ref<number | null>(null)

interface FilterItem {
  key: string | null
  value: string | null
}
const activeFilters = ref<FilterItem[]>([])

let interval: any = null

const timePresets = [
  { label: '1 Saat', value: 'last1h' as const },
  { label: '6 Saat', value: 'last6h' as const },
  { label: '24 Saat', value: 'last24h' as const },
  { label: '7 Gün', value: 'last7d' as const }
]

const palette = [
  '#FF5733', '#27AE60', '#2E86DE', '#E74C3C', '#3498DB', '#8E44AD', '#F39C12', '#1ABC9C',
  '#C0392B', '#16A085', '#D35400', '#7F8C8D', '#2C3E50', '#8E44AD', '#2980B9'
]
const getColor = (idx: number) => palette[idx % palette.length]

const availableLabelKeys = computed(() => {
  const keys = new Set<string>()
  store.getChartSeries.forEach(s => {
    if (s. labels) {
      Object.keys(s.labels).forEach(k => {
        if (k !== '__name__') keys.add(k)
      })
    }
  })
  return Array.from(keys). sort()
})

const getLabelValues = (key: string | null) => {
  if (!key) return []
  const values = new Set<string>()
  store.getChartSeries.forEach(s => {
    if (s.labels && s.labels[key]) {
      values.add(s.labels[key])
    }
  })
  return Array.from(values). sort()
}

const addFilter = () => {
  activeFilters.value.push({ key: null, value: null })
}

const removeFilter = (index: number) => {
  activeFilters.value.splice(index, 1)
}

const finalFilteredSeries = computed(() => {
  if (activeFilters.value.length === 0) return store.getChartSeries

  return store.getChartSeries. filter(series => {
    const labels = series.labels || {}
    for (const filter of activeFilters.value) {
      if (! filter.key || ! filter.value) continue
      if (labels[filter.key] !== filter.value) {
        return false
      }
    }
    return true
  })
})

const toggleSeriesFocus = (index: number) => {
  if (focusedSeriesIndex. value === index) {
    focusedSeriesIndex.value = null 
  } else {
    focusedSeriesIndex.value = index 
  }
}

const displayedSeries = computed(() => {
  const filtered = finalFilteredSeries.value

  if (focusedSeriesIndex.value !== null && filtered[focusedSeriesIndex.value]) {
    return [filtered[focusedSeriesIndex.value]]
  }
  return filtered
})

const globalMax = computed(() => {
  if (finalFilteredSeries. value.length === 0) return { value: '-', name: '' }
  let max = -Infinity; let name = ''
  finalFilteredSeries.value.forEach(s => {
    s.data.forEach(p => { 
      if (p[1] > max) { max = p[1]; name = s.name }
    })
  })
  return max === -Infinity ? { value: '-', name: '' } : { value: max. toFixed(2), name: name }
})

const globalMin = computed(() => {
  if (finalFilteredSeries.value. length === 0) return { value: '-', name: '' }
  let min = Infinity; let name = ''
  finalFilteredSeries.value.forEach(s => {
    s.data. forEach(p => { 
      if (p[1] < min) { min = p[1]; name = s.name }
    })
  })
  return min === Infinity ? { value: '-', name: '' } : { value: min.toFixed(2), name: name }
})

const handleQuerySubmit = () => {
  if (queryInput.value.trim()) {
    store.setQuery(queryInput.value)
    addToHistory(queryInput.value) 
    updateLastTime()
    showHistory. value = false
    showSuggestions. value = false
    focusedSeriesIndex.value = null 
    activeFilters.value = []
  }
}

const handleInput = async () => {
  const input = queryInput.value.trim()
  if (input. length > 0) {
    await store.fetchAutocompleteDataOnInput()
    filteredSuggestions.value = store.getSuggestions(input)
    showSuggestions.value = true
  } else {
    filteredSuggestions.value = []
    showSuggestions.value = false
  }
}

const selectSuggestion = (suggestion: SuggestionItem) => {
  queryInput.value = suggestion.label
  showSuggestions.value = false
}

const getBadgeLetter = (type: string) => {
  if (type === 'metric') return 'M'
  if (type === 'function') return 'F'
  if (type === 'aggregation') return 'A'
  return '?'
}

const handleBlur = () => {
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

const addToHistory = (query: string) => {
  queryHistory.value = queryHistory.value.filter(q => q !== query)
  queryHistory.value.unshift(query)
  if (queryHistory.value.length > 10) queryHistory.value.pop()
  localStorage.setItem('prom_query_history', JSON.stringify(queryHistory.value))
}

const loadHistory = () => {
  const saved = localStorage.getItem('prom_query_history')
  if (saved) {
    try { queryHistory.value = JSON.parse(saved) } catch(e) {}
  }
}

const selectHistory = (query: string) => {
  queryInput.value = query
  handleQuerySubmit()
}

const clearHistory = () => {
  queryHistory.value = []
  localStorage. removeItem('prom_query_history')
}

const refreshData = async () => {
  if (! store.currentQuery) return
  await store.fetchMetricsData()
  updateLastTime()
}

const updateLastTime = () => {
  lastUpdateTime.value = new Date().toLocaleTimeString('tr-TR')
}

const handleRefreshChange = () => {
  if (interval) clearInterval(interval)
  if (refreshRate.value > 0) {
    interval = setInterval(() => { if (! store.loading) refreshData() }, refreshRate. value)
  }
}

const downloadCSV = () => {
  const seriesList = finalFilteredSeries.value
  if (seriesList.length === 0) return
  let csvContent = "\uFEFF"; 
  csvContent += "Tarih,Metrik Adı,Etiketler,Değer\n";
  seriesList.forEach(series => {
    const labelsStr = series.labels ?  Object.entries(series.labels).filter(([k]) => k !== '__name__').map(([k, v]) => `${k}=${v}`).join('; ') : '';
    series.data.forEach(point => {
      const date = new Date(point[0]). toLocaleString('tr-TR');
      csvContent += `"${date}","${series.name}","${labelsStr}",${point[1]}\n`;
    });
  });
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `prometheus_export_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}

const initCustomDates = () => {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  customStartDate.value = oneHourAgo.toISOString(). slice(0, 16)
  customEndDate.value = now.toISOString(). slice(0, 16)
}

const handleTimePresetClick = (preset: string) => {
  store.setRange(preset as any)
  initCustomDates()
}

const applyCustomDateRange = () => {
  if (! customStartDate.value) { alert('Başlangıç tarihi seçiniz'); return }
  const s = new Date(customStartDate. value). toISOString()
  const e = customEndDate.value ? new Date(customEndDate.value).toISOString() : new Date().toISOString()
  store.rangePreset = 'custom' as any
  store.customDateRange = { gte: s, lte: e }
  store.fetchMetricsData()
}

const resetDateRange = () => {
  initCustomDates()
  store.setRange('last1h')
}

const getLastValue = (s: any) => s.data. length ?  s.data[s.data. length-1][1]. toFixed(2) : '-'
const getMinValue = (s: any) => s.data.length ? Math.min(...s.data.map((d:any)=>d[1])). toFixed(2) : '-'
const getMaxValue = (s: any) => s.data. length ? Math.max(...s. data.map((d:any)=>d[1])).toFixed(2) : '-'
const getAvgValue = (s: any) => {
  if(! s.data.length) return '-'
  const sum = s.data.reduce((a:number,b:any)=>a+b[1],0)
  return (sum/s.data.length).toFixed(2)
}

const generatePrometheusString = (series: any) => {
  if (!series.labels) return series.name
  const labels = Object.entries(series. labels).filter(([k]) => k !== '__name__').map(([k, v]) => `${k}="${v}"`).join(', ')
  return series.name + (labels ? `{${labels}}` : '')
}

const chartOptions = computed(() => {
  const dynamicColors = focusedSeriesIndex.value !== null 
    ? [getColor(focusedSeriesIndex.value)] 
    : finalFilteredSeries.value.map((_, i) => getColor(i))

  return {
    chart: {
      type: chartType. value, 
      fontFamily: 'Inter, sans-serif',
      animations: { enabled: false },
      toolbar: { show: true },
      zoom: { enabled: true }
    },
    stroke: { 
      width: chartType.value === 'bar' ? 0 : 2, 
      curve: 'smooth' as const 
    }, 
    colors: dynamicColors,
    markers: { size: chartType.value === 'line' ? 3 : 0, strokeWidth: 0, hover: { size: 6 } }, 
    xaxis: {
      type: 'datetime' as const,
      min: store.currentRange.start || undefined,
      max: store.currentRange.end || undefined,
      tooltip: { enabled: false },
      labels: { 
        datetimeUTC: false,
        formatter: (value: string, timestamp?: number) => {
          if (! timestamp) return value
          const date = new Date(timestamp)
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date. getMinutes()).padStart(2, '0')
          return `${hours}:${minutes}`
        }
      }
    },
    yaxis: {
      labels: { formatter: (val: number) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toFixed(0) }
    },
    legend: { show: false },
    grid: {
      borderColor: '#e5e7eb',
      padding: { left: 20, right: 40, top: 10, bottom: 10 }
    },
    fill: { 
      type: chartType.value === 'area' ? 'gradient' : 'solid', 
      opacity: chartType.value === 'area' ? 0.3 : 1 
    },
    tooltip: {
      enabled: true,
      shared: false,
      intersect: false,
      custom: function({ series, seriesIndex, dataPointIndex, w }: any) {
        const d = displayedSeries. value[seriesIndex]
        if (!d) return ''
        const val = series[seriesIndex][dataPointIndex]
        const timestamp = w.globals.seriesX[seriesIndex][dataPointIndex]
        const date = new Date(timestamp). toLocaleString('tr-TR')
        const color = w.config.colors[seriesIndex]
        let labelHtml = ''
        if (d.labels) {
          Object.entries(d.labels).forEach(([k, v]) => {
            if(k !== '__name__') {
              labelHtml += `<div class="tooltip-label"><span class="t-key">${k}:</span> <span class="t-val">${v}</span></div>`
            }
          })
        }
        return `
          <div class="prom-tooltip">
            <div class="tooltip-header">${date}</div>
            <div class="tooltip-body">
              <div class="tooltip-metric-line">
                <span class="tooltip-color" style="background-color: ${color}"></span>
                <span class="tooltip-name">${d.name}:</span>
                <span class="tooltip-value">${typeof val === 'number' ? val.toFixed(2) : val}</span>
              </div>
              <div class="tooltip-labels">${labelHtml}</div>
            </div>
          </div>
        `
      }
    }
  }
})

onMounted(async () => {
  initCustomDates()
  loadHistory() 
  dashboardStore.initializeDashboards()
  if (store.currentQuery && store.currentQuery.trim() !== '') {
    await refreshData()
  }
  handleRefreshChange() 
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<style scoped>
.prometheus-container { 
  display: flex; 
  flex-direction: column; 
  background: #f3f4f6; 
  height: 100%; 
}

.prometheus-header { 
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%); 
  color: white; 
  padding: 20px; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
}

.header-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.header-title { 
  font-size: 24px; 
  display: flex; 
  gap: 10px; 
  align-items: center; 
  margin: 0;
  flex: 1;
}

.btn-dashboard {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
  white-space: nowrap;
}

.btn-dashboard:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.btn-dashboard:active {
  transform: translateY(0);
}

.badge-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  min-width: 24px;
  text-align: center;
}

.prometheus-content { 
  padding: 20px; 
  flex: 1; 
  overflow-y: auto; 
  display: flex; 
  flex-direction: column; 
  gap: 20px; 
}

.query-section { 
  margin-bottom: 0; 
  position: relative; 
  z-index: 50; 
}

.query-input-wrapper { 
  display: flex; 
  background: white; 
  border: 1px solid #d1d5db; 
  border-radius: 6px; 
  overflow: visible; 
  box-shadow: 0 1px 3px rgba(0,0,0,0.05); 
}

.query-icon { 
  background: #f9fafb; 
  padding: 12px 16px; 
  color: #6b7280; 
  font-family: monospace; 
  font-weight: bold; 
  border-right: 1px solid #d1d5db; 
  display: flex; 
  align-items: center; 
  user-select: none; 
}

.input-container { 
  flex: 1; 
  position: relative; 
}

.query-input { 
  width: 100%; 
  border: none; 
  padding: 12px 16px; 
  font-family: 'Consolas', monospace; 
  font-size: 14px; 
  color: #1f2937; 
  outline: none; 
  background: transparent; 
}


.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1f2937; 
  border: 1px solid #374151;
  border-top: none;
  border-radius: 0 0 6px 6px;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.autocomplete-dropdown ul { 
  list-style: none; 
  margin: 0; 
  padding: 0; 
}

.suggestion-item { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 8px 12px; 
  border-bottom: 1px solid #374151; 
  cursor: pointer; 
  transition: background 0.1s; 
}

.suggestion-item:last-child { 
  border-bottom: none; 
}

.suggestion-item:hover { 
  background-color: #374151; 
}

.suggestion-left { 
  display: flex; 
  align-items: center; 
  gap: 10px; 
}

.suggestion-badge { 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  width: 20px; 
  height: 20px; 
  border-radius: 4px; 
  font-size: 11px; 
  font-weight: bold; 
  color: white; 
}

.suggestion-badge.metric { 
  background-color: #3b82f6; 
}

.suggestion-badge.function { 
  background-color: #10b981; 
}

.suggestion-badge.aggregation { 
  background-color: #f59e0b; 
}

.suggestion-label { 
  font-family: 'Consolas', 'Monaco', monospace; 
  font-size: 13px; 
  color: #e5e7eb; 
  font-weight: 500; 
}

.suggestion-right { 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  font-size: 11px; 
}

.suggestion-type { 
  color: #9ca3af; 
  font-style: italic; 
  text-transform: capitalize; 
}

.suggestion-detail { 
  color: #6b7280; 
  max-width: 200px; 
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  display: none; 
}

@media (min-width: 768px) { 
  .suggestion-detail { 
    display: block; 
  } 
}


.filters-container {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 15px;
  margin-bottom: 5px;
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.filters-title {
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-add-filter {
  background: #eff6ff;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-add-filter:hover { 
  background: #dbeafe; 
}

.btn-clear-all {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}

.btn-clear-all:hover { 
  color: #6b7280; 
}

.active-filters-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f9fafb;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid #f3f4f6;
}

.filter-select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  color: #1f2937;
  outline: none;
  cursor: pointer;
}

.key-select { 
  min-width: 120px; 
  font-weight: 600; 
  background: #fff; 
}

.value-select { 
  min-width: 150px; 
  flex: 1; 
  background: #fff; 
}

.filter-separator { 
  color: #9ca3af; 
  font-weight: bold; 
}

.btn-remove-filter {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-remove-filter:hover { 
  background: #fee2e2; 
}

.btn-execute { 
  background: #3b82f6; 
  color: white; 
  border: none; 
  padding: 0 24px; 
  font-weight: 600; 
  cursor: pointer; 
  transition: background 0.2s; 
  display: flex; 
  align-items: center; 
  border-radius: 0 6px 6px 0; 
}

.btn-execute:hover { 
  background: #2563eb; 
}

.btn-execute:disabled { 
  background: #93c5fd; 
  cursor: not-allowed; 
}

.history-container { 
  position: relative; 
  border-left: 1px solid #d1d5db; 
}

.btn-history { 
  background: #fff; 
  border: none; 
  padding: 0 16px; 
  height: 100%; 
  cursor: pointer; 
  color: #6b7280; 
  transition: color 0.2s; 
}

.btn-history:hover { 
  color: #3b82f6; 
  background: #f9fafb; 
}

.history-dropdown { 
  position: absolute; 
  top: 100%; 
  right: 0; 
  width: 300px; 
  background: white; 
  border: 1px solid #e5e7eb; 
  border-radius: 6px; 
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); 
  margin-top: 8px; 
  z-index: 100; 
  overflow: hidden; 
}

.history-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 8px 12px; 
  background: #f9fafb; 
  border-bottom: 1px solid #e5e7eb; 
  font-size: 12px; 
  font-weight: 600; 
  color: #6b7280; 
}

.clear-btn { 
  background: none; 
  border: none; 
  color: #ef4444; 
  cursor: pointer; 
  font-size: 11px; 
}

.clear-btn:hover { 
  text-decoration: underline; 
}

.history-dropdown ul { 
  list-style: none; 
  margin: 0; 
  padding: 0; 
  max-height: 200px; 
  overflow-y: auto; 
}

.history-dropdown li { 
  padding: 8px 12px; 
  font-family: 'Consolas', monospace; 
  font-size: 12px; 
  color: #374151; 
  cursor: pointer; 
  border-bottom: 1px solid #f3f4f6; 
}

.history-dropdown li:hover { 
  background: #f3f4f6; 
  color: #3b82f6; 
}

.history-empty { 
  padding: 12px; 
  text-align: center; 
  color: #9ca3af; 
  font-size: 12px; 
}

.stats-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
  gap: 16px; 
  margin-bottom: 0; 
}

.stat-card { 
  background: white; 
  border: 1px solid #e5e7eb; 
  border-radius: 8px; 
  padding: 16px; 
  display: flex; 
  align-items: center; 
  gap: 16px; 
  box-shadow: 0 1px 2px rgba(0,0,0,0.05); 
  transition: transform 0.2s; 
}

.stat-card:hover { 
  transform: translateY(-2px); 
  box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
}

.stat-icon { 
  width: 48px; 
  height: 48px; 
  border-radius: 12px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  font-size: 20px; 
  flex-shrink: 0; 
}

.stat-info { 
  display: flex; 
  flex-direction: column; 
  overflow: hidden; 
}

.stat-label { 
  font-size: 12px; 
  color: #6b7280; 
  font-weight: 600; 
  text-transform: uppercase; 
  letter-spacing: 0.5px; 
}

.stat-value { 
  font-size: 20px; 
  font-weight: 700; 
  color: #1f2937; 
  margin-top: 2px; 
}

.stat-subtext { 
  font-size: 11px; 
  color: #6b7280; 
  margin-top: 2px; 
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  max-width: 150px; 
  display: block; 
}

.toolbar-section { 
  display: flex; 
  gap: 12px; 
  align-items: center; 
  flex-wrap: wrap; 
  background: white; 
  padding: 12px; 
  border-radius: 8px; 
  border: 1px solid #e5e7eb; 
}

.toolbar-group { 
  display: flex; 
  gap: 6px; 
}

.time-btn { 
  background: white; 
  border: 1px solid #d1d5db; 
  padding: 6px 12px; 
  border-radius: 4px; 
  cursor: pointer; 
  font-size: 13px; 
  color: #374151; 
  transition: all 0.2s; 
}

.time-btn:hover { 
  border-color: #3b82f6; 
  color: #3b82f6; 
}

.time-btn.active { 
  background: #3b82f6; 
  color: white; 
  border-color: #3b82f6; 
}

.custom-date-picker { 
  display: flex; 
  gap: 8px; 
  align-items: flex-end; 
  margin-left: auto; 
}

.date-input-group { 
  display: flex; 
  flex-direction: column; 
}

.date-input-group label { 
  font-size: 10px; 
  color: #6b7280; 
  margin-bottom: 2px; 
  font-weight: 600; 
}

.date-input { 
  border: 1px solid #d1d5db; 
  padding: 6px; 
  border-radius: 4px; 
  font-size: 12px; 
  color: #374151; 
}

.btn-apply-dates, .btn-reset-dates { 
  width: 32px; 
  height: 32px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  border: 1px solid #d1d5db; 
  border-radius: 4px; 
  cursor: pointer; 
  background: #f9fafb; 
  color: #4b5563; 
  transition: all 0.2s; 
}

.btn-apply-dates:hover { 
  background: #10b981; 
  color: white; 
  border-color: #10b981; 
}

.btn-reset-dates:hover { 
  background: #6b7280; 
  color: white; 
  border-color: #6b7280; 
}

.toolbar-actions { 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  margin-left: 10px; 
  border-left: 1px solid #e5e7eb; 
  padding-left: 10px; 
}

.action-btn { 
  width: 32px; 
  height: 32px; 
  border: 1px solid #d1d5db; 
  border-radius: 4px; 
  background: white; 
  cursor: pointer; 
  color: #6b7280; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  transition: all 0.2s; 
}

.action-btn:hover { 
  border-color: #3b82f6; 
  color: #3b82f6; 
}

.refresh-select { 
  padding: 6px; 
  border: 1px solid #d1d5db; 
  border-radius: 4px; 
  font-size: 12px; 
  color: #374151; 
  background: #fff; 
  cursor: pointer; 
  outline: none; 
}

.refresh-select:hover { 
  border-color: #3b82f6; 
}

.charts-section { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  min-height: 0; 
}

.chart-card { 
  background: white; 
  border: 1px solid #e5e7eb; 
  border-radius: 8px; 
  box-shadow: 0 1px 3px rgba(0,0,0,0.05); 
  overflow: hidden; 
  display: flex; 
  flex-direction: column; 
}

.chart-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 10px 15px; 
  border-bottom: 1px solid #e5e7eb; 
}

.chart-header h3 { 
  margin: 0; 
  font-size: 16px; 
  color: #333; 
}

.chart-body { 
  padding: 10px; 
  border-bottom: 1px solid #e5e7eb; 
  position: relative; 
}

.chart-empty { 
  height: 300px; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  color: #9ca3af; 
  gap: 10px; 
  font-size: 16px; 
}

.chart-type-switcher { 
  display: flex; 
  gap: 4px; 
  background: #f3f4f6; 
  padding: 4px; 
  border-radius: 6px; 
}

.chart-type-switcher button { 
  border: none; 
  background: transparent; 
  padding: 4px 8px; 
  border-radius: 4px; 
  cursor: pointer; 
  color: #6b7280; 
  transition: all 0.2s; 
}

.chart-type-switcher button:hover { 
  color: #374151; 
  background: #e5e7eb; 
}

.chart-type-switcher button.active { 
  background: white; 
  color: #3b82f6; 
  box-shadow: 0 1px 2px rgba(0,0,0,0.1); 
  font-weight: bold; 
}

.loading-state { 
  padding: 40px; 
  text-align: center; 
  color: #6b7280; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  gap: 10px; 
}

.loading-state i { 
  font-size: 32px; 
  color: #3b82f6; 
}

.error-alert { 
  background-color: #fee2e2; 
  border: 1px solid #fca5a5; 
  padding: 12px; 
  border-radius: 6px; 
  color: #991b1b; 
  display: flex; 
  gap: 10px; 
  align-items: center; 
  margin-bottom: 20px; 
}

.error-alert h4 { 
  margin: 0; 
  font-weight: 600; 
  font-size: 14px; 
}

.error-alert p { 
  margin: 0; 
  font-size: 13px; 
}

.table-legend { 
  overflow-x: auto; 
  background: #f9fafb; 
}

.legend-table { 
  width: 100%; 
  border-collapse: collapse; 
  font-size: 12px; 
  white-space: nowrap; 
}

.legend-table th, .legend-table td { 
  padding: 10px 15px; 
  border-bottom: 1px solid #e5e7eb; 
  vertical-align: middle; 
}

.legend-table th { 
  background: #f3f4f6; 
  color: #4b5563; 
  font-weight: 600; 
  position: sticky; 
  top: 0; 
  z-index: 10; 
  text-align: left; 
}

.legend-table td { 
  color: #1f2937; 
}

.legend-row { 
  cursor: pointer; 
  transition: background-color 0.2s, opacity 0.2s; 
}

.legend-row:hover { 
  background-color: #eff6ff; 
}

.active-row { 
  background-color: #dbeafe ! important; 
  border-left: 3px solid #3b82f6; 
}

.dimmed-row { 
  opacity: 0.4; 
}

.dimmed-row:hover { 
  opacity: 0.8; 
}

.legend-table th.col-value, .legend-table td.col-value, 
.legend-table th.col-min, .legend-table td.col-min, 
.legend-table th.col-max, .legend-table td.col-max, 
.legend-table th.col-avg, .legend-table td.col-avg { 
  text-align: right; 
  font-family: 'Consolas', monospace; 
}

.col-metric { 
  width: 40%; 
  max-width: 300px; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  text-align: left; 
}

.col-color { 
  width: 30px; 
  text-align: center; 
}

.legend-dot { 
  display: inline-block; 
  width: 10px; 
  height: 10px; 
  border-radius: 50%; 
  vertical-align: middle; 
}

:deep(.prom-tooltip) { 
  background-color: #111827; 
  color: #f3f4f6; 
  border: 1px solid #374151; 
  border-radius: 4px; 
  padding: 8px; 
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); 
  font-family: 'Inter', sans-serif; 
  min-width: 200px; 
  pointer-events: none; 
  z-index: 9999; 
}

:deep(.tooltip-header) { 
  font-size: 11px; 
  color: #9ca3af; 
  margin-bottom: 6px; 
  border-bottom: 1px solid #374151; 
  padding-bottom: 4px; 
}

:deep(.tooltip-metric-line) { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
  font-weight: bold; 
  font-size: 13px; 
  margin-bottom: 8px; 
}

:deep(.tooltip-color) { 
  width: 8px; 
  height: 8px; 
  display: inline-block; 
  border-radius: 50%; 
}

:deep(.tooltip-labels) { 
  display: flex; 
  flex-direction: column; 
  gap: 3px; 
  font-size: 11px; 
}

:deep(.tooltip-label) { 
  color: #d1d5db; 
  display: flex; 
}

:deep(.t-key) { 
  color: #9ca3af; 
  margin-right: 6px; 
  min-width: 60px; 
}

:deep(.t-val) { 
  color: #60a5fa; 
}

@media (max-width: 768px) {
  .header-wrapper {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-dashboard {
    width: 100%;
    justify-content: center;
  }

  .custom-date-picker {
    flex-direction: column;
    width: 100%;
    margin-left: 0;
    margin-top: 10px;
  }

  .date-input-group {
    width: 100%;
  }

  .date-input {
    width: 100%;
  }
}
</style>