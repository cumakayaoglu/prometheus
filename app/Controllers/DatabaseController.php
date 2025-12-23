<?php

namespace App\Controllers;

class DatabaseController {

    public function get() {
        $payload = json_decode(request("payload"), true);
        $table = $payload["table"];
        $order = array_key_exists("order",$payload) ? $payload["order"] : '';
        $order = $order === 'asc'
            ? 'order by priority ASC'
            : ($order === 'desc'
                ? 'order by priority DESC'
                : 'order by updated_at DESC');
        $query = "SELECT * FROM $table " . $order ;
        return execQuery($query);
    }

    public function create() {
        $UUID = uniqid();
        $payload = json_decode(request("payload"), true);
        $table = $payload["table"];
        $keys = array_keys($payload["data"]);
        $values = array_values($payload["data"]);
        $created_at = date('Y-m-d H:i:s'); // Convert to timestamp format
        $query = "INSERT INTO $table (id, created_at, updated_at, " . implode(", ", $keys) . ") VALUES ('$UUID', '$created_at', '$created_at', '" . implode("', '", $values) . "')";
        return execQuery($query);
    }

    public function update() {
        $payload = json_decode(request("payload"), true);
        $table = $payload["table"];
        $data = $payload["data"];
        $id = $payload["id"];
        $query = "UPDATE $table SET ";
        $updated_at = date('Y-m-d H:i:s'); // Convert to timestamp format
        $data["updated_at"] = $updated_at;
        foreach ($data as $key => $value) {
            $query .= $key . " = '" . $value . "', ";
        }
        $query = substr($query, 0, -2);
        $query .= " WHERE id = '" . $id . "'";
        return execQuery($query);
    }

    public function delete() {
        $payload = json_decode(request("payload"), true);
        $table = $payload["table"];
        $id = $payload["id"];
        $query = "DELETE FROM $table WHERE id = '".$id."'";
        return execQuery($query);
    }
}

