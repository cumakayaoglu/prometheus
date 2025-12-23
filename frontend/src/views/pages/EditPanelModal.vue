<template>
  <div v-if="isOpen" class="edit-modal-overlay" @click="handleClose">
    <div class="edit-modal-container" @click.stop>
      
      <!-- HEADER -->
      <div class="edit-header">
        <div class="header-left">
          <button class="btn-back" @click="handleClose">
            <i class="fas fa-arrow-left"></i>
          </button>
          <div class="breadcrumb">
            <span class="bc-item">Dashboardlar</span>
            <i class="fas fa-chevron-right bc-sep"></i>
            <span class="bc-item">{{ dashboardName }}</span>
            <i class="fas fa-chevron-right bc-sep"></i>
            <span class="bc-active">{{ localPanel.title || 'Panel Düzenle' }}</span>
          </div>
        </div>
        <div class="header-right">
          <button class="btn-header btn-discard" @click="handleClose">
            İptal
          </button>
          <button class="btn-header btn-apply" @click="applyChanges">
            Uygula
          </button>
          <button class="btn-header btn-save" @click="saveAndClose">
            <i class="fas fa-save"></i> Kaydet
          </button>
        </div>
      </div>

      <!-- BODY -->
      <div class="edit-body">
        
        <!-- PREVIEW ZONE -->
        <div class="preview-zone" :style="{ height: previewHeight + 'px' }">
          <div class="preview-toolbar">
            <div class="toolbar-left">
              <span class="section-label"><i class="fas fa-desktop"></i> ÖNİZLEME</span>
            </div>
            <div class="toolbar-right">
              <button class="tb-btn" @click="refreshAllPreviews" :disabled="isRefreshing">
                <i class="fas fa-sync-alt" :class="{ 'fa-spin': isRefreshing }"></i>
                Tümünü Yenile
              </button>
              <select class="tb-select" v-model="timeRange" @change="onTimeRangeChange">
                <option value="5m">Son 5 dakika</option>
                <option value="15m">Son 15 dakika</option>
                <option value="1h">Son 1 saat</option>
                <option value="6h">Son 6 saat</option>
                <option value="24h">Son 24 saat</option>
              </select>
            </div>
          </div>
          
          <!-- MULTI PREVIEW GRID -->
          <div class="preview-grid" :style="{ gridTemplateColumns: previewGridColumns }">
            <div v-for="(query, idx) in visibleQueries" :key="query. id" class="preview-item">
              <div class="preview-item-header">
                <span class="preview-query-id">{{ query.id }}</span>
                <span class="preview-query-text">{{ query.expression || 'Sorgu yok' }}</span>
              </div>
              <div class="preview-canvas-mini">
                <div v-if="! query.expression" class="preview-empty">
                  <i class="fas fa-inbox"></i>
                  <p>Sorgu girilmedi</p>
                </div>
                <div v-else-if="query.error" class="preview-error-mini">
                  <i class="fas fa-exclamation-triangle"></i>
                  <p>{{ query.error }}</p>
                </div>
                <DashboardPanel v-else-if="query.previewPanel" :panel="query.previewPanel" :dashboard-id="dashboardId" class="mini-preview-panel" />
                <div v-else class="preview-loading">
                  <i class="fas fa-spinner fa-spin"></i>
                  <p>Yükleniyor...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RESIZE HANDLE -->
        <div class="resize-handle" @mousedown="startResize">
          <div class="resize-indicator">
            <i class="fas fa-grip-lines"></i>
          </div>
        </div>

        <!-- EDITOR ZONE -->
        <div class="editor-zone">
          
          <!-- TABS -->
          <div class="editor-tabs">
            <button v-for="tab in tabs" :key="tab.id" :class="['tab-item', { active: currentTab === tab.id }]" @click="currentTab = tab.id">
              <i :class="tab.icon"></i>
              {{ tab.label }}
            </button>
          </div>

          <!-- CONTENT -->
          <div class="editor-content">
            
            <!-- ===== QUERY TAB ===== -->
            <div v-if="currentTab === 'query'" class="content-pane">
              
              <!-- DATA SOURCE -->
              <div class="ds-section">
                <div class="ds-row">
                  <div class="ds-field">
                    <label>VERİ KAYNAĞI</label>
                    <div class="ds-selector">
                      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/prometheus/prometheus-original.svg" class="ds-logo" />
                      <span>Prometheus</span>
                      <i class="fas fa-chevron-down ml-auto text-gray-400"></i>
                    </div>
                  </div>
                  
                  <div class="ds-actions">
                    <button class="ds-btn" @click="showQueryOpts = ! showQueryOpts">
                      <i :class="showQueryOpts ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
                      Sorgu Ayarları
                    </button>
                    <button class="ds-btn btn-inspector" @click="openQueryInspector">
                      <i class="fas fa-search"></i> Sorgu Denetleyicisi
                    </button>
                  </div>
                </div>

                <!-- QUERY OPTIONS PANEL -->
                <div v-if="showQueryOpts" class="query-opts-panel">
                  <div class="qo-field">
                    <label>Maksimum Veri Noktası</label>
                    <input type="text" v-model="globalQueryOpts.maxDataPoints" class="qo-input" placeholder="auto" />
                  </div>
                  <div class="qo-field">
                    <label>Min Aralık</label>
                    <input type="text" v-model="globalQueryOpts.minInterval" class="qo-input" placeholder="15s" />
                  </div>
                  <div class="qo-field">
                    <label>Göreceli Zaman</label>
                    <input type="text" v-model="globalQueryOpts.relativeTime" class="qo-input" placeholder="örn:  1h" />
                  </div>
                </div>
              </div>

              <!-- QUERY BLOCKS -->
              <div class="queries-list">
                <div v-for="(query, idx) in queries" :key="query.id" class="query-block">
                  
                  <!-- HEADER -->
                  <div class="qb-header">
                    <button class="qb-toggle" @click="query.collapsed = !query.collapsed">
                      <i :class="query.collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"></i>
                    </button>
                    <span class="qb-id">{{ query.id }}</span>
                    <span class="qb-source">(Prometheus)</span>
                    
                    <div class="qb-actions">
                      <button class="qb-action" @click="duplicateQuery(idx)" title="Kopyala">
                        <i class="fas fa-copy"></i>
                      </button>
                      <button class="qb-action" @click="toggleQueryVisibility(idx)" :title="query.hidden ? 'Göster' : 'Gizle'">
                        <i :class="query.hidden ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                      </button>
                      <button class="qb-action qb-delete" @click="removeQuery(idx)" v-if="queries.length > 1" title="Sil">
                        <i class="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>

                  <!-- BODY -->
                  <div v-show="! query.collapsed" class="qb-body">
                    
                    <div class="code-editor-wrapper">
                      <!-- Metrics Browser -->
                      <div class="metrics-link">
                        <button class="metrics-btn" @click="openMetricsBrowser(idx)">
                          <i class="fas fa-folder-open"></i> Metrik Tarayıcı
                        </button>
                      </div>
                      
                      <!-- Code Editor -->
                      <div class="code-editor">
                        <textarea v-model="query.expression" class="promql-textarea" placeholder='Sorgu giriniz...   Örn: mppt_values{job="mppt"}' @input="onQueryChange(idx)" @keydown.ctrl. enter="runQuery(idx)" rows="3"></textarea>
                      </div>
                      
                      <!-- Actions -->
                      <div class="code-actions">
                        <button class="ca-run" @click="runQuery(idx)" :disabled="query.isRunning || ! query.expression">
                          <i :class="query.isRunning ?   'fas fa-spinner fa-spin' : 'fas fa-play'"></i>
                          {{ query.isRunning ? 'Çalıştırılıyor...' : 'Sorguyu Çalıştır' }}
                        </button>
                      </div>
                    </div>

                    <!-- Footer Options -->
                    <div class="qb-footer">
                      <button class="qb-opts-toggle" @click="query.showOpts = !query.showOpts">
                        <i :class="query.showOpts ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
                        Seçenekler
                      </button>
                      <span v-if="! query.showOpts" class="qb-meta">
                        Lejant: {{ query.opts.legend }} | Format: {{ query.opts.format }}
                      </span>
                    </div>

                    <!-- Expanded Options -->
                    <div v-if="query.showOpts" class="qb-opts-grid">
                      <div class="qog-field">
                        <label>Lejant (Legend)</label>
                        <select v-model="query.opts.legend" class="qog-select" @change="markAsChanged">
                          <option>Auto</option>
                          <option>Custom</option>
                          <option>Hidden</option>
                        </select>
                      </div>
                      <div class="qog-field">
                        <label>Format</label>
                        <select v-model="query.opts.format" class="qog-select" @change="markAsChanged">
                          <option>Time series</option>
                          <option>Table</option>
                          <option>Heatmap</option>
                        </select>
                      </div>
                      <div class="qog-field">
                        <label>Adım (Step)</label>
                        <input v-model="query.opts.step" type="text" class="qog-input" placeholder="auto" @input="markAsChanged" />
                      </div>
                      <div class="qog-field">
                        <label>Tip</label>
                        <select v-model="query.opts. type" class="qog-select" @change="markAsChanged">
                          <option>Instant</option>
                          <option>Range</option>
                          <option>Both</option>
                        </select>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              <!-- ADD QUERY -->
              <div class="add-query-row">
                <button class="add-btn" @click="addQuery">
                  <i class="fas fa-plus"></i> Sorgu Ekle
                </button>
              </div>

            </div>

            <!-- ===== VIZ TAB ===== -->
            <div v-else-if="currentTab === 'viz'" class="content-pane">
              
              <!-- QUERY SELECTOR -->
              <div class="section-block">
                <h3 class="section-title">
                  <i class="fas fa-layer-group"></i>
                  Hangi Sorguyu Düzenlemek İstiyorsunuz?
                </h3>
                <div class="query-selector-grid">
                  <button v-for="query in queries" :key="query.id" :class="['query-selector-btn', { active: selectedQueryForEdit === query.id, hidden: query.hidden }]" @click="selectedQueryForEdit = query.id">
                    <span class="query-id-badge">{{ query.id }}</span>
                    <span class="query-expr">{{ query.expression || 'Sorgu yok' }}</span>
                    <span v-if="query.hidden" class="query-hidden-badge">
                      <i class="fas fa-eye-slash"></i> Gizli
                    </span>
                  </button>
                </div>
              </div>

              <!-- VISUALIZATION TYPE -->
              <div v-if="selectedQueryForEdit" class="section-block">
                <h3 class="section-title">
                  <i class="fas fa-chart-bar"></i>
                  Görselleştirme Tipi ({{ selectedQueryForEdit }})
                </h3>
                <div class="viz-grid">
                  <div v-for="vt in panelTypes" :key="vt. id" :class="['viz-item', { selected: getQuerySettings(selectedQueryForEdit).type === vt.id }]" @click="changeQueryPanelType(selectedQueryForEdit, vt.id)">
                    <div class="viz-icon-box">
                      <i :class="vt.icon"></i>
                    </div>
                    <span>{{ vt.  label }}</span>
                  </div>
                </div>
              </div>

              <!-- PANEL OPTIONS -->
              <div v-if="selectedQueryForEdit" class="section-block">
                <h3 class="section-title">
                  <i class="fas fa-sliders-h"></i>
                  Panel Seçenekleri ({{ selectedQueryForEdit }})
                </h3>
                <div class="form-field">
                  <label>Başlık</label>
                  <input v-model="getQuerySettings(selectedQueryForEdit).title" type="text" class="form-input" :placeholder="`Panel ${selectedQueryForEdit} Başlığı`" @input="markAsChanged" />
                </div>
                <div class="form-field">
                  <label>Açıklama</label>
                  <textarea v-model="getQuerySettings(selectedQueryForEdit).description" class="form-input" :placeholder="`Panel ${selectedQueryForEdit} Açıklaması`" @input="markAsChanged" rows="2"></textarea>
                </div>
              </div>

              <!-- STANDART SEÇENEKLER -->
              <div v-if="selectedQueryForEdit" class="section-block">
                <h3 class="section-title">
                  <i class="fas fa-cogs"></i>
                  Standart Seçenekler ({{ selectedQueryForEdit }})
                </h3>

                <div class="form-row">
                  <div class="form-field">
                    <label>Birim</label>
                    <select v-model="getQuerySettings(selectedQueryForEdit).unit" class="form-select" @change="markAsChanged">
                      <option value="">Yok</option>
                      <option value="V">Volt (V)</option>
                      <option value="A">Amper (A)</option>
                      <option value="W">Watt (W)</option>
                      <option value="kW">Kilowatt (kW)</option>
                      <option value="%">Yüzde (%)</option>
                      <option value="°C">Derece Celsius (°C)</option>
                      <option value="°F">Derece Fahrenheit (°F)</option>
                      <option value="Ω">Ohm (Ω)</option>
                      <option value="Hz">Hertz (Hz)</option>
                      <option value="ppm">PPM</option>
                    </select>
                  </div>
                  <div class="form-field">
                    <label>Ondalık Basamak</label>
                    <input v-model.number="getQuerySettings(selectedQueryForEdit).decimals" type="number" class="form-input" min="0" max="10" placeholder="2" @input="markAsChanged" />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-field">
                    <label>Min Değer</label>
                    <input v-model.number="getQuerySettings(selectedQueryForEdit).min" type="number" class="form-input" placeholder="Otomatik" @input="markAsChanged" />
                  </div>
                  <div class="form-field">
                    <label>Max Değer</label>
                    <input v-model.number="getQuerySettings(selectedQueryForEdit).max" type="number" class="form-input" placeholder="Otomatik" @input="markAsChanged" />
                  </div>
                </div>

                <div class="form-field">
                  <label>Veri Gösterimi Formatı</label>
                  <select v-model="getQuerySettings(selectedQueryForEdit).format" class="form-select" @change="markAsChanged">
                    <option value="auto">Otomatik</option>
                    <option value="short">Kısa (1.2K)</option>
                    <option value="long">Uzun (1200)</option>
                    <option value="scientific">Bilimsel (1.2e3)</option>
                    <option value="percent">Yüzde (120%)</option>
                  </select>
                </div>

                <div class="form-field">
                  <label>Ondalık Ayırıcı</label>
                  <select v-model="getQuerySettings(selectedQueryForEdit).decimalSeparator" class="form-select" @change="markAsChanged">
                    <option value=".">Nokta (. )</option>
                    <option value=",">Virgül (,)</option>
                  </select>
                </div>
              </div>

              <!-- RENK ŞEMASI -->
              <div v-if="selectedQueryForEdit" class="section-block">
                <h3 class="section-title">
                  <i class="fas fa-palette"></i>
                  Renk Şeması ({{ selectedQueryForEdit }})
                </h3>
                
                <div class="form-field">
                  <label>Renk Teması</label>
                  <select v-model="getQuerySettings(selectedQueryForEdit).colorTheme" class="form-select" @change="markAsChanged">
                    <option value="default">Varsayılan (Yeşil-Sarı-Kırmızı)</option>
                    <option value="blue">Mavi Tonu</option>
                    <option value="purple">Mor Tonu</option>
                    <option value="orange">Turuncu Tonu</option>
                    <option value="custom">Özel</option>
                  </select>
                </div>

                <div v-if="getQuerySettings(selectedQueryForEdit).colorTheme === 'custom'" class="custom-color-grid">
                  <div class="form-field">
                    <label>Normal Rengi</label>
                    <input v-model="getQuerySettings(selectedQueryForEdit).colorNormal" type="color" class="form-color-input" @input="markAsChanged" />
                  </div>
                  <div class="form-field">
                    <label>Uyarı Rengi</label>
                    <input v-model="getQuerySettings(selectedQueryForEdit).colorWarning" type="color" class="form-color-input" @input="markAsChanged" />
                  </div>
                  <div class="form-field">
                    <label>Kritik Rengi</label>
                    <input v-model="getQuerySettings(selectedQueryForEdit).colorCritical" type="color" class="form-color-input" @input="markAsChanged" />
                  </div>
                </div>
              </div>

              <!-- LEGEND & TOOLTIP -->
              <div v-if="selectedQueryForEdit" class="section-block">
                <h3 class="section-title">
                  <i class="fas fa-chart-line"></i>
                  Grafik Ayarları ({{ selectedQueryForEdit }})
                </h3>

                <div class="form-row">
                  <div class="form-field">
                    <label>Legend Pozisyonu</label>
                    <select v-model="getQuerySettings(selectedQueryForEdit).legendPosition" class="form-select" @change="markAsChanged">
                      <option value="top">Üst</option>
                      <option value="right">Sağ</option>
                      <option value="bottom">Alt</option>
                      <option value="left">Sol</option>
                      <option value="hidden">Gizli</option>
                    </select>
                  </div>
                  <div class="form-field">
                    <label>Tooltip Stili</label>
                    <select v-model="getQuerySettings(selectedQueryForEdit).tooltipStyle" class="form-select" @change="markAsChanged">
                      <option value="single">Tek Değer</option>
                      <option value="multi">Çok Değer</option>
                      <option value="none">Yok</option>
                    </select>
                  </div>
                </div>

                <div class="form-field">
                  <label>
                    <input v-model="getQuerySettings(selectedQueryForEdit).showGrid" type="checkbox" @change="markAsChanged" /> 
                    Arka Plan Izgarasını Göster
                  </label>
                </div>

                <div class="form-field">
                  <label>
                    <input v-model="getQuerySettings(selectedQueryForEdit).enableZoom" type="checkbox" @change="markAsChanged" /> 
                    Zoom/Pan Etkinleştir
                  </label>
                </div>
              </div>

              <!-- UYARI AYARLARI -->
              <div v-if="selectedQueryForEdit" class="section-block">
                <h3 class="section-title">
                  <i class="fas fa-bell"></i>
                  Uyarı Ayarları ({{ selectedQueryForEdit }})
                </h3>

                <div class="form-field">
                  <label>
                    <input v-model="getQuerySettings(selectedQueryForEdit).alertEnabled" type="checkbox" @change="markAsChanged" /> 
                    Uyarı Etkinleştir
                  </label>
                </div>

                <div v-if="getQuerySettings(selectedQueryForEdit).alertEnabled" class="alert-options">
                  <div class="form-field">
                    <label>Uyarı Mesajı</label>
                    <textarea v-model="getQuerySettings(selectedQueryForEdit).alertMessage" class="form-input" placeholder="Eşik değer geçildiğinde gösterilecek mesaj" rows="2" @input="markAsChanged"></textarea>
                  </div>

                  <div class="form-field">
                    <label>
                      <input v-model="getQuerySettings(selectedQueryForEdit).alertSound" type="checkbox" @change="markAsChanged" /> 
                      Ses Çıkart
                    </label>
                  </div>

                  <div class="form-field">
                    <label>
                      <input v-model="getQuerySettings(selectedQueryForEdit).alertNotification" type="checkbox" @change="markAsChanged" /> 
                      Tarayıcı Bildirimi Gönder
                    </label>
                  </div>
                </div>
              </div>

            </div>

            <!-- ===== OPTIONS TAB ===== -->
            <div v-else-if="currentTab === 'options'" class="content-pane">
              
              <!-- ✅ THRESHOLD SECTION - PERFECT VERSION -->
              <div class="section-block">
                <h3 class="section-title">
                  <i class="fas fa-exclamation-triangle"></i>
                  Eşik Değerleri (Thresholds) - ✅ KORUNMUŞ
                </h3>
                
                <div v-if="localPanel.threshold" class="threshold-list">
                  <!-- BASE -->
                  <div class="th-row base">
                    <div class="th-color" style="background:  #10b981;"></div>
                    <span class="th-label">Temel (Yeşil)</span>
                    <input 
                      v-model.number="localPanel.threshold.base" 
                      type="number" 
                      class="th-input" 
                      placeholder="0"
                      @input="markAsChanged" 
                    />
                  </div>

                  <!-- WARNING -->
                  <div class="th-row warning">
                    <div class="th-color" style="background: #f59e0b;"></div>
                    <span class="th-label">Uyarı (Sarı)</span>
                    <input 
                      v-model.number="localPanel. threshold.warning" 
                      type="number" 
                      class="th-input" 
                      placeholder="Uyarı eşiği"
                      @input="markAsChanged" 
                    />
                  </div>

                  <!-- CRITICAL -->
                  <div class="th-row critical">
                    <div class="th-color" style="background: #ef4444;"></div>
                    <span class="th-label">Kritik (Kırmızı)</span>
                    <input 
                      v-model.number="localPanel.threshold.critical" 
                      type="number" 
                      class="th-input" 
                      placeholder="Kritik eşiği"
                      @input="markAsChanged" 
                    />
                  </div>
                </div>

                <!-- THRESHOLD RULE EXPLANATION -->
                <div style="padding: 12px; background: #dcfce7; border-left: 4px solid #10b981; border-radius: 6px; margin-top: 16px;">
                  <p style="margin: 0; font-size: 12px; color: #166534; font-weight: 600;">
                    ✅ <strong>Doğru Mantık: </strong>
                    <br/>🟢 Değer < Uyarı → <strong>Yeşil (Normal)</strong>
                    <br/>🟡 Uyarı ≤ Değer < Kritik → <strong>Sarı (Uyarı)</strong>
                    <br/>🔴 Değer ≥ Kritik → <strong>Kırmızı (Kritik)</strong>
                  </p>
                </div>
              </div>

              <!-- REFRESH RATE -->
              <div class="section-block">
                <h3 class="section-title"><i class="fas fa-sync-alt"></i> Yenileme Aralığı</h3>
                <select v-model.number="localPanel.refresh_rate" class="form-select" @change="markAsChanged">
                  <option :value="5000">5 saniye</option>
                  <option :value="10000">10 saniye</option>
                  <option :value="15000">15 saniye</option>
                  <option :value="30000">30 saniye</option>
                  <option :value="60000">1 dakika</option>
                </select>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { usePrometheusStore } from '@/stores/prometheus'
