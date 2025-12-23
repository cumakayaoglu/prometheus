<template>
<div class="dashboards-container">
<!-- HEADER -->
<div class="dashboards-header">
<div class="header-top">
<div class="header-left">
<h1>
<i class="fas fa-th-large"></i> Dashboardlar
</h1>
<p class="header-subtitle">Tüm monitoring dashboard'larını yönetin ve görüntüleyin</p>
</div>
<div class="header-right">
<button class="btn-theme-toggle" @click="dashboardStore.toggleTheme()" :title="`${dashboardStore.theme === 'dark' ? 'Açık' : 'Koyu'} tema`">
<i :class="dashboardStore.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon'"></i>
</button>
<button class="btn-create-dashboard" @click="showCreateModal = true">
<i class="fas fa-plus"></i> Yeni Dashboard
</button>
</div>
</div>

<!-- SEARCH & FILTERS -->
<div class="filters-section">
<div class="search-box">
<i class="fas fa-search"></i>
<input 
v-model="searchQuery" 
type="text" 
placeholder="Dashboard ara..." 
class="search-input"
/>
</div>

<div class="filter-tags">
<button 
v-for="tag in allTags" 
:key="tag"
:class="['tag-filter', { active: selectedTags. includes(tag) }]"
@click="toggleTag(tag)"
>
<i class="fas fa-tag"></i> {{ tag }}
</button>
</div>

<div class="view-controls">
<button 
v-for="view in ['all', 'favorites']" 
:key="view"
:class="['view-btn', { active: currentView === view }]"
@click="currentView = view as 'all' | 'favorites'"
>
<i :class="view === 'favorites' ? 'fas fa-star' : 'fas fa-list'"></i>
{{ view === 'favorites' ? 'Favoriler' : 'Tümü' }}
</button>
</div>
</div>
</div>

<!-- EMPTY STATE -->
<div v-if="filteredDashboards.length === 0" class="empty-state">
<i class="fas fa-inbox"></i>
<h3>Dashboard bulunamadı</h3>
<p>{{ searchQuery || selectedTags.length > 0 ? 'Arama kriterlerinize uygun dashboard yok.' : 'Henüz dashboard oluşturmadınız.' }}</p>
<button class="btn-create-dashboard" @click="showCreateModal = true">
<i class="fas fa-plus"></i> İlk Dashboard'ı Oluştur
</button>
</div>

<!-- DASHBOARDS GRID -->
<div v-else class="dashboards-grid">
<div 
v-for="dashboard in filteredDashboards" 
:key="dashboard.id"
class="dashboard-card"
@click="goToDashboard(dashboard.id)"
>
<!-- CARD HEADER -->
<div class="card-header">
<div class="card-icon">
<i :class="`${dashboard.icon}`"></i>
</div>
<div class="card-title-group">
<h3 class="card-title">{{ dashboard. name }}</h3>
<p class="card-description">{{ dashboard.description }}</p>
</div>
<button 
class="btn-favorite"
:class="{ favorite: dashboard.is_favorite }"
@click. stop="dashboardStore.toggleFavorite(dashboard.id)"
:title="dashboard.is_favorite ? 'Favorilerden çıkar' : 'Favori ekle'"
>
<i class="fas fa-star"></i>
</button>
</div>

<!-- CARD BODY -->
<div class="card-body">
<div class="card-stats">
<div class="stat">
<span class="stat-label">Paneller</span>
<span class="stat-value">{{ dashboard.panels.length }}</span>
</div>
<div class="stat">
<span class="stat-label">Yenileme</span>
<span class="stat-value">{{ formatRefreshRate(dashboard.refresh_rate) }}</span>
</div>
<div class="stat">
<span class="stat-label">Zaman Aralığı</span>
<span class="stat-value">{{ formatTimeRange(dashboard.time_range) }}</span>
</div>
</div>

<div class="card-tags">
<span 
v-for="tag in dashboard.tags" 
:key="tag"
class="tag"
@click. stop="selectTag(tag)"
>
{{ tag }}
</span>
</div>
</div>

