<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { usePrometheusStore } from '@/stores/prometheus'
import VueApexCharts from 'vue3-apexcharts'
import type { DashboardPanel } from '@/stores/dashboardStore'

const props = defineProps<{
  panel: DashboardPanel
  dashboardId: string
}>()

const emit = defineEmits<{
  update:  [panelId: string, updates:    Partial<DashboardPanel>]
  delete: [panelId: string]
  edit: [panelId: string]
}>()

const apexchart = VueApexCharts
const prometheusStore = usePrometheusStore()

// STATE
const showOptions = ref(false)
const showDataModal = ref(false)
const showInspectModal = ref(false)
const inspectModalType = ref<'data' | 'stats' | 'query' | 'json'>('json')
const activeSubmenu = ref<string | null>(null)
const showFullscreen = ref(false)
const panelData = ref<number | null>(null)
const panelChartData = ref<any[]>([])
const panelLoading = ref(false)
const panelError = ref<string | null>(null)
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)
const selectedCell = ref<any>(null)
const selectedCellIdx = ref<number | null>(null)
const selectedJob = ref<string>('mppt')
const availableJobs = ref<string[]>([])
const lastAlertType = ref<string | null>(null)

// ✅ ANALYTICS STATE - ApexCharts
const showAnalyticsModal = ref(false)
const analyticsTimeRange = ref('1w')
const analyticsStartDate = ref<string>('')
const analyticsEndDate = ref<string>('')
const analyticsChartData = ref<any[]>([])
const analyticsLoading = ref(false)
const analyticsChartOptions = ref<any>({})
const analyticsSeries = ref<any[]>([])


const thresholdEvents = ref<Array<{
  ts: number
  iso: string
  series?: string
  from?: string | undefined
  to: 'normal' | 'warning' | 'critical'
  value: number
}>>([])


const sidePanelExpanded = ref(false)

const toggleSidePanelSize = () => {
  sidePanelExpanded.value = !sidePanelExpanded.value
  
  nextTick(() => {
    const el = document.querySelector('.analytics-side-panel') as HTMLElement | null
    if (el) el.scrollTop = 0
  })
}

const showThresholdDetails = ref(false)

const toggleThresholdDetails = async () => {
  showThresholdDetails.value = !showThresholdDetails.value
  
  if (showThresholdDetails.value) {
    await nextTick()
    const el = document.querySelector('.analytics-threshold-details') as HTMLElement | null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const thresholdDurations = ref<{ normal: number; warning: number; critical: number }>({ normal: 0, warning: 0, critical: 0 }) // ms
const thresholdPercentages = ref<{ normal: number; warning: number; critical: number }>({ normal: 0, warning: 0, critical: 0 })
const totalDurationMs = ref<number>(0)
const eventsFilter = ref<'all' | 'normal' | 'warning' | 'critical'>('all')


const toMs = (t: number) => (t < 1e12 ? t * 1000 : t)


const getStatusForValue = (val: number, threshold: any): 'normal' | 'warning' | 'critical' => {
  if (!threshold) return 'normal'
  if (typeof threshold.critical === 'number' && val >= threshold.critical) return 'critical'
  if (typeof threshold.warning === 'number' && val >= threshold.warning) return 'warning'
  return 'normal'
}


const analyzeThresholds = (data: any[], threshold: any, startIso?: string, endIso?: string) => {
  const events: typeof thresholdEvents.value = []
  const durations = { normal: 0, warning: 0, critical: 0 }
  let globalStartMs = startIso ? new Date(startIso).getTime() : Number.POSITIVE_INFINITY
  let globalEndMs = endIso ? new Date(endIso).getTime() : 0

  
  data.forEach((s: any) => {
    if (s.data && s.data.length) {
      const first = toMs(s.data[0][0])
      const last = toMs(s.data[s.data.length - 1][0])
      if (first < globalStartMs) globalStartMs = first
      if (last > globalEndMs) globalEndMs = last
    }
  })

  if (!isFinite(globalStartMs) || globalEndMs <= globalStartMs) {
    totalDurationMs.value = 0
    thresholdEvents.value = []
    thresholdDurations.value = durations
    thresholdPercentages.value = { normal: 0, warning: 0, critical: 0 }
    return
  }

  totalDurationMs.value = globalEndMs - globalStartMs

  data.forEach((series: any) => {
    const name = series.name || series.metric?.__name__ || series.metric?.sensor || 'series'
    const arr = series.data || []
    if (!arr.length) return

    if (arr.length === 1) {
      const tMs = toMs(arr[0][0])
      const val = parseFloat(arr[0][1]) || 0
      const status = getStatusForValue(val, threshold)
      durations[status] += (globalEndMs - globalStartMs)
      events.push({ ts: tMs, iso: new Date(tMs).toISOString(), series: name, from: undefined, to: status, value: val })
      return
    }

    let prevStatus: 'normal' | 'warning' | 'critical' | null = null
    for (let i = 0; i < arr.length; i++) {
      const cur = arr[i]
      const next = arr[i + 1]
      const tCur = toMs(cur[0])
      const val = parseFloat(cur[1]) || 0
      const status = getStatusForValue(val, threshold)

      if (prevStatus === null) {
        events.push({ ts: tCur, iso: new Date(tCur).toISOString(), series: name, from: undefined, to: status, value: val })
      } else if (status !== prevStatus) {
        events.push({ ts: tCur, iso: new Date(tCur).toISOString(), series: name, from: prevStatus as any, to: status, value: val })
      }

      let dur = 0
      if (next) {
        const tNext = toMs(next[0])
        dur = Math.max(0, tNext - tCur)
      } else {
        dur = Math.max(0, globalEndMs - tCur)
      }
      durations[status] += dur
      prevStatus = status
    }
  })

  

  const total = Math.max(1, durations.normal + durations.warning + durations.critical)
  thresholdEvents.value = events.sort((a, b) => a.ts - b.ts)
  thresholdDurations.value = durations
  thresholdPercentages.value = {
    normal: Math.round((durations.normal / total) * 100),
    warning: Math.round((durations.warning / total) * 100),
    critical: Math.round((durations.critical / total) * 100)
  }
}


const exportEventsCSV = () => {
  if (!thresholdEvents.value.length) { alert('Export edilecek olay yok'); return }
  let csv = 'Timestamp(ms),ISO,Series,From,To,Value\n'
  thresholdEvents.value.forEach(e => {
    csv += `${e.ts},${e.iso},${e.series || ''},${e.from || ''},${e.to},${e.value}\n`
  })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.panel.title || 'panel'}-threshold-events-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}


watch(
  [() => analyticsChartData.value, () => props.panel.threshold, () => analyticsStartDate.value, () => analyticsEndDate.value],
  ([acd]) => {
    if (!acd || (Array.isArray(acd) && acd.length === 0)) {
      thresholdEvents.value = []
      thresholdDurations.value = { normal: 0, warning: 0, critical: 0 }
      thresholdPercentages.value = { normal: 0, warning: 0, critical: 0 }
      totalDurationMs.value = 0
      return
    }
    analyzeThresholds(acd, props.panel.threshold, analyticsStartDate.value, analyticsEndDate.value)
  },
  { immediate: true, deep: true }
)


// ✅ ZAMAN PRESETLERI
const timePresets = [
  { label: '1 Hafta', value: '1w' },
  { label: '1 Ay', value: '1m' },
  { label: '3 Ay', value: '3m' },
  { label: '6 Ay', value: '6m' }
]

const menuButtonRef = ref<HTMLElement | null>(null)
const menuPosition = ref<any>({ top: '0px', left: '0px' })

// Menu Toggle
const toggleMenu = () => {
  if (! showOptions.value && menuButtonRef.value) {
    const rect = menuButtonRef.value. getBoundingClientRect()
    menuPosition.value = {
      position: 'fixed',
      top: `${rect.bottom + 5}px`,
      left: `${rect.right - 240}px`,
      zIndex: '99999'
    }
  }
  showOptions.value = !showOptions.value
}

// MENU METHODS
const toggleSubmenu = (submenu: string) => { activeSubmenu.value = activeSubmenu.value === submenu ?  null : submenu }
const viewPanel = () => { showFullscreen.value = true; showOptions.value = false }
const closeFullscreen = () => { showFullscreen.value = false }
const editPanelAction = () => { console.log('✏️ Edit panel:', props.panel.title); emit('edit', props.panel.id); showOptions.value = false }
const copyPanelLink = () => { const link = `${window.location.origin}? panel=${props.panel.id}`; navigator.clipboard.writeText(link); console.log('📋 Panel linki kopyalandı:', link); showOptions.value = false }
const exportPanel = () => { const data = JSON.stringify(props.panel, null, 2); const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a. download = `${props.panel.title}-export.json`; a.click(); console.log('💾 Panel export edildi'); showOptions.value = false }

// VIEW DATA
const viewPanelData = () => {
  let hasData = false
  
  if (props.panel.type === 'chart' || props.panel.type === 'table' || props.panel.type === 'heatmap') {
    hasData = panelChartData.value && panelChartData.value. length > 0
  } else if (props.panel.type === 'stat' || props.panel.type === 'gauge' || props.panel.type === 'progress') {
    hasData = panelData.value !== null && panelData.value !== undefined
  }
  
  if (! hasData) {
    alert('Henüz veri yüklenmedi. Lütfen sorguyu çalıştırın!')
    return
  }
  
  showDataModal.value = true
  showOptions.value = false
  console.log('✅ Data Modal açıldı - Panel tipi:', props.panel.type)
}

// DOWNLOAD CSV
const downloadCSV = () => {
  if (props.panel.type === 'stat' || props.panel.type === 'gauge' || props.panel.type === 'progress') {
    if (panelData.value === null || panelData.value === undefined) {
      alert('İndirmek için veri yok!')
      return
    }

    let csv = 'Panel Adı,Değer,Birim,Zaman\n'
    csv += `"${props.panel.title}","${panelData.value}","${props.panel.unit || '-'}","${new Date().toLocaleString('tr-TR')}"\n`

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${props.panel.title}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    console.log('📥 CSV indirildi')
    showOptions.value = false
    alert('✅ CSV indirildi!')
    return
  }

  if (! panelChartData.value || panelChartData.value.length === 0) {
    alert('İndirmek için veri yok!')
    return
  }

  let csv = 'Metrik,Değer,Zaman,Birim\n'

  panelChartData.value.forEach((item:  any, idx: number) => {
    const name = item.metric?. sensor || item.metric?.__name__ || `Metrik ${idx + 1}`
    const value = item.value?.[1] ?  parseFloat(item.value[1]).toFixed(2) : '-'
    const timestamp = item.value?.[0] ? new Date(item.value[0] * 1000).toLocaleString('tr-TR') : '-'
    const unit = props.panel.unit || ''

    csv += `"${name}","${value}","${timestamp}","${unit}"\n`
  })

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document. createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${props.panel.title}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)

  console.log('📥 CSV indirildi')
  showOptions.value = false
  alert('✅ CSV indirildi!')
}

// SAVE AS IMAGE - MENU
const saveAsImageFromMenu = async () => {
  try {
    const panelContent = document.querySelector('.fullscreen-content') || document.querySelector('.panel-body')
    
    if (!panelContent) {
      alert('Panel bulunamadı!')
      return
    }

    const canvas = document.createElement('canvas')
    const width = 800
    const height = 600
    
    canvas.width = width
    canvas.height = height
    
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      alert('Canvas oluşturulamadı!')
      return
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 28px Arial'
    ctx.fillText(props.panel.title, 30, 50)

    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(30, 60)
    ctx.lineTo(width - 30, 60)
    ctx.stroke()

    ctx.fillStyle = getThresholdStatus. value. text
    ctx.font = 'bold 64px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(formatValue. value, width / 2, 200)

    ctx.fillStyle = '#64748b'
    ctx.font = '14px Arial'
    ctx.textAlign = 'left'
    
    const infoY = 280
    const lineHeight = 30

    ctx.fillText(`Panel Tipi: ${props.panel.type}`, 30, infoY)
    ctx.fillText(`Birim: ${props.panel.unit || 'N/A'}`, 30, infoY + lineHeight)
    ctx.fillText(`Sorgu:  ${props.panel.query. substring(0, 50)}...`, 30, infoY + lineHeight * 2)
    ctx.fillText(`Oluşturma Tarihi: ${new Date().toLocaleString('tr-TR')}`, 30, infoY + lineHeight * 3)

    ctx.fillStyle = getThresholdStatus.value.bg
    ctx.fillRect(30, infoY + lineHeight * 4 + 10, width - 60, 50)
    
    ctx.fillStyle = getThresholdStatus.value.text
    ctx.font = 'bold 16px Arial'
    ctx.fillText(`Status: ${getThresholdStatus. value.label}`, 40, infoY + lineHeight * 4 + 40)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Prometheus Monitoring System', width / 2, height - 20)

    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${props.panel.title}-${new Date().toISOString().slice(0, 19)}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)

        console.log('🖼️ Panel resim olarak kaydedildi')
        alert('✅ Panel resim olarak kaydedildi!')
        showOptions.value = false
      }
    })
  } catch (error) {
    console.error('Resim kaydetme hatası:', error)
    alert('❌ Resim kaydedilirken hata oluştu!')
  }
}

// SAVE AS IMAGE - DATA MODAL
const saveAsImage = async () => {
  try {
    const modalContent = document.querySelector('.data-modal-content') as HTMLElement
    
    if (! modalContent) {
      alert('Modal bulunamadı!')
      return
    }

    const canvas = document.createElement('canvas')
    const width = 800
    const height = 600
    
    canvas.width = width
    canvas.height = height
    
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      alert('Canvas oluşturulamadı!')
      return
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas. width, canvas.height)

    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 28px Arial'
    ctx.fillText(props.panel.title, 30, 50)

    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(30, 60)
    ctx.lineTo(width - 30, 60)
    ctx.stroke()

    ctx.fillStyle = getThresholdStatus. value.text
    ctx.font = 'bold 64px Arial'
    ctx.textAlign = 'center'
    ctx. fillText(formatValue.value, width / 2, 200)

    ctx.fillStyle = '#64748b'
    ctx. font = '14px Arial'
    ctx.textAlign = 'left'
    
    const infoY = 280
    const lineHeight = 30

    ctx.fillText(`Panel Tipi: ${props.panel.type}`, 30, infoY)
    ctx.fillText(`Birim: ${props.panel.unit || 'N/A'}`, 30, infoY + lineHeight)
    ctx.fillText(`Sorgu: ${props.panel.query. substring(0, 50)}...`, 30, infoY + lineHeight * 2)
    ctx.fillText(`Oluşturma Tarihi: ${new Date().toLocaleString('tr-TR')}`, 30, infoY + lineHeight * 3)

    ctx.fillStyle = getThresholdStatus. value.bg
    ctx.fillRect(30, infoY + lineHeight * 4 + 10, width - 60, 50)
    
    ctx.fillStyle = getThresholdStatus.value.text
    ctx. font = 'bold 16px Arial'
    ctx.fillText(`Status: ${getThresholdStatus.value.label}`, 40, infoY + lineHeight * 4 + 40)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx. fillText('Prometheus Monitoring System', width / 2, height - 20)

    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${props.panel.title}-${new Date().toISOString().slice(0, 19)}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)

        console.log('🖼️ Panel resim olarak kaydedildi')
        alert('✅ Panel resim olarak kaydedildi!')
        showOptions.value = false
      }
    })
  } catch (error) {
    console.error('Resim kaydetme hatası:', error)
    alert('❌ Resim kaydedilirken hata oluştu!')
  }
}