import { useDashboardStore } from '@/stores/dashboardStore'
import type { DashboardPanel, PanelType } from '@/stores/dashboardStore'
import DashboardPanelComp from './DashboardPanel.vue'

const DashboardPanel = DashboardPanelComp
const prometheusStore = usePrometheusStore()
const dashboardStore = useDashboardStore()

let isSaving = false

const props = defineProps<{
  isOpen: boolean
  panel: DashboardPanel | null
  dashboardId: string
}>()

const emit = defineEmits<{
  close: []
  save: [panel: DashboardPanel]
  'save-additional': [panels: DashboardPanel[]]
  'delete-additional': [panelIds: string[]]
}>()

const currentTab = ref('query')
const tableView = ref(false)
const timeRange = ref('6h')
const showQueryOpts = ref(false)
const isRefreshing = ref(false)
const hasChanges = ref(false)

const previewHeight = ref(400)
const isResizing = ref(false)
const startY = ref(0)
const startHeight = ref(0)

const selectedQueryForEdit = ref<string>('A')

const globalQueryOpts = ref({
  maxDataPoints: 'auto',
  minInterval: '15s',
  relativeTime: ''
})

const tabs = [
  { id: 'query', label: 'Sorgu', icon: 'fas fa-database' },
  { id: 'viz', label: 'Görselleştirme', icon: 'fas fa-chart-pie' },
  { id: 'options', label: 'Ayarlar', icon: 'fas fa-cog' }
]