<!-- CARD FOOTER -->
<div class="card-footer">
<span class="updated-time">
<i class="fas fa-clock"></i> 
{{ formatDate(dashboard.updated_at) }}
</span>
<div class="card-actions">
<button class="action-btn view-btn" @click. stop="goToDashboard(dashboard.id)" title="Görüntüle">
<i class="fas fa-eye"></i>
</button>
<button class="action-btn edit-btn" @click.stop="editDashboard(dashboard)" title="Düzenle">
<i class="fas fa-edit"></i>
</button>
<button class="action-btn delete-btn" @click.stop="deleteDashboard(dashboard.id)" title="Sil">
<i class="fas fa-trash"></i>
</button>
</div>
</div>
</div>
</div>

<!-- CREATE/EDIT MODAL -->
<div v-if="showCreateModal" class="modal-overlay" @click="closeModal">
<div class="modal-content" @click.stop>
<div class="modal-header">
<h2>{{ editingDashboard ? 'Dashboard Düzenle' : 'Yeni Dashboard Oluştur' }}</h2>
<button class="btn-close" @click="closeModal">
<i class="fas fa-times"></i>
</button>
</div>

<div class="modal-body">
<div class="form-group">
<label>Dashboard Adı *</label>
<input 
v-model="formData.name" 
type="text" 
placeholder="Dashboard adını girin"
class="form-input"
/>
</div>

<div class="form-group">
<label>Açıklama</label>
<textarea 
v-model="formData. description" 
placeholder="Dashboard açıklaması..."
class="form-textarea"
rows="3"
></textarea>
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
<label>Yenileme Oranı</label>
<select v-model="formData.refresh_rate" class="form-select">
<option :value="10000">10 saniye</option>
<option :value="30000">30 saniye</option>
<option :value="60000">1 dakika</option>
<option :value="300000">5 dakika</option>
</select>
</div>
</div>

<div class="form-row">
<div class="form-group">
<label>Zaman Aralığı</label>
<select v-model="formData.time_range" class="form-select">
<option value="last1h">Son 1 saat</option>
<option value="last6h">Son 6 saat</option>
<option value="last24h">Son 24 saat</option>
<option value="last7d">Son 7 gün</option>
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
<label>Etiketler (virgülle ayırarak)</label>
<input 
v-model="tagsInput" 
type="text" 
placeholder="solar, energy, monitoring"
class="form-input"
/>
</div>
</div>

<div class="modal-footer">
<button class="btn-cancel" @click="closeModal">İptal</button>
<button class="btn-submit" @click="saveDashboard">
{{ editingDashboard ? 'Güncelle' : 'Oluştur' }}
</button>
</div>
</div>
</div>
</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboardStore'
import type { Dashboard } from '@/stores/dashboardStore'

const router = useRouter()
const dashboardStore = useDashboardStore()

// STATE
const searchQuery = ref('')
const selectedTags = ref<string[]>([])
const currentView = ref<'all' | 'favorites'>('all')
const showCreateModal = ref(false)
const editingDashboard = ref<Dashboard | null>(null)
const tagsInput = ref('')
const formData = ref({
name: '',
description: '',
icon: 'fas fa-sun',
refresh_rate: 30000,
time_range: 'last24h' as 'last1h' | 'last6h' | 'last24h' | 'last7d', // ✅ FIXED
theme: 'dark' as 'dark' | 'light' // ✅ FIXED
})

// COMPUTED
const allTags = computed(() => {
const tags = new Set<string>()
dashboardStore.getAllDashboards. forEach(d => {
d.tags.forEach(t => tags.add(t))
})
return Array.from(tags). sort()
})

const filteredDashboards = computed(() => {
let result = dashboardStore.getAllDashboards

// View Filter
if (currentView. value === 'favorites') {
result = result. filter(d => d.is_favorite)
}

// Search Filter
if (searchQuery.value. trim()) {
const query = searchQuery.value.toLowerCase()
result = result.filter(d =>
d.name. toLowerCase().includes(query) ||
d.description.toLowerCase().includes(query)
)
}

// Tag Filter
if (selectedTags.value.length > 0) {
result = result.filter(d =>
selectedTags.value. some(tag => d.tags.includes(tag))
)
}

return result
})

// METHODS
const toggleTag = (tag: string) => {
const idx = selectedTags.value.indexOf(tag)
if (idx > -1) {
selectedTags.value.splice(idx, 1)
} else {
selectedTags.value.push(tag)
}
}

