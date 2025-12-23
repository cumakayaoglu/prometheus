<?php

namespace App\Controllers;

class HomeController
{
    public function index()
    {
        return view('index');
    }

    public function development()
    {
        return view('index_development');
    }

    public function getPrometheusData()
    {
        // 1. Liman Ayarlarından Prometheus IP Adresini Al
        $baseUrl = extensionDb('prometheus_url');
        
        // Eğer boşsa varsayılan
        if (! $baseUrl) {
            $baseUrl = "http://127.0.0.1:9090";
        }
        $baseUrl = rtrim($baseUrl, '/');

        // 2. Vue'dan gelen isteği yakala
        $type = request('endpoint_type');
        $query = request('query');
        
        // 3. URL'i oluştur
        $url = "";
        
        if ($type == 'query_range') {
            $start = request('start');
            $end = request('end');
            $step = request('step');
            $q = urlencode($query);
            $url = "$baseUrl/api/v1/query_range?query=$q&start=$start&end=$end&step=$step";
        } else {
            $safeQuery = $query ?  urlencode($query) : 'up';
            $url = "$baseUrl/api/v1/query?query=$safeQuery";
        }

        // 4. Guzzle ile istek yap (cURL yerine helpers. php'deki getResponse kullan)
        try {
            $response = getResponse(function ($client) use ($url) {
                return $client->get($url);
            });

            // ✅ DOĞRU: response() fonksiyonu kullan (Liman'ın fonksiyonu)
            return response($response, 200, [
                'Content-Type' => 'application/json'
            ]);

        } catch (\Exception $e) {
            return response([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500, [
                'Content-Type' => 'application/json'
            ]);
        }
    }
}