const panelTypes:  { id: PanelType, label: string, icon: string }[] = [
  { id: 'stat', label: 'Stat', icon: 'fas fa-heading' },
  { id: 'gauge', label: 'Gauge', icon: 'fas fa-tachometer-alt' },
  { id: 'chart', label: 'Time Series', icon: 'fas fa-chart-line' },
  { id: 'progress', label: 'Bar Gauge', icon: 'fas fa-battery-half' },
  { id: 'table', label: 'Table', icon: 'fas fa-table' },
  { id: 'heatmap', label: 'Heatmap', icon: 'fas fa-th' },
  { id: 'alert', label: 'Alert List', icon: 'fas fa-exclamation-triangle' }
]

interface QueryItem {
  id: string
  expression: string
  collapsed: boolean
  hidden: boolean
  isRunning: boolean
  error: string | null
  previewPanel:  DashboardPanel | null
  showOpts: boolean
  opts: {
    legend: string
    format: string
    step: string
    type: string
  }
  settings?:  {
    type?: PanelType
    unit?: string
    min?: number
    max?: number
    decimals?: number
    title?: string
    description?: string
    format?: string
    decimalSeparator?: string
    colorTheme?: string
    colorNormal?: string
    colorWarning?: string
    colorCritical?: string
    legendPosition?: string
    tooltipStyle?: string
    showGrid?: boolean
    enableZoom?: boolean
    alertEnabled?: boolean
    alertMessage?: string
    alertSound?: boolean
    alertNotification?: boolean
    threshold?: {
      base?: number
      warning:  number
      critical: number
    }
  }
}