const selectTag = (tag: string) => {
if (! selectedTags.value.includes(tag)) {
selectedTags.value.push(tag)
}
}

const goToDashboard = (id: string) => {
dashboardStore.setCurrentDashboard(id)
router.push(`/dashboard/${id}`)
}

const editDashboard = (dashboard: Dashboard) => {
editingDashboard.value = dashboard
formData.value = {
name: dashboard.name,
description: dashboard.description,
icon: dashboard.icon,
refresh_rate: dashboard.refresh_rate,
time_range: dashboard.time_range as 'last1h' | 'last6h' | 'last24h' | 'last7d',
theme: dashboard.theme as 'dark' | 'light' 
}
tagsInput.value = dashboard.tags.join(', ')
showCreateModal.value = true
}

const saveDashboard = () => {
if (!formData.value.name. trim()) {
alert('Dashboard adı boş olamaz!')
return
}

if (editingDashboard.value) {
// Update
Object.assign(editingDashboard.value, {
... formData.value,
tags: tagsInput.value.split(','). map(t => t.trim()). filter(t => t),
updated_at: new Date().toISOString()
})
} else {
// Create
const newDashboard: Dashboard = {
id: `dashboard-${Date.now()}`,
... formData.value,
tags: tagsInput.value.split(',').map(t => t. trim()).filter(t => t),
panels: [],
created_at: new Date().toISOString(),
updated_at: new Date().toISOString(),
is_favorite: false,
layout: 'grid'
}
dashboardStore.dashboards.push(newDashboard)
}

closeModal()
}

const deleteDashboard = (id: string) => {
if (confirm('Bu dashboardı silmek istediğinize emin misiniz?')) {
const idx = dashboardStore.dashboards.findIndex(d => d. id === id)
if (idx > -1) {
dashboardStore.dashboards.splice(idx, 1)
}
}
}

const closeModal = () => {
showCreateModal.value = false
editingDashboard.value = null
formData.value = {
name: '',
description: '',
icon: 'fas fa-sun',
refresh_rate: 30000,
time_range: 'last24h',
theme: 'dark'
}
tagsInput.value = ''
}

const formatRefreshRate = (ms: number): string => {
if (ms < 60000) return `${Math.round(ms / 1000)}s`
return `${Math.round(ms / 60000)}m`
}

const formatTimeRange = (range: string): string => {
const map: Record<string, string> = {
last1h: '1 saat',
last6h: '6 saat',
last24h: '24 saat',
last7d: '7 gün'
}
return map[range] || range
}

const formatDate = (date: string): string => {
return new Date(date).toLocaleDateString('tr-TR', {
year: 'numeric',
month: 'short',
day: 'numeric',
hour: '2-digit',
minute: '2-digit'
})
}

onMounted(() => {
dashboardStore.initializeDashboards()
})
</script>

<style scoped>
.dashboards-container {
  background: #f5f7fa;
  min-height: 100vh;
  padding: 30px;
  color: #1a202c;
  font-family: 'Inter', sans-serif;
}

.dashboards-header {
  margin-bottom: 40px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  gap: 20px;
}

.header-left h1 {
  font-size: 32px;
  font-weight:  700;
  margin: 0 0 5px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #1a202c;
}