// ✅ INSPECT MODAL
const showPanelJSON = () => {
  inspectModalType.value = 'json'
  showInspectModal.value = true
  showOptions.value = false
}

const showQueryDetails = () => {
  inspectModalType.value = 'query'
  showInspectModal.value = true
  showOptions.value = false
}

const showPanelInfo = () => {
  inspectModalType.value = 'stats'
  showInspectModal.value = true
  showOptions.value = false
}

const copyToClipboard = () => {
  let text = ''
  if (inspectModalType.value === 'json') {
    text = JSON.stringify(props.panel, null, 2)
  } else if (inspectModalType.value === 'query') {
    text = props.panel.query
  } else if (inspectModalType.value === 'stats') {
    text = `ID: ${props.panel.id}\nType: ${props.panel. type}\nTitle: ${props.panel.title}\nUnit: ${props.panel.unit}`
  } else {
    text = JSON.stringify(panelData. value, null, 2)
  }
  
  navigator. clipboard.writeText(text)
  alert('✅ Kopyalandı!')
}


const calculateDateRange = (preset:  string) => {
  const now = new Date()
  let start = new Date()
  
  if (preset === '1w') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else if (preset === '1m') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  } else if (preset === '3m') {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  } else if (preset === '6m') {
    start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
  }
  
  analyticsStartDate.value = start.toISOString().slice(0, 16)
  analyticsEndDate. value = now.toISOString().slice(0, 16)
}


const selectAnalyticsTimeRange = (range: string) => {
  analyticsTimeRange. value = range
  const now = new Date()
  let start = new Date()
  
  console.log('🕐 NOW:', now.toLocaleString('tr-TR'))
  
  if (range === '1w') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    console.log('📅 1 HAFTA SEÇİLDİ')
  } else if (range === '1m') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    console.log('📅 1 AY SEÇİLDİ')
  } else if (range === '3m') {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    console.log('📅 3 AY SEÇİLDİ')
  } else if (range === '6m') {
    start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
    console.log('📅 6 AY SEÇİLDİ')
  }
  
  console.log('📅 START:', start.toLocaleString('tr-TR'))
  console.log('📅 START ISO:', start.toISOString().slice(0, 16))
  console.log('📅 END ISO:', now.toISOString().slice(0, 16))
  
  analyticsStartDate.value = start. toISOString().slice(0, 16)
  analyticsEndDate.value = now.toISOString().slice(0, 16)
  
  console.log('✅ analyticsStartDate. value:', analyticsStartDate.value)
  console.log('✅ analyticsEndDate.value:', analyticsEndDate.value)
  
  loadAnalyticsData()
}


const applyCustomAnalyticsDateRange = () => {
  if (! analyticsStartDate.value) {
    alert('Başlangıç tarihi seçiniz!')
    return
  }
  
  analyticsTimeRange.value = 'custom'
  loadAnalyticsData()
}


onMounted(async () => {
  console.log('📌 Panel mounted:', props.panel. title)
  
  await fetchPanelData()
  initAnalyticsDates()
  
  
  console.log('🧪 TEST: 1 Hafta seçiliyor...')
  selectAnalyticsTimeRange('1w')
  
  
})


const resetAnalyticsDateRange = () => {
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  analyticsStartDate.value = oneWeekAgo.toISOString().slice(0, 16)
  analyticsEndDate.value = now.toISOString().slice(0, 16)
  analyticsTimeRange.value = '1w'
  
  loadAnalyticsData()
}


const loadAnalyticsData = async () => {
  try {
    analyticsLoading.  value = true
    
    const startDate = new Date(analyticsStartDate. value)
    const endDate = new Date(analyticsEndDate. value)
    
    const start = Math.floor(startDate.getTime() / 1000)
    const end = Math.floor(endDate.getTime() / 1000)
    const step = Math.ceil((end - start) / 300)
    
    const query = props.panel. query
    
    console.log('📊 PROMETHEUS QUERY: ')
    console.log(`   Query: ${query}`)
    console.log(`   Start: ${start} = ${new Date(start*1000).toLocaleString('tr-TR')}`)
    console.log(`   End: ${end} = ${new Date(end*1000).toLocaleString('tr-TR')}`)
    console.log(`   Step: ${step}`)
    console.log(`   Fark: ${(end-start)/3600} saat`)
    
    // ✅ QUERY STRİNGİ KONTROL ET
    const expectedQueryString = `${query}&start=${start}&end=${end}&step=${step}`
    console.log('📍 Full query string:', expectedQueryString)
    
    const result = await prometheusStore.fetchRangeQuery(query, start, end, step)
    
    if (result && result.length > 0) {
      const firstData = result[0]. data[0]
      const lastData = result[0].data[result[0].data.length - 1]
      
      console.log('✅ Gelen veri: ')
      console.log('   İlk timestamp:', firstData[0], '=', new Date(firstData[0]).toLocaleString('tr-TR'))
      console.log('   Son timestamp:', lastData[0], '=', new Date(lastData[0]).toLocaleString('tr-TR'))
      console.log('   Toplam nokta:', result[0].data.length)
      
      // ✅ RANGE KONTROL
      const minTime = new Date(startDate).getTime()
      const maxTime = new Date(endDate).getTime()
      const firstTime = firstData[0]
      const lastTime = lastData[0]
      
      if (firstTime < minTime || lastTime > maxTime) {
        console.warn('⚠️ UYARI: Gelen veri, istenen aralığın dışında!')
        console.warn(`   İstenen:  ${minTime} - ${maxTime}`)
        console.warn(`   Gelen: ${firstTime} - ${lastTime}`)
      }
      
      analyticsChartData.value = result
      await nextTick()
      buildAnalyticsChart()
    } else {
      analyticsChartData.value = []
      analyticsSeries.value = []
    }
  } catch (error) {
    console.error('❌ Analytics veri hatası:', error)
    analyticsChartData.value = []
  } finally {
    analyticsLoading. value = false
  }
}


const buildAnalyticsChart = () => {
  if (analyticsChartData.  value.   length === 0) return
  
  const threshold = props.panel.threshold
  
  
  const minInputDate = new Date(analyticsStartDate.value)
  const maxInputDate = new Date(analyticsEndDate. value)

   console.log('🔍 Panel:', props.panel.title)
  console.log('   Threshold:', threshold)
  console.log('   Warning:', threshold?. warning)
  console.log('   Critical:', threshold?. critical)
  
  const series = analyticsChartData.value.map((s:  any) => ({
    name: s. name,
    data: s. data.map((p: any) => {
      const value = parseFloat(p[1])
      
      let color = '#3b82f6'
      if (threshold) {
        if (value >= threshold.  critical) {
          color = '#dc2626'
        } else if (value >= threshold.  warning) {
          color = '#f59e0b'
        }
      }
      
      
      let timestamp = typeof p[0] === 'string' ?   parseInt(p[0]) : p[0]
      
      
      if (timestamp < 100000000000) {
        timestamp = timestamp * 1000
      }
      
      return {
        x: new Date(timestamp),
        y: value,
        fillColor: color,
        strokeColor: color
      }
    })
  }))
  
  let dominantColor = '#3b82f6'
  if (threshold && analyticsChartData.value[0]?.data) {
    let redCount = 0, yellowCount = 0
    const total = analyticsChartData.value[0].data.length
    
    analyticsChartData.  value[0].data.forEach((p: any) => {
      const value = parseFloat(p[1])
      if (value >= threshold.  critical) redCount++
      else if (value >= threshold. warning) yellowCount++
    })
    
    if (redCount > total * 0.3) dominantColor = '#dc2626'
    else if (yellowCount > total * 0.3) dominantColor = '#f59e0b'
  }
  
  const annotations:   any = {
    yaxis: []
  }
  
  if (threshold?. warning) {
    annotations.yaxis.  push({
      y: threshold.warning,
      borderColor: '#f59e0b',
      strokeDashArray: 5,
      label:   {
        borderColor: '#f59e0b',
        style: {
          color: '#fff',
          background: '#f59e0b',
          fontSize: '12px',
          fontWeight: 600
        },
        text: `⚠️ Warning: ${threshold.warning}`
      }
    })
  }
  
  if (threshold?. critical) {
    annotations.yaxis. push({
      y: threshold. critical,
      borderColor: '#dc2626',
      strokeDashArray: 5,
      label:  {
        borderColor: '#dc2626',
        style: {
          color:   '#fff',
          background:  '#dc2626',
          fontSize:   '12px',
          fontWeight: 600
        },
        text: `🔴 Critical: ${threshold. critical}`
      }
    })
  }
  
  analyticsSeries.value = series
  
  analyticsChartOptions.value = {
    chart: {
      type: 'line',
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: true },
      zoom: { enabled: true, type:   'x' },
      animations: { enabled: false }
    },
    
    stroke: {
      width: 2.5,
      curve: 'smooth',
      lineCap: 'round',
      colors: [dominantColor]
    },
    
    colors: [dominantColor],
    
    markers: {
      size: 6,
      strokeWidth: 2,
      hover: { size: 9 },
      colors: analyticsChartData.value[0]?.data.map((p: any) => {
        const value = parseFloat(p[1])
        if (threshold) {
          if (value >= threshold.critical) return '#dc2626'
          else if (value >= threshold.warning) return '#f59e0b'
        }
        return '#3b82f6'
      }) || ['#3b82f6'],
      strokeColors: '#ffffff',
      opacity: 1
    },
    
    xaxis: {
      type: 'datetime',
      min: minInputDate. getTime(),  
      max: maxInputDate.getTime(),  
      labels: {
        datetimeUTC: false,
        formatter:  (value:   string) => {
          if (!  value) return ''
          
          const date = new Date(parseInt(value))
          
          return date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: 'short',
            hour:  '2-digit',
            minute: '2-digit'
          })
        }
      },
      axisBorder: { color: '#e2e8f0' },
      axisTicks: { color: '#e2e8f0' }
    },
    
    yaxis: {
      labels: {
        formatter: (val: number) => {
          if (val >= 1000) return `${(val / 1000).toFixed(1)}k`
          return val.toFixed(0)
        }
      },
      title: {
        text:   props.panel.unit || 'Value',
        style: {
          color: '#64748b',
          fontSize: '13px'
        }
      }
    },
    
    legend: { 
      show: true, 
      position:   'bottom',
      fontSize: 12
    },
    
    grid: {
      borderColor: '#e2e8f0',
      padding: { left: 20, right: 40, top: 10, bottom: 10 }
    },
    
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0.8,
        opacityFrom: 0.35,
        opacityTo:   0.05,
        stops: [0, 100],
        colorStops: [
          {
            offset: 0,
            color: dominantColor,
            opacity: 0.4
          },
          {
            offset: 100,
            color: dominantColor,
            opacity: 0.05
          }
        ]
      }
    },
    
    tooltip: {
      enabled: true,
      shared: false,
      intersect: false,
      x: {
        formatter: (value: string) => {
          if (! value) return ''
          
          const date = new Date(parseInt(value))
          
          return date.toLocaleString('tr-TR', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour:   '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        }
      },
      y: {
        formatter:   (val: number) => {
          if (!   val && val !== 0) return ''
          
          let color = '#3b82f6'
          let status = '🔵 Normal'
          
          if (threshold) {
            if (val >= threshold.critical) {
              color = '#dc2626'
              status = '🔴 Critical'
            } else if (val >= threshold.warning) {
              color = '#f59e0b'
              status = '🟡 Warning'
            }
          }
          
          return `<span style="color: ${color}; font-weight: 700;">${status}:   ${val.toFixed(2)} ${props.panel.unit || ''}</span>`
        }
      }
    },
    
    annotations: annotations
  }
}

// ✅ CALCULATE STATS
const calculateStats = () => {
  const threshold = props.panel.threshold
  if (! threshold || analyticsChartData.value.length === 0) {
    return { normal: 0, warning: 0, critical: 0 }
  }
  
  let normal = 0, warning = 0, critical = 0
  let totalPoints = 0
  
  analyticsChartData.value.forEach((series: any) => {
    series.data.forEach((point: any) => {
      const value = point[1]
      totalPoints++
      
      if (value >= threshold.critical) {
        critical++
      } else if (value >= threshold.warning) {
        warning++
      } else {
        normal++
      }
    })
  })
  
  const timeRange = (new Date(analyticsEndDate. value).getTime() - new Date(analyticsStartDate.value).getTime()) / 3600000
  
  return {
    normal: Math.round((normal / totalPoints) * timeRange),
    warning: Math. round((warning / totalPoints) * timeRange),
    critical: Math.round((critical / totalPoints) * timeRange)
  }
}

// ✅ INIT ANALYTICS DATES
const initAnalyticsDates = () => {
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  // ✅ DEBUG
  console.log('🕐 initAnalyticsDates: ')
  console.log('   Now:', now.toLocaleString('tr-TR'))
  console.log('   1 Week Ago:', oneWeekAgo. toLocaleString('tr-TR'))
  
  analyticsStartDate.value = oneWeekAgo. toISOString().slice(0, 16)
  analyticsEndDate. value = now.toISOString().slice(0, 16)
  
  console.log('   analyticsStartDate. value:', analyticsStartDate.value)
  console.log('   analyticsEndDate.value:', analyticsEndDate.value)
}

// ✅ DUPLICATE PANEL
const duplicatePanel = () => {
  try {
    const duplicatedPanel = JSON.parse(JSON.stringify(props.panel))
    duplicatedPanel.id = `panel-${Date.now()}-${Math.random()}`
    duplicatedPanel.title = `${props.panel.title} (Copy)`
    
    emit('update', duplicatedPanel. id, duplicatedPanel)
    
    console.log('📋 Panel çoğaltıldı:', duplicatedPanel.title)
    alert(`✅ "${duplicatedPanel.title}" oluşturuldu! `)
    showOptions. value = false
  } catch (error) {
    console.error('❌ Duplicate hatası:', error)
    alert('Panel çoğaltılamadı!')
  }
}

// ✅ REFRESH NOW
const refreshNow = async () => {
  try {
    panelLoading.value = true
    console.log('🔄 Panel yenileniyor:', props.panel.title)
    
    await fetchPanelData()
    
    if (props.panel.type === 'table') {
      extractJobs()
    }
    
    alert('✅ Panel yenilendi!')
    showOptions.value = false
  } catch (error) {
    console.error('❌ Refresh hatası:', error)
    alert('Panel yenilenemedi!')
  } finally {
    panelLoading.value = false
  }
}

// ✅ SETTINGS
const openSettings = () => {
  console.log('⚙️ Panel ayarları açılıyor:', props.panel.title)
  emit('edit', props.panel.id)
  showOptions.value = false
}

const deletePanelAction = () => { if (confirm(`"${props.panel.title}" panelini silmek istediğinize emin misiniz?`)) { emit('delete', props. panel.id) } showOptions.value = false }