const queries = ref<QueryItem[]>([
  {
    id: 'A',
    expression: '',
    collapsed: false,
    hidden: false,
    isRunning: false,
    error:  null,
    previewPanel:  null,
    showOpts:  false,
    opts: { legend: 'Auto', format: 'Time series', step: 'auto', type: 'Instant' }
  }
])

const localPanel = ref<DashboardPanel>({} as DashboardPanel)

const dashboardName = computed(() => {
  const dash = dashboardStore.getDashboardById(props.dashboardId)
  return dash ? dash.name : 'Dashboard'
})

const visibleQueries = computed(() => queries.value.filter(q => ! q.hidden))

const previewGridColumns = computed(() => {
  const count = visibleQueries.value. length
  if (count === 1) return '1fr'
  if (count === 2) return '1fr 1fr'
  if (count <= 4) return 'repeat(2, 1fr)'
  return 'repeat(3, 1fr)'
})

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  startY.value = e.clientY
  startHeight.value = previewHeight.value
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

const handleResize = (e: MouseEvent) => {
  if (! isResizing.value) return
  
  const delta = e.clientY - startY.value
  const newHeight = startHeight.value + delta
  
  const minHeight = 200
  const maxHeight = window.innerHeight * 0.7
  
  previewHeight.value = Math.max(minHeight, Math.min(newHeight, maxHeight))
}

const stopResize = () => {
  isResizing.value = false
  document.body. style.cursor = ''
  document.body.style.userSelect = ''
  
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  
  localStorage.setItem('editPanelPreviewHeight', previewHeight.value. toString())
}

const markAsChanged = () => {
  hasChanges.value = true
}

