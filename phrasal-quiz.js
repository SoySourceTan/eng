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
    let incorrectPhrases = [];
    let isReviewMode = false;
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
        fetch(`phrasal_verbs_with_audio.json?v=${new Date().getTime()}`)
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
        isReviewMode = false; // 通常モードに設定
        currentQuestionIndex = 0;
        correctAnswersCount = 0;
        levelUpOccurred = false;
        incorrectPhrases = []; // 新しい挑戦の開始時にリセット
        // 全ての句動詞をシャッフルしてクイズリストを作成
        currentPhrases = [...allPhrases].sort(() => 0.5 - Math.random());
        updateProgress();
        generateQuestion();
    }

    /**
     * 間違えた問題の復習セッションを開始する
     */
    function startReview() {
        if (incorrectPhrases.length === 0) return;
        isReviewMode = true;

        currentPhrases = [...incorrectPhrases].sort(() => Math.random() - 0.5);
        incorrectPhrases = []; // 次の通常セッションのためにクリア
        currentQuestionIndex = 0;
        correctAnswersCount = 0; // スコアをリセット
        levelUpOccurred = false;
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
        setTimeout(() => speakWord(phrase.phrase_en, {
            audioFile: phrase.audio_file,
            lang: 'en-GB'
        }), 500);
    }

    /**
     * ユーザーの回答をチェックする
     * @param {jQuery} $card - 選択された回答カードのjQueryオブジェクト
     */
    function checkAnswer($card) {
        $('.answer-card').addClass('disabled');
        const selectedAnswer = $card.data('answer');
        const currentPhrase = currentPhrases[currentQuestionIndex];
        const correctAnswerEn = currentPhrase.phrase_en;
        const correctAnswerJa = currentPhrase.phrase_ja;
        const situation = currentPhrase.situation;
        const itemKey = currentPhrase.phrase_en;
        const itemData = { category: currentPhrase.category || 'phrasal_verb' };

        const correctAnswer = (difficulty === 'easy') ? correctAnswerEn : correctAnswerJa;
        const isCorrect = selectedAnswer === correctAnswer;

        if (isCorrect) {
            if (isReviewMode) {
                // --- 復習モードの正解処理 ---
                $card.addClass('correct');
                playCorrectSound();
                updateLearningStats('phrasalVerbQuiz', itemKey, itemData, true);
                updateProgress(true); // 進捗を更新

                if (currentQuestionIndex + 1 >= currentPhrases.length) {
                    // 全問正解で復習完了
                    levelUpOccurred = true; // 完了画面表示用のフラグ
                    showFeedback('復習完了！', '間違えた問題をすべてクリアしました！');
                } else {
                    // 復習中の正解フィードバック
                    const feedbackBody = `
                        <div class="text-center">
                            <h4 class="text-success">正解！</h4>
                            <p class="fs-5 fw-bold my-3">"${correctAnswerEn}"</p>
                            <p class="text-muted">(${correctAnswerJa})</p>
                        </div>
                    `;
                    showFeedback('正解です！', feedbackBody);
                }
            } else {
                // --- 通常モードの正解処理 ---
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
                    showFeedback(`レベルアップ！🎉 Level ${currentLevel}達成！`, `おめでとうございます！`);
                } else {
                    const feedbackBody = `
                        <div class="text-center">
                            <h4 class="text-success">正解！</h4>
                            <p class="fs-5 fw-bold my-3">"${correctAnswerEn}"</p>
                            <p class="text-muted">(${correctAnswerJa})</p>
                            <hr>
                            <p class="text-start small"><strong>使われる状況：</strong><br>${situation || '解説はありません。'}</p>
                        </div>
                    `;
                    showFeedback('正解です！', feedbackBody);
                }
            }
        } else {
            $card.addClass('incorrect');
            playIncorrectSound();
            updateLearningStats('phrasalVerbQuiz', itemKey, itemData, false);
            if (!isReviewMode && !incorrectPhrases.some(p => p.phrase_en === currentPhrase.phrase_en)) {
                incorrectPhrases.push(currentPhrase);
            }
            // 正解のカードをハイライト
            $(`.answer-card[data-answer="${correctAnswer}"]`).addClass('correct');

            // 不正解時のフィードバックモーダル
            const yourAnswerText = (difficulty === 'hard') ? selectedAnswer : `"${selectedAnswer}"`;
            const feedbackBody = `
                <div class="text-center">
                    <p>あなたの回答: <br><span class="text-danger fw-bold">${yourAnswerText}</span></p>
                    <hr>
                    <p>正解は...<br><strong class="fs-5">"${correctAnswerEn}"</strong><br><small class="text-muted">(${correctAnswerJa})</small></p>
                    <hr>
                    <p class="text-start small"><strong>使われる状況：</strong><br>${situation || '解説はありません。'}</p>
                </div>
            `;
            showFeedback('残念！', feedbackBody);
        }
    }

    function handleNextQuestion() {
        currentQuestionIndex++;
        generateQuestion();
    }

    function updateProgress(answeredInReview = false) {
        if (isReviewMode) {
            const total = currentPhrases.length;
            // answeredInReviewがtrueの場合、現在の問題もカウントに含める
            const completed = answeredInReview ? currentQuestionIndex + 1 : currentQuestionIndex;
            const progress = total > 0 ? (completed / total) * 100 : 0;
            $('#progressBar').css('width', progress + '%').attr('aria-valuenow', progress);
            $('#scoreText').text(`復習中: ${completed} / ${total} 問`);
        } else {
            const goal = CORRECT_ANSWERS_FOR_LEVEL_UP;
            const progress = goal > 0 ? (correctAnswersCount / goal) * 100 : 0;
            $('#progressBar').css('width', progress + '%').attr('aria-valuenow', progress);
            $('#scoreText').text(`正解: ${correctAnswersCount} / ${goal}`);
        }
        // 常に現在のレベルをフッターに表示
        $('#levelText').text(`Level: ${currentLevel}`);
    }

    function showFeedback(title, body) {
        $('#feedbackModalLabel').text(title);
        $('#feedbackModalBody').html(body);
        feedbackModal.show();
    }

    function showCompletionScreen() {
        let completionHtml = `
            <div class="text-center mt-5">
                <h3 class="mb-3">🎉 ${isReviewMode ? '復習完了！' : `Level ${currentLevel} 達成！`} 🎉</h3>
                <p class="lead">${isReviewMode ? '間違えた問題をすべてクリアしました！' : 'おめでとうございます！'}</p>
                <button id="nextChallengeButton" class="btn btn-success mt-3">
                    <i class="fas fa-arrow-right me-2"></i>${isReviewMode ? 'クイズに戻る' : '次のレベルに挑戦！'}
                </button>
        `;

        // 通常モードで、間違えた問題がある場合のみ復習ボタンを表示
        if (!isReviewMode && incorrectPhrases.length > 0) {
            completionHtml += `
                <button id="reviewButton" class="btn btn-warning mt-3 ms-2">
                    <i class="fas fa-book-reader me-1"></i>間違えた問題だけ復習する (${incorrectPhrases.length}問)
                </button>
            `;
        }
        completionHtml += `</div>`;
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
        incorrectPhrases = [];
        startNewChallenge();
    });

    // 動的に追加されるボタンのイベント
    $(document).on('click', '#nextChallengeButton', function() {
        startNewChallenge();
    });

    // 復習ボタンのクリック
    $(document).on('click', '#reviewButton', function() {
        startReview();
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
        const phraseText = $(this).data('phrase');
        const currentPhrase = currentPhrases[currentQuestionIndex];
        if (phraseText && currentPhrase && currentPhrase.phrase_en === phraseText) {
            speakWord(phraseText, {
                audioFile: currentPhrase.audio_file,
                lang: 'en-GB'
            });
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