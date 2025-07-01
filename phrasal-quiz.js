$(document).ready(function() {
    console.log('phrasal-quiz.js ロード開始');

    // --- 定数 & 変数 ---
    const LEVEL_STORAGE_KEY = 'phrasalQuizLevel';
    const CORRECT_ANSWERS_FOR_LEVEL_UP = 10; // 10問正解でレベルアップ
    const levelUpSound = new Audio('lvup.mp3');

    let allPhrases = [];
    let currentPhrases = [];
    let currentQuestionIndex = 0;
    let correctAnswersCount = 0;
    let currentLevel = parseInt(localStorage.getItem(LEVEL_STORAGE_KEY)) || 1;
    let difficulty = 'easy'; // デフォルト
    let levelUpOccurred = false;
    let hintUsed = false; // ヒント使用フラグ

    // Bootstrap 5のModalインスタンスを生成
    const feedbackModal = new bootstrap.Modal(document.getElementById('feedbackModal'));
    const startModal = new bootstrap.Modal(document.getElementById('startModal'));

    // ページ固有のクラスをbodyに追加
    $('body').addClass('phrase-quiz-page');

    // --- 関数 ---

    /**
     * HTML属性用に文字列をエスケープする
     * @param {string} str - エスケープする文字列
     * @returns {string} エスケープされた文字列
     */
    function escapeAttr(str) {
        return str.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    }

    /**
     * データをJSONファイルから読み込む
     * @param {function} callback - データ読み込み後に実行するコールバック関数
     */
    function loadData(callback) {
        fetch(`phrasal_verbs.json?v=${new Date().getTime()}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    callback(data);
                } else {
                    showError('句動詞データの読み込みに失敗しました。ファイルが空か、形式が正しくありません。');
                }
            })
            .catch(err => {
                console.error("データ読み込みエラー:", err);
                showError('句動詞データの読み込みに失敗しました。');
            });
    }

    /**
     * 新しいクイズセッションを開始する
     */
    function startNewChallenge() {
        currentQuestionIndex = 0;
        correctAnswersCount = 0;
        levelUpOccurred = false;
        // 全ての句動詞をシャッフルしてクイズリストを作成
        currentPhrases = [...allPhrases].sort(() => 0.5 - Math.random());
        updateProgress();
        generateQuestion();
    }

    /**
     * クイズの問題を生成して表示する
     */
    function generateQuestion() {
        hintUsed = false; // 新しい問題が始まるのでヒント使用状況をリセット

        if (currentQuestionIndex >= currentPhrases.length) {
            // 全ての問題を一周したら、再度シャッフルして続ける
            currentQuestionIndex = 0;
            currentPhrases.sort(() => 0.5 - Math.random());
        }

        const phrase = currentPhrases[currentQuestionIndex];
        const correctAnswerText = (difficulty === 'easy') ? phrase.phrase_en : phrase.phrase_ja;

        let hintText;
        let hintButtonText;
        if (difficulty === 'easy') {
            // EASYモード: 英語の選択肢から選ぶ -> ヒントは日本語訳
            hintText = phrase.phrase_ja;
            hintButtonText = 'ヒントを見る (日本語訳)';
        } else {
            // HARDモード: 日本語の選択肢から選ぶ -> ヒントは英文
            hintText = phrase.phrase_en;
            hintButtonText = 'ヒントを見る (英文)';
        }

        // --- 不正解の選択肢をより堅牢な方法で生成 ---
        // 1. 正解のフレーズを除外したリストを作成し、シャッフルする
        const wrongAnswerPool = allPhrases
            .filter(p => p.phrase_en !== phrase.phrase_en)
            .sort(() => 0.5 - Math.random());

        // 2. プールから最大3つの不正解の選択肢を取得
        const wrongAnswers = wrongAnswerPool.slice(0, 3).map(p => {
            return (difficulty === 'easy') ? p.phrase_en : p.phrase_ja;
        });

        // 3. 正解と不正解を結合して最終的な選択肢リストを作成し、シャッフルする
        const answers = [correctAnswerText, ...wrongAnswers].sort(() => 0.5 - Math.random());

        // --- HTMLを生成 ---
        const quizHtml = `
            <div class="question-card text-center">
                <p class="lead">この句動詞は何でしょう？</p>
                <div class="my-3">
                    <i class="fas fa-volume-up sound-icon" data-phrase="${escapeAttr(phrase.phrase_en)}" style="font-size: 3rem; cursor: pointer;"></i>
                </div>
                <div id="hint-area" class="mt-2" style="display: none;">
                    <p class="h5 text-info font-monospace">${hintText}</p>
                </div>
                <div class="mt-2 mb-3">
                    <button id="hintButton" class="btn btn-sm btn-outline-secondary">
                        <i class="fas fa-lightbulb me-1"></i> ${hintButtonText}
                    </button>
                </div>
            </div>
            <div class="answer-grid">
                ${answers.map(answer => `<div class="answer-card" data-answer="${escapeAttr(answer)}">${answer}</div>`).join('')}
            </div>
        `;
        $('#quizContainer').html(quizHtml);

        // 少し待ってから音声を再生
        setTimeout(() => speakWord(phrase.phrase_en, { lang: 'en-GB' }), 500);
    }

    /**
     * ユーザーの回答をチェックする
     * @param {jQuery} $card - 選択された回答カードのjQueryオブジェクト
     */
    function checkAnswer($card) {
        $('.answer-card').addClass('disabled');
        const selectedAnswer = $card.data('answer');
        const currentPhrase = currentPhrases[currentQuestionIndex];
        const correctAnswer = (difficulty === 'easy') ? currentPhrase.phrase_en : currentPhrase.phrase_ja;
        const itemKey = currentPhrase.phrase_en;
        const itemData = { category: currentPhrase.category || 'phrasal_verb' };

        if (selectedAnswer === correctAnswer) {
            $card.addClass('correct');
            playCorrectSound();
            correctAnswersCount++;
            updateProgress();
            updateLearningStats('phrasalVerbQuiz', itemKey, itemData, true);

            if (correctAnswersCount >= CORRECT_ANSWERS_FOR_LEVEL_UP) {
                levelUpOccurred = true;
                currentLevel++;
                correctAnswersCount = 0; // カウンターリセット
                localStorage.setItem(LEVEL_STORAGE_KEY, currentLevel);
                levelUpSound.play().catch(e => console.error("Audio play failed:", e));
                // レベルアップを通知するフィードバックモーダルを表示
                showFeedback(`レベルアップ！🎉 Level ${currentLevel}達成！`, `おめでとうございます！`);
            } else {
                setTimeout(handleNextQuestion, 1500);
            }
        } else {
            $card.addClass('incorrect');
            playIncorrectSound();
            const feedbackBody = `正解は <strong>"${correctAnswer}"</strong> でした。<br><hr><em>"${currentPhrase.phrase_en}"</em>: ${currentPhrase.phrase_ja}`;
            updateLearningStats('phrasalVerbQuiz', itemKey, itemData, false);
            showFeedback('残念！もう一度挑戦！', feedbackBody);
        }
    }

    function handleNextQuestion() {
        currentQuestionIndex++;
        generateQuestion();
    }

    function updateProgress() {
        const goal = CORRECT_ANSWERS_FOR_LEVEL_UP;
        const progress = goal > 0 ? (correctAnswersCount / goal) * 100 : 0;

        $('#progressBar').css('width', progress + '%').attr('aria-valuenow', progress);
        $('#scoreText').text(`正解: ${correctAnswersCount} / ${goal}`);
        $('#levelText').text(`Level: ${currentLevel}`);
    }

    function showFeedback(title, body) {
        $('#feedbackModalLabel').text(title);
        $('#feedbackModalBody').html(body);
        feedbackModal.show();
    }

    function showCompletionScreen() {
        const completionHtml = `
            <div class="text-center mt-5">
                <h3 class="mb-3">🎉 Level ${currentLevel} 達成！ 🎉</h3>
                <p class="lead">おめでとうございます！</p>
                <button id="nextChallengeButton" class="btn btn-success mt-3">
                    <i class="fas fa-arrow-right me-2"></i>次のレベルに挑戦！
                </button>
            </div>
        `;
        $('#quizContainer').html(completionHtml);
    }


    function showError(message) {
        $('#quizContainer').html(`<div class="alert alert-danger text-center">${message}</div>`);
    }

    // --- イベントリスナー ---

    // 難易度選択の説明を更新
    $('input[name="difficulty"]').on('change', function() {
        const desc = {
            easy: 'EASY: 英語の音声を聞いて、英語の選択肢から選びます。',
            hard: 'HARD: 英語の音声を聞いて、日本語の選択肢から選びます。'
        };
        $('#difficulty-description').text(desc[this.value]);
    });

    // クイズ開始ボタン
    $('#startGameButton').on('click', function() {
        difficulty = $('input[name="difficulty"]:checked').val();
        console.log(`クイズ開始: 難易度=${difficulty}`);
        loadData(function(data) {
            allPhrases = data;
            startNewChallenge();
        });
    });

    // リセットボタン
    $('#resetButton').on('click', function() {
        localStorage.removeItem(LEVEL_STORAGE_KEY);
        currentLevel = 1;
        startNewChallenge();
    });

    // 動的に追加されるボタンのイベント
    $(document).on('click', '#nextChallengeButton', function() {
        startNewChallenge();
    });

    // 回答カードのクリック
    $(document).on('click', '.answer-card', function() {
        if ($(this).hasClass('disabled')) return;
        checkAnswer($(this));
    });

    // ヒントボタンのクリック
    $(document).on('click', '#hintButton', function() {
        hintUsed = true;
        $('#hint-area').slideDown();
        $(this).prop('disabled', true).addClass('disabled');
        showToast('ヒントを表示しました', 'info');
    });

    // 音声アイコンのクリック
    $(document).on('click', '.sound-icon', function() {
        const phrase = $(this).data('phrase');
        if (phrase) {
            speakWord(phrase, { lang: 'en-GB' });
        }
    });

    // フィードバックモーダルが閉じた後の処理
    $('#feedbackModal').on('hidden.bs.modal', function() {
        if (levelUpOccurred) {
            showCompletionScreen();
            levelUpOccurred = false;
        } else {
            // 不正解でモーダルが閉じた場合は次の問題へ
            handleNextQuestion();
        }
    });

    // --- 初期表示 ---
    startModal.show();
});