const exportPanelAction = () => {
  const data = JSON.stringify(props.panel, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.panel.title}. json`
  a.click()
  URL.revokeObjectURL(url)
  console.log('✅ Panel export edildi:', props.panel.title)
  showOptions.value = false
}

const importPanelAction = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '. json'
  input.onchange = async (e:  any) => {
    const file = e.target.files[0]
    if (! file) return
    
    const reader = new FileReader()
    reader.onload = (event: any) => {
      try {
        const importedPanel = JSON.parse(event.target. result)
        importedPanel.id = `panel-${Date.now()}-${Math.random()}`
        
        emit('update', importedPanel.id, importedPanel)
        
        console.log('✅ Panel import edildi:', importedPanel.title)
        alert(`✅ "${importedPanel.title}" paneli eklendi!`)
      } catch (error) {
        console.error('❌ Import hatası:', error)
        alert('Geçersiz panel dosyası!')
      }
    }
    reader.readAsText(file)
  }
  input.click()
  showOptions.value = false
}

// CELL METHODS
const openCellDetail = (cell: any, idx: number) => { selectedCell.value = cell; selectedCellIdx.value = idx }
const closeCellDetail = () => { selectedCell.value = null; selectedCellIdx.value = null }
const getStatusText = (value: number): string => { const p = value * 100; if (p < 33) return 'Düşük'; if (p < 66) return 'Orta'; return 'Yüksek' }
const getStatusClass = (value: number): string => { const p = value * 100; if (p < 33) return 'status-low'; if (p < 66) return 'status-medium'; return 'status-high' }

// DATA FETCHING
const fetchPanelData = async () => {
  if (! props.panel.query) return
  try {
    panelLoading.value = true
    panelError.value = null

    if (props.panel.type === 'stat' || props.panel.type === 'gauge' || props.panel.type === 'progress') {
      const result = await prometheusStore.fetchInstantQuery(props.panel.query)
      if (result && result.length > 0) {
        const value = parseFloat(result[0]. value?.[1] as string) || 0
        panelData.value = value
      } else {
        panelData.value = 0
      }
    } else if (props.panel.type === 'chart') {
      panelChartData.value = await prometheusStore.fetchPanelChartData(props. panel.query)
    } else if (props.panel.type === 'table' || props.panel.type === 'heatmap') {
      const result = await prometheusStore.fetchInstantQuery(props.panel.query)
      panelChartData.value = result || []
      if (props.panel.type === 'table') extractJobs()
    }
  } catch (error:  any) {
    panelError.value = error.message || 'Veri çekilemedi'
    console.error('❌ Error:', error)
  } finally {
    panelLoading.value = false
  }
}

const extractJobs = () => {
  if (!panelChartData.value || panelChartData.value.length === 0) return
  const jobs = new Set<string>()
  panelChartData.value.forEach((item: any) => {
    jobs.add(item.metric?. job || 'default')
  })
  availableJobs.value = Array. from(jobs).sort()
  if (availableJobs.value. length > 0 && ! availableJobs.value.includes(selectedJob.value)) {
    selectedJob.value = availableJobs.value[0]
  }
}

// COMPUTED
const getThresholdStatus = computed(() => {
  if (panelData.value === null || panelData.value === undefined) {
    return { status: 'unknown', label: 'Bilinmiyor', bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b', icon: 'fa-question-circle' }
  }

  const value = panelData.value
  const threshold = props.panel.threshold

  if (! threshold) {
    return { status: 'normal', label: 'Normal', bg: '#dcfce7', border: '#86efac', text: '#166534', icon: 'fa-check-circle' }
  }

  if (value >= threshold. critical) {
    return { 
      status: 'critical', 
      label: '🔴 KRİTİK', 
      bg: '#fee2e2', 
      border: '#fca5a5', 
      text: '#7f1d1d', 
      icon: 'fa-times-circle' 
    }
  }

  if (value >= threshold. warning) {
    return { 
      status: 'warning', 
      label: '🟡 UYARI', 
      bg: '#fef3c7', 
      border: '#fcd34d', 
      text:  '#92400e', 
      icon: 'fa-exclamation-circle' 
    }
  }

  return { 
    status: 'normal', 
    label: '🟢 NORMAL', 
    bg: '#dcfce7', 
    border: '#86efac', 
    text: '#166534', 
    icon: 'fa-check-circle' 
  }
})

const formatValue = computed(() => {
  if (panelData.value === null || panelData.value === undefined) return '-'

  let value = panelData.value
  const decimals = props.panel.decimals ??  2
  const format = props.panel.settings?.format || 'auto'
  const separator = props.panel.settings?.decimalSeparator || '.'
  const unit = props.panel.unit || ''

  let formatted = ''

  if (format === 'short') {
    if (value >= 1000000) {
      formatted = (value / 1000000).toFixed(decimals) + 'M'
    } else if (value >= 1000) {
      formatted = (value / 1000).toFixed(decimals) + 'K'
    } else {
      formatted = value.toFixed(decimals)
    }
  } else if (format === 'percent') {
    formatted = (value * 100).toFixed(decimals) + '%'
  } else if (format === 'scientific') {
    formatted = value.toExponential(decimals)
  } else {
    formatted = value.toFixed(decimals)
  }

  if (separator === ',') {
    formatted = formatted. replace('. ', ',')
  }

  return formatted + (unit ?  ' ' + unit : '')
})

const alertStatus = computed(() => {
  if (! props.panel.settings?.alertEnabled) return null

  const status = getThresholdStatus.value. status

  if (status === 'critical') {
    return {
      type: 'critical',
      message: '🔴 Kritik:  Eşik değer aşıldı! ',
      icon: 'fa-exclamation-circle'
    }
  }

  if (status === 'warning') {
    return {
      type: 'warning',
      message: '🟡 Uyarı: Değer uyarı seviyesine ulaştı!',
      icon: 'fa-exclamation-triangle'
    }
  }

  return null
})

const playAlertSound = () => {
  try {
    const audioContext = new (window. AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 1000
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext. currentTime + 0.5)

    console.log('🔊 Ses çalındı')
  } catch (e) {
    console.error('Ses hatası:', e)
  }
}

const sendNotification = (message: string) => {
  try {
    if (! ('Notification' in window)) return

    if (Notification.permission === 'granted') {
      new Notification(props.panel.title, {
        body: message,
        icon:  '📊',
        tag: `alert-${props.panel.id}`,
        requireInteraction: false
      })
    } else if (Notification.permission !== 'denied') {
      Notification. requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(props.panel.title, {
            body: message,
            icon: '📊',
            tag: `alert-${props.panel.id}`,
            requireInteraction: false
          })
        }
      })
    }
  } catch (e) {
    console.error('Bildirim hatası:', e)
  }
}

watch(
  () => alertStatus.value?. type,
  (newType, oldType) => {
    if (newType && newType !== oldType) {
      console.log('🚨 Uyarı tetiklendi:', newType, '(Önceki:', oldType, ')')

      if (props.panel.settings?.alertSound) {
        playAlertSound()
      }

      if (props.panel.settings?.alertNotification && alertStatus.value) {
        sendNotification(alertStatus.value.message)
      }
    }
  },
  { immediate: false }
)

const statValue = computed(() => panelData.value !== null ?  Math.floor(panelData.value) : 0)

const gaugeValue = computed(() => {
  if (panelData.value === null || panelData.value === undefined) return 0
  return Math.floor(Math.min(100, Math.max(0, panelData.value)))
})

const gaugeRotation = computed(() => (Math.min(100, Math.max(0, gaugeValue.value)) / 100) * 180 - 90)

const gaugeFillPath = computed(() => {
  const R = 100, CX = 150, CY = 130
  const val = Math.min(100, Math.max(0, gaugeValue.value))
  const angle = Math.PI + ((val / 100) * Math.PI)
  const endX = CX + R * Math.cos(angle)
  const endY = CY + R * Math.sin(angle)
  return `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${endX} ${endY}`
})

const progressPercent = computed(() => {
  const min = props.panel.min ?? 0
  const max = props.panel.max ?? 100
  const range = max - min
  
  if (panelData.value === null || panelData.value === undefined) return 0
  
  const percent = ((panelData.value - min) / range) * 100
  return Math.min(100, Math.max(0, Math.floor(percent)))
})

const chartData = computed(() => {
  if (! panelChartData.value || panelChartData.value.length === 0) return Array. from({ length: 20 }, () => Math.random() * 100)
  if (panelChartData.value[0]?.data && Array.isArray(panelChartData.value[0].data)) {
    return panelChartData.value[0].data. map((d:  any) => typeof d === 'number' ? d : parseFloat(d[1]) || 0)
  }
  if (panelChartData.value[0]?.value && Array.isArray(panelChartData.value[0]. value)) {
    return panelChartData.value. map((item: any) => parseFloat(item. value[1]) || 0)
  }
  return Array.from({ length: 20 }, () => Math.random() * 100)
})

const chartPoints = computed(() => {
  if (chartData.value.length === 0) return ''
  const maxVal = Math.max(...chartData. value, 1)
  const minVal = Math.min(...chartData.value, 0)
  const range = maxVal - minVal || 1
  return chartData.value.map((val: number, idx: number) => {
    const x = (idx / Math.max(1, chartData. value.length - 1)) * 300
    const y = 100 - (((val - minVal) / range) * 100)
    return `${x},${y}`
  }).join(' ')
})

const chartPolygon = computed(() => `0,100 ${chartPoints.value} 300,100`)

const chartMin = computed(() => {
  const valid = chartData.value.filter((v: number) => !isNaN(v))
  return valid.length > 0 ?  Math.min(...valid).toFixed(2) : '0'
})

const chartMax = computed(() => {
  const valid = chartData.value.filter((v: number) => !isNaN(v))
  return valid.length > 0 ?  Math.max(...valid).toFixed(2) : '0'
})

const chartAvg = computed(() => {
  const valid = chartData.value. filter((v: number) => !isNaN(v))
  if (valid.length === 0) return '0'
  const avg = valid.reduce((a: number, b: number) => a + b, 0) / valid.length
  return avg.toFixed(2)
})

const tableData = computed(() => {
  if (! panelChartData.value || panelChartData.value. length === 0) return []
  return panelChartData.value. map((item: any, idx: number) => {
    let name = item.metric?. sensor || item.metric?.__name__ || `Metrik ${idx + 1}`
    if (item.metric?.sensor === 'role durumlari' && item.metric?. role) name += ` (${item.metric.role})`
    if (item.metric?.job && item.metric. job !== 'mppt') name += ` [${item.metric.job}]`
    return {
      name,
      value:  item.value?.[1] ?  `${parseFloat(item.value[1]).toFixed(2)} ${props.panel.unit || ''}` : '-',
      trend: Math.floor(Math.random() * 20) - 10,
      job: item.metric?.job || 'mppt'
    }
  })
})

const filteredTableData = computed(() => {
  if (selectedJob.value === 'all') return tableData.value
  return tableData.value.filter((item: any) => item.job === selectedJob.value)
})

const alertMessage = computed(() => panelData.value === 1 || panelData.value === 0 ? 'Sistem durumu normal - Tüm servisler çalışıyor' : 'Sistem durumu sorunlu - Dikkat gereklidir')
const alertType = computed(() => panelData.value === 1 ?  'success' : panelData.value === 0 ? 'warning' : 'info')

const heatmapData = computed(() => {
  if (panelChartData.value && panelChartData.value.length > 0) {
    return panelChartData.value. map((item: any, idx:  number) => ({
      label: item.metric?.sensor || `Metrik ${idx + 1}`,
      value: item.value?.[1] ? parseFloat(item.value[1]) : Math.random()
    }))
  }
  return Array.from({ length: 12 }, (_, i) => ({ label: `Sensör ${i + 1}`, value: Math.random() }))
})

const getCellColor = (value: number): string => {
  if (value < 0.33) return '#10b981'
  if (value < 0.66) return '#f59e0b'
  return '#ef4444'
}

// LIFECYCLE
onMounted(async () => {
  console.log('📌 Panel mounted:', props.panel.title)
  
  await fetchPanelData()
  initAnalyticsDates()
  
  if (props.panel.type === 'table') extractJobs()
  
  if (props.panel.refresh_rate && props.panel.refresh_rate > 0) {
    refreshInterval. value = setInterval(async () => {
      await fetchPanelData()
      if (props.panel.type === 'table') extractJobs()
    }, props.panel. refresh_rate)
  }
})

onUnmounted(() => {
  if (refreshInterval. value) clearInterval(refreshInterval.value)
})

// ✅ EŞİK DEĞERİ DEĞİŞTİĞİNDE GRAFİĞİ YENİLE
watch(
  () => props.panel.threshold,
  (newThreshold, oldThreshold) => {
    console.log('🔄 Threshold değişti!')
    console.log('   Eski:', oldThreshold)
    console.log('   Yeni:', newThreshold)
    
    
    if (analyticsChartData.value.length > 0) {
      console.log('📊 Grafik güncelleniyor...')
      buildAnalyticsChart()
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="panel-wrapper">
    <div class="panel-container" :class="`panel-type-${panel.type}`" :style="{ backgroundColor: getThresholdStatus.  bg, borderColor: getThresholdStatus.  border }">
      <div class="panel-header">
        <div class="panel-title-group">
          <h4 class="panel-title">{{ panel. title }}</h4>
          <p v-if="panel.description" class="panel-desc">{{ panel.description }}</p>
        </div>
        <div class="panel-controls">
          <button 
            ref="menuButtonRef" 
            class="control-btn" 
            @click="toggleMenu" 
            title="Seçenekler"
          >
            <i class="fas fa-ellipsis-v"></i>
          </button>
          
          <Teleport to="body">
            <div v-if="showOptions" class="menu-backdrop" @click="showOptions = false"></div>

            <div v-if="showOptions" class="panel-menu" :style="menuPosition" @click.  stop>
              <div class="menu-section">
                <button @click="viewPanel" class="menu-btn">
                  <i class="fas fa-eye"></i>
                  <span>View (Tam Ekran)</span>
                </button>
              </div>

              <div class="menu-section">
                <button @click="editPanelAction" class="menu-btn">
                  <i class="fas fa-edit"></i>
                  <span>Edit</span>
                </button>
                <button class="menu-btn submenu-toggle" :class="{ active: activeSubmenu === 'share' }" @click="toggleSubmenu('share')">
                  <i class="fas fa-share-alt"></i>
                  <span>Share</span>
                  <i class="fas fa-chevron-right submenu-arrow"></i>
                </button>
                <div v-if="activeSubmenu === 'share'" class="submenu">
                  <button class="submenu-btn" @click="copyPanelLink">
                    <i class="fas fa-copy"></i> Copy Link
                  </button>
                  <button class="submenu-btn" @click="exportPanel">
                    <i class="fas fa-download"></i> Export
                  </button>
                </div>
              </div>

              <div class="menu-section">
                <button class="menu-btn submenu-toggle" :class="{ active: activeSubmenu === 'explore' }" @click="toggleSubmenu('explore')">
                  <i class="fas fa-compass"></i>
                  <span>Explore</span>
                  <i class="fas fa-chevron-right submenu-arrow"></i>
                </button>
                <div v-if="activeSubmenu === 'explore'" class="submenu">
                  <button class="submenu-btn" @click="viewPanelData">
                    <i class="fas fa-chart-line"></i> View Data
                  </button>
                  <button class="submenu-btn" @click="downloadCSV">
                    <i class="fas fa-download"></i> Download CSV
                  </button>
                 <button class="submenu-btn" @click="saveAsImageFromMenu">
                    <i class="fas fa-image"></i> Save as Image
                  </button>
                </div>
              </div>

              <div class="menu-section">
                <button class="menu-btn submenu-toggle" :class="{ active: activeSubmenu === 'inspect' }" @click="toggleSubmenu('inspect')">
                  <i class="fas fa-microscope"></i>
                  <span>Inspect</span>
                  <i class="fas fa-chevron-right submenu-arrow"></i>
                </button>
                <div v-if="activeSubmenu === 'inspect'" class="submenu">
                  <button class="submenu-btn" @click="showPanelJSON">
                    <i class="fas fa-code"></i> Panel JSON
                  </button>
                  <button class="submenu-btn" @click="showQueryDetails">
                    <i class="fas fa-database"></i> Query Details
                  </button>
                  <button class="submenu-btn" @click="showPanelInfo">
                    <i class="fas fa-info-circle"></i> Panel Info
                  </button>
                </div>
              </div>

              <div class="menu-section">
                <button class="menu-btn submenu-toggle" :class="{ active: activeSubmenu === 'more' }" @click="toggleSubmenu('more')">
                  <i class="fas fa-ellipsis-h"></i>
                  <span>More...  </span>
                  <i class="fas fa-chevron-right submenu-arrow"></i>
                </button>
                <div v-if="activeSubmenu === 'more'" class="submenu">
                  <button class="submenu-btn" @click="duplicatePanel" title="Bu paneli kopyala">
                    <i class="fas fa-copy"></i>
                    <span>Duplicate</span>
                  </button>
                  
                  <button class="submenu-btn" @click="refreshNow" title="Veriyi hemen yenile" :disabled="panelLoading">
                    <i class="fas fa-sync" :class="{ 'fa-spin': panelLoading }"></i>
                    <span>{{ panelLoading ? 'Refreshing...' : 'Refresh Now' }}</span>
                  </button>

                  <button class="submenu-btn" @click="showAnalyticsModal = true; showOptions = false" title="Grafik ve İstatistikler">
                    <i class="fas fa-chart-line"></i>
                    <span>Analytics</span>
                  </button>
                  
                  <button class="submenu-btn" @click="openSettings" title="Panel ayarlarını düzenle">
                    <i class="fas fa-cog"></i>
                    <span>Settings</span>
                  </button>
                </div>
              </div>

              <div class="menu-section">
                <button class="menu-btn submenu-toggle" :class="{ active: activeSubmenu === 'transfer' }" @click="toggleSubmenu('transfer')">
                  <i class="fas fa-exchange-alt"></i>
                  <span>Transfer</span>
                  <i class="fas fa-chevron-right submenu-arrow"></i>
                </button>
                <div v-if="activeSubmenu === 'transfer'" class="submenu">
                  <button class="submenu-btn" @click="exportPanelAction">
                    <i class="fas fa-download"></i> Export
                  </button>
                  <button class="submenu-btn" @click="importPanelAction">
                    <i class="fas fa-upload"></i> Import
                  </button>
                </div>
              </div>

              <div class="menu-section danger">
                <button @click="deletePanelAction" class="menu-btn delete-btn-menu">
                  <i class="fas fa-trash"></i>
                  <span>Remove</span>
                </button>
              </div>
            </div>
          </Teleport>
        </div>
      </div>

      <!-- ✅ UYARI KUTUSU -->
      <div v-if="alertStatus" :class="['alert-box', `alert-${alertStatus.  type}`]">
        <i :class="['fas', alertStatus. icon]"></i>
        <span>{{ alertStatus.message }}</span>
      </div>

      <div class="panel-body">
        <div v-if="panel.type === 'stat'" class="stat-panel-large">
          <div class="stat-large-wrapper">
            <div class="stat-label-large">{{ panel.title }}</div>
            <div class="stat-value-large" :style="{ color: getThresholdStatus. text }">{{ formatValue }}</div>
            <div class="stat-bar"></div>
          </div>
        </div>
        <div v-else-if="panel.type === 'gauge'" class="gauge-panel">
          <div class="gauge-wrapper">
            <svg viewBox="0 0 300 160" class="gauge-svg" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" :style="`stop-color:  ${getThresholdStatus.bg || '#3b82f6'}; stop-opacity: 1`" />
                  <stop offset="50%" style="stop-color: #8b5cf6; stop-opacity: 1" />
                  <stop offset="100%" style="stop-color: #10b981; stop-opacity: 1" />
                </linearGradient>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.4)" />
                </filter>
              </defs>
              <path d="M 50 130 A 100 100 0 0 1 250 130" class="gauge-bg" fill="none" stroke="#334155" stroke-width="18" stroke-linecap="round" opacity="0.5" />
              <path :d="gaugeFillPath" class="gauge-fill" fill="none" stroke="url(#gaugeGrad)" stroke-width="18" stroke-linecap="round" />
              <g :transform="`rotate(${gaugeRotation} 150 130)`" class="needle-group">
                <line x1="150" y1="130" x2="150" y2="45" stroke="#f8fafc" stroke-width="4" stroke-linecap="round" filter="url(#shadow)" />
                <circle cx="150" cy="130" r="8" fill="#f8fafc" filter="url(#shadow)" />
                <circle cx="150" cy="130" r="4" fill="#3b82f6" />
              </g>
              <text x="150" y="155" text-anchor="middle" class="svg-value-text" fill="#0f172a">
                {{ formatValue }}
              </text>
            </svg>
          </div>
        </div>
        <div v-else-if="panel.type === 'progress'" class="progress-panel">
          <div class="progress-wrapper">
            <div class="progress-bar-container">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" :style="{ width: progressPercent + '%', backgroundColor: getThresholdStatus.  bg }"></div>
              </div>
            </div>
            <div class="progress-info">
              <span class="progress-value-text" :style="{ color: getThresholdStatus.text }">{{ formatValue }}</span>
            </div>
          </div>
        </div>
        <div v-else-if="panel.type === 'chart'" class="chart-panel">
          <div class="chart-wrapper">
            <svg class="sparkline-chart" viewBox="0 0 300 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color: #3b82f6; stop-opacity:   0.4" />
                  <stop offset="100%" style="stop-color: #3b82f6; stop-opacity: 0.05" />
                </linearGradient>
              </defs>
              <polyline :points="chartPoints" class="sparkline-line" />
              <polygon :points="chartPolygon" class="sparkline-area" />
            </svg>
            <div class="chart-info">
              <span class="chart-label">{{ panel.query }}</span>
              <span class="chart-stats">
                <span class="stat-item">Min:  {{ chartMin }}</span>
                <span class="stat-item">Max: {{ chartMax }}</span>
                <span class="stat-item">Avg: {{ chartAvg }}</span>
              </span>
            </div>
          </div>
        </div>
        <div v-else-if="panel.type === 'table'" class="table-panel">
          <div class="table-filter-header">
            <div class="filter-buttons">
              <button v-for="job in availableJobs" :key="job" class="filter-btn" :class="{ active: selectedJob === job }" @click="selectedJob = job">
                {{ job.  toUpperCase() }}
              </button>
              <button class="filter-btn" :class="{ active: selectedJob === 'all' }" @click="selectedJob = 'all'">
                TÜM VERİLER
              </button>
            </div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th class="table-header-metric">Metrik</th>
                <th class="table-header-value">Değer</th>
                <th class="table-header-trend">Trend</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in filteredTableData" :key="idx" class="table-row">
                <td class="table-cell metric-name">{{ item.name }}</td>
                <td class="table-cell metric-value">{{ item.value }}</td>
                <td class="table-cell metric-trend">
                  <span class="trend-badge" :class="item.trend > 0 ? 'positive' : 'negative'">
                    <i :class="item.trend > 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
                    {{ Math.abs(item.trend) }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else-if="panel.type === 'alert'" class="alert-panel" :class="`alert-${alertType}`">
          <div class="alert-icon-wrapper">
            <i class="fas fa-info-circle"></i>
          </div>
          <div class="alert-content-wrapper">
            <h5 class="alert-title">{{ panel.title }}</h5>
            <p class="alert-message">{{ alertMessage }}</p>
          </div>
        </div>
        <div v-else-if="panel.type === 'heatmap'" class="heatmap-panel">
          <div class="heatmap-grid">
            <div v-for="(cell, idx) in heatmapData" :key="idx" class="heatmap-cell" :style="{ backgroundColor:   getCellColor(cell.value), opacity: 0.7 + cell.value * 0.3 }" @click="openCellDetail(cell, idx)">
              <span class="heatmap-value">{{ (cell.value * 100).toFixed(0) }}</span>
            </div>
          </div>
          <div v-if="selectedCell" class="modal-overlay" @click="closeCellDetail">
            <div class="modal-content" @click.stop>
              <div class="modal-header">
                <h3>{{ selectedCell.label }}</h3>
                <button class="modal-close" @click="closeCellDetail">✕</button>
              </div>
              <div class="modal-body">
                <div class="detail-row">
                  <span class="detail-label">Değer:</span>
                  <span class="detail-value">{{ (selectedCell.value * 100).toFixed(2) }}%</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Durum:</span>
                  <span class="detail-status" :class="getStatusClass(selectedCell.value)">
                    {{ getStatusText(selectedCell.value) }}
                  </span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Index:</span>
                  <span class="detail-value">{{ selectedCellIdx }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Panel:</span>
                  <span class="detail-value">{{ panel.title }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="default-panel">
          <p class="default-title">{{ panel.title }}</p>
          <small class="default-query">{{ panel.query }}</small>
        </div>
      </div>
    </div>

    <!-- ✅ FULLSCREEN MODAL -->
    <Teleport to="body">
      <div v-if="showFullscreen" class="fullscreen-modal" @click="closeFullscreen">
        <div class="fullscreen-content" @click.stop>
          <div class="fullscreen-header">
            <h2>{{ panel.title }}</h2>
            <button class="btn-close-fullscreen" @click="closeFullscreen">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="fullscreen-body">
            <!-- STAT -->
            <div v-if="panel.type === 'stat'" class="stat-panel-large">
              <div class="stat-large-wrapper">
                <div class="stat-label-large" style="font-size: 16px;">{{ panel.title }}</div>
                <div class="stat-value-large" style="font-size: 80px;" :style="{ color: getThresholdStatus.text }">{{ formatValue }}</div>
                <div class="stat-bar" style="height: 8px;"></div>
              </div>
            </div>

            <!-- GAUGE -->
            <div v-else-if="panel.type === 'gauge'" class="panel-content gauge-container">
              <div class="gauge-header">
                <span class="gauge-title">{{ panel.title }}</span>
                <span class="gauge-status" :style="{ color: getThresholdStatus.  text }">
                  {{ getThresholdStatus.label }}
                </span>
              </div>

              <div class="gauge-value-display">
                {{ formatValue }}
              </div>

              <div class="gauge-bar-wrapper">
                <div class="gauge-bar-background">
                  <div class="gauge-bar-fill" :style="{ width: `${gaugeValue}%` }"></div>
                </div>
                <div class="gauge-bar-label">{{ gaugeValue }}%</div>
              </div>

              <div class="gauge-info-grid">
                <div class="gauge-info-item">
                  <span class="gauge-info-label">Min</span>
                  <span class="gauge-info-value">{{ panel.min ??   0 }}</span>
                </div>
                <div class="gauge-info-item">
                  <span class="gauge-info-label">Current</span>
                  <span class="gauge-info-value" :style="{ color: getThresholdStatus.text }">
                    {{ panelData ??  0 }}
                  </span>
                </div>
                <div class="gauge-info-item">
                  <span class="gauge-info-label">Max</span>
                  <span class="gauge-info-value">{{ panel.max ??  100 }}</span>
                </div>
              </div>
            </div>

            <!-- PROGRESS -->
            <div v-else-if="panel.type === 'progress'" class="panel-content progress-container">
              <div class="progress-header">
                <span class="progress-label">{{ panel.title }}</span>
                <span class="progress-value">
                  {{ formatValue }}
                  <span class="progress-percent">({{ progressPercent }}%)</span>
                </span>
              </div>

              <div class="progress-bar-wrapper">
                <div class="progress-bar-background">
                  <div class="progress-bar-fill" :style="{ width: `${progressPercent}%` }"></div>
                </div>
              </div>

              <div class="progress-info">
                <div class="progress-info-item">
                  <span class="info-label">Min</span>
                  <span class="info-value">{{ panel.min ??   0 }}</span>
                </div>
                <div class="progress-info-item">
                  <span class="info-label">Current</span>
                  <span class="info-value" :style="{ color: getThresholdStatus.  text }">{{ panelData ??  0 }}</span>
                </div>
                <div class="progress-info-item">
                  <span class="info-label">Max</span>
                  <span class="info-value">{{ panel.max ?? 100 }}</span>
                </div>
              </div>
            </div>

            <!-- CHART -->
            <div v-else-if="panel.type === 'chart'" class="chart-panel" style="width: 100%; height: 100%;">
              <div class="chart-wrapper" style="height: 100%; width: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px;">
                <div v-if="!  chartPoints || chartPoints === ''" style="width: 100%; text-align: center; padding: 40px;">
                  <p style="color: #94a3b8; font-size: 16px; margin-bottom: 20px;">📊 Grafik Verisi Yükleniyor...  </p>
                  <table class="data-table-modal" style="width: 100%; max-width: 900px; margin: 0 auto;">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Metrik Adı</th>
                        <th>Değer</th>
                        <th>Zaman</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(item, idx) in panelChartData" :key="idx">
                        <td>{{ idx + 1 }}</td>
                        <td>{{ item.  name || item. metric?.sensor || 'Metrik' }}</td>
                        <td class="value-cell">{{ item.value?.[1] ?   parseFloat(item.value[1]).toFixed(2) : '-' }}</td>
                        <td>{{ item.value?.[0] ?  new Date(item.value[0] * 1000).toLocaleString('tr-TR') : '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <svg v-else class="sparkline-chart" viewBox="0 0 300 100" preserveAspectRatio="none" style="height: 60%; width: 90%; max-width: 1000px;">
                  <defs>
                    <linearGradient id="sparkGradientFull" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:  #3b82f6; stop-opacity:   0.4" />
                      <stop offset="100%" style="stop-color: #3b82f6; stop-opacity: 0.05" />
                    </linearGradient>
                  </defs>
                  <polyline :points="chartPoints" class="sparkline-line" />
                  <polygon :points="chartPolygon" class="sparkline-area" />
                </svg>
                <div class="chart-info" style="margin-top: 30px; text-align: center;">
                  <span class="chart-label" style="font-size: 14px; color: #64748b;">{{ panel.query }}</span>
                  <span class="chart-stats" style="gap: 30px; display: flex; justify-content: center; margin-top: 15px;">
                    <span class="stat-item" style="font-size: 16px; padding: 10px 20px; background: #f1f5f9; border-radius: 8px;">Min:   {{ chartMin }}</span>
                    <span class="stat-item" style="font-size: 16px; padding: 10px 20px; background: #f1f5f9; border-radius: 8px;">Max:  {{ chartMax }}</span>
                    <span class="stat-item" style="font-size: 16px; padding: 10px 20px; background: #f1f5f9; border-radius: 8px;">Avg: {{ chartAvg }}</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- TABLE -->
            <div v-else-if="panel.type === 'table'" class="table-panel" style="width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden;">
              <div class="table-filter-header" style="flex-shrink: 0; padding: 16px 20px; background: #ffffff; border-bottom: 2px solid #e2e8f0;">
                <div class="filter-buttons">
                  <button v-for="job in availableJobs" :key="job" class="filter-btn" :class="{ active: selectedJob === job }" @click="selectedJob = job" style="padding: 10px 16px; margin-right: 8px;">
                    {{ job.  toUpperCase() }}
                  </button>
                  <button class="filter-btn" :class="{ active: selectedJob === 'all' }" @click="selectedJob = 'all'" style="padding: 10px 16px;">
                    TÜM VERİLER
                  </button>
                </div>
              </div>
              <div style="flex: 1; overflow-y: auto; width: 100%; padding: 0;">
                <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 16px;">
                  <thead style="position: sticky; top: 0; z-index: 10; background:   #f1f5f9;">
                    <tr style="border-bottom: 2px solid #e2e8f0;">
                      <th class="table-header-metric" style="position: sticky; top: 0; background: #f1f5f9; z-index: 20; padding: 20px 16px; text-align: left; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0;">Metrik</th>
                      <th class="table-header-value" style="position: sticky; top: 0; background: #f1f5f9; z-index: 20; padding:   20px 16px; text-align: right; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0;">Değer</th>
                      <th class="table-header-trend" style="position: sticky; top: 0; background: #f1f5f9; z-index: 20; padding: 20px 16px; text-align: center; font-weight: 700; color: #0f172a;">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in filteredTableData" :key="idx" style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" @mouseover="($event. target as HTMLElement).style.background = '#f8fafc'" @mouseout="($event.target as HTMLElement).style.background = ''">
                      <td class="table-cell metric-name" style="padding: 16px; border-right: 1px solid #f1f5f9; font-weight: 600; color: #1a202c;">{{ item.name }}</td>
                      <td class="table-cell metric-value" style="padding: 16px; border-right: 1px solid #f1f5f9; text-align: right; color: #3b82f6; font-weight: 700; font-family: 'Courier New', monospace;">{{ item.  value }}</td>
                      <td class="table-cell metric-trend" style="padding: 16px; text-align: center;">
                        <span class="trend-badge" :class="item.trend > 0 ? 'positive' : 'negative'" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 6px; font-weight: 700; font-size: 14px;"  :style="item.trend > 0 ? 'background: #dcfce7; color: #15803d;' : 'background: #fee2e2; color: #dc2626;'">
                          <i :class="item.trend > 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
                          {{ Math.abs(item.trend) }}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- HEATMAP -->
            <div v-else-if="panel.type === 'heatmap'" class="heatmap-panel" style="width: 100%; height:   100%; display: flex; flex-direction: column; overflow: hidden;">
              <div style="flex: 1; overflow-y: auto; width: 100%; padding: 20px;">
                <div class="heatmap-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; width: 100%; padding-bottom: 20px;">
                  <div v-for="(cell, idx) in heatmapData" :key="idx" class="heatmap-cell" :style="{ backgroundColor:   getCellColor(cell.value), opacity: 0.7 + cell.value * 0.3, minHeight: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.3s', fontSize: '32px', fontWeight: '900', color: '#ffffff' }" @click="openCellDetail(cell, idx)" @mouseover="($event.target as HTMLElement).style.transform = 'scale(1.05)'" @mouseout="($event.target as HTMLElement).style.transform = 'scale(1)'">
                    <span class="heatmap-value">{{ (cell.value).toFixed(0) }} {{ panel.unit }}</span>
                    <span style="font-size: 14px; margin-top: 10px; text-align: center; opacity: 0.9;">{{ cell.label }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- ALERT -->
            <div v-else-if="panel.type === 'alert'" class="alert-panel" :class="`alert-${alertType}`" style="max-width: 900px; margin: 0 auto; padding: 30px;">
              <div class="alert-icon-wrapper" style="font-size: 48px;">
                <i class="fas fa-info-circle"></i>
              </div>
              <div class="alert-content-wrapper">
                <h5 class="alert-title" style="font-size: 24px;">{{ panel.title }}</h5>
                <p class="alert-message" style="font-size: 18px;">{{ alertMessage }}</p>
              </div>
            </div>

            <!-- DEFAULT -->
            <div v-else class="default-panel">
              <p class="default-title" style="font-size: 24px;">{{ panel.title }}</p>
              <small class="default-query" style="font-size: 16px;">{{ panel.query }}</small>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ✅ VIEW DATA MODAL -->
    <Teleport to="body">
      <div v-if="showDataModal" class="data-modal-overlay" @click="showDataModal = false">
        <div class="data-modal-content" @click.stop>
          <div class="data-modal-header">
            <h2>📊 {{ panel.title }} - Veriler</h2>
            <button class="data-modal-close" @click="showDataModal = false">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="data-modal-body">
            <!-- STAT/GAUGE/PROGRESS -->
            <div v-if="panel.type === 'stat' || panel.type === 'gauge' || panel.type === 'progress'" class="stat-data-display">
              <div class="stat-value-card">
                <span class="stat-label">{{ panel.title }}</span>
                <span class="stat-value-large">{{ panelData }}</span>
                <span class="stat-unit">{{ panel.unit }}</span>
              </div>
              <div class="stat-info">
                <p><strong>Panel Tipi:</strong> {{ panel.type }}</p>
                <p><strong>Sorgu:  </strong> {{ panel.query }}</p>
                <p><strong>Son Güncelleme: </strong> {{ new Date().toLocaleString('tr-TR') }}</p>
              </div>
            </div>

            <!-- CHART/TABLE/HEATMAP -->
            <table v-else class="data-table-modal">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Metrik Adı</th>
                  <th>Değer</th>
                  <th>Birim</th>
                  <th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in panelChartData" :key="idx">
                  <td>{{ idx + 1 }}</td>
                  <td>{{ item.metric?.  sensor || item.metric?.__name__ || `Metrik ${idx + 1}` }}</td>
                  <td class="value-cell">
                    <strong>{{ item.value?.[1] ?   parseFloat(item.value[1]).toFixed(2) : '-' }}</strong>
                  </td>
                  <td>{{ panel.unit || '-' }}</td>
                  <td class="time-cell">
                    {{ item.value?.[0] ? new Date(item.value[0] * 1000).toLocaleString('tr-TR') : '-' }}
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="(!  panelChartData || panelChartData.length === 0) && (panel.type !== 'stat' && panel.type !== 'gauge' && panel.  type !== 'progress')" class="no-data">
              <i class="fas fa-inbox"></i>
              <p>Veri yüklenmiyor...  </p>
            </div>
          </div>

          <div class="data-modal-footer">
            <button class="data-btn-export-csv" @click="downloadCSV">
              <i class="fas fa-download"></i> CSV İndir
            </button>
            <button class="data-btn-export-image" @click="saveAsImage">
              <i class="fas fa-image"></i> Resim Olarak Kaydet
            </button>
            <button class="data-btn-close" @click="showDataModal = false">
              Kapat
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ✅ INSPECT MODAL -->
    <Teleport to="body">
      <div v-if="showInspectModal" class="inspect-modal-overlay" @click="showInspectModal = false">
        <div class="inspect-modal-content" @click.stop>
          <!-- Header -->
          <div class="inspect-modal-header">
            <div class="inspect-header-left">
              <i class="fas fa-microscope" style="font-size: 20px; color: #3b82f6; margin-right: 12px;"></i>
              <h2>Inspect:   {{ panel.title }}</h2>
            </div>
            <button class="inspect-modal-close" @click="showInspectModal = false">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- Tabs -->
          <div class="inspect-tabs">
            <button 
              class="inspect-tab" 
              :class="{ active: inspectModalType === 'data' }"
              @click="inspectModalType = 'data'"
            >
              <i class="fas fa-database"></i>
              <span>Data</span>
            </button>
            <button 
              class="inspect-tab" 
              :class="{ active: inspectModalType === 'stats' }"
              @click="inspectModalType = 'stats'"
            >
              <i class="fas fa-chart-bar"></i>
              <span>Stats</span>
            </button>
            <button 
              class="inspect-tab" 
              :class="{ active: inspectModalType === 'query' }"
              @click="inspectModalType = 'query'"
            >
              <i class="fas fa-code"></i>
              <span>Query</span>
            </button>
            <button 
              class="inspect-tab" 
              :class="{ active: inspectModalType === 'json' }"
              @click="inspectModalType = 'json'"
            >
              <i class="fas fa-braces"></i>
              <span>JSON</span>
            </button>
          </div>

          <!-- Content -->
          <div class="inspect-modal-body">
            <!-- DATA TAB -->
            <div v-if="inspectModalType === 'data'" class="inspect-content">
              <div class="data-display">
                <div class="data-card">
                  <div class="data-card-label">Current Value</div>
                  <div class="data-card-value" :style="{ color: getThresholdStatus.  text }">
                    {{ formatValue }}
                  </div>
                  <div class="data-card-meta">{{ getThresholdStatus. label }}</div>
                </div>
              </div>
            </div>

            <!-- STATS TAB -->
            <div v-if="inspectModalType === 'stats'" class="inspect-content">
              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-icon">
                    <i class="fas fa-hashtag"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-label">Panel ID</div>
                    <div class="stat-value">{{ panel.id }}</div>
                  </div>
                </div>

                <div class="stat-item">
                  <div class="stat-icon">
                    <i class="fas fa-layer-group"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-label">Type</div>
                    <div class="stat-value">{{ panel.  type }}</div>
                  </div>
                </div>

                <div class="stat-item">
                  <div class="stat-icon">
                    <i class="fas fa-heading"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-label">Title</div>
                    <div class="stat-value">{{ panel.  title }}</div>
                  </div>
                </div>

                <div class="stat-item">
                  <div class="stat-icon">
                    <i class="fas fa-ruler"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-label">Unit</div>
                    <div class="stat-value">{{ panel. unit || 'N/A' }}</div>
                  </div>
                </div>

                <div class="stat-item">
                  <div class="stat-icon">
                    <i class="fas fa-hourglass-half"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-label">Refresh Rate</div>
                    <div class="stat-value">{{ panel. refresh_rate ?   `${panel.refresh_rate}ms` : 'Manual' }}</div>
                  </div>
                </div>

                <div class="stat-item">
                  <div class="stat-icon">
                    <i class="fas fa-sliders-h"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-label">Decimals</div>
                    <div class="stat-value">{{ panel.decimals ??   2 }}</div>
                  </div>
                </div>

                <div class="stat-item">
                  <div class="stat-icon">
                    <i class="fas fa-circle-check"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-label">Status</div>
                    <div class="stat-value" :style="{ color: getThresholdStatus. text }">
                      {{ getThresholdStatus.label }}
                    </div>
                  </div>
                </div>

                <div class="stat-item">
                  <div class="stat-icon">
                    <i class="fas fa-database"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-label">Data Status</div>
                    <div class="stat-value">{{ panelLoading ? '⏳ Loading' : '✅ Loaded' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- QUERY TAB -->
            <div v-if="inspectModalType === 'query'" class="inspect-content">
              <div class="query-section">
                <div class="query-header">
                  <i class="fas fa-database"></i>
                  <h4>PromQL Query</h4>
                </div>
                <pre class="query-code">{{ panel. query }}</pre>

                <div class="query-info-grid">
                  <div class="query-info-item">
                    <i class="fas fa-circle-info"></i>
                    <div>
                      <div class="query-info-label">Query Type</div>
                      <div class="query-info-value">{{ panel.type === 'chart' ? 'Range Query' : 'Instant Query' }}</div>
                    </div>
                  </div>
                  <div class="query-info-item">
                    <i class="fas fa-clock"></i>
                    <div>
                      <div class="query-info-label">Interval</div>
                      <div class="query-info-value">{{ panel.refresh_rate ? `Every ${panel.refresh_rate}ms` : 'Manual' }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- JSON TAB -->
            <div v-if="inspectModalType === 'json'" class="inspect-content">
              <pre class="json-viewer">{{ JSON.stringify(panel, null, 2) }}</pre>
            </div>
          </div>

          <!-- Footer -->
          <div class="inspect-modal-footer">
            <button class="inspect-btn-copy" @click="copyToClipboard" title="Copy to clipboard">
              <i class="fas fa-copy"></i> Copy
            </button>
            <button class="inspect-btn-close" @click="showInspectModal = false">
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    
<Teleport to="body">
  <div v-if="showAnalyticsModal" class="analytics-modal-overlay" @click="showAnalyticsModal = false">
    <div class="analytics-modal-content" @click.stop>
      <!-- Header -->
      <div class="analytics-header">
        <h2>
          <i class="fas fa-chart-line"></i>
          {{ panel.title }} - Time Series Analytics
        </h2>
        <button class="close-btn" @click="showAnalyticsModal = false">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Time Range Selector -->
      <div class="analytics-toolbar">
        <!-- ✅ ZAMAN PRESETLERI BUTONLARI -->
        <div class="time-buttons">
          <button 
            v-for="preset in timePresets"
            :key="preset. value"
            class="time-btn"
            :class="{ active:  analyticsTimeRange === preset.value }"
            @click="selectAnalyticsTimeRange(preset.value)"
          >
            {{ preset.label }}
          </button>
        </div>

        <!-- ✅ CUSTOM TARİH SEÇİCİSİ -->
        <div class="custom-date-inputs">
          <div class="date-input-group">
            <label>Başlangıç:  </label>
            <input 
              v-model="analyticsStartDate" 
              type="datetime-local" 
              class="date-input"
            />
          </div>
          <div class="date-input-group">
            <label>Bitiş: </label>
            <input 
              v-model="analyticsEndDate" 
              type="datetime-local" 
              class="date-input"
            />
          </div>
          
          <!-- ✅ UYGULA VE SIFIRLANSıN BUTONLARI -->
          <button 
            class="btn-apply-dates" 
            @click="applyCustomAnalyticsDateRange"
            title="Uygula"
          >
            <i class="fas fa-check"></i>
          </button>
          <button 
            class="btn-reset-dates" 
            @click="resetAnalyticsDateRange"
            title="Sıfırla"
          >
            <i class="fas fa-redo"></i>
          </button>

          <!-- SHOW/HIDE DETAILS BUTTON -->
<button
  class="btn-toggle-details"
  @click="toggleThresholdDetails"
  :aria-pressed="showThresholdDetails"
  style="margin-left:12px;"
>
  <i class="fas fa-list-ul" style="margin-right:8px;"></i>
  {{ showThresholdDetails ? 'Hide Details' : 'Show Details' }}
</button>
        </div>
      </div>

      <!-- Chart - ApexCharts -->
      <div class="analytics-chart-container">
        <div v-if="analyticsLoading" class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Veriler yükleniyor...</p>
        </div>
        <apexchart
          v-else-if="analyticsSeries.length > 0"
          type="line"
          height="400"
          :options="analyticsChartOptions"
          :series="analyticsSeries"
        />
        <div v-else class="chart-empty">
          <i class="fas fa-database"></i>
          <p>Veri bulunamadı</p>
        </div>
      </div>

  
<div
  v-if="showThresholdDetails"
  :class="['analytics-side-panel', { fullscreen: sidePanelExpanded }]"
  :aria-hidden="!showThresholdDetails"
  @click.stop
>
  <div class="side-panel-header">
    <div class="side-panel-title">Detaylar & Olaylar</div>
    <div class="side-panel-actions">
      <button class="btn-apply-dates" @click="eventsFilter = 'all'">All</button>
      <button class="time-btn" @click="eventsFilter = 'warning'">Warning</button>
      <button class="time-btn" @click="eventsFilter = 'critical'">Critical</button>
      <button class="btn-apply-dates export" @click="exportEventsCSV()">Export CSV</button>
      <button class="btn-apply-dates" @click="toggleThresholdDetails()">Kapat</button>
      <button
  class="btn-apply-dates"
  @click="toggleSidePanelSize()"
  :title="sidePanelExpanded ? 'Küçült' : 'Büyüt'"
>
  <i :class="sidePanelExpanded ? 'fas fa-compress' : 'fas fa-expand'"></i>
</button>
    </div>
  </div>

  <div class="side-panel-body">
    <div class="side-top">
      <div class="donut-column">
        <apexchart
          type="donut"
          height="220"
          :options="{
            labels: ['Normal','Warning','Critical'],
            legend: { show: false },
            colors: ['#3b82f6','#f59e0b','#dc2626'],
            plotOptions: { pie: { donut: { size: '64%' } } }
          }"
          :series="[thresholdPercentages.normal, thresholdPercentages.warning, thresholdPercentages.critical]"
        />
        <div class="donut-caption">Zaman Dağılımı</div>
      </div>

      <div class="summary-column">
        <div class="summary-card">
          <div class="summary-label">Toplam Süre</div>
          <div class="summary-value">{{ (totalDurationMs / 3600000).toFixed(2) }} h</div>
          <div class="badge-row">
            <div class="badge normal">Normal: {{ (thresholdDurations.normal/3600000).toFixed(1) }}h</div>
            <div class="badge warning">Warning: {{ (thresholdDurations.warning/3600000).toFixed(1) }}h</div>
            <div class="badge critical">Critical: {{ (thresholdDurations.critical/3600000).toFixed(1) }}h</div>
          </div>
        </div>

        <div class="info-card">
          <div class="info-row">
            <div>
              <div class="info-label">Olay Sayısı</div>
              <div class="info-value">{{ thresholdEvents.length }}</div>
            </div>
            <div style="text-align:right">
              <div class="info-label">Son Olay</div>
              <div class="info-value">{{ thresholdEvents.length ? new Date(thresholdEvents[thresholdEvents.length-1].ts).toLocaleString('tr-TR') : '-' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="data-table-wrapper">
      <table class="data-table-modal">
        <thead>
          <tr>
            <th style="width:150px">Tarih</th>
            <th>Seri</th>
            <th>From → To</th>
            <th style="width:90px; text-align:right">Değer</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(ev, idx) in thresholdEvents.filter(e => eventsFilter === 'all' ? true : e.to === eventsFilter)" :key="idx">
            <td>{{ new Date(ev.ts).toLocaleString('tr-TR') }}</td>
            <td>{{ ev.series }}</td>
            <td>{{ ev.from ? ev.from + ' → ' : '' }}{{ ev.to }}</td>
            <td style="text-align:right">{{ ev.value }}</td>
          </tr>
          <tr v-if="thresholdEvents.length === 0">
            <td colspan="4" style="text-align:center; padding:12px; color:#94a3b8">Olay bulunamadı</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>


      <!-- Statistics -->
      <div v-if="analyticsChartData.length > 0" class="analytics-stats">
        <div class="stat-box normal">
          <span class="stat-icon">🟢</span>
          <div class="stat-info">
            <span class="stat-label">Normal</span>
            <span class="stat-value">{{ calculateStats().normal }}h</span>
          </div>
        </div>
        <div class="stat-box warning">
          <span class="stat-icon">🟡</span>
          <div class="stat-info">
            <span class="stat-label">Uyarı</span>
            <span class="stat-value">{{ calculateStats().warning }}h</span>
          </div>
        </div>
        <div class="stat-box critical">
          <span class="stat-icon">🔴</span>
          <div class="stat-info">
            <span class="stat-label">Kritik</span>
            <span class="stat-value">{{ calculateStats().critical }}h</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</Teleport>

  </div>
</template>

<style scoped>

  /* Submenu Button Styles */
.submenu-btn {
  width: 100%;
  padding:  12px 16px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  color: #0f172a;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.submenu-btn i {
  font-size: 16px;
  min-width: 20px;
  text-align: center;
  color: #3b82f6;
}

.submenu-btn:hover {
  background:   #f1f5f9;
  border-left-color: #3b82f6;
  padding-left: 20px;
}

.submenu-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submenu-btn:disabled:hover {
  background: none;
  border-left-color: transparent;
  padding-left: 16px;
}

/* Spin Animation */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.fa-spin {
  animation:   spin 1s linear infinite;
}


.inspect-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height:   100%;
  background:   rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.inspect-modal-content {
  background:  #ffffff;
  border-radius: 16px;
  width: 90%;
  max-width: 1000px;
  max-height:   85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
  overflow:  hidden;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.inspect-modal-header {
  padding: 24px;
  border-bottom: 2px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items:  center;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.inspect-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.inspect-modal-header h2 {
  margin: 0;
  font-size: 22px;
  color: #0f172a;
  font-weight: 700;
}

.inspect-modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #94a3b8;
  transition: all 0.2s;
  padding: 8px;
  border-radius:   6px;
}

.inspect-modal-close:hover {
  background:   #e2e8f0;
  color: #0f172a;
}

.inspect-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid #e2e8f0;
  padding:   0;
  background: #ffffff;
  overflow-x: auto;
}

.inspect-tab {
  padding:  16px 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  border-bottom: 3px solid transparent;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap:  8px;
  white-space: nowrap;
}

.inspect-tab i {
  font-size: 16px;
}

.inspect-tab.active {
  color: #3b82f6;
  border-bottom-color:  #3b82f6;
  background: #f0f9ff;
}

.inspect-tab:hover:not(.active) {
  color: #0f172a;
  background: #f8fafc;
}

.inspect-modal-body {
  flex: 1;
  overflow-y: auto;
  padding:   24px;
  background:   #ffffff;
}

.inspect-content {
  width: 100%;
}

/* DATA DISPLAY */
.data-display {
  display: flex;
  justify-content: center;
}

.data-card {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border:   2px solid #0284c7;
  border-radius: 12px;
  padding: 32px;
  text-align:   center;
  min-width: 300px;
  box-shadow: 0 4px 6px rgba(2, 132, 199, 0.1);
}

.data-card-label {
  font-size: 12px;
  font-weight: 600;
  color: #0284c7;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom:   12px;
}

.data-card-value {
  font-size: 48px;
  font-weight:   900;
  margin:  16px 0;
  font-family: 'Courier New', monospace;
}

.data-card-meta {
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  margin-top: 16px;
  padding-top: 16px;
  border-top:   1px solid rgba(2, 132, 199, 0.2);
}

/* STATS GRID */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.stat-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border-left: 4px solid #3b82f6;
  transition: all 0.2s;
}

.stat-item:hover {
  background: #f1f5f9;
  transform: translateX(4px);
}

.stat-icon {
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  color: #64748b;
  opacity: 0.7;
}

.stat-item:hover .stat-icon {
  color: #3b82f6;
  opacity: 1;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.stat-value {
  font-size:   16px;
  font-weight:   700;
  color: #0f172a;
  font-family: 'Courier New', monospace;
  word-break: break-all;
}

/* QUERY SECTION */
.query-section {
  width: 100%;
}

.query-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom:   16px;
}

.query-header i {
  font-size: 20px;
  color: #3b82f6;
}

.query-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight:   700;
  color: #0f172a;
}

.query-code {
  background: #1e293b;
  color:   #10b981;
  padding:  16px;
  border-radius:  8px;
  font-family:   'Courier New', monospace;
  font-size: 13px;
  overflow-x:  auto;
  word-break: break-all;
  line-height: 1.6;
  margin-bottom: 20px;
  border-left: 4px solid #10b981;
}

.query-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.query-info-item {
  display:   flex;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  align-items: flex-start;
}

.query-info-item i {
  color: #3b82f6;
  margin-top: 2px;
  flex-shrink: 0;
}

.query-info-label {
  font-size: 11px;
  font-weight:  600;
  color: #94a3b8;
  text-transform: uppercase;
}

.query-info-value {
  font-size:  14px;
  font-weight:   600;
  color: #0f172a;
  margin-top: 4px;
}

/* JSON VIEWER */
.json-viewer {
  background: #1e293b;
  color:   #e2e8f0;
  padding: 16px;
  border-radius: 8px;
  font-family:  'Courier New', monospace;
  font-size: 12px;
  max-height: 500px;
  overflow-y:   auto;
  line-height: 1.6;
  border-left: 4px solid #8b5cf6;
}

/* FOOTER */
.inspect-modal-footer {
  padding: 16px 24px;
  border-top:  2px solid #e2e8f0;
  display: flex;
  gap: 12px;
  justify-content:   flex-end;
  background: #f8fafc;
}

.inspect-btn-copy,
.inspect-btn-close {
  padding: 12px 20px;
  border:  none;
  border-radius:  8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.inspect-btn-copy {
  background: #3b82f6;
  color: white;
}

.inspect-btn-copy:hover {
  background: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.inspect-btn-close {
  background: #e2e8f0;
  color: #0f172a;
}

.inspect-btn-close:hover {
  background: #cbd5e1;
}

/* SCROLLBAR STİLİ */
.inspect-modal-body::-webkit-scrollbar,
.json-viewer::-webkit-scrollbar {
  width: 8px;
}

.inspect-modal-body::-webkit-scrollbar-track,
.json-viewer::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 10px;
}

.inspect-modal-body::-webkit-scrollbar-thumb,
.json-viewer::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.inspect-modal-body::-webkit-scrollbar-thumb:hover,
.json-viewer::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.panel-wrapper { width: 100%; height: 100%; position: relative;   overflow: visible; }
.panel-container {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: visible;
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}
.panel-container::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: transparent; pointer-events: none; border-radius: 10px; }
.panel-container:hover { border-color: #3b82f6; box-shadow: 0 8px 20px rgba(59, 130, 246, 0.12); transform: translateY(-3px); }
.panel-header { 
  padding: 16px 20px; 
  border-bottom: 1px solid #e2e8f0; 
  display:  flex; 
  justify-content: space-between; 
  align-items:   flex-start; 
  gap:  12px; 
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); 
  z-index: 20; 
  position: relative; 
  border-radius: 10px 10px 0 0; 
  overflow: visible ! important;
}
.panel-title-group { flex: 1; min-width: 0; }
.panel-title { font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.2px; }
.panel-desc { font-size: 12px; color: #64748b; margin: 0; display: -webkit-box; -webkit-line-clamp: 1; line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; }
.panel-controls { 
  position: relative; 
  z-index: 10; 
  overflow: visible ! important;
}
.control-btn { width: 32px; height: 32px; border:  1px solid #e2e8f0; border-radius: 6px; background: #ffffff; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.3s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.control-btn:hover { border-color: #3b82f6; color: #3b82f6; background: #f0f4f8; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15); transform: translateY(-1px); }
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.panel-menu {
  min-width: 240px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  padding: 8px 0;
  max-height: 400px;
  overflow-y: auto;
}

.menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99998;
  background: transparent;
  cursor: default;
}

.panel-menu::-webkit-scrollbar {
  width: 6px;
}

.panel-menu::-webkit-scrollbar-track {
  background: transparent;
}

.panel-menu::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius:   3px;
}

.panel-menu::-webkit-scrollbar-thumb:hover {
  background:  #94a3b8;
}

.menu-section { padding: 4px 0; }
.menu-section:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
.menu-section.danger { background: rgba(239, 68, 68, 0.03); }
.menu-btn { width: 100%; padding: 10px 16px; border: none; background:  transparent; color: #374151; cursor: pointer; font-size: 14px; font-weight: 500; text-align: left; display: flex; align-items: center; gap: 12px; transition: all 0.2s ease; position: relative; }
.menu-btn i:first-child { width: 18px; text-align: center; flex-shrink: 0; color: #6b7280; }
.menu-btn:hover { background: #f0f4f8; color:  #1f2937; padding-left: 20px; }
.menu-btn:hover i:first-child { color: #2563eb; }
.menu-btn.active { background: #eff6ff; color: #2563eb; }
.menu-btn.active i:first-child { color: #2563eb; }
.submenu-toggle { justify-content: space-between; }
.submenu-arrow { font-size: 12px; color: #9ca3af; margin-left:  auto; transition: transform 0.3s ease; }
.submenu-toggle.active .submenu-arrow { transform: rotate(90deg); color: #2563eb; }
.submenu { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 4px 0; max-height:   280px; overflow-y: auto; animation: slideDown 0.2s ease; }
.submenu-btn { width: 100%; padding:  8px 16px 8px 48px; border: none; background:   transparent; color: #475569; cursor: pointer; font-size: 13px; font-weight: 500; text-align: left; display: flex; align-items: center; gap: 10px; transition: all 0.2s ease; }
.submenu-btn i { width: 16px; text-align: center; color: #2563eb; flex-shrink:   0; }
.submenu-btn:hover { background: #e0f2fe; color: #0c4a6e; padding-left: 52px; }
.delete-btn-menu { color: #dc2626; }
.delete-btn-menu i:first-child { color: #dc2626 ! important; }
.delete-btn-menu:hover { background: #fee2e2; color: #991b1b; padding-left: 20px; }
.delete-btn-menu:hover i:first-child { color: #991b1b !  important; }
.submenu::-webkit-scrollbar { width: 6px; }
.submenu::-webkit-scrollbar-track { background: transparent; }
.submenu::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
.submenu::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
.fullscreen-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 999999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.3s ease; backdrop-filter: blur(4px); }
.fullscreen-content { background: #ffffff; border-radius: 12px; width: 90vw; height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); position: relative; }
.fullscreen-header { padding: 20px 30px; background: #ffffff; color: #0f172a; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
.fullscreen-header h2 { margin: 0; font-size:   20px; font-weight:  800; color: #0f172a; }
.btn-close-fullscreen { width: 36px; height: 36px; background: #f1f5f9; border:   1px solid #e2e8f0; border-radius:   8px; color: #64748b; cursor:   pointer; display: flex; align-items: center; justify-content:   center; font-size: 16px; transition: all 0.2s ease; }
.btn-close-fullscreen:hover { background: #fee2e2; color: #ef4444; border-color: #fecaca; transform: rotate(90deg); }
.fullscreen-body { flex: 1; padding: 20px; display: flex; flex-direction: column; background: #f8fafc; overflow: hidden; }
.fullscreen-body::-webkit-scrollbar { width:  8px; }
.fullscreen-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.panel-body { padding: 20px; flex: 1; overflow: visible; display: flex; align-items: center; justify-content: center; min-height: 200px; position: relative; z-index: 1; background: #ffffff; border-radius:  0 0 10px 10px; }
.alert-box { padding: 12px 16px; border-radius: 6px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; background: #fee2e2; color: #7f1d1d; border:  1px solid #fca5a5; border-left: 4px solid #dc2626; }
@keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.stat-panel-large { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; animation: fadeInScale 0.5s ease-out; }
.stat-large-wrapper { width: 100%; padding: 20px; border-radius: 8px; text-align: center; display: flex; flex-direction: column; gap: 12px; }
.stat-label-large { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.stat-value-large { font-size: 56px; font-weight: 900; background: linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1; }
.stat-unit-large { font-size: 20px; margin-left: 8px; opacity: 0.8; }
.stat-bar { width: 100%; height: 4px; background: #e2e8f0; border-radius:   2px; margin-top: 12px; position: relative; overflow: hidden; }
@keyframes slideRight { from { width: 0; } to { width: 85%; } }
.stat-bar::after { content: ''; position: absolute; top: 0; left:   0; height: 100%; width: 85%; background: linear-gradient(90deg, #3b82f6 0%, #7c3aed 100%); border-radius: 2px; animation: slideRight 1s ease-out; }
.gauge-panel { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.gauge-wrapper { width: 100%; max-width: 350px; display: flex; justify-content: center; }
.gauge-svg { width: 100%; height:  auto; overflow: visible; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.05)); }
.gauge-fill { transition: d 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.needle-group { transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1); transform-origin: 150px 130px; }
.svg-value-text { font-family: 'Inter', system-ui, sans-serif; font-weight: 800; font-size: 32px; color: #0f172a; pointer-events: none; }
.progress-panel { width: 100%; animation: fadeInScale 0.5s ease-out; }
.progress-bar-bg { width: 100%; height:  40px; background: #f1f5f9; border-radius:  8px; border: 1px solid #e2e8f0; padding: 4px; display: flex; align-items: center; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, #10b981 0%, #14b8a6 100%); border-radius: 6px; width: 0; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 12px rgba(16, 185, 129, 0.3); }
.progress-info { display: flex; justify-content: space-between; margin-top: 12px; }
.progress-value-text { font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.progress-unit-text { font-size: 12px; color: #64748b; font-weight: 600; }
.chart-panel { width: 100%; height: 100%; display: flex; flex-direction: column; gap: 12px; cursor: pointer; transition: all 0.3s ease; }
.chart-panel:hover { opacity: 0.95; }
.chart-wrapper { width: 100%; display: flex; flex-direction: column; gap: 12px; }
.sparkline-chart { width: 100%; height:   80px; filter: drop-shadow(0 2px 8px rgba(59, 130, 246, 0.15)); }
.sparkline-line { fill: none; stroke: #3b82f6; stroke-width:   2.5; }
.sparkline-area { fill: url(#sparkGradient); }
.chart-info { display: flex; flex-direction: column; gap: 8px; }
.chart-label { font-size: 11px; color: #64748b; font-family: 'Courier New', monospace; font-weight: 500; }
.chart-stats { display: flex; justify-content: space-around; gap: 8px; }
.table-panel { width: 100%; height:  100%; display: flex; flex-direction: column; overflow:  hidden; }
.table-filter-header { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); }
.filter-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.filter-btn { padding: 8px 14px; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff; color: #475569; cursor: pointer; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.3s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.filter-btn:hover { border-color: #3b82f6; color: #3b82f6; background: #f0f4f8; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1); transform: translateY(-1px); }
.filter-btn.active { border-color: #3b82f6; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #1d4ed8; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); }
.data-table { width: 100%; border-collapse: collapse; font-size: 14px; flex:  1; overflow-y: auto; }
.data-table::-webkit-scrollbar { width:   6px; }
.data-table::-webkit-scrollbar-track { background: transparent; }
.data-table::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
.data-table::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
.table-header-metric, .table-header-value, .table-header-trend { padding: 12px; background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); color: #3b82f6; text-align: left; font-size: 12px; border-bottom: 2px solid #e2e8f0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.table-cell { padding: 12px; color: #0f172a; border-bottom: 1px solid #f1f5f9; transition: all 0.2s ease; }
.data-table tbody tr:hover.table-cell { background: #f8fafc; }
.metric-name { color: #1a202c; font-weight: 600; }
.metric-value { text-align: right; color: #3b82f6; font-family: 'Courier New', monospace; font-weight: 700; }
.trend-badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; text-transform: uppercase; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
.trend-badge.positive { background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%); color: #15803d; border:  1px solid #10b981; }
.trend-badge.negative { background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #991b1b; border: 1px solid #ef4444; }
.alert-panel { width: 100%; padding: 16px; border-radius: 8px; border-left: 4px solid; display: flex; gap: 14px; background: linear-gradient(135deg, #eff6ff 0%, #f0f4f8 100%); border-color: #3b82f6; color: #1d4ed8; box-shadow: 0 1px 3px rgba(59, 130, 246, 0.1); }
.alert-panel.alert-success { background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%); border-color: #15803d; color: #15803d; }
.alert-panel.alert-warning { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-color: #d97706; color: #92400e; }
.alert-icon-wrapper { font-size: 20px; flex-shrink: 0; }
.alert-content-wrapper { flex: 1; }
.alert-title { font-size: 14px; font-weight: 700; margin:  0 0 4px 0; }
.alert-message { font-size: 12px; margin: 0; opacity: 0.95; font-weight: 500; }
.heatmap-panel { width: 100%; height: 100%; display: flex; flex-direction: column; }
.heatmap-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; padding: 12px; }
.heatmap-cell { aspect-ratio: 1; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.3); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; min-height: 70px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
.heatmap-cell:hover { transform: scale(1.12) translateY(-2px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2); }
.heatmap-value { display: block; font-size: 18px; font-weight: 900; margin-bottom: 4px; }
.default-panel { text-align: center; color: #64748b; }
.default-title { font-size: 14px; font-weight: 600; margin:  0 0 8px 0; color: #0f172a; }
.default-query { font-size: 11px; font-family: 'Courier New', monospace; display: block; word-break: break-all; color: #94a3b8; }
@keyframes fadeIn { from { opacity:  0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.3s ease; }
.modal-content { background: #ffffff; border:  1px solid #e2e8f0; border-radius:  12px; padding: 0; max-width: 400px; width: 90%; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15); animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-header { padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); }
.modal-header h3 { margin: 0; color: #0f172a; font-size:   18px; font-weight: 800; letter-spacing: -0.3px; }
.modal-close { background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; transition: all 0.3s ease; width: 32px; height: 32px; display: flex; align-items:  center; justify-content: center; }
.modal-close:hover { color: #dc2626; background: #fee2e2; border-radius: 6px; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
.modal-body::-webkit-scrollbar { width:   6px; }
.modal-body::-webkit-scrollbar-track { background: transparent; }
.modal-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); border-radius: 6px; border-left: 3px solid #3b82f6; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.detail-label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.detail-value { color: #0f172a; font-size:   14px; font-weight: 800; font-family: 'Courier New', monospace; }
.detail-status { padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
.detail-status.status-low { background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%); color: #15803d; border:   1px solid #10b981; }
.detail-status.status-medium { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #92400e; border:  1px solid #f59e0b; }
.detail-status.status-high { background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #991b1b; border: 1px solid #ef4444; }
@media (max-width: 768px) { .panel-container { border-radius: 8px; overflow: visible; } .panel-body { padding: 16px; min-height: 150px; } .stat-value-large { font-size: 42px; } .heatmap-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; } .modal-content { max-width: 90vw; } .modal-body { padding: 16px; } .fullscreen-content { width: 95vw; height: 95vh; } }
/* ✅ DATA MODAL */
.data-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right:  0;
  bottom:   0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  backdrop-filter: blur(4px);
}

.data-modal-content {
  background:   #ffffff;
  border-radius: 12px;
  width: 90%;
  max-width: 1000px;
  max-height:   80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

.data-modal-header {
  padding: 24px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  border-radius: 12px 12px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.data-modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight:   700;
}

.data-modal-close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius:   8px;
  cursor: pointer;
  font-size: 20px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.data-modal-close:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(90deg);
}

.data-modal-body {
  flex:  1;
  overflow-y: auto;
  padding:   24px;
}

.data-table-modal {
  width: 100%;
  border-collapse:   collapse;
  font-size: 14px;
}

.data-table-modal thead {
  background: #f1f5f9;
  position: sticky;
  top: 0;
  z-index:   10;
}

.data-table-modal th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 700;
  color: #0f172a;
  border-bottom: 2px solid #e2e8f0;
}

.data-table-modal td {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  color: #475569;
}

.data-table-modal tbody tr:hover {
  background:  #f8fafc;
}

.value-cell {
  color: #3b82f6;
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

.time-cell {
  font-size: 12px;
  color: #64748b;
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #94a3b8;
  padding: 40px;
  text-align:   center;
}

.no-data i {
  font-size: 48px;
  opacity: 0.5;
}

.data-modal-footer {
  padding: 20px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  border-radius: 0 0 12px 12px;
  justify-content: flex-end;
}

.data-btn-export-csv,
.data-btn-export-image,
.data-btn-close {
  padding: 10px 16px;
  border: none;
  border-radius:  8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.data-btn-export-csv {
  background: #10b981;
  color: white;
}

.data-btn-export-csv:hover {
  background: #059669;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.data-btn-export-image {
  background: #8b5cf6;
  color: white;
}

.data-btn-export-image:hover {
  background: #7c3aed;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.data-btn-close {
  background: #e2e8f0;
  color: #0f172a;
}

.data-btn-close:hover {
  background: #cbd5e1;
  transform:   translateY(-2px);
}

@media (max-width: 768px) {
  .data-modal-content {
    width: 95%;
    max-height: 90vh;
  }

  .data-modal-header {
    padding: 16px;
  }

  .data-modal-header h2 {
    font-size: 16px;
  }

  .data-table-modal {
    font-size: 12px;
  }

  .data-table-modal th,
  .data-table-modal td {
    padding: 8px 12px;
  }

  .data-modal-footer {
    flex-direction: column;
  }

  .data-btn-export-csv,
  .data-btn-export-image,
  .data-btn-close {
    width: 100%;
    justify-content: center;
  }
}

.stat-data-display {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px;
}

.stat-value-card {
  background: linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%);
  color: white;
  padding: 30px;
  border-radius:   12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
  font-weight: 600;
  user-select: text;
}

.stat-value-large {
  font-size: 48px;
  font-weight:  900;
  line-height: 1;
  user-select: text;
  cursor: text;
  background:   linear-gradient(135deg, #fbbf24 0%, #0bf594 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.stat-unit {
  font-size: 18px;
  opacity: 0.8;
  user-select: text;
}

.stat-info {
  background: #f8fafc;
  padding: 16px;
  border-radius:   8px;
  border-left: 4px solid #3b82f6;
}

.stat-info p {
  margin:   8px 0;
  font-size: 13px;
  color: #475569;
}

.stat-info strong {
  color:   #1a202c;
}

.progress-container {
  padding: 20px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items:   center;
  margin-bottom:   16px;
}

.progress-label {
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
}

.progress-value {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
}

.progress-percent {
  font-size: 14px;
  color: #94a3b8;
  margin-left:  8px;
}

.progress-bar-wrapper {
  margin:   24px 0;
}

.progress-bar-background {
  width: 100%;
  height:   12px;
  background: #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.progress-bar-fill {
  height:  100%;
  background:   #3b82f6;
  border-radius: 12px;
  transition: width 0.4s ease;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.progress-info {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 20px;
}

.progress-info-item {
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 3px solid #3b82f6;
  text-align: center;
}

.info-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.info-value {
  display: block;
  font-size: 18px;
  font-weight:   800;
  color: #0f172a;
  font-family: 'Courier New', monospace;
}

.gauge-container {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.gauge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.gauge-title {
  font-size: 14px;
  font-weight:   600;
  color: #64748b;
}

.gauge-status {
  font-size: 13px;
  font-weight:  700;
  padding: 4px 12px;
  background:   rgba(59, 130, 246, 0.1);
  border-radius: 6px;
}

.gauge-value-display {
  font-size:   48px;
  font-weight:   900;
  color: #0f172a;
  text-align: center;
  font-family: 'Courier New', monospace;
}

.gauge-bar-wrapper {
  position: relative;
  margin:  16px 0;
}

.gauge-bar-background {
  width: 100%;
  height:   16px;
  background: #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.gauge-bar-fill {
  height: 100%;
  background:  #3b82f6;
  border-radius: 16px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
}

.gauge-bar-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  font-weight:  700;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 8px;
  border-radius:   4px;
  white-space:   nowrap;
}

.gauge-info-grid {
  display: grid;
  grid-template-columns:   repeat(3, 1fr);
  gap: 12px;
}

.gauge-info-item {
  padding: 12px;
  background: #f8fafc;
  border-radius:  8px;
  border-top: 3px solid #3b82f6;
  text-align: center;
}

.gauge-info-label {
  display: block;
  font-size: 11px;
  font-weight:   700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom:  6px;
}

.gauge-info-value {
  display: block;
  font-size: 18px;
  font-weight:  800;
  color: #0f172a;
  font-family: 'Courier New', monospace;
}

/* ✅ ANALYTICS MODAL - ApexCharts */
.analytics-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width:   100%;
  height: 100%;
  background:   rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
}

.analytics-modal-content {
  background:   white;
  border-radius: 12px;
  width: 95%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
  overflow:   hidden;
}

.analytics-header {
  padding:  20px;
  border-bottom:   2px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items:  center;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.analytics-header h2 {
  margin: 0;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #0f172a;
}

.close-btn {
  background:   none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #94a3b8;
  transition: all 0.2s;
  padding: 4px;
  border-radius: 6px;
}

.close-btn:hover {
  color:   #0f172a;
  background: #e2e8f0;
}

.analytics-toolbar {
  padding: 16px;
  border-bottom:  1px solid #e2e8f0;
  display: flex;
  gap: 16px;
  align-items:  flex-end;
  flex-wrap: wrap;
  background: #f9fafc;
}

.time-buttons {
  display: flex;
  gap: 8px;
}

.time-btn {
  background: white;
  border: 1px solid #d1d5db;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
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

.custom-date-inputs {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.date-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date-input-group label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
}

.date-input {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size:  12px;
  color: #374151;
}

.analytics-chart-container {
  flex: 1;
  padding: 16px;
  overflow:   auto;
  position: relative;
  min-height: 300px;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #6b7280;
  gap: 12px;
}

.loading-indicator i {
  font-size: 32px;
  color: #3b82f6;
  animation: spin 1s linear infinite;
}

.chart-empty {
  display:   flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #9ca3af;
  gap:   10px;
  font-size: 16px;
}

.analytics-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  background: #f9fafc;
}

.stat-box {
  padding: 12px;
  border-radius:  8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-box.normal {
  background: #dcfce7;
  border-left: 3px solid #16a34a;
}

.stat-box.warning {
  background: #fef3c7;
  border-left: 3px solid #f59e0b;
}

.stat-box.critical {
  background: #fee2e2;
  border-left: 3px solid #dc2626;
}

.stat-icon {
  font-size: 24px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
}

.stat-value {
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
  font-family: 'Courier New', monospace;
}

/* ✅ Analytics Modal */
.analytics-modal-content {
  background: #ffffff;
  border-radius: 16px;
  width: 95%;
  max-width: 1400px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.analytics-header {
  padding: 24px;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
}

.analytics-header h2 {
  margin: 0;
  font-size: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #1f2937;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.close-btn {
  width: 36px;
  height: 36px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.close-btn:hover {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
  transform: rotate(90deg);
}

.analytics-toolbar {
  padding: 20px;
  border-bottom:  1px solid #e5e7eb;
  display: flex;
  gap: 20px;
  align-items:  flex-end;
  flex-wrap: wrap;
  background: linear-gradient(135deg, #fafbfc 0%, #f3f4f6 100%);
}

.time-buttons {
  display: flex;
  gap: 8px;
}

.time-btn {
  background: white;
  border: 2px solid #e5e7eb;
  padding: 10px 18px;
  border-radius:  8px;
  cursor:  pointer;
  font-size:  12px;
  font-weight: 700;
  color: #64748b;
  transition: all 0.3s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.time-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.time-btn.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.analytics-chart-container {
  flex: 1;
  padding: 20px;
  overflow: auto;
  position: relative;
  background: #ffffff;
}

.analytics-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  padding: 20px;
  border-top: 2px solid #e5e7eb;
  background: linear-gradient(135deg, #fafbfc 0%, #f3f4f6 100%);
}

.stat-box {
  padding: 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-left: 4px solid;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
}

.stat-box:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.stat-box.normal {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border-left-color: #16a34a;
}

.stat-box.warning {
  background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%);
  border-left-color: #f59e0b;
}

.stat-box.critical {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border-left-color: #dc2626;
}

.stat-icon {
  font-size: 28px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 10px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight:  900;
  color: #1f2937;
  font-family: 'Courier New', monospace;
}

/* ✅ Tooltip Renkli Badge */
:deep(.apexcharts-tooltip-series-group) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.apexcharts-tooltip-marker) {
  width: 10px;
  height: 10px;
  border-radius:  50%;
  border: 2px solid white;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}

/* ✅ Critical - Kırmızı */
:deep(.apexcharts-series-0 .apexcharts-marker) {
  fill: #dc2626 !important;
  stroke: #991b1b !important;
}

/* ✅ Warning - Sarı */
:deep(.apexcharts-series-1 .apexcharts-marker) {
  fill: #f59e0b !important;
  stroke: #d97706 !important;
}

/* ✅ Normal - Mavi */
:deep(.apexcharts-series-2 .apexcharts-marker) {
  fill: #3b82f6 !important;
  stroke: #1d4ed8 !important;
}

/* ✅ ANALYTICS MODAL - Buton Stilleri */
.btn-apply-dates,
.btn-reset-dates {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background:  #ffffff;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  font-weight:  600;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 40px;
  justify-content: center;
}

.btn-apply-dates:hover {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
  transform: translateY(-1px);
}

.btn-reset-dates:hover {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);
  transform: translateY(-1px);
}

/* ✅ CUSTOM TARİH SEÇİCİ */
.custom-date-inputs {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.date-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.date-input-group label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.date-input {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  background: #ffffff;
  font-family: 'Courier New', monospace;
  transition: all 0.2s;
  min-width: 160px;
}

.date-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: #f0f9ff;
}

.date-input:hover {
  border-color: #cbd5e1;
  background: #f9fafc;
}

/* ✅ ANALYTICS TOOLBAR - Responsive */
.analytics-toolbar {
  display: flex;
  gap:  16px;
  flex-wrap:  wrap;
  align-items: flex-end;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #fafbfc 0%, #f3f4f6 100%);
}

/* ✅ TIME BUTTONS GRUP */
.time-buttons {
  display: flex;
  gap: 8px;
  flex-wrap:  wrap;
}

.time-btn {
  padding: 10px 18px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  color:  #64748b;
  cursor: pointer;
  font-size: 12px;
  font-weight:  700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: fit-content;
}

.time-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
  transform:  translateY(-2px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.time-btn.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

/* ✅ ANALYTICS CHART CONTAINER */
.analytics-chart-container {
  flex: 1;
  padding: 20px;
  overflow: auto;
  position: relative;
  min-height: 350px;
  background: #ffffff;
}

.analytics-chart-container::-webkit-scrollbar {
  width: 8px;
}

.analytics-chart-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 10px;
}

.analytics-chart-container::-webkit-scrollbar-thumb {
  background:  #cbd5e1;
  border-radius: 10px;
}

.analytics-chart-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* ✅ LOADING INDICATOR */
.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 350px;
  gap: 16px;
}

.loading-indicator i {
  font-size: 36px;
  color: #3b82f6;
  animation: spin 2s linear infinite;
}

.loading-indicator p {
  font-size: 14px;
  color: #64748b;
  font-weight: 600;
}

/* ✅ CHART EMPTY STATE */
.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 350px;
  gap: 12px;
  color: #94a3b8;
}

.chart-empty i {
  font-size: 48px;
  opacity: 0.5;
}

.chart-empty p {
  font-size: 16px;
  font-weight:  600;
}

/* ✅ ANALYTICS STATS */
.analytics-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  padding: 20px;
  border-top: 2px solid #e5e7eb;
  background: linear-gradient(135deg, #fafbfc 0%, #f3f4f6 100%);
}

.stat-box {
  padding: 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-left: 4px solid;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stat-box:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.stat-box.normal {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border-left-color: #16a34a;
}

.stat-box.warning {
  background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%);
  border-left-color: #f59e0b;
}

.stat-box.critical {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border-left-color: #dc2626;
}

.stat-icon {
  font-size: 28px;
  min-width: 32px;
  text-align: center;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-label {
  font-size: 10px;
  font-weight: 800;
  color: #64748b;
  text-transform:  uppercase;
  letter-spacing:  1px;
}

.stat-value {
  font-size:  20px;
  font-weight: 900;
  color: #1f2937;
  font-family: 'Courier New', monospace;
}

/* ✅ RESPONSIVE - Tablet */
@media (max-width: 1024px) {
  .analytics-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .time-buttons {
    width: 100%;
  }

  .custom-date-inputs {
    width: 100%;
    justify-content: space-between;
  }

  .analytics-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* ✅ RESPONSIVE - Mobile */
@media (max-width: 640px) {
  .analytics-modal-content {
    width: 98%;
    max-height: 95vh;
    border-radius: 12px;
  }

  .analytics-header {
    padding: 16px;
  }

  .analytics-header h2 {
    font-size: 16px;
  }

  .analytics-toolbar {
    padding: 12px;
    gap: 10px;
  }

  .time-buttons {
    width:  100%;
    flex-wrap: wrap;
  }

  .time-btn {
    flex: 1;
    min-width: 60px;
    padding: 8px 12px;
    font-size: 11px;
  }

  .custom-date-inputs {
    flex-direction: column;
    width: 100%;
  }

  .date-input-group {
    width: 100%;
  }

  .date-input {
    width: 100%;
    min-width: unset;
  }

  .btn-apply-dates,
  .btn-reset-dates {
    width: 100%;
    justify-content: center;
  }

  .analytics-stats {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 12px;
  }

  .stat-box {
    padding: 12px;
  }

  .analytics-chart-container {
    min-height: 250px;
    padding: 12px;
  }
}

/* Threshold details small styles */
.analytics-threshold-details .summary-card { box-shadow: 0 6px 18px rgba(2,6,23,0.04); }
.analytics-threshold-details table { font-size: 13px; }
.analytics-threshold-details thead th { background:#fbfcfe; font-weight:700; color:#475569; padding:10px 12px; }
.analytics-threshold-details .time-btn { padding: 8px 12px; border-radius: 6px; border: 1px solid #e5e7eb; background: #ffffff; cursor:pointer; }
.analytics-threshold-details .time-btn:hover { background: #eff6ff; border-color: #3b82f6; color: #3b82f6; }
/* Toggle details button */
.btn-toggle-details {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.15s ease;
}
.btn-toggle-details:hover { background:#f0f9ff; border-color:#3b82f6; color:#1f2937; transform: translateY(-1px); }
.btn-toggle-details[aria-pressed="true"] { background: linear-gradient(135deg,#e0f2fe, #dbeafe); border-color:#2563eb; color:#0f172a; }


.analytics-threshold-details {
  padding: 20px;
  background: #fff;
  border-top: 1px solid #e8eef4;
  margin-top: 8px;
}


.analytics-threshold-details .threshold-grid {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 20px;
  align-items: start;
}


.analytics-threshold-details .threshold-grid > div:nth-child(2) {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  align-items: start;
}


.analytics-threshold-details > .threshold-grid > :first-child {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.analytics-threshold-details apexchart[height] {
  
  max-width: 260px !important;
  max-height: 260px !important;
}


.analytics-threshold-details .summary-card {
  padding: 18px;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, #fbfdff);
  box-shadow: 0 8px 24px rgba(16,24,40,0.06);
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}


.analytics-threshold-details .summary-card > div:first-child {
  font-size: 12px;
  color: #64748b;
}
.analytics-threshold-details .summary-card .stat-value {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
}


.analytics-threshold-details .summary-card .badge-row {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.analytics-threshold-details .summary-card .badge {
  padding: 10px 12px;
  border-radius: 8px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(2,6,23,0.04);
}


.analytics-threshold-details .summary-card[style*="width:320px"], 
.analytics-threshold-details .summary-card:last-child {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 20px rgba(2,6,23,0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
}


.analytics-threshold-details .btn-apply-dates,
.analytics-threshold-details .btn-toggle-details,
.analytics-threshold-details .time-btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #e6eef7;
  background: #fff;
  font-weight: 700;
}


.analytics-threshold-details .data-table-modal {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  color: #1f2937;
}
.analytics-threshold-details .data-table-modal thead th {
  background: #f8fafc;
  color: #334155;
  font-weight: 700;
  padding: 12px 14px;
  border-bottom: 1px solid #e6eef7;
  position: sticky;
  top: 0;
  z-index: 3;
}
.analytics-threshold-details .data-table-modal tbody tr {
  background: transparent;
  transition: background 0.15s ease;
}
.analytics-threshold-details .data-table-modal tbody tr:nth-child(odd) {
  background: #fff;
}
.analytics-threshold-details .data-table-modal tbody tr:nth-child(even) {
  background: #fbfdff;
}
.analytics-threshold-details .data-table-modal tbody tr:hover {
  background: #eef7ff !important;
}
.analytics-threshold-details .data-table-modal td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f6fb;
  vertical-align: middle;
  font-size: 14px;
  line-height: 1.4;
}


.analytics-threshold-details > .data-table-wrapper {
  max-height: 340px;
  overflow: auto;
  border-radius: 10px;
  padding: 6px;
  border: 1px solid #eef4f8;
  background: linear-gradient(180deg, #ffffff, #fcfeff);
}


.analytics-threshold-details .data-table-wrapper::-webkit-scrollbar,
.analytics-threshold-details .data-table-modal::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}
.analytics-threshold-details .data-table-wrapper::-webkit-scrollbar-thumb,
.analytics-threshold-details .data-table-modal::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
.analytics-threshold-details .data-table-wrapper::-webkit-scrollbar-track {
  background: #f8fafc;
}


.analytics-threshold-details .btn-apply-dates.export {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
.analytics-threshold-details .btn-apply-dates.export:hover {
  background: #1e40af;
}


@media (max-width: 920px) {
  .analytics-threshold-details .threshold-grid {
    grid-template-columns: 1fr;
  }
  .analytics-threshold-details .threshold-grid > div:nth-child(2) {
    grid-template-columns: 1fr;
  }
  .analytics-threshold-details apexchart[height] {
    max-width: 220px !important;
    max-height: 220px !important;
  }
  .analytics-threshold-details > .data-table-wrapper { max-height: 240px; }
}

.btn-toggle-details {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.15s ease;
}
.btn-toggle-details:hover { background:#f0f9ff; border-color:#3b82f6; color:#1f2937; transform: translateY(-1px); }
.btn-toggle-details[aria-pressed="true"] { background: linear-gradient(135deg,#e0f2fe, #dbeafe); border-color:#2563eb; color:#0f172a; }


.slide-fade-enter-active, .slide-fade-leave-active {
  transition: all .25s ease;
}
.slide-fade-enter-from, .slide-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.slide-fade-enter-to, .slide-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.analytics-modal-content { position: relative; }


.analytics-modal-content { position: relative; }

.analytics-side-panel.fullscreen {
  position: absolute;         
  left: 24px;                
  right: 24px;                
  top: 88px;                  
  bottom: 24px;               
  width: auto;
  max-width: none;
  min-width: 0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 30px 80px rgba(2,6,23,0.28);
  z-index: 1400;
  overflow: hidden;
  transition: none;         
}


.analytics-side-panel.fullscreen .side-panel-header {
  position: relative;
  z-index: 2;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(226,232,240,0.6);
  background: linear-gradient(180deg,#fff,#fbfdff);
  flex-shrink: 0;
}


.analytics-side-panel.fullscreen .side-panel-body {
  height: calc(100% - 64px);  
  overflow: auto;
  padding: 22px;
  -webkit-overflow-scrolling: touch;
}


.analytics-side-panel.fullscreen .donut-column { width: 320px; }
.analytics-side-panel.fullscreen apexchart[height] { max-height: 320px !important; }
.analytics-side-panel.fullscreen .data-table-wrapper { max-height: calc(100% - 420px); padding: 12px; }


@media (max-width: 900px) {
  .analytics-side-panel.fullscreen {
    left: 12px;
    right: 12px;
    top: 72px;
    bottom: 12px;
  }
  .analytics-side-panel.fullscreen .donut-column { width: 240px; }
  .analytics-side-panel.fullscreen apexchart[height] { max-height: 240px !important; }
}

.analytics-side-panel {
  position: absolute;
  top: 88px; 
  right: 20px;
  bottom: 20px;
  width: 520px;           
  max-width: 60%;
  min-width: 360px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 30px 80px rgba(2,6,23,0.28);
  z-index: 60;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width .22s ease, right .22s ease, transform .18s ease, opacity .18s ease;
  font-size: 14px;
}


.analytics-side-panel.large {
  width: calc(80vw);
  max-width: calc(100vw - 120px);
  right: 20px;
  top: 70px;
  border-radius: 12px;
}


.analytics-side-panel .side-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #eef4f8;
  background: linear-gradient(180deg,#fff,#fbfdff);
  flex-shrink: 0;
}
.side-panel-title { font-weight: 800; color: #0f172a; font-size: 15px; }
.side-panel-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }


.btn-apply-dates, .time-btn, .btn-toggle-details {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #e6eef7;
  background: #fff;
  font-weight: 700;
  cursor: pointer;
  font-size: 13px;
}


.analytics-side-panel .side-panel-body {
  padding: 18px;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.side-top { display:flex; gap:18px; align-items:flex-start; }
.donut-column { width: 220px; flex-shrink: 0; display:flex; flex-direction:column; align-items:center; }
.donut-caption { margin-top:8px; font-weight:700; color:#334155; font-size:14px; }
.summary-column { flex: 1; display:flex; flex-direction:column; gap:12px; }


.analytics-side-panel.large .donut-column { width: 280px; }
.analytics-side-panel.large apexchart[height] { max-height: 260px !important; }


.summary-card { padding: 14px; border-radius: 12px; background: #f8fafc; box-shadow: 0 10px 28px rgba(2,6,23,0.05); }
.summary-label { font-size:13px; color:#64748b; font-weight:700; margin-bottom:6px; }
.summary-value { font-size:22px; font-weight:900; color:#0f172a; margin-bottom:8px; }
.badge-row { display:flex; gap:10px; flex-wrap:wrap; }
.badge { padding:10px 12px; border-radius:9px; font-weight:800; font-size:14px; }


.info-card { padding: 12px; border-radius: 12px; background: #fff; border: 1px solid #eef4f8; box-shadow: 0 8px 20px rgba(2,6,23,0.04); }
.info-label { font-size:12px; color:#64748b; font-weight:700; text-transform:uppercase; }
.info-value { font-size:18px; font-weight:900; color:#0f172a; }


.data-table-wrapper { margin-top: 14px; border-radius: 10px; border: 1px solid #eef4f8; overflow: auto; background: #fff; padding: 8px; }
.data-table-wrapper { max-height: calc(100% - 420px); } 
.analytics-side-panel.large .data-table-wrapper { max-height: calc(100% - 320px); } 


.data-table-modal { width:100%; border-collapse:collapse; font-size:14px; }
.data-table-modal thead th { padding:12px 14px; background:#fbfcfe; font-weight:800; color:#334155; position: sticky; top: 0; z-index:3; }
.data-table-modal td { padding:12px 14px; border-bottom: 1px solid #f1f6fb; }


@media (max-width: 1100px) {
  .analytics-side-panel { width: 460px; right: 16px; top: 88px; }
  .donut-column { width: 200px; }
}
@media (max-width: 820px) {
  .analytics-side-panel { right: 12px; left: 12px; width: auto; top: 120px; bottom: 12px; max-width: unset; border-radius:10px; }
  .analytics-side-panel.large { width: calc(100vw - 40px); top: 110px; }
}


.analytics-side-panel .side-panel-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  
  min-height: 0;
}


.analytics-side-panel .side-top {
  flex: 0 0 auto; 
}


.analytics-side-panel .data-table-wrapper {
  flex: 1 1 auto;   
  min-height: 0;    
  overflow: auto;
  padding: 8px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #eef4f8;
  box-shadow: none;
}


.analytics-side-panel.fullscreen .side-panel-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  min-height: 0;
}
.analytics-side-panel.fullscreen .data-table-wrapper {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none; 
  overflow: auto;
}
</style>