const getQuerySettings = (queryId: string) => {
  const query = queries.value.find(q => q.id === queryId)
  
  if (!query) {
    return {
      type:  localPanel.value.type || 'gauge',
      unit: '',
      min: 0,
      max: 100,
      decimals: 2,
      title: '',
      description: '',
      format: 'auto',
      decimalSeparator: '.',
      colorTheme: 'default',
      colorNormal: '#10b981',
      colorWarning: '#f59e0b',
      colorCritical: '#ef4444',
      legendPosition:  'bottom',
      tooltipStyle: 'single',
      showGrid: true,
      enableZoom: false,
      alertEnabled: false,
      alertMessage: '',
      alertSound: false,
      alertNotification: false,
      
      threshold: localPanel.value.threshold ? { ... localPanel.value.threshold } :  { base: 0, warning: 70, critical: 90 }
    }
  }
  
  if (! query.settings) {
    query.settings = {
      type: localPanel.value.type || 'gauge',
      unit: localPanel.value.unit || '',
      min: localPanel.value. min || 0,
      max: localPanel.value.max || 100,
      decimals:  localPanel.value.decimals || 2,
      title: `${localPanel.value.title} (${queryId})`,
      description: localPanel.value.description || '',
      format: 'auto',
      decimalSeparator: '.',
      colorTheme: 'default',
      colorNormal: '#10b981',
      colorWarning:  '#f59e0b',
      colorCritical: '#ef4444',
      legendPosition:  'bottom',
      tooltipStyle: 'single',
      showGrid: true,
      enableZoom: false,
      alertEnabled: false,
      alertMessage: 'Eşik değer geçildi! ',
      alertSound: false,
      alertNotification: false,
      
      threshold: localPanel.value.threshold ?  { ...localPanel.value.threshold } : { base: 0, warning: 70, critical: 90 }
    }
  }
  
  return query. settings
}

const changeQueryPanelType = (queryId: string, typeId: PanelType) => {
  const query = queries.value.find(q => q.id === queryId)
  if (query) {
    if (! query.settings) query.settings = {}
    query. settings.type = typeId
    updateQueryPreview(queryId)
    markAsChanged()
  }
}

const updateQueryPreview = (queryId: string) => {
  const query = queries.value.find(q => q.id === queryId)
  if (!query || !query.expression) return
  
  const settings = getQuerySettings(queryId)
  
  query.previewPanel = {
    ... localPanel.value,
    id: `preview-${queryId}`,
    query: query.expression,
    title: settings.title || `${queryId}: ${query.expression. substring(0, 30)}...`,
    description: settings.description,
    type: settings.type || localPanel.value.type,
    unit: settings.unit,
    min: settings.min,
    max: settings.max,
    decimals: settings.decimals,
    
    threshold: settings.threshold
  }
  
  query.previewPanel = { ...query.previewPanel }
}

const runQuery = async (idx: number) => {
  const query = queries.value[idx]
  if (!query.  expression) return

  query.isRunning = true
  query.error = null

  try {
    const result = await prometheusStore.fetchInstantQuery(query.expression)
    console.log(`✅ Query ${query.id} result: `, result)
    updateQueryPreview(query.id)
    markAsChanged()
  } catch (error:  any) {
    query.error = error.message || 'Sorgu hatası'
    console.error(`❌ Query ${query.id} error: `, error)
  } finally {
    query.isRunning = false
  }
}

const onQueryChange = (idx: number) => {
  queries.value[idx].error = null
  queries.value[idx].previewPanel = null
  markAsChanged()
}

const onTimeRangeChange = () => {
  prometheusStore.setRange(timeRange.value as any)
  refreshAllPreviews()
}

const refreshAllPreviews = async () => {
  isRefreshing.value = true
  for (let i = 0; i < queries. value.length; i++) {
    if (queries.value[i].expression && ! queries.value[i].hidden) {
      await runQuery(i)
    }
  }
  isRefreshing.value = false
}

const addQuery = () => {
  const nextId = String. fromCharCode(65 + queries.value.length)
  queries.value.push({
    id: nextId,
    expression:  '',
    collapsed: false,
    hidden: false,
    isRunning: false,
    error: null,
    previewPanel: null,
    showOpts: false,
    opts: { legend: 'Auto', format: 'Time series', step: 'auto', type: 'Instant' }
  })
  
  selectedQueryForEdit. value = nextId
  markAsChanged()
}

const duplicateQuery = (idx: number) => {
  const original = queries.value[idx]
  const nextId = String.fromCharCode(65 + queries.value.length)
  queries.value.push({
    ... JSON.parse(JSON.stringify(original)),
    id: nextId,
    previewPanel: null,
    settings: original.settings ?  { ...original.settings } : undefined
  })
  markAsChanged()
}

const removeQuery = (idx: number) => {
  if (queries.value.  length > 1) {
    if (confirm(`${queries.value[idx].id} sorgusunu silmek istediğinize emin misiniz?`)) {
      queries.value.splice(idx, 1)
      if (selectedQueryForEdit.value === queries.  value[idx]?.id) {
        selectedQueryForEdit.value = queries.value[0]. id
      }
      markAsChanged()
    }
  }
}

const toggleQueryVisibility = (idx: number) => {
  queries.value[idx].hidden = ! queries.value[idx].hidden
  markAsChanged()
}

const openMetricsBrowser = (idx: number) => {
  console.log('📂 Metrics browser açılıyor, query:', idx)
  alert('Metrik tarayıcı yakında eklenecek!')
}

const openQueryInspector = () => {
  console.log('🔍 Query inspector açılıyor')
  alert('Sorgu denetleyicisi yakında eklenecek!')
}

const handleClose = () => {
  if (hasChanges.value) {
    if (confirm('Kaydedilmemiş değişiklikler var.  Çıkmak istediğinize emin misiniz?')) {
      emit('close')
    }
  } else {
    emit('close')
  }
}

const saveAndClose = () => {
  savePanel()
  emit('close')
}

const applyChanges = () => {
  savePanel()
  hasChanges.value = false
}

