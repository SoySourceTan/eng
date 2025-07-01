// Service Workerの登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // sw.jsはサイトのルートにあると仮定して登録します。
        // GitHub Pagesで /eng/ のようなサブディレクトリにある場合でも、
        // この相対パス指定で正しく動作します。
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

if (!window.words) {
    window.words = [];
}
window.audioContext = null;
window.speechSynthesisVoices = []; // グローバルな音声リスト
window.speechEnabled = true;

window.defaultIcons = {
    action: 'icon-park-solid:running',
    animal: 'fluent-emoji:paw-prints',
    asking: 'twemoji:speech-balloon',
    banking: 'twemoji:money-bag',
    body: 'twemoji:person-gesturing-ok',
    color: 'fluent-emoji:artist-palette',
    culture: 'twemoji:national-park',
    daily_life: 'twemoji:sunrise-over-mountains',
    eating_out: 'twemoji:fork-and-knife-with-plate',
    emotion: 'twemoji:smiling-face-with-heart-eyes',
    entertainment: 'twemoji:clapper-board',
    feelings: 'twemoji:hugging-face',
    fish: 'twemoji:fish',
    fruit: 'twemoji:cherries',
    greetings: 'twemoji:waving-hand',
    household: 'twemoji:house',
    in_class: 'twemoji:books',
    introductions: 'twemoji:speaking-head',
    making_friends: 'twemoji:people-holding-hands',
    meat: 'twemoji:cut-of-meat',
    news_broadcast: 'twemoji:newspaper',
    number: 'twemoji:input-numbers',
    object: 'twemoji:package',
    other: 'twemoji:gear',
    parents: 'twemoji:family-man-woman-girl-boy',
    place: 'twemoji:world-map',
    proverbs: 'twemoji:scroll',
    roads: 'twemoji:motorway',
    school: 'twemoji:school',
    shape: 'twemoji:red-square',
    shopping: 'twemoji:shopping-cart',
    society: 'twemoji:cityscape',
    soy: 'twemoji:beans',
    time: 'twemoji:watch',
    time_telling: 'twemoji:alarm-clock',
    transport: 'twemoji:bus',
    utilities: 'twemoji:wrench',
    vegetable: 'twemoji:carrot',
    weather: 'twemoji:sun-behind-cloud',
    weather_forecast: 'twemoji:sun-behind-rain-cloud'
};
window.fallbackWords = [
    {"word": "unknown", "meaning": "不明", "category": "unknown", "icon": "fas fa-question", "background": "bg-light"}
];

// 効果音を事前に読み込む
const soundEffects = {
    correct: new Audio('./correct.mp3'),
    incorrect: new Audio('./wrong.mp3')
};
Object.values(soundEffects).forEach(sound => {
    sound.load(); // ファイルのプリロードを開始
    sound.volume = 1.0;
});

function initAudioContext() {
    if (!window.AudioContext && !window.webkitAudioContext) {
        console.error('このブラウザでは音声再生がサポートされていません。');
        return false;
    }
    window.audioContext = window.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    return true;
}

