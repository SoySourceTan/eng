const CACHE_NAME = 'vocab-fun-cache-v2'; // キャッシュのバージョンを更新

// Service Workerがインストールされたときに呼ばれる
self.addEventListener('install', event => {
    // 新しいService Workerをすぐに有効化する
    event.waitUntil(self.skipWaiting());
});

// Service Workerが有効化されたときに呼ばれる
self.addEventListener('activate', event => {
    // 古いバージョンのキャッシュを削除する
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    // 現在のキャッシュ名と異なるものをすべて削除
                    return cacheName !== CACHE_NAME;
                }).map(cacheName => {
                    console.log('古いキャッシュを削除:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        })
    );
    // すぐにページをコントロール下に置く
    self.clients.claim();
});

// ファイルへのリクエストがあったときに呼ばれる（開発向け：ネットワーク優先戦略）
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        return;
    }
    event.respondWith(
        // まずネットワークから最新のファイルを取得しにいく
        fetch(event.request).then(networkResponse => {
            // 取得に成功したら、レスポンスをキャッシュに保存してからブラウザに返す
            // 正常なレスポンス(status: 200)のみをキャッシュする
            if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
        }).catch(() => {
            // ネットワークに接続できない場合は、キャッシュからファイルを探して返す
            return caches.match(event.request);
        })
    );
});

// clear-cache.htmlからのメッセージを受け取ってキャッシュを削除します。
self.addEventListener('message', event => {
    if (event.data.action === 'clear-cache') {
        console.log('キャッシュ削除メッセージ受信');
        // すべてのキャッシュを削除
        caches.keys().then(cacheNames => {
            return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        }).then(() => {
            console.log('すべてのキャッシュを削除しました');
            // 呼び出し元のページに完了を通知
            event.source.postMessage({ status: 'cache-cleared' });
        });
    }
});