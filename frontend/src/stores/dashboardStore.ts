import { defineStore } from 'pinia'
import { ref, computed } from 'vue'


export type PanelType = 
| 'stat' 
| 'gauge' 
| 'chart' 
| 'table' 
| 'progress' 
| 'alert' 
| 'heatmap' 
| 'mini-chart'
| 'sparkline'


export interface DashboardPanel {
  id:  string
  dashboard_id: string
  type: PanelType
  title: string
  description?: string
  query: string
  metric_name?: string
  position:  { x: number; y: number; w: number; h: number }
  settings?: {
    queries?: any[]
    additionalPanelIds?: string[]  
    [key: string]:  any
  }
  refresh_rate?: number
  unit?: string
  min?: number
  max?: number
  decimals?: number
  threshold?: { base?: number; warning:  number; critical: number }
  visible: boolean
  created_at?: string
  updated_at?:  string
}
// Dashboard Interface
export interface Dashboard {
  id:  string
  name: string
  description:   string
  icon:  string
  tags: string[]
  panels: DashboardPanel[]
  created_at: string
  updated_at: string
  is_favorite: boolean
  refresh_rate: number
  time_range: 'last1h' | 'last6h' | 'last24h' | 'last7d' | 'custom'
  theme: 'dark' | 'light'
  layout: 'grid' | 'flex'
  gridLayout?:  any[] 
}


export const exportPanel = (panel: DashboardPanel) => {
  const data = JSON.stringify(panel, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `panel-${panel.title}.json`
  link.click()
  URL.revokeObjectURL(url)
  console.log('✅ Panel export edildi:', panel.title)
}


export const importPanel = async (file: File): Promise<DashboardPanel | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        data.id = `panel-${Date.now()}` // Yeni ID
        resolve(data as DashboardPanel)
        console.log('✅ Panel import edildi:', data.title)
      } catch (error) {
        console.error('❌ Import hatası:', error)
        alert('Geçersiz panel dosyası!')
        resolve(null)
      }
    }
    reader.readAsText(file)
  })
}


export const exportDashboard = (dashboard: Dashboard) => {
  const data = JSON. stringify(dashboard, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `dashboard-${dashboard.name}.json`
  link.click()
  URL.revokeObjectURL(url)
  console.log('✅ Dashboard export edildi:', dashboard.name)
}


export const importDashboard = async (file: File): Promise<Dashboard | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        data.id = `dashboard-${Date.now()}` // Yeni ID
        data.panels = data.panels?. map((p: any) => ({
          ...p,
          id: `panel-${Date.now()}-${Math.random()}`
        })) || []
        resolve(data as Dashboard)
        console.log('✅ Dashboard import edildi:', data.name)
      } catch (error) {
        console.error('❌ Import hatası:', error)
        alert('Geçersiz dashboard dosyası!')
        resolve(null)
      }
    }
    reader.readAsText(file)
  })
}

