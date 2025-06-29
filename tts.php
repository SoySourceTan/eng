<?php
// CORSヘッダー
header('Access-Control-Allow-Origin: *'); // 本番ではhttps://your-username.github.io
header('Content-Type: audio/mpeg');

// エラーログ設定
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

try {
    // テキスト取得
    $text = urldecode($_GET['text'] ?? '');
    if (empty($text)) {
        throw new Exception('テキストが指定されていません');
    }

    // cURLでttsmp3.comにリクエスト
    $ch = curl_init('https://ttsmp3.com/makemp3_new.php');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'msg' => $text,
        'lang' => 'Nova',
        'source' => 'ttsmp3'
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    
    if ($response === false) {
        throw new Exception('ttsmp3.comリクエスト失敗: ' . curl_error($ch));
    }
    
    curl_close($ch);

    // JSONパース
    $json = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE || empty($json['URL'])) {
        throw new Exception('MP3生成失敗: 無効なレスポンス - ' . json_last_error_msg());
    }

    // MP3取得（cURL）
    $ch = curl_init($json['URL']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $mp3 = curl_exec($ch);
    
    if ($mp3 === false) {
        throw new Exception('MP3取得失敗: ' . curl_error($ch));
    }
    
    curl_close($ch);

    echo $mp3;
} catch (Exception $e) {
    error_log('TTSエラー: ' . $e->getMessage() . ' | Text: ' . ($text ?? 'なし') . ' | Time: ' . date('Y-m-d H:i:s'));
    http_response_code(500);
    header('Content-Type: text/plain');
    echo 'エラー: ' . $e->getMessage();
}
?>