<?php

use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Client;

if (!function_exists('getUrl')) {
    function getUrl($endpoint = "")
    {
        $baseUrl = extensionDb('api_url'); 
        $endpoint = ltrim($endpoint, '/');
        return $baseUrl . "/" . $endpoint;
    }
}

if (!function_exists('getDefaults')) {
    function getDefaults()
    {
        return [
            'headers' => [
                'Content-Type' => 'application/json',
            ],
            'verify' => false,
            'timeout' => 30
        ];
    }
}

if (!function_exists('getResponse')) {
    function getResponse($function, $opts = [])
    {
        $client = new Client(array_merge_recursive($opts, getDefaults()));
        try {
            $response = $function($client);
            
            $body = (string)$response->getBody();
            $decoded = json_decode($body, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                return (object)[
                    'status' => 'error',
                    'message' => 'JSON Parse Error: ' . json_last_error_msg()
                ];
            }
            
            return $decoded;
            
        } catch (RequestException $exception) {
            $code = 500;
            $message = $exception->getMessage();
            
            if ($exception->hasResponse()) {
                $code = $exception->getResponse()->getStatusCode();
                try {
                    $body = $exception->getResponse()->getBody()->getContents();
                    $decoded = json_decode($body, true);
                    $message = $decoded['error'] ?? $body;
                } catch (\Throwable $e) {
                    $message = $exception->getMessage();
                }
            }

            abort("Prometheus API Error: " . $message, $code);
            
        } catch (GuzzleException $exception) {
            $message = $exception->getMessage();
            abort("Connection Error: " . $message, 500);
        }
    }
}

if (!function_exists('prometheus_proxy')) {
    function prometheus_proxy()
    {
        validate([
            "path" => "required",
            "params" => "json",
            "method" => "in:GET,POST,get,post"
        ]);

        $path = request('path');
        $paramsJson = request('params') ?? '{}';
        $method = strtoupper(request('method', 'GET'));

        $params = json_decode($paramsJson, true) ?? [];

        $client = new Client(getDefaults());

        try {
            $requestOptions = [];
            
            if ($method === 'GET') {
                $requestOptions['query'] = $params;
            } else {
                $requestOptions['json'] = $params;
            }

            $response = $client->request($method, getUrl($path), $requestOptions);
            $body = (string)$response->getBody();
            $decoded = json_decode($body, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                return respond([
                    'status' => 'error',
                    'message' => 'JSON Parse Error'
                ], 400);
            }

            return respond($decoded);

        } catch (RequestException $e) {
            $message = $e->getMessage();
            $code = 500;

            if ($e->hasResponse()) {
                $code = $e->getResponse()->getStatusCode();
                try {
                    $body = $e->getResponse()->getBody()->getContents();
                    $decoded = json_decode($body, true);
                    $message = $decoded['error'] ?? $body;
                } catch (\Throwable $ex) {
                    $message = $e->getMessage();
                }
            }

            return respond([
                'status' => 'error',
                'message' => $message
            ], $code);
            
        } catch (GuzzleException $e) {
            return respond([
                'status' => 'error',
                'message' => 'Connection Error: ' . $e->getMessage()
            ], 500);
        }
    }
}

if (!function_exists('getVersion')) {
    function getVersion()
    {
        try {
            $json = json_decode(file_get_contents(getPath("db.json")), true);
            return $json["version"] ?? "unknown";
        } catch (\Exception $e) {
            return "unknown";
        }
    }
}