export const useDashboardStore = defineStore('dashboard', () => {
  
  const dashboards = ref<Dashboard[]>([])
  const current_dashboard = ref<Dashboard | null>(null)
  const favorites = ref<string[]>([])
  const theme = ref<'dark' | 'light'>('dark')
  const auto_refresh = ref<boolean>(true)

  
  const getAllDashboards = computed(() => dashboards.value)
  const getFavoriteDashboards = computed(() => 
    dashboards.value.filter(d => d.is_favorite)
  )
  const getDashboardById = computed(() => 
    (id: string) => dashboards.value.find(d => d.id === id)
  )
  const getCurrentDashboard = computed(() => current_dashboard.value)

  

  
  const initializeDashboards = () => {
    dashboards.value = [
      {
        id: 'solar-system-01',
        name: '☀️ Solar System Monitoring',
        description: 'Güneş paneli sistemi, MPPT kontrolör ve batarya izleme',
        icon: 'fas fa-sun',
        tags:   ['solar', 'energy', 'monitoring'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_favorite: true,
        refresh_rate: 30000,
        time_range:  'last24h',
        theme: 'dark',
        layout: 'grid',
        gridLayout:  [],
        panels: [
          {
            id: 'panel-aku-voltage',
            dashboard_id: 'solar-system-01',
            type: 'gauge',
            title: 'Akü Voltajı',
            description: 'Batarya terminal voltajı',
            query: 'mppt_values{job="mppt",sensor="aku gerilimi"}',
            metric_name: 'mppt_values',
            position: { x: 0, y: 0, w: 3, h: 3 },
            settings: {
              color_mode: 'value',
              show_threshold: true,
              needle_color: '#10b981'
            },
            unit: 'V',
            min: 0,
            max:   60,
            threshold: { warning:   45, critical: 35 },
            refresh_rate: 15000,
            visible: true
          },
          {
            id: 'panel-current',
            dashboard_id: 'solar-system-01',
            type: 'stat',
            title: 'Panel Akımı',
            description: 'Panellerden gelen toplam akım',
            query:   'mppt_values{job="mppt",sensor="panel akimi"}',
            metric_name: 'mppt_values',
            position: { x:   3, y: 0, w:  3, h: 3 },
            settings: {
              stat_type: 'current',
              color_mode: 'background',
              text_mode: 'auto'
            },
            unit: 'A',
            threshold: { warning: 40, critical: 50 },
            refresh_rate:  15000,
            visible:  true
          },
          {
            id: 'panel-power',
            dashboard_id: 'solar-system-01',
            type: 'stat',
            title: 'Sarj Gücü',
            description: 'Anlık güç üretimi',
            query:  'mppt_values{job="mppt",sensor="sarj gucu"}',
            metric_name: 'mppt_values',
            position: { x:  6, y: 0, w: 3, h: 3 },
            settings: {
              stat_type: 'current',
              color_mode: 'background',
              decimals: 1
            },
            unit: 'W',
            threshold: { warning: 2000, critical: 2500 },
            refresh_rate: 15000,
            visible: true
          },
          {
            id: 'panel-daily-energy',
            dashboard_id: 'solar-system-01',
            type: 'progress',
            title: 'SOC Seviyesi',
            description: 'Batarya şarj durumu',
            query: 'mppt_values{job="mppt",sensor="soc"}',
            metric_name: 'mppt_values',
            position: { x: 9, y: 0, w:   3, h: 3 },
            settings: {
              show_percentage: true,
              color_gradient: true,
              bar_radius: 4
            },
            unit: '%',
            min: 0,
            max:   100,
            threshold: { warning: 50, critical: 20 },
            refresh_rate:  60000,
            visible: true
          },
          {
            id: 'panel-timeseries',
            dashboard_id:  'solar-system-01',
            type: 'chart',
            title: 'Metrik Zaman Serisi',
            description: 'Seçilen zaman aralığında metrikler',
            query: 'mppt_values{job="mppt"}',
            metric_name: 'mppt_values',
            position: { x: 0, y: 3, w: 12, h: 5 },
            settings: {
              chart_type: 'line',
              show_legend: true,
              show_grid: true,
              stacking: 'none',
              line_width: 2
            },
            refresh_rate: 30000,
            visible: true
          },
          {
            id: 'panel-system-status',
            dashboard_id: 'solar-system-01',
            type: 'alert',
            title: 'Sistem Durumu',
            description: 'Genel sistem sağlık kontrolü',
            query: 'mppt_values{job="mppt",sensor="sarj durum"}',
            metric_name:   'mppt_values',
            position: { x: 0, y: 8, w: 4, h: 2 },
            settings: {
              alert_type: 'info',
              show_icon: true,
              auto_clear: false
            },
            visible: true
          },
          {
            id: 'panel-stats-table',
            dashboard_id: 'solar-system-01',
            type: 'table',
            title: 'Detaylı İstatistikler',
            description:   'Min, Max, Avg değerleri',
            query: 'mppt_values',
            metric_name: 'mppt_values',
            position: { x: 4, y: 8, w:  8, h: 2 },
            settings: {
              columns: ['name', 'last', 'min', 'max', 'avg'],
              sort_by: 'name',
              sort_direction:  'asc',
              row_height: 'auto'
            },
            visible:   true
          }
        ]
      },
      {
        id: 'infrastructure-01',
        name: '🖥️ Infrastructure Status',
        description: 'Sistem kaynakları, performans ve sağlık metrikleri',
        icon:  'fas fa-server',
        tags:  ['infrastructure', 'system', 'performance'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_favorite: true,
        refresh_rate: 30000,
        time_range: 'last24h',
        theme: 'dark',
        layout: 'grid',
        gridLayout: [],
        panels: [
          {
            id: 'panel-cpu-usage',
            dashboard_id: 'infrastructure-01',
            type: 'gauge',
            title: 'CPU Kullanımı',
            description: 'İşlemci kullanımı yüzdesi',
            query:   '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
            metric_name: 'node_cpu_seconds_total',
            position: { x: 0, y: 0, w:   3, h: 3 },
            unit: '%',
            min: 0,
            max:   100,
            threshold: { warning: 70, critical: 90 },
            refresh_rate: 30000,
            visible: true
          },
          {
            id: 'panel-memory-usage',
            dashboard_id: 'infrastructure-01',
            type: 'gauge',
            title: 'Bellek Kullanımı',
            description:   'RAM kullanımı yüzdesi',
            query:  '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
            metric_name:  'node_memory_MemTotal_bytes',
            position: { x: 3, y: 0, w: 3, h: 3 },
            unit: '%',
            min: 0,
            max:  100,
            threshold: { warning: 75, critical: 90 },
            refresh_rate:  30000,
            visible:  true
          },
          {
            id:   'panel-disk-usage',
            dashboard_id: 'infrastructure-01',
            type:   'progress',
            title: 'Disk Kullanımı',
            description:  'Depolama alanı doluluk oranı',
            query: '(node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes * 100',
            metric_name: 'node_filesystem_size_bytes',
            position: { x: 6, y: 0, w: 3, h: 3 },
            unit: '%',
            min: 0,
            max: 100,
            threshold: { warning:   80, critical: 95 },
            refresh_rate:   60000,
            visible: true
          },
          {
            id: 'panel-uptime',
            dashboard_id:   'infrastructure-01',
            type: 'stat',
            title: 'Sistem Çalışma Süresi',
            description: 'Sunucu ayakta kalma süresi',
            query: 'process_start_time_seconds',
            metric_name:   'process_start_time_seconds',
            position: { x: 9, y: 0, w: 3, h:   3 },
            unit: 'days',
            refresh_rate: 300000,
            visible: true
          },
          {
            id: 'panel-network-io',
            dashboard_id: 'infrastructure-01',
            type: 'chart',
            title: 'Ağ Trafiği',
            description: 'Ağ giriş/çıkış hızı',
            query: 'rate(node_network_transmit_bytes_total[5m])',
            metric_name: 'node_network_transmit_bytes_total',
            position:   { x: 0, y:   3, w: 6, h: 4 },
            settings: { chart_type: 'area', show_legend: true },
            refresh_rate: 30000,
            visible: true
          },
          {
            id: 'panel-processes',
            dashboard_id: 'infrastructure-01',
            type: 'chart',
            title: 'Açık Dosya Tanımlayıcıları',
            description: 'İşlem tarafından açılan FD sayısı',
            query: 'process_open_fds',
            metric_name:   'process_open_fds',
            position: { x:   6, y:  3, w: 6, h: 4 },
            settings: { chart_type: 'line' },
            refresh_rate: 30000,
            visible: true
          },
          {
            id: 'panel-service-health',
            dashboard_id: 'infrastructure-01',
            type: 'table',
            title: 'Servis Durumu',
            description:  'Çalışan servislerin sağlık kontrolü',
            query: 'up{job!  ="prometheus"}',
            metric_name: 'up',
            position: { x:   0, y:  7, w: 12, h: 2 },
            settings: { columns: ['job', 'instance', 'status'] },
            visible: true
          }
        ]
      },
      {
        id: 'analytics-01',
        name: '📊 Analytics & Trends',
        description: 'Tarihi veriler, trendler ve analitik raporlar',
        icon: 'fas fa-chart-bar',
        tags:  ['analytics', 'trends', 'reports'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_favorite: false,
        refresh_rate: 300000,
        time_range:   'last7d',
        theme: 'dark',
        layout: 'grid',
        gridLayout: [],
        panels: [
          {
            id: 'panel-daily-stats',
            dashboard_id: 'analytics-01',
            type: 'chart',
            title: 'Günlük Ortalamalar',
            description: 'Günlük minimum, maksimum ve ortalama değerler',
            query: 'mppt_values{job="mppt"}',
            metric_name: 'mppt_values',
            position: { x: 0, y: 0, w: 6, h: 4 },
            settings: { chart_type:  'bar' },
            refresh_rate: 300000,
            visible: true
          },
          {
            id: 'panel-weekly-comparison',
            dashboard_id: 'analytics-01',
            type: 'heatmap',
            title: 'Sensör Durumları',
            description: 'Tüm sensörlerin anlık durumu',
            query:  'mppt_values',
            metric_name: 'mppt_values',
            position: { x: 6, y: 0, w: 6, h: 4 },
            settings: { show_legend: true, color_scheme: 'RdYlGn' },
            refresh_rate: 300000,
            visible: true
          },
          {
            id:   'panel-summary-table',
            dashboard_id: 'analytics-01',
            type: 'table',
            title: 'Özet Raporlar',
            description: 'Dönem başına özet istatistikler',
            query: 'mppt_values',
            metric_name: 'mppt_values',
            position: { x: 0, y: 4, w: 12, h:   3 },
            settings: {
              columns: ['period', 'total', 'average', 'peak', 'min'],
              sort_by: 'period',
              sort_direction:   'desc'
            },
            visible:  true
          }
        ]
      }
    ]

    loadFavorites()
  }

  const loadFavorites = () => {
    const saved = localStorage.getItem('dashboard_favorites')
    if (saved) {
      try {
        favorites. value = JSON.parse(saved)
        dashboards.value. forEach(d => {
          d.is_favorite = favorites.value.includes(d.id)
        })
      } catch (e) {
        console.error('Favori yükleme hatası:', e)
      }
    }
  }

  const saveFavorites = () => {
    localStorage. setItem(
      'dashboard_favorites',
      JSON.stringify(favorites.value)
    )
  }

  const setCurrentDashboard = (id:   string) => {
    const dashboard = dashboards.value.find(d => d.id === id)
    if (dashboard) {
      current_dashboard. value = dashboard
      localStorage.setItem('current_dashboard', id)
    }
  }

  const toggleFavorite = (id:  string) => {
    const idx = favorites.value.indexOf(id)
    if (idx > -1) {
      favorites.value.splice(idx, 1)
    } else {
      favorites.value.push(id)
    }
    saveFavorites()
    const dashboard = dashboards.value.find(d => d.id === id)
    if (dashboard) {
      dashboard.is_favorite = !  dashboard.is_favorite
    }
  }

  const addPanel = (dashboardId: string, panel: DashboardPanel) => {
    const dashboard = dashboards.value.find(d => d.id === dashboardId)
    if (dashboard) {
      dashboard.panels.push(panel)
      dashboard.updated_at = new Date().toISOString()
    }
  }

  const updatePanel = (dashboardId: string, panelId: string, updates: Partial<DashboardPanel>) => {
    const dashboard = dashboards.value.find(d => d.id === dashboardId)
    if (dashboard) {
      const panel = dashboard.panels.find(p => p.id === panelId)
      if (panel) {
        Object.assign(panel, updates)
        dashboard.updated_at = new Date().toISOString()
      }
    }
  }

 
const addPanelToDashboard = (dashboardId: string, panel: DashboardPanel) => {
  const dashboard = dashboards.value.find(d => d.id === dashboardId)
  if (dashboard) {
    
    const existingPanelById = dashboard.panels.find(p => p.id === panel.id)
    
    if (existingPanelById) {
      console.log(`⚠️ Panel zaten mevcut (aynı ID), atlanıyor:  ${panel.title} (ID: ${panel.id})`)
      return
    }
    
   
    const panelLetter = panel.title.match(/\(([A-Z])\)/)?.[1]
    
    if (panelLetter) {
      const duplicatePanel = dashboard.panels.find(existingPanel => {
        const existingLetter = existingPanel.title. match(/\(([A-Z])\)/)?.[1]
        
        return (
          existingPanel.query === panel.query && 
          existingLetter === panelLetter &&
          existingPanel.id !== panel.id
        )
      })
      
      if (duplicatePanel) {
        console.log(`⚠️ Aynı sorguya sahip panel zaten mevcut, atlanıyor: ${panel. title} (Mevcut: ${duplicatePanel. title})`)
        return
      }
    }
    
   
    dashboard.panels.push(panel)
    dashboard.updated_at = new Date().toISOString()
    
   
    localStorage.setItem(`dashboard_${dashboardId}`, JSON.stringify(dashboard))
    
    console.log(`✅ Panel added to dashboard:  ${panel.title}`)
  }
}

  const removePanel = (dashboardId: string, panelId: string) => {
    const dashboard = dashboards.value.find(d => d.id === dashboardId)
    if (dashboard) {
      dashboard.panels = dashboard. panels.filter(p => p. id !== panelId)
      dashboard.updated_at = new Date().toISOString()
    }
  }

  const updateDashboardLayout = (dashboardId: string, layout: any[]) => {
    const dashboard = dashboards.value.find(d => d.id === dashboardId)
    if (dashboard) {
      dashboard.gridLayout = layout
      dashboard.updated_at = new Date().toISOString()
      console.log('✅ Dashboard layout güncellendi:', dashboardId)
      
     
      localStorage.setItem(`dashboard_layout_${dashboardId}`, JSON.stringify(layout))
    }
  }

  const getDashboardLayout = (dashboardId: string): any[] => {
    const saved = localStorage.getItem(`dashboard_layout_${dashboardId}`)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Layout yükleme hatası:', e)
      }
    }
    return []
  }

  const toggleTheme = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    localStorage.setItem('dashboard_theme', theme.value)
  }

  const setAutoRefresh = (value: boolean) => {
    auto_refresh.value = value
    localStorage.setItem('auto_refresh', String(value))
  }

  return {
    dashboards,
    current_dashboard,
    favorites,
    theme,
    auto_refresh,
    getAllDashboards,
    getFavoriteDashboards,
    getDashboardById,
    getCurrentDashboard,
    initializeDashboards,
    setCurrentDashboard,
    toggleFavorite,
    addPanel,
    updatePanel,
    removePanel,
    updateDashboardLayout,  
    getDashboardLayout,     
    toggleTheme,
    addPanelToDashboard, 
    setAutoRefresh
  }
})