function showToast(message, type = 'info') {
    console.log(`Toast: ${message} (${type})`);
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    toastContainer.innerHTML = `
        <div class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'warning'} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    document.body.appendChild(toastContainer);
    const toast = new bootstrap.Toast(toastContainer.querySelector('.toast'), { delay: 1500 });
    toast.show();
    toastContainer.querySelector('.toast').addEventListener('hidden.bs.toast', () => {
        toastContainer.remove();
    });
}

function playCorrectSound() {
    if (!window.audioContext) initAudioContext();
    console.log('正解音を再生');
    soundEffects.correct.currentTime = 0; // 再生位置を最初に戻す
    soundEffects.correct.play().catch(err => {
        console.error('正解音再生エラー:', err);
        // showToast('正解音の再生に失敗しました。', 'error');
    });
}

function playIncorrectSound() {
    if (!window.audioContext) initAudioContext();
    console.log('不正解音を再生');
    soundEffects.incorrect.currentTime = 0; // 再生位置を最初に戻す
    soundEffects.incorrect.play().catch(err => {
        console.error('不正解音再生エラー:', err);
        // showToast('不正解音の再生に失敗しました。', 'error');
    });
}

const SELECTED_VOICE_URI_KEY = 'selectedVoiceURI';

function speakWord(word, options = {}) {
    const {
        audioFile = null, // MP3ファイルパスをオプションで受け取る
        caller = 'unknown',
        lang = 'en-GB',
        onStart,
        onEnd,
        onError
    } = options;

    // 1. audioFileが指定されている場合、それを最優先で再生
    if (audioFile) {
        console.log(`MP3再生: ${audioFile}`);
        const audio = new Audio(audioFile);
        if (onStart) onStart();
        audio.play()
            .then(() => { if (onEnd) onEnd(); })
            .catch(err => {
                console.error(`MP3再生エラー: ${audioFile}`, err);
                if (onError) onError();
            });
        return;
    }

    if (!window.speechEnabled) {
        console.warn('Speech is disabled by user.');
        if (onError) onError();
        return;
    }
    if (!window.speechSynthesis) {
        console.warn('Speech synthesis is disabled or not supported.');
        if (onError) onError();
        return;
    }

    // iOSでのスタッタリング（冒頭の音がダブる）バグを軽減するための対策。
    // 既に発話中の場合はキャンセルし、少し待ってから新しい発話を開始する。
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }

    // 50msの遅延を設けることで、cancel()の処理が完了するのを待ち、バグを回避する。
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = lang;

        // --- 音声選択ロジックを強化 ---
        let voices = window.speechSynthesisVoices;
        if (!voices || voices.length === 0) {
            console.warn('グローバル音声リストが空です。同期的に再取得を試みます。');
            voices = speechSynthesis.getVoices();
        }

        const savedVoiceURI = localStorage.getItem(SELECTED_VOICE_URI_KEY);

        // 1. ユーザーが保存した声を最優先で探す
        if (savedVoiceURI && voices.length > 0) {
            const savedVoice = voices.find(v => v.voiceURI === savedVoiceURI);
            if (savedVoice) {
                utterance.voice = savedVoice;
            }
        }

        // デバッグ用に、利用可能な音声のリストをコンソールに出力
        if (voices.length > 0 && caller !== 'warmup') {
            console.log(`利用可能な音声 (${voices.length}件):`, voices.map(v => `${v.name} (${v.lang})`));
        }

        // 2. 保存した声がない場合、または見つからなかった場合、既存の優先順位ロジックで探す
        if (!utterance.voice && voices.length > 0) {
            // 2. 音声選択の優先順位を定義
            const voicePriority = [
                // iOS/macOSの高品質な女性の声
                v => v.lang === lang && v.name === 'Serena',
                v => v.lang === lang && v.name === 'Samantha',
                // 一般的な女性の声
                v => v.lang === lang && /female/i.test(v.name),
                // Google製の高品質な声 (Android/Windows向け)
                v => v.lang === lang && /google/i.test(v.name),
                // OSのデフォルト (指定言語)
                v => v.lang === lang,
                // 最終手段 (英語なら何でも)
                v => v.lang.startsWith('en')
            ];

            // 3. 優先順位に従って最適な音声を探す
            for (const condition of voicePriority) {
                const foundVoice = voices.find(condition);
                if (foundVoice) {
                    utterance.voice = foundVoice;
                    break; // 最適な音声が見つかったらループを抜ける
                }
            }
        } else {
            console.warn('音声リストが取得できませんでした。ブラウザのデフォルト音声を使用します。');
        }

        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onstart = () => {
            const voiceName = utterance.voice ? `${utterance.voice.name} (${utterance.voice.lang})` : 'default';
            console.log(`音声開始: "${word}", 声: ${voiceName}, 呼び出し元: ${caller}`);
            if (onStart) onStart();
        };
        utterance.onend = () => {
            console.log(`音声終了: "${word}"`);
            if (onEnd) onEnd();
        };
        utterance.onerror = (event) => {
            if (event.error !== 'interrupted') {
                console.error(`音声エラー: "${word}", エラー: ${event.error}`);
                // showToast('音声の再生に失敗しました。', 'error');
            }
            // 中断を含むすべてのエラーでUIクリーンアップ用のコールバックを呼ぶ
            if (onError) onError();
        };
        speechSynthesis.speak(utterance);
    }, 50);
}

function loadData(callback) {
    console.log('データ読み込み開始');
    fetch(`kidswords.json?v=${new Date().getTime()}`)
        .then(response => {
            console.log('読み込み結果:', response);
            if (!response.ok) {
                throw new Error(`データ読み込み失敗: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('データ取得:', data);
            if (!validateWords(data)) {
                throw new Error('データ形式が正しくありません');
            }
            callback(data);
        })
        .catch(error => {
            console.error('データ読み込みエラー:', error);
            callback(fallbackWords);
        });
}

function validateWords(data) {
    return Array.isArray(data) && data.every(word => 
        word && typeof word.word === 'string' && typeof word.meaning === 'string'
    );
}