.header-subtitle {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

.header-right {
  display:  flex;
  gap: 12px;
  align-items:  center;
}

.btn-theme-toggle {
  width: 40px;
  height: 40px;
  border:  1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #f59e0b;
  cursor:  pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.3s;
}

.btn-theme-toggle:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.btn-create-dashboard {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
}

.btn-create-dashboard:hover {
  transform:  translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

.filters-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0 16px;
  max-width: 400px;
}

.search-box i {
  color: #94a3b8;
  margin-right: 10px;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  padding: 12px 0;
  color: #1a202c;
  outline: none;
  font-size: 14px;
}

.search-input::placeholder {
  color: #94a3b8;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-filter {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 8px 12px;
  border-radius:  6px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.3s;
}

.tag-filter:hover {
  border-color: #94a3b8;
  color: #1a202c;
  background: #f8fafc;
}

.tag-filter.active {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1d4ed8;
}

.view-controls {
  display: flex;
  gap: 8px;
}

.view-btn {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color:  #475569;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.3s;
}

.view-btn:hover {
  border-color: #94a3b8;
  color:  #1a202c;
  background: #f8fafc;
}

.view-btn.active {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1d4ed8;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: #64748b;
}

.empty-state i {
  font-size: 64px;
  color: #cbd5e1;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 20px;
  color: #1a202c;
  margin-bottom: 10px;
}

.empty-state p {
  font-size:  14px;
  margin-bottom: 30px;
}

.dashboards-grid {
  display:  grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
}

.dashboard-card {
  background: #ffffff;
  border:  1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.dashboard-card:hover {
  transform: translateY(-6px);
  border-color: #3b82f6;
  box-shadow:  0 8px 24px rgba(59, 130, 246, 0.12);
}

.card-header {
  padding: 20px;
  border-bottom:  1px solid #f1f5f9;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.card-icon {
  width: 48px;
  height: 48px;
  background: #eff6ff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #3b82f6;
  flex-shrink: 0;
}

.card-title-group {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 16px;
  font-weight:  700;
  margin: 0 0 4px 0;
  color: #1a202c;
  word-break: break-word;
}

.card-description {
  font-size: 12px;
  color: #64748b;
  margin:  0;
  display: -webkit-box;
  -webkit-line-clamp:  2;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow:  hidden;
}

.btn-favorite {
  background: none;
  border: none;
  color: #cbd5e1;
  cursor:  pointer;
  font-size:  18px;
  transition: all 0.3s;
  flex-shrink: 0;
}

.btn-favorite:hover,
.btn-favorite.favorite {
  color: #fbbf24;
  transform: scale(1.2);
}

.card-body {
  padding: 20px;
  flex:  1;
}

.card-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat {
  background: #f8fafc;
  border:  1px solid #e2e8f0;
  padding: 10px;
  border-radius: 6px;
  text-align:  center;
}

.stat-label {
  display: block;
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom:  4px;
}

.stat-value {
  display: block;
  font-size: 16px;
  font-weight:  700;
  color: #3b82f6;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  background: #eff6ff;
  color: #1d4ed8;
  padding:  4px 10px;
  border-radius:  4px;
  font-size:  11px;
  cursor: pointer;
  transition: all 0.2s;
}

.tag:hover {
  background: #dbeafe;
  color: #0c4a6e;
}

.card-footer {
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.updated-time {
  font-size: 12px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border:  1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: #94a3b8;
}

.action-btn.view-btn:hover {
  background: #dcfce7;
  border-color: #15803d;
  color: #15803d;
}

.action-btn.edit-btn:hover {
  background: #dbeafe;
  border-color: #2563eb;
  color: #2563eb;
}

.action-btn.delete-btn:hover {
  background: #fee2e2;
  border-color: #dc2626;
  color: #dc2626;
}

/* MODAL STYLES */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom:  0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #ffffff;
  border:  1px solid #e2e8f0;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 20px;
  font-weight:  700;
  margin: 0;
  color:  #1a202c;
}

.btn-close {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 20px;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #dc2626;
}

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-size: 13px;
  font-weight:  600;
  color: #1a202c;
  margin-bottom: 6px;
}

.form-input,
.form-textarea,
.form-select {
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #1a202c;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
  font-family: 'Inter', sans-serif;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  border-color: #3b82f6;
  background: #f8fafc;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.modal-footer {
  padding: 16px 24px;
  border-top:  1px solid #f1f5f9;
  display:  flex;
  gap: 12px;
  justify-content:  flex-end;
  background: #f8fafc;
}

.btn-cancel,
.btn-submit {
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f1f5f9;
  color: #475569;
}

.btn-cancel:hover {
  background:  #e2e8f0;
}

.btn-submit {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.btn-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

@media (max-width: 768px) {
  .dashboards-container {
    padding: 20px;
  }

  .header-top {
    flex-direction: column;
  }

  .header-left h1 {
    font-size: 24px;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }

  .search-box {
    max-width: 100%;
  }

  .dashboards-grid {
    grid-template-columns: 1fr;
  }

  .card-stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>