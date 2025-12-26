# Elasticsearch Kurumsal Yönetim ve Operasyonel Analiz Platformu

**Platform:** Liman MYS v2.0+ Ekosistemi  
**Mimari:** Vue 3 (Composition API), TypeScript 5.0, Pinia State Management, ECharts, Naive UI  
**Temel Bileşenler:** Cluster Health, Node Management, Log Discovery, Data View Engine, KQL Engine

Elasticsearch Extension, kurumsal BT altyapılarında kullanılan Elasticsearch kümelerinin tek bir merkezden, gelişmiş görselleştirme araçları ve operasyonel komutlarla yönetilmesini sağlayan kapsamlı bir Liman MYS çözümüdür. Sistem, cluster sağlığından en ince log detayına kadar tüm veri akışını modernize edilmiş ve performans odaklı bir mimariyle sunar.

## İleri Seviye Teknik Kabiliyetler

1. Akıllı Veri Görünümü (Data View) ve İndeks Yönetimi
    - Dinamik Pattern Eşleştirme: İndeksleri gruplandırmak için kullanılan Index Pattern yapısı, Regex ve Asterisk (*) desteğiyle anlık olarak doğrulanır. Kullanıcı pattern yazdığı anda eşleşen indeksler gerçek zamanlı olarak raporlanır.
    - Timestamp Validasyonu: Verilerin zaman serisi olarak işlenebilmesi için indeks mapping yapıları taranarak `@timestamp` ve benzeri zaman alanlarının varlığı otomatik kontrol edilir.
    - CRUD ve Persistence: Oluşturulan Data View yapıları tarayıcı belleğinde ve store katmanında kalıcı (persistent) olarak saklanır, hızlı geçiş imkanı sunar.

2. Gelişmiş Log Keşfi ve KQL Sorgu Motoru
    - Kibana Tarzı Sorgulama: KQL (Kibana Query Language) uyumlu arama motoru, kompleks sorguları (AND, OR, Keyword) yerel lojiklerle işleyerek Elasticsearch API'sine iletir.
    - Reaktif Öneri Sistemi: Sorgu esnasında alan isimleri, operatörler (equals, exists) ve değerler için badge destekli, API tabanlı dinamik otomatik tamamlama sağlar.
    - Histogram Analizi: Log yoğunluğunu milisaniyelik hassasiyetle zaman serisi (ECharts) üzerinde görselleştirir. Grafik üzerinden sürükle-seç (brushing) yöntemiyle anlık tarih filtresi uygulanabilir.
    - Alan İstatistikleri (Field Stats): İndeks içerisindeki alanların doluluk oranlarını (coverage) ve benzersiz değer sayılarını analiz ederek veri kalitesi hakkında bilgi sunar.

3. Cluster ve Node Performans Analitiği
    - Canlı Donanım İzleme: Her bir düğümün (node) OS CPU, Disk I/O ve JVM Heap belleği reaktif olarak takip edilir.
    - Zaman Serisi Geçmişi: Düğüm bazlı performans verileri (CPU ve RAM) store katmanında tarihsel olarak tutulur ve analiz modunda çizgi grafiklerle darboğaz tespiti için sunulur.
    - Shard ve Topoloji Yönetimi: Primary ve Replica shard dağılımları görselleştirilerek küme stabilitesi anlık olarak denetlenir.

## Yazılım Mimarisi ve Sınıf Detayları

### Frontend Katmanı (Core Architecture)
- `Home.vue`: Uygulamanın orkestrasyon merkezi; sidebar navigasyonu, global istatistikler ve sekme yönetimini koordine eder.
- `IndexManagementModal.vue`: Küme genelindeki indekslerin sağlık dağılımını ve disk kullanım sıralamasını yöneten analitik modül.
- `NodeManagementModal.vue`: Sunucu tabanlı donanım metriklerini ve düğüm rollerini yöneten operasyonel merkez.
- `CreateDataViewModal.vue`: Veri kaynağı tanımlama ve validasyon süreçlerini yürüten teknik arayüz.

### Veri Yönetimi ve State (Pinia Store)
- `useElasticStore`: Projenin beyin katmanı. Elasticsearch REST API haberleşmesini yönetir, ham JSON yanıtlarını parse eder ve KQL öneri veritabanını canlı tutar.
- Data Processing: Gelen ham metrikler (Byte, Timestamp vb.) kullanıcı dostu formatlara (MB/GB, LocalTime) dönüştürülerek state katmanına aktarılır.

### Güvenlik ve Haberleşme
- Secure Proxying: Doğrudan erişime kapalı olan Elasticsearch endpoint'lerine Liman MYS'nin güvenli tünelleme altyapısı üzerinden yetkilendirilmiş erişim sağlanır.
- Data Export: Sorgulanan veya analiz edilen veriler profesyonel raporlama formatlarında (CSV, JSON) dışa aktarılabilir.

## Proje Dizini

```text
├── views/
│   ├── Home.vue                # Ana uygulama konteyneri ve orkestrasyon
│   ├── IndexManagementModal.vue # İndeks analizi ve operasyonları
│   ├── NodeManagementModal.vue  # Düğüm performansı ve donanım izleme
│   └── CreateDataViewModal.vue  # Pattern tanımlama ve validasyon
├── stores/
│   └── elastic.ts              # Elasticsearch API ve Merkezi State motoru
├── utils/
│   ├── convert-unit.ts         # Veri birimi dönüşüm lojiği
│   └── http-common.ts          # Liman MYS güvenli haberleşme katmanı
```

## Kurulum ve Konfigürasyon

1. Proje kaynak kodlarını zip formatında paketleyip uzantısını `.lmext` olarak güncelleyin.  
2. Liman MYS panelinde Eklentiler > Yükle menüsünden paketi sisteme dahil edin.  
3. Eklenti ayarları sayfasından Elasticsearch Host ve Port bilgilerini tanımlayın.  
4. Data View oluşturma adımlarını tamamlayarak kurumsal izleme sürecini başlatın.

## Geliştirici
Cuma Kayaoğlu