const savePanel = () => {
  if (isSaving) {
    console.log('⚠️ savePanel zaten çalışıyor, atlanıyor')
    return
  }
  
  isSaving = true
  console.log('🔵 savePanel BAŞLADI')
  
  try {
    const mainQuery = queries.value[0]
    if (mainQuery && mainQuery.expression) {
      const mainSettings = getQuerySettings(mainQuery.id)

      if (! mainSettings) {
        console.error('mainSettings undefined')
        return
      }

      
      localPanel.value. query = mainQuery.expression
      localPanel.value.type = mainSettings.type || localPanel.value.type
      localPanel.value.unit = mainSettings.unit !== undefined ? mainSettings.unit : localPanel.value.unit
      localPanel.value.min = mainSettings.min !== undefined ? mainSettings. min : localPanel.value.min
      localPanel.value.max = mainSettings.max !== undefined ?  mainSettings.max : localPanel. value.max
      localPanel. value.decimals = mainSettings. decimals !== undefined ? mainSettings. decimals : localPanel.value. decimals
      
      
      if (! localPanel.value.threshold) {
        localPanel.value.threshold = { base: 0, warning: 70, critical: 90 }
      }
      
      console.log('📝 Kaydedilecek Threshold (UIdan):', localPanel.value.threshold)

      if (!localPanel.value.settings) {
        localPanel.value.settings = {}
      }
      
      localPanel.value.settings. format = mainSettings.format
      localPanel.value.settings. decimalSeparator = mainSettings.decimalSeparator
      localPanel. value.settings.colorTheme = mainSettings.colorTheme
      localPanel.value.settings.colorNormal = mainSettings.colorNormal
      localPanel.value.settings. colorWarning = mainSettings.colorWarning
      localPanel.value.settings.colorCritical = mainSettings.colorCritical
      localPanel.value.settings.legendPosition = mainSettings.legendPosition
      localPanel.value.settings. tooltipStyle = mainSettings.tooltipStyle
      localPanel.value.settings. showGrid = mainSettings.showGrid
      localPanel.value.settings.enableZoom = mainSettings.enableZoom
      localPanel.value.settings. alertEnabled = mainSettings.alertEnabled
      localPanel.value.settings.alertMessage = mainSettings.alertMessage
      localPanel.value.settings.alertSound = mainSettings.alertSound
      localPanel.value.settings.alertNotification = mainSettings.alertNotification

      const customTitle = mainSettings.title
      if (customTitle && customTitle !== `${localPanel.value.title} (${mainQuery.id})`) {
        localPanel.value.title = customTitle. replace(/\s*\([A-Z]\)$/, '')
      }

      const customDescription = mainSettings.description || ''
      if (customDescription) {
        localPanel.value. description = customDescription
      }
    }
    
    const allQueries = queries.value.map(q => ({
      id:  q.id,
      expression: q.expression,
      hidden: q.hidden,
      opts: q.opts,
      settings: q.settings
    }))
    
    if (!localPanel.value.settings) {
      localPanel.value.settings = {}
    }
    localPanel.value.settings.queries = allQueries
    
    const oldPanelIds:  string[] = localPanel.value. settings.additionalPanelIds || []
    
    const additionalPanels:  DashboardPanel[] = []
    const newPanelIds: string[] = []
    
    const processedQueries = new Set<string>()
    
    queries.value.forEach((query, idx) => {
      if (idx > 0 && query.expression && !query.hidden) {
        
        const queryKey = `${query.id}-${query.expression}`
        if (processedQueries.has(queryKey)) {
          return
        }
        processedQueries.add(queryKey)
        
        const settings = getQuerySettings(query.id)
        
        const timestamp = Date.now() + idx * 1000
        const baseId = localPanel.value.id.includes('-') 
          ? localPanel.value. id.split('-')[0] 
          : localPanel.value.id
        const uniqueId = `${baseId}-${query.id}-${timestamp}`
        
        const newPanel: DashboardPanel = {
          ... JSON.parse(JSON.stringify(localPanel.value)),
          id: uniqueId,
          dashboard_id: localPanel.value.dashboard_id,
          title: settings.title || `${localPanel.value.title. replace(/\s*\([A-Z]\)$/, '')} (${query.id})`,
          description: settings.description || '',
          query: query.expression,
          type: settings.type || 'gauge',
          unit: settings.unit || '',
          min: settings.min !== undefined ? settings.min : 0,
          max: settings. max !== undefined ? settings.max :  100,
          decimals:  settings.decimals !== undefined ? settings.decimals : 2,
          
          threshold: { ...localPanel.value.threshold },
          position: {
            x: (idx * 6) % 12,
            y: Math.floor((idx * 6) / 12) * 10,
            w: 6,
            h: 10
          },
          visible: true
        }
        
        additionalPanels.push(newPanel)
        newPanelIds.push(uniqueId)
      }
    })
    
    localPanel.value.settings.additionalPanelIds = newPanelIds
    localPanel.value.updated_at = new Date().toISOString()
    
    console.log('📤 Panel emit ile gönderiliyor - Threshold:', localPanel.value.threshold)
    
    emit('save', localPanel.value)
    
    if (oldPanelIds.length > 0) {
      emit('delete-additional', oldPanelIds)
    }
    
    if (additionalPanels.length > 0) {
      const uniquePanels = additionalPanels.filter((panel, index, self) => 
        index === self.findIndex(p => 
          p.query === panel.query && 
          p.title === panel.title
        )
      )
      
      if (uniquePanels.length > 0) {
        emit('save-additional', uniquePanels)
      }
    }
    
    console.log('✅ Panel kaydedildi - Threshold:', localPanel.value.threshold)
    
  } finally {
    isSaving = false
    console.log('🔵 savePanel BİTTİ')
  }
}

watch(() => props.panel, (newVal) => {
  if (newVal) {
    // ✅ DEEP COPY - PROTECT THRESHOLD
    localPanel.value = JSON.parse(JSON.stringify(newVal))
    
    if (newVal.settings?.queries && Array.isArray(newVal.settings.queries)) {
      queries.value = newVal.settings. queries.map(q => ({
        ...q,
        collapsed: false,
        isRunning: false,
        error: null,
        previewPanel: null,
        showOpts: false
      }))
      
      queries.value.forEach((q, idx) => {
        if (q.expression && !q.hidden) {
          runQuery(idx)
        }
      })
    } else if (newVal.query) {
      queries.value[0]. expression = newVal.query
      runQuery(0)
    }
    
    // ✅ THRESHOLD PROTECTION
    if (newVal.threshold) {
      localPanel.value.threshold = { ...newVal. threshold }
      console.log('✅ Threshold yüklendi (panelden):', localPanel.value.threshold)
    } else if (!localPanel.value.threshold) {
      localPanel.value.threshold = { base: 0, warning:  70, critical: 90 }
      console.log('✅ Threshold varsayılan değerle oluşturuldu')
    }
    
    if (! localPanel.value.settings) {
      localPanel.value.settings = {}
    }
    
    if (localPanel.value.decimals === undefined) {
      localPanel. value.decimals = 2
    }
    
    hasChanges. value = false
  }
}, { immediate: true, deep: true })

watch(() => [
  selectedQueryForEdit. value,
  ... queries.value.map(q => q.settings)
], () => {
  if (selectedQueryForEdit.value) {
    const query = queries.value.find(q => q.id === selectedQueryForEdit.value)
    if (query && query.expression) {
      updateQueryPreview(selectedQueryForEdit.value)
    }
  }
}, { deep: true })

