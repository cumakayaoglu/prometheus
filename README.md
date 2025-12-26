# Prometheus İzleme ve Dinamik Dashboard Motoru

**Liman MYS Uyumluluk:** v2.0+  
**Teknoloji Yığını:** Vue.js 3 (Composition API), TypeScript, ApexCharts, Pinia Store

Prometheus Extension, Liman MYS platformu için geliştirilmiş, kurumsal seviyede bir metrik izleme, analiz ve dashboard yönetim platformudur. Proje, sistem metriklerini gerçek zamanlı izlemenin ötesinde, kompleks PromQL sorgularını işleyebilen ve özelleştirilebilir bir veri yönetim framework'ü sunar.

## Temel Kabiliyetler

### Merkezi Yönetim ve Akıllı Sorgu Motoru (Home View)
- Gelişmiş PromQL Editörü: Metrik isimleri, fonksiyonlar ve agregasyonlar için tip bazlı (Metric, Function, Aggregation) otomatik tamamlama desteği.
- Sorgu Geçmişi ve Bellek: Sık kullanılan sorguları saklayan yerel geçmiş yönetimi ve sayfa yenilense dahi kaybolmayan state yapısı.
- Dinamik Veri Kartları (Stats Grid): Toplam seri sayısı, anlık global uç değerler (Max/Min) ve milisaniyelik hassasiyette güncelleme takibi.
- Profesyonel Veri Export: İzlenen tüm zaman serisi verilerinin etiket detaylarıyla birlikte raporlamaya hazır CSV formatında dışa aktarımı.

### Dinamik Dashboard ve Panel Ekosistemi
- Grid Layout Engine: Panellerin sürükle-bırak yöntemiyle boyutlandırılmasına ve yerleşimlerin dashboard bazlı kaydedilmesine olanak tanıyan motor.
- Hibrit Görselleştirme: Tek tıkla Çizgi (Line), Alan (Area) ve Çubuk (Bar) grafik türleri arasında veri kaybı olmadan dinamik geçiş.
- Akıllı Threshold (Eşik) Sistemi: Kritik ve uyarı seviyeleri için görsel renk kodlaması ve anlık sistem sağlığı takibi.
- Full-Screen ve Fokus Modu: Belirli bir metriğe odaklanmak için tam ekran izleme ve diğer serileri gizleyerek izolasyon sağlama özelliği.

### Gelişmiş Analitik ve Denetim (Inspect Mode)
- Derinlemesine İnceleme: Panellerin ham JSON verisi, PromQL sorgu performansı ve istatistiksel özet (Min/Max/Avg) analizi.
- Heatmap ve Analiz Modu: Veri yoğunluğunu ve sapmalarını analiz eden gelişmiş grafik alt yapısı.
- Etiket Bazlı Dinamik Filtreleme: Çok sayıda veri serisi arasından kompleks etiket (label) eşleşmeleriyle anlık veri süzme.

## Teknik Mimari ve Sınıf Yapısı

Proje, kurumsal yazılım standartlarına uygun olarak Store Pattern ve MVVM prensipleriyle yapılandırılmıştır.

### Frontend Katmanı (Vue 3 ve TypeScript)
- `Home.vue`: Uygulamanın yönetim merkezi; sorgu motoru, filtreleme lojiği ve global state koordinasyonunu sağlar.
- `Dashboardpanel.vue`: Grafik render süreçleri, veri işleme algoritması ve panel bazlı aksiyon menülerinin (Edit/Inspect/Delete) çekirdek bileşenidir.
- `DashboardsModal.vue`: Çoklu dashboard profillerinin yönetimi, favorilere ekleme ve şablon içe/dışa aktarma süreçlerini yürütür.
- `EditPanelModal.vue`: Panel bazlı sorgu konfigürasyonu ve görselleştirme parametrelerinin yönetildiği uzman editör arayüzüdür.

### Veri Yönetimi (Pinia Stores)
- `usePrometheusStore`: Prometheus API iletişimini yöneten, metrikleri parse eden ve dinamik autocomplete veritabanını yöneten ana veri katmanıdır.
- `useDashboardStore`: Dashboard hiyerarşisini, panel yerleşimlerini ve kalıcı kullanıcı tercihlerini yönetir.

### Sistem Entegrasyonu ve Güvenlik
- Secure Proxy: Liman MYS üzerinden sağlanan `prometheus_proxy` ile doğrudan erişime kapalı olan Prometheus API'sine güvenli ve yetkilendirilmiş erişim sağlanır.
- Backend Otomasyonu: Sunucu tarafında Prometheus yaşam döngüsü ve metrik toplama süreçleri için optimize edilmiş Python betikleri.

## Proje Dizini

```text
├── views/
│   ├── Home.vue              # Uygulama ana giriş noktası ve yönetim merkezi
│   ├── Dashboardpanel.vue    # Veri görselleştirme ve panel motoru
│   ├── DashboardsModal.vue   # Dashboard yönetim arayüzü
│   ├── EditPanelModal.vue    # Panel konfigürasyon editörü
├── stores/
│   ├── prometheus.ts         # Metrik veri ve API haberleşme store'u
│   ├── dashboardStore.ts     # Yerleşim ve Dashboard state yönetimi
```

## Kurulum ve Yapılandırma

1. Paketleme: Proje kaynak kodlarını zip formatında paketleyip uzantısını `.lmext` olarak belirleyin.  
2. Yükleme: Liman MYS panelinden Eklentiler bölümüne giriş yaparak paketi sisteme dahil edin.  
3. Konfigürasyon: Eklenti ayarları panelinden Prometheus sunucusunun URL bilgilerini tanımlayın.  
4. Kullanım: Ana ekrandan PromQL sorgularınızı koşturmaya başlayın veya hazır JSON şablonlarını içe aktararak kendi izleme merkezinizi oluşturun.

## Geliştirici
Cuma Kayaoğlu
