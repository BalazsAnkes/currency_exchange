<?php
$url = $_POST['url'];
$data = file_get_contents($url);
$xml = simplexml_load_string($data);
$json = json_encode($xml);
print_r($json);
?>