onMounted(() => {
  const savedHeight = localStorage.getItem('editPanelPreviewHeight')
  if (savedHeight) {
    previewHeight. value = parseInt(savedHeight)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.edit-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px); z-index: 99999; display: flex; animation: fadeIn 0.2s ease; }
.edit-modal-container { width: 100%; height: 100%; display: flex; flex-direction: column; background: #f8fafc; color: #1e293b; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }
.edit-header { height: 56px; background: #ffffff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.header-left { display: flex; align-items: center; gap: 16px; }
.btn-back { background: transparent; border: 1px solid #e2e8f0; color: #64748b; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; }
.btn-back:hover { background: #f1f5f9; color:  #3b82f6; border-color: #bfdbfe; transform: translateX(-2px); }
.breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.bc-item { color: #64748b; font-weight: 500; transition: color 0.2s; cursor: pointer; }
.bc-item:hover { color: #3b82f6; }
.bc-sep { color: #cbd5e1; font-size: 10px; }
.bc-active { color: #1e293b; font-weight: 700; }
.header-right { display: flex; gap: 10px; }
.btn-header { border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
.btn-discard { background: white; color: #64748b; border: 1px solid #e2e8f0; }
.btn-discard:hover { background: #f8fafc; color: #ef4444; border-color: #fecaca; }
.btn-apply { background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; }
.btn-apply:hover { background: #dbeafe; border-color: #93c5fd; }
.btn-save { background: #3b82f6; color: white; border: 1px solid #3b82f6; box-shadow: 0 1px 2px rgba(59, 130, 246, 0.3); }
.btn-save:hover { background: #2563eb; transform: translateY(-1px); box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); }
.edit-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.preview-zone { min-height: 200px; max-height: 70vh; display: flex; flex-direction: column; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; padding: 16px 24px; overflow: hidden; }
.preview-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
.toolbar-left, .toolbar-right { display: flex; gap: 12px; align-items: center; }
.section-label { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
.tb-btn { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px; transition: all 0.2s; font-weight: 600; }
.tb-btn:hover:not(:disabled) { background: #f8fafc; color: #3b82f6; border-color: #bfdbfe; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1); }
.tb-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.tb-select { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 6px 12px; border-radius: 6px; font-size: 12px; outline: none; cursor: pointer; font-weight: 600; transition:  all 0.2s; }
.tb-select:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.preview-grid { display: grid; gap: 16px; height: 100%; overflow-y:  auto; padding: 4px; }
.preview-item { background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); transition: all 0.2s; }
.preview-item:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); transform: translateY(-2px); }
.preview-item-header { padding: 8px 12px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }
.preview-query-id { font-size: 12px; font-weight: 700; color: #3b82f6; min-width: 20px; }
.preview-query-text { font-size: 11px; color: #64748b; font-family: 'Monaco', 'Courier New', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.preview-canvas-mini { flex: 1; padding: 12px; display: flex; align-items: center; justify-content: center; min-height: 150px; background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%); }
.mini-preview-panel { width: 100%; height: 100%; }
.preview-empty, .preview-error-mini, .preview-loading { text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.preview-error-mini { color: #ef4444; }
.preview-error-mini i, .preview-empty i, .preview-loading i { font-size: 24px; }
.preview-error-mini p, .preview-empty p, .preview-loading p { font-size: 11px; margin: 0; font-weight: 500; }
.resize-handle { height: 8px; background: #e2e8f0; cursor: ns-resize; display: flex; align-items: center; justify-content: center; transition: background 0.2s; flex-shrink: 0; position: relative; z-index: 10; }
.resize-handle:hover { background: #cbd5e1; }
.resize-handle:active { background: #3b82f6; }
.resize-indicator { display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px; transition: color 0.2s; }
.resize-handle:hover .resize-indicator { color: #64748b; }
.resize-handle:active .resize-indicator { color: white; }
.editor-zone { flex: 1; display: flex; flex-direction: column; background: white; overflow: hidden; }
.editor-tabs { display: flex; background: white; border-bottom: 1px solid #e2e8f0; padding: 0 24px; }
.tab-item { background: transparent; border:  none; color: #64748b; padding: 14px 20px; font-size: 13px; font-weight: 600; cursor:  pointer; border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
.tab-item:hover { color: #1e293b; background: #f8fafc; }
.tab-item.active { color: #3b82f6; border-bottom-color: #3b82f6; }
.editor-content { flex: 1; overflow-y: auto; padding: 24px; background: #ffffff; }
.content-pane { max-width: 1200px; margin: 0 auto; }
.ds-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
.ds-row { display: flex; align-items: flex-end; gap: 20px; flex-wrap: wrap; }
.ds-field { flex: 1; min-width: 200px; }
.ds-field label { display: block; font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.ds-selector { display: flex; align-items: center; gap: 10px; background: white; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
.ds-selector:hover { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.ds-logo { width: 20px; height: 20px; }
.ds-selector span { color: #1e293b; font-weight: 600; font-size: 13px; }
.ds-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.ds-btn { background: white; border: 1px solid #cbd5e1; color: #475569; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 10px 14px; border-radius: 6px; font-weight: 600; transition:  all 0.2s; }
.ds-btn:hover { border-color: #3b82f6; color: #3b82f6; background: #eff6ff; }
.btn-inspector { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-color: #93c5fd; }
.query-opts-panel { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
.qo-field label { display: block; font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight:  600; }
.qo-input { width: 100%; background: white; border: 1px solid #cbd5e1; color: #1e293b; padding: 8px 12px; border-radius: 6px; font-size: 12px; outline: none; transition: all 0.2s; }
.qo-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.queries-list { display: flex; flex-direction: column; gap: 16px; }
.query-block { background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); overflow: hidden; transition: all 0.2s; }
.query-block:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); }
.qb-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 1px solid #e2e8f0; }
.qb-toggle { background: transparent; border: none; color: #64748b; font-size: 14px; cursor: pointer; padding:  4px; transition: all 0.2s; }
.qb-toggle:hover { color: #3b82f6; }
.qb-id { font-size: 15px; font-weight: 800; color: #3b82f6; }
.qb-source { font-size: 11px; color: #94a3b8; font-style: italic; }
.qb-actions { margin-left: auto; display: flex; gap: 4px; }
.qb-action { background: transparent; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 6px 8px; border-radius: 4px; transition: all 0.2s; }
.qb-action:hover { background: #e2e8f0; color:  #475569; }
.qb-delete:hover { color: #ef4444; background: #fee2e2; }
.qb-body { padding: 16px; }
.code-editor-wrapper { background: #f8fafc; border:  1px solid #e2e8f0; border-radius:  6px; display: flex; flex-direction: column; overflow: hidden; }
.metrics-link { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; background: white; }
.metrics-btn { background: transparent; border: none; color: #3b82f6; font-size: 12px; font-weight: 600; cursor:  pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
.metrics-btn:hover { text-decoration: underline; }
.code-editor { background: white; }
.promql-textarea { width: 100%; min-height: 80px; background: white; border: none; color: #1e293b; padding: 12px; font-family: 'Monaco', 'Menlo', 'Courier New', monospace; font-size: 13px; line-height: 1.6; outline: none; resize: vertical; }
.promql-textarea::placeholder { color: #cbd5e1; }
.promql-textarea:focus { background: #fff; }
.code-actions { display: flex; justify-content: flex-end; padding: 8px 12px; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-top: 1px solid #e2e8f0; }
.ca-run { background: #3b82f6; border: none; color: white; padding: 7px 16px; border-radius: 6px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 600; transition:  all 0.2s; box-shadow: 0 1px 2px rgba(59, 130, 246, 0.3); }
.ca-run:hover:not(:disabled) { background: #2563eb; transform: translateY(-1px); box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); }
.ca-run:disabled { opacity: 0.6; cursor: not-allowed; }
.qb-footer { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e2e8f0; display: flex; align-items: center; gap: 14px; }
.qb-opts-toggle { background: transparent; border: none; color: #64748b; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 600; transition: all 0.2s; }
.qb-opts-toggle:hover { color: #3b82f6; }
.qb-meta { font-size: 11px; color: #94a3b8; }
.qb-opts-grid { padding: 16px; background: #f8fafc; border-radius: 6px; margin-top: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.qog-field label { display: block; font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight: 700; text-transform: uppercase; }
.qog-select, .qog-input { width: 100%; background: white; border: 1px solid #cbd5e1; color: #1e293b; padding: 8px 10px; border-radius: 6px; font-size: 12px; outline: none; transition: all 0.2s; }
.qog-select:focus, .qog-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.add-query-row { margin-top: 20px; }
.add-btn { background: white; border: 1px dashed #cbd5e1; color: #475569; padding: 10px 20px; border-radius: 6px; font-size: 13px; cursor: pointer; display:  flex; align-items: center; gap: 8px; font-weight: 600; transition: all 0.2s; width: 100%; justify-content: center; }
.add-btn:hover { border-color: #3b82f6; color: #3b82f6; background: #eff6ff; border-style: solid; }
.query-selector-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.query-selector-btn { background: white; border: 2px solid #e2e8f0; border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 10px; text-align: left; position: relative; overflow: hidden; }
.query-selector-btn:hover { border-color: #3b82f6; background: #f8fafc; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1); }
.query-selector-btn.active { border-color: #3b82f6; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); box-shadow: 0 4px 16px rgba(59, 130, 246, 0.25); }
.query-selector-btn.hidden { opacity: 0.5; border-style: dashed; }
.query-id-badge { display: inline-block; font-size: 15px; font-weight: 800; color: #3b82f6; background: white; padding: 6px 12px; border-radius: 8px; width: fit-content; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1); }
.query-expr { font-size: 11px; color: #64748b; font-family: 'Monaco', 'Courier New', monospace; overflow:  hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.query-hidden-badge { font-size: 10px; color: #94a3b8; font-weight: 600; display: flex; align-items: center; gap: 4px; }
.query-selector-btn.active .query-id-badge { background: #3b82f6; color: white; }
.section-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
.section-title { font-size: 14px; color: #1e293b; margin:  0 0 16px 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }
.section-title i { color: #3b82f6; }
.viz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
.viz-item { background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; cursor: pointer; transition: all 0.2s; }
.viz-item:hover { border-color: #3b82f6; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1); }
.viz-item.selected { border-color: #3b82f6; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); }
.viz-icon-box { width: 40px; height: 40px; border-radius: 8px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.viz-item.selected .viz-icon-box { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
.viz-item i { font-size: 20px; color: #64748b; transition: all 0.2s; }
.viz-item.selected i { color: white; }
.viz-item span { font-size: 13px; font-weight: 600; color: #475569; }
.viz-item.selected span { color: #1e293b; }
.form-field { margin-bottom: 16px; }
.form-field label { display: block; font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 600; }
.form-input, .form-select { width: 100%; background: white; border: 1px solid #cbd5e1; color: #1e293b; padding: 10px 12px; border-radius: 6px; font-size: 13px; outline: none; transition: all 0.2s; }
.form-input:focus, .form-select:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.custom-color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
.form-color-input { width: 100%; height: 44px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.3s ease; }
.form-color-input:hover { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); }
.alert-options { padding: 16px; background: #fee2e2; border-left: 4px solid #dc2626; border-radius: 8px; margin-top: 12px; }
.alert-options .form-field { margin-bottom: 12px; }
.alert-options .form-field:last-child { margin-bottom: 0; }
.threshold-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.th-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; transition: all 0.2s; }
.th-row:hover { box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
.th-color { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; border: 2px solid white; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1); }
.th-row span { flex: 1; font-weight: 600; color: #475569; font-size: 13px; }
.th-input { width: 100px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; text-align: right; outline: none; transition: all 0.2s; background: #ffffff; color: #1e293b; cursor: text; }
.th-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.th-input:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
.th-label { min-width: 100px; font-weight: 600; color: #475569; }
.th-delete { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 6px; font-size: 14px; border-radius: 4px; transition: all 0.2s; }
.th-delete:hover { color: #ef4444; background: #fee2e2; }
.add-th-btn { background: white; border: 1px dashed #cbd5e1; width: 100%; padding: 10px; border-radius: 6px; color: #3b82f6; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; }
.add-th-btn:hover { background: #eff6ff; border-color: #3b82f6; border-style: solid; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.fa-spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.preview-grid::-webkit-scrollbar, .editor-content::-webkit-scrollbar { width: 8px; height: 8px; }
.preview-grid::-webkit-scrollbar-track, .editor-content::-webkit-scrollbar-track { background: #f1f5f9; }
.preview-grid::-webkit-scrollbar-thumb, .editor-content::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.preview-grid::-webkit-scrollbar-thumb:hover, .editor-content::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
@media (max-width: 1200px) { .qb-opts-grid { grid-template-columns: repeat(2, 1fr); } .query-opts-panel { grid-template-columns: repeat(2, 1fr); } .query-selector-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); } }
@media (max-width: 768px) { .edit-header { padding: 0 12px; } .breadcrumb { display: none; } .preview-zone { padding: 12px; } .editor-content { padding: 16px; } .form-row, .qb-opts-grid, .query-opts-panel { grid-template-columns: 1fr; } .ds-row { flex-direction: column; } .viz-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); } .query-selector-grid { grid-template-columns: 1fr; } }
.ml-auto { margin-left: auto; }
.text-gray-400 { color: #9ca3af; }
</style>