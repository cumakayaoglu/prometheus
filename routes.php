<?php

return [
    "index" => "HomeController@index",
    
    // 🔥 BU SATIRIN BAŞINDAKİ // İŞARETİNİ KALDIRDIK 🔥
    "development" => "HomeController@development", 

    // Request routes
    "apiProxy" => "RequestController@apiProxy",
    "downloadFile" => "FileController@downloadFile",
    "uploadFile" => "FileController@uploadFile",
    "get" => "DatabaseController@get",
    "create" => "DatabaseController@create",
    "update" => "DatabaseController@update",
    "delete" => "DatabaseController@delete",

    // Prometheus verisi için
    "get_prometheus_data" => "HomeController@getPrometheusData"
];