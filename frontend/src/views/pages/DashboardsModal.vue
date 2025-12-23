<template>
  <div v-if="isOpen" class="dashboard-modal-overlay" @click="closeModal">
    <div class="dashboard-modal" @click.stop>
      <div class="modal-header">
        <div class="header-title">
          <i class="fas fa-th-large"></i>
          <h2>Dashboardlar</h2>
        </div>
        <div class="header-controls">
          <button class="btn-theme-toggle" @click="dashboardStore.toggleTheme()" :title="`${dashboardStore.theme === 'dark' ? 'Açık' : 'Koyu'} tema`">
            <i :class="dashboardStore.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon'"></i>
          </button>
          <button class="btn-new-dashboard" @click="showCreateForm = true">
            <i class="fas fa-plus"></i> Yeni
          </button>
          <button class="btn-close" @click="closeModal">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <div v-if="! selectedDashboard && !showCreateForm" class="modal-body">
        <div class="list-controls">
          <div class="search-box">
            <i class="fas fa-search"></i>
            <input v-model="searchQuery" type="text" placeholder="Dashboard ara..." class="search-input" />
          </div>
          
          <!-- ✅ IMPORT BUTONU -->
          <div class="import-export-buttons">
            <button class="btn-import-dashboard" @click="importDashboardAction" title="Dashboard Import">
              <i class="fas fa-upload"></i> Import
            </button>
          </div>

          <div class="filter-buttons">
            <button v-for="view in ['all', 'favorites']" :key="view" :class="['filter-btn', { active: currentView === view }]" @click="currentView = view as 'all' | 'favorites'">
              <i :class="view === 'favorites' ? 'fas fa-star' : 'fas fa-list'"></i>
              {{ view === 'favorites' ? 'Favoriler' : 'Tümü' }}
            </button>
          </div>
          <div class="tag-filters">
            <button v-for="tag in allTags" :key="tag" :class="['tag-btn', { active: selectedTags.includes(tag) }]" @click="toggleTag(tag)">
              {{ tag }}
            </button>
          </div>
        </div>
        <div class="dashboards-list">
          <div v-if="filteredDashboards.length === 0" class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>Dashboard bulunamadı</p>
          </div>
          <div v-for="dashboard in filteredDashboards" :key="dashboard.id" class="dashboard-item" @click="selectDashboard(dashboard)">
            <div class="item-icon">
              <i :class="dashboard.icon"></i>
            </div>
            <div class="item-content">
              <h3>{{ dashboard.name }}</h3>
              <p>{{ dashboard.description }}</p>
              <div class="item-meta">
                <span class="meta-item"><i class="fas fa-cube"></i> {{ dashboard.panels.length }} panel</span>
                <span class="meta-item"><i class="fas fa-clock"></i> {{ formatDate(dashboard.updated_at) }}</span>
              </div>
            </div>
            <button class="btn-favorite" :class="{ favorite: dashboard.is_favorite }" @click. stop="dashboardStore.toggleFavorite(dashboard.id)" :title="dashboard.is_favorite ? 'Favorilerden çıkar' : 'Favori ekle'">
              <i class="fas fa-star"></i>
            </button>
            
            <!-- ✅ EXPORT BUTONU -->
            <button class="btn-export-dashboard" @click.stop="exportDashboardAction(dashboard)" title="Export">
              <i class="fas fa-download"></i>
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="selectedDashboard && ! showCreateForm && !showPanelsManagement" class="modal-body dashboard-view">
        <button class="btn-back" @click="goBackToList">
          <i class="fas fa-arrow-left"></i> Geri
        </button>
        <div class="dashboard-header">
          <div class="dashboard-title-group">
            <i class="dashboard-icon" :class="selectedDashboard. icon"></i>
            <div>
              <h3>{{ selectedDashboard.name }}</h3>
              <p>{{ selectedDashboard.description }}</p>
            </div>
          </div>
          <div class="dashboard-actions">
            <button v-if="hasUnsavedChanges" class="action-btn save-btn" @click="saveLayoutChanges" title="Düzeni Kaydet">
              <i class="fas fa-save"></i> Kaydet
            </button>
            <button class="action-btn" @click="editDashboard" title="Düzenle">
              <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn" @click="deleteDashboard" title="Sil">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="dashboard-stats-bar">
          <div class="stat-item"><i class="fas fa-cube"></i><span class="label">Toplam Paneller</span><span class="value">{{ selectedDashboard.panels.length }}</span></div>
          <div class="stat-item"><i class="fas fa-sync-alt"></i><span class="label">Son Güncelleme</span><span class="value">{{ formatTime(selectedDashboard.updated_at) }}</span></div>
          <div class="stat-item"><i class="fas fa-heartbeat"></i><span class="label">Status</span><span class="value health-ok">🟢 Healthy</span></div>
          <div class="stat-item"><i class="fas fa-tachometer-alt"></i><span class="label">Yükleme Süresi</span><span class="value">{{ dashboardLoadTime }}ms</span></div>
          <div class="stat-item"><i class="fas fa-chart-pie"></i><span class="label">Panel Tipi</span><span class="value">{{ getPanelTypeCount() }}</span></div>
        </div>
        <div class="dashboard-info-section">
          <h4 class="section-title">Bilgiler</h4>
          <div class="info-cards-grid">
            <div class="info-card"><div class="card-header"><i class="fas fa-calendar-plus"></i><span>Oluşturulma Tarihi</span></div><div class="card-value">{{ formatDate(selectedDashboard.created_at) }}</div><div class="card-detail">{{ daysAgo(selectedDashboard.created_at) }} gün önce</div></div>
            <div class="info-card"><div class="card-header"><i class="fas fa-edit"></i><span>Son Değişiklik</span></div><div class="card-value">{{ formatDate(selectedDashboard.updated_at) }}</div><div class="card-detail">Sistem tarafından</div></div>
            <div class="info-card"><div class="card-header"><i class="fas fa-sync"></i><span>Yenileme Sıklığı</span></div><div class="card-value">{{ formatRefreshRate(selectedDashboard. refresh_rate) }}</div><div class="card-detail">Otomatik güncelleme aktif</div></div>
            <div class="info-card"><div class="card-header"><i class="fas fa-history"></i><span>Zaman Aralığı</span></div><div class="card-value">{{ getTimeRangeLabel(selectedDashboard.time_range) }}</div><div class="card-detail">Varsayılan görünüm</div></div>
            <div class="info-card"><div class="card-header"><i class="fas fa-palette"></i><span>Tema</span></div><div class="card-value">{{ selectedDashboard.theme === 'dark' ? '🌙 Koyu' : '☀️ Açık' }}</div><div class="card-detail">Görünüm tercihi</div></div>
            <div class="info-card"><div class="card-header"><i class="fas fa-tags"></i><span>Etiketler</span></div><div class="card-tags"><span v-for="tag in selectedDashboard.tags" :key="tag" class="tag">{{ tag }}</span></div></div>
          </div>
        </div>
        <div class="performance-section">
          <h4 class="section-title">Performans Metrikleri</h4>
          <div class="metrics-grid">
            <div class="metric"><div class="metric-label">Aktif Paneller</div><div class="metric-value">{{ activePanelCount }}</div><div class="metric-bar"><div class="metric-fill" :style="{ width: (activePanelCount / selectedDashboard.panels.length) * 100 + '%' }"></div></div></div>
            <div class="metric"><div class="metric-label">Panel Yükleme</div><div class="metric-value">{{ panelLoadTime }}ms</div><div class="metric-bar"><div class="metric-fill" :style="{ width: (panelLoadTime / 500) * 100 + '%' }"></div></div></div>
            <div class="metric"><div class="metric-label">Son Güncelleme</div><div class="metric-value">{{ timeSinceUpdate }}</div></div>
            <div class="metric"><div class="metric-label">Veri Boyutu</div><div class="metric-value">-</div></div>
          </div>
        </div>
        
        <div class="panels-summary-section">
          <h4 class="section-title">📊 Panel Durumu ve Eşik Değerleri</h4>
          <table class="summary-table">
            <thead>
              <tr>
                <th>PANEL ADI</th>
                <th>TİP</th>
                <th>ŞIMDIKI DEĞER</th>
                <th>YENİLEME</th>
                <th>UYARI</th>
                <th>KRİTİK</th>
                <th>DURUM</th>
                <th>GÖRÜNÜRLÜk</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="panel in selectedDashboard.panels" :key="panel.id" :class="`row-status-${getPanelStatus(panel).status}`">
                <td class="cell-name">
                  <strong>{{ panel.title }}</strong>
                  <br/>
                  <small style="color: #666;">{{ panel.query. substring(0, 40) }}...</small>
                </td>
                <td class="cell-type"><span class="badge">{{ panel.type }}</span></td>
                <td class="cell-value" :style="{ color: getPanelStatus(panel).color, fontWeight: 'bold' }">
                  {{ panelCurrentValues[panel.id] !== undefined ? panelCurrentValues[panel.id]. toFixed(2) : '-' }} {{ panel.unit }}
                </td>
                <td class="cell-refresh">{{ formatRefreshRate(panel.refresh_rate) }}</td>
                <td class="cell-threshold">
                  <span v-if="panel.threshold?. warning" style="color: #f59e0b; font-weight: 600;">
                    🟡 {{ panel.threshold.warning }}
                  </span>
                  <span v-else>-</span>
                </td>
                <td class="cell-threshold">
                  <span v-if="panel.threshold?.critical" style="color: #ef4444; font-weight: 600;">
                    🔴 {{ panel.threshold.critical }}
                  </span>
                  <span v-else>-</span>
                </td>
                <td class="cell-status">
                  <span :class="['status-badge', `status-${getPanelStatus(panel).status}`]" :title="getPanelStatusTitle(panel)">
                    <i :class="getPanelStatus(panel).icon"></i> 
                    {{ getPanelStatus(panel).label }}
                  </span>
                </td>
                <td class="cell-visibility">
                  <span :class="panel.visible ? 'visibility-active' : 'visibility-inactive'">
                    {{ panel.visible ? '✅ Aktif' : '❌ Pasif' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="activity-section">
          <h4 class="section-title">Son Aktiviteler</h4>
          <div class="activity-log">
            <div v-for="(activity, idx) in activityLog" :key="idx" class="log-item">
              <span class="log-icon"><i :class="getActivityIcon(activity.action)"></i></span>
              <span class="log-action">{{ activity.action }}</span>
              <span class="log-time">{{ activity.time }}</span>
            </div>
          </div>
        </div>

        <div class="panels-button-section">
          <button class="btn-show-panels" @click="showPanelsModal = true">
            <i class="fas fa-th-large"></i>
            Paneller ({{ selectedDashboard?. panels. length || 0 }})
          </button>
        </div>
      </div>

      <div v-if="showPanelsModal" class="panels-fullscreen-modal" @click="showPanelsModal = false">
        <div class="panels-fullscreen-content" @click.stop>
          <div class="panels-modal-header">
            <h2>Paneller - {{ selectedDashboard?.name }}</h2>
            <button class="btn-close-panels" @click="showPanelsModal = false">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="panels-modal-toolbar">
            <button class="tb-btn" @click="saveLayoutChanges">
              <i class="fas fa-save"></i> Düzeni Kaydet
            </button>
            <span v-if="hasUnsavedChanges" class="unsaved-badge">
              ⚠️ Kaydedilmemiş Değişiklikler
            </span>
          </div>
          
          <div class="panels-modal-body">
            <div class="grid-layout-container-fullscreen">
              <GridLayout 
                v-if="layout. length > 0" 
                v-model:layout="layout" 
                :col-num="12" 
                :row-height="30" 
                :is-draggable="true" 
                :is-resizable="true" 
                :vertical-compact="true" 
                :margin="[20, 20]" 
                :use-css-transforms="true" 
                @layout-updated="onLayoutUpdated"
              >
                <GridItem 
                  v-for="item in layout" 
                  :key="item.i" 
                  :x="item.x" 
                  :y="item.y" 
                  :w="item.w" 
                  :h="item.h" 
                  :i="item.i" 
                  class="custom-grid-item-fullscreen"
                >
                  <div class="grid-content-card-fullscreen">
                    <DashboardPanel 
                      v-if="getPanel(item.i)" 
                      :panel="getPanel(item.i)!" 
                      :dashboard-id="selectedDashboard! .id" 
                      @update="updatePanel" 
                      @delete="deletePanel" 
                      @edit="openEditPanel" 
                    />
                  </div>
                </GridItem>
              </GridLayout>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="showCreateForm && !showPanelsManagement" class="modal-body form-view">
        <button class="btn-back" @click="cancelForm">
          <i class="fas fa-arrow-left"></i> Geri
        </button>
        <div class="form-container">
          <h3>{{ editingDashboard ? 'Dashboard Düzenle' : 'Yeni Dashboard Oluştur' }}</h3>
          <div class="form-group">
            <label>Dashboard Adı *</label>
            <input v-model="formData.name" type="text" placeholder="Dashboard adını girin" class="form-input" />
          </div>
          <div class="form-group">
            <label>Açıklama</label>
            <textarea v-model="formData.description" placeholder="Dashboard açıklaması..." class="form-textarea" rows="2"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>İkon</label>
              <select v-model="formData.icon" class="form-select">
                <option value="fas fa-sun">☀️ Solar</option>
                <option value="fas fa-server">🖥️ Infrastructure</option>
                <option value="fas fa-chart-bar">📊 Analytics</option>
                <option value="fas fa-heartbeat">💓 Health</option>
                <option value="fas fa-cog">⚙️ Configuration</option>
              </select>
            </div>
            <div class="form-group">
              <label>Yenileme</label>
              <select v-model.number="formData.refresh_rate" class="form-select">
                <option :value="10000">10s</option>
                <option :value="30000">30s</option>
                <option :value="60000">1m</option>
                <option :value="300000">5m</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Zaman Aralığı</label>
              <select v-model="formData.time_range" class="form-select">
                <option value="last1h">1 saat</option>
                <option value="last6h">6 saat</option>
                <option value="last24h">24 saat</option>
                <option value="last7d">7 gün</option>
              </select>
            </div>
            <div class="form-group">
              <label>Tema</label>
              <select v-model="formData.theme" class="form-select">
                <option value="dark">Koyu</option>
                <option value="light">Açık</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Etiketler</label>
            <input v-model="tagsInput" type="text" placeholder="solar, energy, monitoring" class="form-input" />
          </div>
          
          <div class="form-group">
            <button class="btn-manage-panels" @click="openPanelsManagement">
              <i class="fas fa-cube"></i> Panelleri Yönet
            </button>
          </div>

          <div class="form-actions">
            <button class="btn-cancel" @click="cancelForm">İptal</button>
            <button class="btn-submit" @click="saveDashboard">{{ editingDashboard ? 'Güncelle' : 'Oluştur' }}</button>
          </div>
        </div>
      </div>

      <div v-else-if="showCreateForm && showPanelsManagement" class="modal-body panels-management-view">
        <button class="btn-back" @click="showPanelsManagement = false">
          <i class="fas fa-arrow-left"></i> Geri
        </button>

        <div class="panels-management-container">
          <div class="management-header">
            <h3>Paneller - {{ editingDashboard?. name || 'Yeni Dashboard' }}</h3>
            <button class="btn-add-panel" @click="openCreatePanelModal">
              <i class="fas fa-plus"></i> Panel Ekle
            </button>
          </div>

          <div class="panels-list-container">
            <div v-if="! editingDashboard?. panels || editingDashboard. panels.length === 0" class="empty-panels-state">
              <i class="fas fa-inbox"></i>
              <p>Henüz panel eklenmedi</p>
              <button class="btn-add-first-panel" @click="openCreatePanelModal">
                <i class="fas fa-plus"></i> İlk Paneli Ekle
              </button>
            </div>

            <div v-else class="panels-grid">
              <div v-for="panel in editingDashboard.panels" :key="panel.id" class="panel-card">
                <div class="panel-card-header">
                  <div class="panel-info">
                    <h4>{{ panel.title }}</h4>
                    <p>{{ panel.type }} • {{ panel.query. substring(0, 30) }}...</p>
                  </div>
                  <div class="panel-actions">
                    <button class="action-btn edit-btn" @click="editPanelInDashboard(panel. id)" title="Düzenle">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" @click="deletePanelFromDashboard(panel.id)" title="Sil">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                <div class="panel-card-body">
                  <span class="badge">{{ panel.type }}</span>
                  <span class="unit" v-if="panel.unit">{{ panel.unit }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn-cancel" @click="showPanelsManagement = false">Geri</button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <EditPanelModal 
        v-if="showPanelCreationModal && editingDashboard"
        :is-open="showPanelCreationModal" 
        :panel="newPanelForDashboard" 
        :dashboard-id="editingDashboard.id"
        @close="showPanelCreationModal = false"
        @save="handleNewPanelSave"
      />
      
      <EditPanelModal 
        v-if="showEditModal && selectedDashboard" 
        :is-open="showEditModal" 
        :panel="panelToEdit" 
        :dashboard-id="selectedDashboard.id" 
        @close="showEditModal = false" 
        @save="handlePanelSave" 
        @save-additional="handleAdditionalPanelsSave" 
        @delete-additional="handleDeleteAdditionalPanels" 
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { usePrometheusStore } from '@/stores/prometheus'
import { useDashboardStore } from '@/stores/dashboardStore'
import DashboardPanel from './DashboardPanel.vue'
import EditPanelModal from './EditPanelModal.vue'
import type { Dashboard, DashboardPanel as DashboardPanelType } from '@/stores/dashboardStore'
import { exportDashboard, importDashboard } from '@/stores/dashboardStore'
import { GridLayout, GridItem } from 'vue3-grid-layout'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ close: [] }>()

const dashboardStore = useDashboardStore()
const prometheusStore = usePrometheusStore()

const searchQuery = ref('')
const selectedTags = ref<string[]>([])
const currentView = ref<'all' | 'favorites'>('all')
const selectedDashboard = ref<Dashboard | null>(null)
const showCreateForm = ref(false)
const editingDashboard = ref<Dashboard | null>(null)
const tagsInput = ref('')

const layout = ref<any[]>([])
const hasUnsavedChanges = ref(false)

const showEditModal = ref(false)
const panelToEdit = ref<any>(null)

const dashboardLoadTime = ref(245)
const panelLoadTime = ref(198)

const panelCurrentValues = ref<Record<string, number>>({})

const showPanelsModal = ref(false)
const showPanelsManagement = ref(false)
const showPanelCreationModal = ref(false)
const newPanelForDashboard = ref<DashboardPanelType | null>(null)

// ✅ Panel durumunu hesapla
const calculatePanelStatus = (value: number | undefined, threshold: any) => {
  if (value === undefined || value === null) return 'unknown'
  if (! threshold) return 'normal'
  
  if (value >= threshold.critical) return 'critical'
  if (value >= threshold.warning) return 'warning'
  return 'normal'
}

// ✅ Panel durumunu dön
const getPanelStatus = (panel: DashboardPanelType) => {
  const value = panelCurrentValues.value[panel.id]
  const status = calculatePanelStatus(value, panel.threshold)

  if (status === 'critical') {
    return { status: 'critical', label: 'KRİTİK', icon: 'fas fa-times-circle', color: '#ef4444' }
  }
  if (status === 'warning') {
    return { status: 'warning', label: 'UYARI', icon: 'fas fa-exclamation-circle', color: '#f59e0b' }
  }
  if (status === 'normal') {
    return { status: 'normal', label: 'NORMAL', icon: 'fas fa-check-circle', color: '#10b981' }
  }

  return { status: 'unknown', label: 'BİLİNMİYOR', icon: 'fas fa-question-circle', color: '#64748b' }
}

// ✅ Panel durumunun açıklaması
const getPanelStatusTitle = (panel: DashboardPanelType) => {
  const value = panelCurrentValues.value[panel.id]
  if (value === undefined) return 'Veri yüklenmiyor...'
  
  const threshold = panel.threshold
  if (! threshold) return `Şu anki değer: ${value. toFixed(2)} ${panel.unit || ''}`
  
  return `Değer: ${value.toFixed(2)} ${panel.unit || ''} | Uyarı: ${threshold.warning} | Kritik: ${threshold.critical}`
}

// ✅ Tüm panellerin durumunu güncelle
const updateAllPanelStatus = async () => {
  if (!selectedDashboard.value) return
  
  for (const panel of selectedDashboard.value.panels) {
    try {
      const result = await prometheusStore.fetchInstantQuery(panel.query)
      if (result && result.length > 0 && result[0].value) {
        const value = parseFloat(result[0].value[1])
        panelCurrentValues.value[panel. id] = value
        console.log(`✅ ${panel.title}: ${value} ${panel.unit || ''}`)
      }
    } catch (error) {
      console.error(`❌ ${panel.title} error:`, error)
    }
  }
}

// ✅ Panel yönetim fonksiyonları
const openPanelsManagement = () => {
  showPanelsManagement.value = true
}

const openCreatePanelModal = () => {
  const panelId = `panel-${Date.now()}`
  newPanelForDashboard. value = {
    id: panelId,
    dashboard_id: editingDashboard.value?.id || '',
    type: 'stat',
    title: `Yeni Panel ${(editingDashboard.value?. panels?.length || 0) + 1}`,
    description: '',
    query: '',
    position: { x: 0, y: 0, w: 6, h: 10 },
    refresh_rate: 30000,
    unit: '',
    decimals: 2,
    visible: true,
    threshold: { warning: 70, critical: 90 }
  }
  showPanelCreationModal.value = true
}

const editPanelInDashboard = (panelId: string) => {
  const panel = editingDashboard.value?.panels.find(p => p.id === panelId)
  if (panel) {
    newPanelForDashboard. value = JSON.parse(JSON.stringify(panel))
    showPanelCreationModal.value = true
  }
}

const deletePanelFromDashboard = (panelId: string) => {
  if (confirm('Bu paneli silmek istediğinize emin misiniz?')) {
    if (editingDashboard.value) {
      editingDashboard.value.panels = editingDashboard.value.panels.filter(p => p.id !== panelId)
    }
  }
}

const handleNewPanelSave = (panel:  DashboardPanelType) => {
  if (!editingDashboard.value) return

  const existingIndex = editingDashboard.value.panels.findIndex(p => p.id === panel.id)

  if (existingIndex > -1) {
    editingDashboard.value.panels[existingIndex] = panel
  } else {
    editingDashboard.value.panels. push(panel)
  }

  showPanelCreationModal.value = false
  console.log(`✅ Panel kaydedildi: ${panel. title}`)
}

const activePanelCount = computed(() => {
  if (!selectedDashboard.value) return 0
  return selectedDashboard.value.panels.filter(p => p.visible).length
})

const timeSinceUpdate = computed(() => {
  if (!selectedDashboard.value) return '-'
  const now = new Date()
  const updated = new Date(selectedDashboard.value.updated_at)
  const diffMs = now.getTime() - updated.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'şimdi'
  if (diffMins < 60) return `${diffMins} dakika önce`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} saat önce`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} gün önce`
})

const activityLog = computed(() => [
  { action: 'Dashboard oluşturuldu', time: formatTimeDiff(selectedDashboard.value?. created_at) },
  { action: 'Panel eklendi', time: '1 saat önce' },
  { action: 'Ayarlar güncellendi', time: '30 dakika önce' },
  { action: 'Son görüntüleme', time: 'az önce' }
])

const formData = ref({ 
  name: '', 
  description: '', 
  icon: 'fas fa-sun', 
  refresh_rate: 30000, 
  time_range: 'last24h' as 'last1h' | 'last6h' | 'last24h' | 'last7d', 
  theme: 'dark' as 'dark' | 'light' 
})

const allTags = computed(() => { 
  const tags = new Set<string>()
  dashboardStore.getAllDashboards.forEach(d => { 
    d.tags.forEach(t => tags.add(t)) 
  })
  return Array.from(tags).sort() 
})

const filteredDashboards = computed(() => { 
  let result = dashboardStore.getAllDashboards
  if (currentView.value === 'favorites') {
    result = result.filter(d => d.is_favorite)
  }
  if (searchQuery.value.trim()) { 
    const query = searchQuery.value.toLowerCase()
    result = result.filter(d => 
      d.name.toLowerCase().includes(query) || 
      d.description.toLowerCase().includes(query)
    )
  }
  if (selectedTags.value.length > 0) { 
    result = result.filter(d => 
      selectedTags.value. some(tag => d.tags.includes(tag))
    )
  }
  return result 
})

const closeModal = () => { 
  if (hasUnsavedChanges.value) { 
    if (! confirm('Kaydedilmemiş değişiklikler var.  Çıkmak istediğinize emin misiniz?')) {
      return
    }
  }
  emit('close')
  resetState()
}

const goBackToList = () => { 
  if (hasUnsavedChanges.value) { 
    if (!confirm('Kaydedilmemiş düzen değişiklikleri var. Kaydetmeden çıkmak istiyor musunuz?')) {
      return
    }
  }
  resetState()
}

const resetState = () => { 
  selectedDashboard.value = null
  showCreateForm.value = false
  editingDashboard.value = null
  showPanelsManagement.value = false
  layout.value = []
  hasUnsavedChanges.value = false
  panelCurrentValues.value = {}
  showPanelsModal.value = false
}

const toggleTag = (tag: string) => { 
  const idx = selectedTags.value.indexOf(tag)
  if (idx > -1) {
    selectedTags.value.splice(idx, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

const selectDashboard = (dashboard: Dashboard) => {
  selectedDashboard.value = dashboard
  dashboardStore.setCurrentDashboard(dashboard. id)
  
  nextTick(() => {
    dashboard.panels.forEach(panel => {
      const savedPosition = localStorage.getItem(`panel-position-${panel.id}`)
      
      if (savedPosition) {
        try {
          const parsed = JSON.parse(savedPosition)
          panel.position = {
            x: parsed.x,
            y: parsed.y,
            w: parsed.w,
            h: parsed.h
          }
          console.log(`✅ Panel konumu yüklendi (${panel.id}):`, panel.position)
        } catch (e) {
          console.error(`❌ Parse hatası (${panel.id}):`, e)
        }
      } else {
        console.log(`⚠️ Kaydedilmiş konum yok (${panel.id}), varsayılan kullanılıyor`)
      }
    })
    
    initializeLayout()
    updateAllPanelStatus()
  })
}

const initializeLayout = () => {
  if (!selectedDashboard.value) return
  
  if (selectedDashboard.value. panels.length === 0) {
    layout.value = []
    return
  }

  layout.value = selectedDashboard.value.panels. map((panel, idx) => {
    let x = panel.position?. x ?? 0
    let y = panel.position?.y ?? 0
    let w = panel.position?. w ?? 6
    let h = panel.position?.h ?? 10

    if (!w || w < 3) w = 6
    if (!h || h < 5) h = 10

    return {
      x: Number(x),
      y: Number(y),
      w: Number(w),
      h: Number(h),
      i: panel.id,
      minH: 5,
      minW: 3
    }
  })

  console.log('✅ Layout başlatıldı:', layout.value)

  nextTick(() => {
    hasUnsavedChanges.value = false
  })
}

const onLayoutUpdated = (newLayout: any[]) => { 
  if (! selectedDashboard.value) return
  
  const isActuallyChanged = newLayout.some(newItem => { 
    const originalPanel = selectedDashboard.value?. panels.find(p => p. id === newItem.i)
    if (!originalPanel || ! originalPanel.position) return true
    return (
      newItem.x !== Number(originalPanel.position.x) || 
      newItem.y !== Number(originalPanel.position.y) || 
      newItem.w !== Number(originalPanel.position.w) || 
      newItem.h !== Number(originalPanel.position.h)
    )
  })
  
  if (isActuallyChanged) { 
    layout.value = newLayout
    hasUnsavedChanges.value = true 
  } 
}

const saveLayoutChanges = () => {
  if (!selectedDashboard.value) return
  
  if (confirm('Bu düzen değişikliğini kaydetmek istiyor musunuz?')) {
    let savedCount = 0
    
    selectedDashboard.value. panels.forEach(panel => {
      const layoutItem = layout.value.find(l => l.i === panel.id)
      
      if (layoutItem) {
        panel.position = {
          x: layoutItem.x,
          y: layoutItem.y,
          w: layoutItem.w,
          h: layoutItem.h
        }
        
        localStorage.setItem(
          `panel-position-${panel.id}`,
          JSON.stringify(panel.position)
        )
        
        console.log(`✅ ${panel.title} kaydedildi:`, panel.position)
        savedCount++
      }
    })
    
    selectedDashboard.value.updated_at = new Date().toISOString()
    hasUnsavedChanges.value = false
    
    alert(`✅ ${savedCount} panel düzeni kaydedildi! `)
  }
}

const getPanel = (id: string | number) => { 
  return selectedDashboard.value?.panels. find(p => p.id === id) 
}

const openEditPanel = (panelId: string) => { 
  const panel = selectedDashboard.value?.panels. find(p => p.id === panelId)
  if (panel) { 
    panelToEdit.value = panel
    showEditModal.value = true 
  } 
}

const handlePanelSave = (updatedPanel: any) => { 
  if (!selectedDashboard.value) return
  
  const panelIndex = selectedDashboard.value.panels.findIndex(p => p.id === updatedPanel.id)
  if (panelIndex > -1) { 
    Object.assign(selectedDashboard. value.panels[panelIndex], updatedPanel)
    dashboardStore.updatePanel(selectedDashboard.value.id, updatedPanel.id, updatedPanel)
    nextTick(() => { 
      initializeLayout()
      updateAllPanelStatus() 
    }) 
  } 
}

const handleAdditionalPanelsSave = (additionalPanels: any[]) => { 
  if (!selectedDashboard.value || additionalPanels.length === 0) return
  
  additionalPanels.forEach(panel => { 
    const sameId = selectedDashboard.value! .panels.find(p => p.id === panel.id)
    if (sameId) return
    
    const panelLetter = panel.title.match(/\(([A-Z])\)/)?.[1]
    if (panelLetter) { 
      const duplicate = selectedDashboard.value! .panels.find(existingPanel => { 
        const existingLetter = existingPanel.title.match(/\(([A-Z])\)/)?.[1]
        return (
          existingPanel.query === panel.query && 
          existingLetter === panelLetter
        )
      })
      if (duplicate) return 
    }
    
    dashboardStore.addPanelToDashboard(selectedDashboard.value!.id, panel) 
  })
  
  nextTick(() => { 
    initializeLayout()
    updateAllPanelStatus() 
  }) 
}

const handleDeleteAdditionalPanels = (panelIds:  string[]) => { 
  if (selectedDashboard.value && panelIds.length > 0) { 
    panelIds.forEach(panelId => { 
      const panelIndex = selectedDashboard. value!.panels.findIndex(p => p.id === panelId)
      if (panelIndex > -1) { 
        selectedDashboard.value!.panels.splice(panelIndex, 1)
        dashboardStore.removePanel(selectedDashboard.value!.id, panelId)
        
        const layoutIdx = layout.value.findIndex(item => item.i === panelId)
        if (layoutIdx > -1) {
          layout. value.splice(layoutIdx, 1)
        }
      } 
    }) 
  } 
}

const editDashboard = () => { 
  if (!selectedDashboard.value) return
  
  editingDashboard.value = selectedDashboard.value
  formData.value = { 
    name: selectedDashboard.value. name, 
    description: selectedDashboard.value. description, 
    icon: selectedDashboard.value. icon, 
    refresh_rate: selectedDashboard.value. refresh_rate, 
    time_range: selectedDashboard.value. time_range as any, 
    theme: selectedDashboard.value. theme as any 
  }
  tagsInput.value = selectedDashboard.value.tags.join(', ')
  showCreateForm.value = true 
}

const deleteDashboard = () => { 
  if (!selectedDashboard.value) return
  
  if (confirm('Bu dashboard\'ı silmek istediğinize emin misiniz?')) { 
    const idx = dashboardStore.dashboards.findIndex(d => d.id === selectedDashboard. value!.id)
    if (idx > -1) { 
      dashboardStore.dashboards.splice(idx, 1)
      selectedDashboard.value = null 
    } 
  } 
}

const saveDashboard = () => { 
  if (!formData.value.name. trim()) { 
    alert('Dashboard adı boş olamaz!')
    return 
  }
  
  if (editingDashboard.value) { 
    Object.assign(editingDashboard.value, { 
      ...formData.value, 
      tags: tagsInput.value.split(',').map(t => t.trim()).filter(t => t), 
      updated_at: new Date().toISOString() 
    }) 
  } else { 
    const newDashboard: Dashboard = { 
      id: `dashboard-${Date.now()}`, 
      ...formData.value, 
      tags: tagsInput.value.split(',').map(t => t.trim()).filter(t => t), 
      panels: [], 
      created_at: new Date().toISOString(), 
      updated_at: new Date().toISOString(), 
      is_favorite: false, 
      layout: 'grid' 
    }
    dashboardStore.dashboards.push(newDashboard) 
  }
  cancelForm() 
}

const cancelForm = () => { 
  showCreateForm.value = false
  editingDashboard.value = null
  showPanelsManagement.value = false
  formData.value = { 
    name: '', 
    description: '', 
    icon: 'fas fa-sun', 
    refresh_rate:  30000, 
    time_range:  'last24h', 
    theme: 'dark' 
  }
  tagsInput.value = '' 
}

// ✅ DASHBOARD EXPORT 
const exportDashboardAction = (dashboard: Dashboard) => {
  try {
    const data = JSON.stringify(dashboard, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dashboard-${dashboard.name}.json`
    document.body.appendChild(link)  
    link.click()
    document.body.removeChild(link)  
    URL.revokeObjectURL(url)
    console.log(`✅ ${dashboard.name} export edildi`)
  } catch (error) {
    console.error('❌ Export hatası:', error)
    alert('Export başarısız!')
  }
}
// ✅ DASHBOARD IMPORT - DÜZELTME
const importDashboardAction = async () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '. json'
  input.onchange = async (e:  any) => {
    const file = e.target.files[0]
    if (! file) return
    
    const reader = new FileReader()
    reader.onload = (event:  any) => {
      try {
        const importedDashboard = JSON.parse(event.target. result)
        
        
        importedDashboard.id = `dashboard-${Date.now()}`
        
        
        if (importedDashboard.panels && Array.isArray(importedDashboard.panels)) {
          importedDashboard.panels = importedDashboard.panels. map((p: any, idx: number) => ({
            ...p,
            id: `panel-${Date.now()}-${idx}-${Math.random()}`
          }))
        } else {
          importedDashboard.panels = []
        }
        
      
        dashboardStore.dashboards.push(importedDashboard)
        
        alert(`✅ "${importedDashboard.name}" başarıyla import edildi!`)
        console.log('✅ Dashboard import edildi:', importedDashboard.name)
      } catch (error) {
        console.error('❌ Import hatası:', error)
        alert('Geçersiz dashboard dosyası!')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

const updatePanel = (panelId: string, updates: any) => {
  if (selectedDashboard. value) {
    const existingPanel = selectedDashboard. value.panels.find(p => p.id === panelId)
    
    if (existingPanel) {
      
      Object.assign(existingPanel, updates)
    } else {
      
      selectedDashboard.value.panels.push(updates)
      console.log('✅ Yeni panel eklendi:', updates. title)
    }
    
    dashboardStore.updatePanel(selectedDashboard.value. id, panelId, updates)
    nextTick(() => {
      initializeLayout()
      updateAllPanelStatus()
    })
  }
}

const deletePanel = (panelId: string) => { 
  if (selectedDashboard.value) { 
    dashboardStore.removePanel(selectedDashboard.value.id, panelId)
    const idx = layout.value.findIndex(item => item.i === panelId)
    if (idx > -1) {
      layout.value. splice(idx, 1)
    }
  } 
}

const formatDate = (date: string) => new Date(date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric', year: 'numeric' })
const formatTime = (date: string) => new Date(date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
const formatTimeDiff = (date:  string | undefined) => { 
  if (!date) return 'bilinmiyor'
  const diffMins = Math.floor((new Date().getTime() - new Date(date).getTime()) / 60000)
  if (diffMins < 1) return 'şimdi'
  if (diffMins < 60) return `${diffMins} dakika önce`
  return `${Math.floor(diffMins / 60)} saat önce` 
}
const daysAgo = (date: string) => Math.floor((new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
const formatRefreshRate = (ms: number | undefined) => { 
  const v = ms ??  30000
  return v < 60000 ? Math.floor(v / 1000) + 's' : v < 3600000 ? Math.floor(v / 60000) + 'm' : Math.floor(v / 3600000) + 'h' 
}
const getTimeRangeLabel = (range: string) => ({ 'last1h': '1 Saat', 'last6h': '6 Saat', 'last24h': '24 Saat', 'last7d': '7 Gün' }[range] || range)
const getPanelTypeCount = () => { 
  if (!selectedDashboard.value) return '0'
  return new Set(selectedDashboard.value. panels.map(p => p. type)).size + ' türde' 
}
const getActivityIcon = (action: string) => 
  action.includes('oluşturuldu') ? 'fas fa-plus-circle' : 
  action.includes('eklendi') ? 'fas fa-cube' : 
  action.includes('güncellendi') ? 'fas fa-sync' : 
  'fas fa-eye'

onMounted(() => { 
  dashboardStore.initializeDashboards()
  updateAllPanelStatus()
  const interval = setInterval(() => { 
    updateAllPanelStatus() 
  }, 10000) 
})
</script>



<style scoped>



.row-status-critical {
  background-color: #fee2e2 !important;
  border-left: 4px solid #ef4444;
}

.row-status-warning {
  background-color: #fef3c7 !important;
  border-left: 4px solid #f59e0b;
}

.row-status-normal {
  background-color: #dcfce7 !important;
  border-left: 4px solid #10b981;
}

.row-status-unknown {
  background-color: #f1f5f9 !important;
  border-left: 4px solid #64748b;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-critical {
  background-color: #fee2e2;
  color: #7f1d1d;
  border:  1px solid #fca5a5;
}

.status-warning {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.status-normal {
  background-color: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}

.status-unknown {
  background-color: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}

.cell-name {
  font-weight: 600;
  padding: 12px !important;
}

.cell-value {
  text-align: center;
  font-weight: bold;
}

.cell-type .badge {
  background: #e0e7ff;
  color: #3730a3;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight:  600;
}

.visibility-active {
  color: #10b981;
  font-weight: 600;
}

.visibility-inactive {
  color: #ef4444;
  font-weight: 600;
}

.visibility-inactive {
  color: #ef4444;
  font-weight: 600;
}

  
/* ============= MODAL OVERLAY & CONTAINER ============= */
.dashboard-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 900; padding: 12px; animation: fadeIn 0.3s ease; }
.dashboard-modal { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; width: 95vw; max-width: 1800px; height: 95vh; max-height: 95vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1); animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }

/* ============= MODAL HEADER ============= */
.modal-header { padding: 24px 32px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 20px; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); }
.header-title { display: flex; align-items: center; gap: 14px; color: #0f172a; }
.header-title i { font-size: 28px; background: linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.header-title h2 { font-size: 26px; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.5px; }
.header-controls { display: flex; align-items: center; gap: 10px; }
.btn-theme-toggle { width: 40px; height: 40px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; color: #f59e0b; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.3s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.btn-theme-toggle:hover { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-color: #fbbf24; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2); transform: translateY(-1px); }
.btn-new-dashboard { background: linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%); color: white; border: none; padding: 10px 22px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3); }
.btn-new-dashboard:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4); }
.btn-close { width: 40px; height: 40px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; transition: all 0.3s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.btn-close:hover { color: #dc2626; background: #fee2e2; border-color: #fecaca; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15); }

/* ============= MODAL BODY ============= */
.modal-body { flex: 1; overflow-y: auto; padding: 32px 40px; display: flex; flex-direction: column; gap: 32px; background: #ffffff; }

/* ============= LIST CONTROLS ============= */
.list-controls { display: flex; flex-direction: column; gap: 16px; }
.search-box { position: relative; display: flex; align-items: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 16px; transition: all 0.3s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.search-box:focus-within { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1); }
.search-box i { color: #94a3b8; font-size: 16px; }
.search-input { flex: 1; background: transparent; border: none; padding: 12px 12px; color: #0f172a; outline: none; font-size: 14px; font-weight: 500; }
.search-input::placeholder { color: #cbd5e1; }

/* ============= FILTER & TAG BUTTONS ============= */
.filter-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.filter-btn { background: #ffffff; border: 1px solid #e2e8f0; color: #475569; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.3s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.filter-btn:hover { border-color: #bfdbfe; color: #1d4ed8; background: #f0f4f8; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1); transform: translateY(-1px); }
.filter-btn.active { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-color: #3b82f6; color: #1d4ed8; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); }
.tag-filters { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-btn { background: #ffffff; border: 1px solid #e2e8f0; color: #475569; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.tag-btn:hover { border-color: #bfdbfe; color: #1d4ed8; background: #f0f4f8; box-shadow:  0 2px 8px rgba(59, 130, 246, 0.1); transform: translateY(-1px); }
.tag-btn.active { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-color: #3b82f6; color: #1d4ed8; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); }

/* ============= DASHBOARDS LIST ============= */
.dashboards-list { display: flex; flex-direction: column; gap: 12px; flex: 1; overflow-y: auto; padding-right: 8px; }
.dashboards-list::-webkit-scrollbar { width: 6px; }
.dashboards-list::-webkit-scrollbar-track { background: transparent; }
.dashboards-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
.dashboards-list::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #64748b; text-align: center; }
.empty-state i { font-size: 64px; background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 16px; opacity: 0.4; }
.empty-state p { font-size: 15px; font-weight: 500; }
.dashboard-item { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.3s ease; display: flex; gap: 14px; align-items: center; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
.dashboard-item:hover { border-color: #3b82f6; background: #f8fafc; box-shadow: 0 8px 20px rgba(59, 130, 246, 0.12); transform: translateX(4px) translateY(-2px); }
.item-icon { width: 48px; height: 48px; background: linear-gradient(135deg, #eff6ff 0%, #f0f4f8 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #3b82f6; font-size: 20px; flex-shrink: 0; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1); }
.item-content { flex: 1; min-width: 0; }
.item-content h3 { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }
.item-content p { font-size: 12px; color: #64748b; margin: 0 0 8px 0; display: -webkit-box; -webkit-line-clamp: 1; line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.item-meta { display: flex; gap: 14px; font-size: 12px; color: #94a3b8; }
.meta-item { display: flex; align-items: center; gap: 4px; }
.btn-favorite { background: none; border: none; color: #cbd5e1; cursor: pointer; font-size: 18px; transition: all 0.3s ease; flex-shrink: 0; }
.btn-favorite:hover, .btn-favorite.favorite { color: #fbbf24; transform: scale(1.2) rotate(10deg); }

/* ============= DASHBOARD VIEW ============= */
.dashboard-view { padding: 0; }
.btn-back { padding: 10px 16px; background: #ffffff; border: 1px solid #e2e8f0; color: #475569; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.3s ease; margin: 32px 40px 0 40px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.btn-back:hover { background: #f8fafc; border-color: #3b82f6; color: #3b82f6; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1); transform: translateX(-2px); }

/* ============= DASHBOARD HEADER ============= */
.dashboard-header { padding: 20px 40px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 20px; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); }
.dashboard-title-group { display: flex; gap: 14px; align-items: center; flex: 1; min-width: 0; }
.dashboard-icon { font-size: 32px; background: linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; flex-shrink: 0; }
.dashboard-title-group h3 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 2px 0; }
.dashboard-title-group p { font-size: 13px; color: #64748b; margin: 0; }
.dashboard-actions { display: flex; gap: 8px; }
.action-btn { width: 36px; height: 36px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; transition: all 0.3s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.action-btn:hover { border-color: #bfdbfe; background: #f0f4f8; color: #3b82f6; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1); transform: translateY(-1px); }
.action-btn:last-child:hover { background: #fee2e2; border-color: #fecaca; color: #dc2626; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15); }
.save-btn { background: #3b82f6 !important; color: white !important; border-color: #2563eb !important; font-weight: 700; padding-left: 12px; padding-right: 12px; width: auto !important; gap: 6px; animation: pulse 2s infinite; }
.save-btn:hover { background: #2563eb !important; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }

/* ============= DASHBOARD STATS BAR ============= */
.dashboard-stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; padding: 0 40px; margin-top: 20px; }
.stat-item { background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 8px; text-align: center; transition: all 0.3s ease; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
.stat-item:hover { border-color: #3b82f6; background: linear-gradient(135deg, #eff6ff 0%, #f0f4f8 100%); box-shadow: 0 8px 16px rgba(59, 130, 246, 0.12); transform: translateY(-2px); }
.stat-item i { font-size: 22px; color: #3b82f6; }
.stat-item .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
.stat-item .value { font-size: 18px; font-weight: 800; color: #0f172a; }
.health-ok { background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

/* ============= DASHBOARD INFO SECTION ============= */
.dashboard-info-section { padding: 0 40px; }
.section-title { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; gap: 8px; letter-spacing: -0.3px; }
.info-cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.info-card { background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 10px; transition: all 0.3s ease; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); overflow: hidden; }
.card-header { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.card-header i { font-size: 14px; color: #3b82f6; }
.card-value { font-size: 16px; font-weight: 800; color: #3b82f6; }
.card-detail { font-size: 11px; color: #94a3b8; font-weight: 500; }
.card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.tag { display: inline-block; padding: 6px 12px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #1d4ed8; border-radius: 12px; font-size: 11px; border: 1px solid #3b82f6; font-weight: 700; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1); }
.tag:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(59, 130, 246, 0.2); }

/* ============= PERFORMANCE SECTION ============= */
.performance-section { padding: 0 40px; }
.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.metric { background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; display: flex; flex-direction:  column; gap: 8px; transition: all 0.3s ease; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
.metric:hover { border-color: #3b82f6; box-shadow: 0 8px 16px rgba(59, 130, 246, 0.12); transform: translateY(-2px); }
.metric-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
.metric-value { font-size: 17px; font-weight: 800; color: #0f172a; }
.metric-bar { width: 100%; height: 6px; background: #e2e8f0; border-radius:  3px; overflow: hidden; }
.metric-fill { height: 100%; background: linear-gradient(90deg, #3b82f6 0%, #7c3aed 50%, #14b8a6 100%); border-radius: 3px; transition: width 0.5s ease; }

/* ============= PANELS SUMMARY SECTION ============= */
.panels-summary-section { padding: 0 40px; }
.summary-table { width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
.summary-table thead tr { background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); border-bottom: 2px solid #e2e8f0; }
.summary-table th { padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px; }
.summary-table td { padding: 12px 14px; color: #0f172a; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
.summary-table tbody tr { transition: all 0.3s ease; }
.summary-table tbody tr:hover { background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); }
.cell-name { font-weight: 700; color: #0f172a; }
.cell-query { font-family: 'Monaco', 'Menlo', monospace; font-size: 11px; color: #3b82f6; font-weight: 500; }
.badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #1d4ed8; border: 1px solid #3b82f6; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1); }

/* ============= STATUS BADGE  ============= */
.status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; transition: all 0.3s ease; }
.status-badge.status-normal { background-color: #dcfce7; color: #166534; border: 1px solid #86efac; }
.status-badge.status-normal i { color: #16a34a; }
.status-badge.status-warning { background-color: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
.status-badge.status-warning i { color: #eab308; }
.status-badge.status-critical { background-color: #fee2e2; color: #7f1d1d; border: 1px solid #fca5a5; }
.status-badge.status-critical i { color: #dc2626; }
.status-badge.status-unknown { background-color: #f3f4f6; color: #6b7280; border: 1px solid #d1d5db; }
.status-badge.active { background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%); color: #15803d; border: 1px solid #10b981; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.1); }
.status-badge.inactive { background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); color: #6b7280; border: 1px solid #d1d5db; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
tbody tr:has(.status-normal) { background-color: #f0fdf4 !important; }
tbody tr:has(.status-warning) { background-color: #fffbeb !important; }
tbody tr:has(.status-critical) { background-color: #fef2f2 !important; }

/* ============= ACTIVITY SECTION ============= */
.activity-section { padding: 0 40px; }
.activity-log { display: flex; flex-direction: column; gap: 8px; }
.log-item { background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; font-size: 12px; transition: all 0.3s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.log-item:hover { border-color: #3b82f6; background: linear-gradient(135deg, #eff6ff 0%, #f0f4f8 100%); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1); transform: translateX(2px); }
.log-icon { font-size: 15px; color: #3b82f6; flex-shrink: 0; }
.log-action { flex: 1; color: #0f172a; font-weight: 600; }
.log-time { color: #94a3b8; font-size: 11px; }

/* ============= DASHBOARD PANELS ============= */
.dashboard-panels { padding: 0 40px 40px 40px; }
.panels-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
.layout-info { font-size: 11px; color: #64748b; font-weight: 600; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; }
.unsaved-warning { color: #d97706; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.grid-layout-container { min-height: 400px; background: #fdfdfd; border-radius: 12px; }
.custom-grid-item { touch-action: none; }
.grid-content-card { width: 100%; height: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); display: flex; flex-direction: column; overflow: hidden; transition: box-shadow 0.2s ease, border-color 0.2s ease; }
.grid-content-card > * { flex: 1; height: 100%; min-height: 0; display: flex; flex-direction: column; }
.custom-grid-item:hover .grid-content-card { border-color: #3b82f6; box-shadow: 0 8px 20px rgba(59, 130, 246, 0.12); z-index: 10; }
.vue-grid-item.vue-grid-placeholder { background: rgba(59, 130, 246, 0.1) !important; border: 2px dashed #3b82f6 !important; border-radius: 10px; opacity: 0.5; }
.vue-grid-item.resizing { opacity: 0.9; z-index: 100; }
.empty-panels { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #64748b; text-align: center; }
.empty-panels i { font-size: 64px; background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 16px; opacity: 0.4; }
.empty-panels p { font-size: 14px; font-weight: 500; }

/* ============= FORM VIEW ============= */
.form-view { padding: 0; }
.form-container { padding: 40px; max-width: 600px; }
.form-container h3 { font-size: 20px; font-weight: 800; color: #0f172a; margin:  0 0 28px 0; letter-spacing: -0.3px; }
.form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.form-group label { font-size: 13px; font-weight: 700; color: #0f172a; text-transform: capitalize; }
.form-input, .form-textarea, .form-select { padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; color: #0f172a; font-size: 13px; outline: none; transition: all 0.3s ease; font-family: 'Inter', sans-serif; font-weight: 500; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.form-input:focus, .form-textarea:focus, .form-select:focus { border-color: #3b82f6; background: #f8fafc; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05); }
.form-textarea { resize: vertical; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-actions { display: flex; gap: 12px; margin-top: 32px; }
.btn-cancel, .btn-submit { flex: 1; padding: 12px; border-radius: 8px; border: none; cursor: pointer; font-weight: 700; font-size: 13px; transition: all 0.3s ease; text-transform: capitalize; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.btn-cancel { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.btn-cancel:hover { background: #e2e8f0; color: #0f172a; border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); transform: translateY(-1px); }
.btn-submit { background: linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%); color: white; }
.btn-submit:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3); }

/* ============= ANIMATIONS ============= */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

/* ============= RESPONSIVE ============= */
@media (max-width: 1024px) { .dashboard-stats-bar, .info-cards-grid, .dashboard-panels { padding-left: 32px; padding-right: 32px; } }
@media (max-width: 768px) { .dashboard-modal { width: 98vw; height: 98vh; border-radius: 12px; } .modal-header { padding: 20px 24px; } .header-title h2 { font-size: 22px; } .modal-body { padding: 20px 24px; } .form-row { grid-template-columns: 1fr; } .dashboard-stats-bar, .info-cards-grid, .dashboard-panels { padding-left: 24px; padding-right:  24px; } }


.panels-button-section {
  padding: 0 40px 20px 40px;
  display: flex;
  justify-content: flex-start;
}

.btn-show-panels {
  background: linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%);
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
}

.btn-show-panels:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
}

/* ✅ FULLSCREEN MODAL */
.panels-fullscreen-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.3s ease;
}

.panels-fullscreen-content {
  background: #ffffff;
  border-radius: 16px;
  width: 100%;
  height: 100%;
  max-width: 1600px;
  max-height: 900px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.panels-modal-header {
  padding: 24px 32px;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.panels-modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.3px;
}

.btn-close-panels {
  width: 40px;
  height: 40px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.3s ease;
}

.btn-close-panels:hover {
  background: #fee2e2;
  color:  #ef4444;
  border-color: #fecaca;
  transform: rotate(90deg);
}

.panels-modal-toolbar {
  padding: 16px 32px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.tb-btn {
  background: #3b82f6;
  color: white;
  border:  none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight:  700;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.tb-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.unsaved-badge {
  color: #d97706;
  font-size: 12px;
  font-weight: 700;
  background: #fef3c7;
  padding: 6px 12px;
  border-radius: 6px;
  border-left: 3px solid #f59e0b;
}

.panels-modal-body {
  flex: 1;
  overflow: auto;
  padding: 24px;
  background: #f8fafc;
}

.grid-layout-container-fullscreen {
  width: 100%;
  min-height: 100%;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  padding: 20px;
}

.custom-grid-item-fullscreen {
  touch-action: none;
}

.grid-content-card-fullscreen {
  width: 100%;
  height: 100%;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.grid-content-card-fullscreen > * {
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.custom-grid-item-fullscreen:hover .grid-content-card-fullscreen {
  border-color: #3b82f6;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.12);
  z-index: 10;
}

.vue-grid-item.vue-grid-placeholder {
  background: rgba(59, 130, 246, 0.1) !important;
  border: 2px dashed #3b82f6 !important;
  border-radius: 10px;
  opacity: 0.5;
}

.vue-grid-item.resizing {
  opacity: 0.9;
  z-index: 100;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.panels-management-view {
  padding: 0;
  display: flex;
  flex-direction: column;
}

.panels-management-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 40px;
  gap: 24px;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items:  center;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 16px;
}

.management-header h3 {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  margin:  0;
}

.btn-add-panel {
  background: linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
}

.btn-add-panel:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
}

.panels-list-container {
  flex: 1;
  overflow-y: auto;
}

.empty-panels-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: #64748b;
}

.empty-panels-state i {
  font-size: 64px;
  opacity: 0.2;
  margin-bottom: 16px;
}

.btn-add-first-panel {
  background: linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%);
  color: white;
  border: none;
  padding:  12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  margin-top: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.panels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.panel-card {
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.panel-card:hover {
  border-color: #3b82f6;
  box-shadow:  0 8px 20px rgba(59, 130, 246, 0.12);
  transform: translateY(-2px);
}

.panel-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.panel-info h4 {
  font-size: 14px;
  font-weight:  700;
  color: #0f172a;
  margin: 0 0 4px 0;
}

.panel-info p {
  font-size: 11px;
  color: #64748b;
  margin: 0;
}

.panel-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 13px;
}

.edit-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #f0f4f8;
}

.delete-btn:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: #fee2e2;
}

.panel-card-body {
  display: flex;
  gap: 8px;
  align-items: center;
}

.badge {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1d4ed8;
  padding:  4px 10px;
  border-radius:  6px;
  font-size: 10px;
  font-weight: 700;
  border: 1px solid #3b82f6;
}

.unit {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}

.btn-export-dashboard,
.btn-import-dashboard {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background:  #3b82f6;
  color:  white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-export-dashboard:hover,
.btn-import-dashboard:hover {
  background:  #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.import-export-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
</style>