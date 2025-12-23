<?php

namespace App\Controllers;

use GuzzleHttp\Psr7;

class FileController
{
    public function downloadFile()
    {
        $type = request('type');
        $endpoint = request('endpoint');
        $data = (array) json_decode(request('data'));

        $random = str_random(16);
        $fileName = "/tmp/" . $random . "." . $data['format'];
        $file = fopen($fileName, "w+");

        getResponse(function ($client) use ($type, $endpoint, $data, $file) {
            return $client->request(strtoupper($type), getUrl($endpoint), count($data) ? [
                'sink' => $file,
                'json' => $data
            ] : []);
        });

        if (!file_exists($fileName)) {
            abort("File not found", 404);
        } else {
            header("Content-Type: " . mime_content_type($fileName));
            header("Content-Disposition: attachment; filename=" . $random . "." . $data['format']);

            readfile($fileName);
        }
    }

    public function uploadFile()
    {
        $data = (array) json_decode(request('data'));
        $file = getPath("uploads/" . trim($data['file']), '/');

        try {
            $multipart = [
                [
                    'name'     => $data['key'],
                    'contents' => Psr7\Utils::tryFopen($file, "r"),
                    'filename' => basename($data['file'])
                ]
            ];

            if (isset($data['params'])) {
                foreach ($data['params'] as $param) {
                    $multipart[] = [
                        'name'     => $param->name,
                        'contents' => $param->contents
                    ];
                }
            }

            $request = getResponse(function ($client) use ($data, $file, $multipart) {
                return $client->request(
                    "POST",
                    getUrl($data['endpoint']),
                    [
                        'multipart' => $multipart
                    ]
                );
            });
        } finally {
            shell_exec("rm -rf " . $file);
        }

        return respond($request);
    }
}
