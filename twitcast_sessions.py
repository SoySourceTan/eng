import websocket
import threading
import time
import requests
import json
import uuid

# TwitCastingのライブID
LIVE_ID = "5610670261"
BASE_URL = "wss://twitcasting.tv/ws"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# セッションごとのユニークIDを生成
def generate_session_id():
    return str(uuid.uuid4())

# WebSocket接続を確立する関数
def connect_websocket(session_id, session_number):
    ws_url = f"{BASE_URL}?live_id={LIVE_ID}&session_id={session_id}"
    headers = {
        "User-Agent": USER_AGENT,
        "Origin": "https://twitcasting.tv",
    }

    def on_message(ws, message):
        print(f"セッション {session_number}: メッセージ受信: {message}")
        # ここではストリーミング開始のメッセージを無視
        try:
            data = json.loads(message)
            if "stream_url" in data:
                print(f"セッション {session_number}: ストリームURL検出、接続を維持しストリーミングは無視")
                # ストリームURL（.m3u8など）へのリクエストは行わない
        except json.JSONDecodeError:
            pass

    def on_error(ws, error):
        print(f"セッション {session_number}: エラー: {error}")

    def on_close(ws, close_status_code, close_msg):
        print(f"セッション {session_number}: 接続終了: {close_status_code}, {close_msg}")

    def on_open(ws):
        print(f"セッション {session_number}: WebSocket接続確立")
        # 必要に応じて初期メッセージを送信
        ws.send(json.dumps({"type": "join", "live_id": LIVE_ID}))

    ws = websocket.WebSocketApp(
        ws_url,
        header=headers,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open
    )

    # WebSocketを別スレッドで実行
    wst = threading.Thread(target=ws.run_forever)
    wst.daemon = True
    wst.start()

    return ws

# 複数セッションを確立
def start_multiple_sessions(num_sessions):
    sessions = []
    for i in range(num_sessions):
        session_id = generate_session_id()
        print(f"セッション {i+1} 開始、セッションID: {session_id}")
        ws = connect_websocket(session_id, i+1)
        sessions.append(ws)
        time.sleep(1)  # セッション間隔を設ける（レート制限回避）

    # セッションを一定時間維持
    try:
        print(f"{num_sessions} セッションを維持中...")
        time.sleep(60)  # 60秒間接続を維持
    except KeyboardInterrupt:
        print("終了中...")
    finally:
        for ws in sessions:
            ws.close()

if __name__ == "__main__":
    NUM_SESSIONS = 3  # 確立したいセッション数
    start_multiple_sessions(NUM_SESSIONS)