const LEARNING_STATS_KEY = 'learningStats'; // 統一された統計キー

/**
 * 汎用的な学習統計更新関数
 * @param {string} quizType - 'wordQuiz', 'phraseQuiz', 'phrasalVerbQuiz' など
 * @param {string} itemKey - 統計のキーとなる単語やフレーズ (e.g., 'apple', 'look up')
 * @param {object} itemData - { category: '...' } などの追加データ
 * @param {boolean} isCorrect - 正解したかどうか
 */
function updateLearningStats(quizType, itemKey, itemData, isCorrect) {
    // 1. localStorageから全体の統計データを読み込む
    const allStats = JSON.parse(localStorage.getItem(LEARNING_STATS_KEY)) || {};

    // 2. 対象のクイズタイプの統計オブジェクトを初期化
    if (!allStats[quizType]) {
        allStats[quizType] = {
            totalQuestions: 0,
            totalCorrect: 0,
            itemStats: {},
        };
    }
    const quizStats = allStats[quizType];

    // 3. クイズ全体の統計を更新
    quizStats.totalQuestions++;
    if (isCorrect) {
        quizStats.totalCorrect++;
    }

    // 4. アイテム別の統計を更新
    if (!quizStats.itemStats[itemKey]) {
        quizStats.itemStats[itemKey] = {
            correct: 0,
            incorrect: 0,
            category: itemData.category || 'unknown',
        };
    }
    isCorrect ? quizStats.itemStats[itemKey].correct++ : quizStats.itemStats[itemKey].incorrect++;

    // 5. 更新した統計データをlocalStorageに保存
    localStorage.setItem(LEARNING_STATS_KEY, JSON.stringify(allStats));
}

// サイト全体で共通のUIイベントをバインドします
$(document).ready(function() {
    // --- Settings Modal Logic ---
    function populateVoiceSelector() {
        const selector = $('#voiceSelector');
        if (selector.length === 0) return; // No settings modal on this page

        const voices = window.speechSynthesisVoices || [];

        if (voices.length > 0) {
            selector.empty(); // Clear loading message
            const savedVoiceURI = localStorage.getItem(SELECTED_VOICE_URI_KEY);

            voices
                .filter(voice => voice.lang.startsWith('en')) // Only show English voices
                .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically
                .forEach(voice => {
                    const option = $('<option></option>')
                        .val(voice.voiceURI)
                        .text(`${voice.name} (${voice.lang})`);
                    if (voice.voiceURI === savedVoiceURI) {
                        option.prop('selected', true);
                    }
                    selector.append(option);
                });
        } else {
            selector.html('<option>利用可能な音声がありません。</option>');
        }
    }

    $('#settingsModal').on('show.bs.modal', populateVoiceSelector);

    $('#saveSettingsButton').on('click', function() {
        const selectedVoiceURI = $('#voiceSelector').val();
        localStorage.setItem(SELECTED_VOICE_URI_KEY, selectedVoiceURI);
        showToast('設定を保存しました！', 'success');
        $('#settingsModal').modal('hide');
    });

    // 音声切り替えボタンのイベントハンドラ
    $('#toggleSpeechButton').on('click', function() {
        window.speechEnabled = !window.speechEnabled;
        $(this).find('.button-text').text(window.speechEnabled ? '音声オフ' : '音声オン');
        showToast(window.speechEnabled ? '音声をオンにしました' : '音声をオフにしました', 'info');
        if (!window.speechEnabled && window.speechSynthesis) {
            // 音声オフ時に再生中の音声を停止
            speechSynthesis.cancel();
        }
    });

    // 音声合成エンジンを早期に準備させるための「ウォームアップ」
    if (window.speechSynthesis) {
        const loadVoices = () => {
            window.speechSynthesisVoices = speechSynthesis.getVoices();
            console.log(`音声リストを読み込みました: ${window.speechSynthesisVoices.length}件`);
        };

        // ブラウザによっては、getVoices()が非同期でリストを返すため、
        // onvoiceschanged イベントを使って確実にリストを取得する。
        loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    // 現在のページに基づいてナビゲーションリンクをアクティブにする
    try {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        $('.navbar-nav .nav-link').removeClass('active').removeAttr('aria-current');
        $('.navbar-nav .nav-link').each(function() {
            const linkPage = $(this).attr('href').split('/').pop();
            if (linkPage === currentPage) {
                $(this).addClass('active');
                $(this).attr('aria-current', 'page');
            }
        });
    } catch (e) {
        console.error("ナビゲーションのアクティブ化に失敗:", e);
    }
});