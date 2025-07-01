$(document).ready(function() {
    const LEVEL_STORAGE_KEY = 'phraseQuizLevel';

    let phrasesData = [];
    let questions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let level = parseInt(localStorage.getItem(LEVEL_STORAGE_KEY)) || 1;
    let incorrectQuestions = [];
    let isReviewMode = false;
    let levelUpOccurred = false; // レベルアップしたかを判定するフラグ
    let difficulty = 'easy'; // デフォルト難易度
    const POINTS_FOR_LEVEL_UP = 5;

    // Bootstrap 5のModalインスタンスは、jQueryオブジェクトではなくDOM要素を渡して生成します。
    const feedbackModal = new bootstrap.Modal(document.getElementById('feedbackModal'));

    function startGame() {
        isReviewMode = false;
        questions = [...phrasesData].sort(() => 0.5 - Math.random());
        currentQuestionIndex = 0;
        score = 0;
        levelUpOccurred = false;
        incorrectQuestions = [];
        updateProgress();
        generateQuestion();
    }

    function startReview() {
        if (incorrectQuestions.length === 0) return;
        isReviewMode = true;
        questions = [...incorrectQuestions]; // 復習リストを問題にする
        incorrectQuestions = []; // 次の復習のためにクリア
        currentQuestionIndex = 0;
        score = 0;
        updateProgress();
        generateQuestion();
    }

    // --- 問題生成 ---
    function generateQuestion() {
        if (currentQuestionIndex >= questions.length) {
            showCompletionScreen();
            return;
        }

        const question = questions[currentQuestionIndex];
        const correctAnswerEn = question.phrase_en;

        let displayAnswers;
        let correctDisplayAnswer;

        if (difficulty === 'hard') {
            // HARDモード: 日本語の選択肢
            correctDisplayAnswer = question.phrase_ja;
            const wrongAnswers = [];
            const tempPhrases = [...phrasesData].filter(p => p.phrase_en !== correctAnswerEn);
            while (wrongAnswers.length < 3 && tempPhrases.length > 0) {
                const randomIndex = Math.floor(Math.random() * tempPhrases.length);
                wrongAnswers.push(tempPhrases.splice(randomIndex, 1)[0].phrase_ja);
            }
            displayAnswers = [correctDisplayAnswer, ...wrongAnswers];
        } else {
            // EASYモード: 英語の選択肢 (デフォルト)
            correctDisplayAnswer = correctAnswerEn;
            const wrongAnswers = [];
            const tempPhrases = [...phrasesData].filter(p => p.phrase_en !== correctAnswerEn);
            while (wrongAnswers.length < 3 && tempPhrases.length > 0) {
                const randomIndex = Math.floor(Math.random() * tempPhrases.length);
                wrongAnswers.push(tempPhrases.splice(randomIndex, 1)[0].phrase_en);
            }
            displayAnswers = [correctDisplayAnswer, ...wrongAnswers];
        }

        // 選択肢をシャッフル
        displayAnswers.sort(() => 0.5 - Math.random());

        const quizHtml = `
            <div class="question-card text-center">
                <p class="lead mb-3">この音声のフレーズはどれ？</p>
                <button id="playQuestionSound" class="btn btn-lg btn-primary mb-4 shadow-sm">
                    <span class="iconify" data-icon="fa-solid:volume-up" style="font-size: 1.5rem; vertical-align: middle;"></span>
                    <span class="ms-2">音声を聞く</span>
                </button>
            </div>
            <div class="row row-cols-1 row-cols-md-2 g-3">
                ${displayAnswers.map(answer => `
                    <div class="col">
                        <div class="answer-card h-100 d-flex align-items-center justify-content-center p-3" data-answer="${answer}">
                            <span class="answer-text">${answer}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        $('#quizContainer').html(quizHtml);
        Iconify.scan();

        // 問題が生成されたら一度だけ自動再生
        speakWord(correctAnswerEn, { lang: 'en-GB' });
    }

    // --- イベントハンドラ ---
    function bindEvents() {
        // 音声再生ボタン
        $('#quizContainer').on('click', '#playQuestionSound', function() {
            const correctAnswer = questions[currentQuestionIndex].phrase_en;
            speakWord(correctAnswer, { lang: 'en-GB' });
        });

        // 回答カード
        $('#quizContainer').on('click', '.answer-card', function() {
            const $card = $(this);
            if ($card.hasClass('disabled')) return;

            $('.answer-card').addClass('disabled'); // 全てのカードを無効化

            const selectedAnswer = $card.data('answer');
            const questionData = questions[currentQuestionIndex];
            const correctAnswerEn = questionData.phrase_en;
            const correctAnswerJa = questionData.phrase_ja;

            const isCorrect = (difficulty === 'hard') ? (selectedAnswer === correctAnswerJa) : (selectedAnswer === correctAnswerEn);

            if (isCorrect) {
                score++;
                $card.addClass('correct');

                // レベルアップ判定
                if (score > 0 && score % POINTS_FOR_LEVEL_UP === 0) {
                    level++;
                    localStorage.setItem(LEVEL_STORAGE_KEY, level);
                    levelUpOccurred = true;
                    playCorrectSound();
                    showFeedback('レベルアップ！🎉', `おめでとうございます！<br>Level ${level} に到達しました！`);
                    // モーダルを閉じた後に 'hidden.bs.modal' イベントで次の問題へ進むので、ここではタイマーをセットしない
                } else {
                    // 通常の正解
                    playCorrectSound();
                    setTimeout(handleNextQuestion, 1500); // 1.5秒後に次の問題へ
                }
            } else {
                playIncorrectSound();
                $card.addClass('incorrect');
                // 正解のカードをハイライト
                const correctDisplayAnswer = (difficulty === 'hard') ? correctAnswerJa : correctAnswerEn;
                $(`.answer-card[data-answer="${correctDisplayAnswer}"]`).addClass('correct');
                // 復習リストに不正解の問題を追加（重複チェック）
                if (!incorrectQuestions.some(q => q.phrase_en === questionData.phrase_en)) {
                    incorrectQuestions.push(questionData);
                }
                showFeedback('残念！', `正解は...<br><strong>"${correctDisplayAnswer}"</strong><br>でした。`);
            }
            updateProgress(true); // 回答したので分母を増やす
        });

        // リセットボタン
        $('#resetButton').on('click', function() {
            localStorage.removeItem(LEVEL_STORAGE_KEY);
            level = 1;
            startGame();
        });
        
        // 動的に追加されるボタンのイベント
        $('#quizContainer').on('click', '#reviewButton', startReview);
        $('#quizContainer').on('click', '#restartButton', function() {
            localStorage.removeItem(LEVEL_STORAGE_KEY);
            level = 1;
            startGame();
        });
        // モーダルが閉じた後の処理
        $('#feedbackModal').on('hidden.bs.modal', function() {
            if (levelUpOccurred) {
                showCompletionScreen();
                levelUpOccurred = false; // フラグをリセット
            } else if (currentQuestionIndex < questions.length) {
                // クイズ完了画面が表示されていない場合のみ次の問題へ
                handleNextQuestion();
            }
        });
    }

    function handleNextQuestion() {
        currentQuestionIndex++;
        generateQuestion();
    }

    // --- UI更新 ---
    function updateProgress(answered = false) {
        const totalAnswered = answered ? currentQuestionIndex + 1 : currentQuestionIndex;
        const progress = (totalAnswered / questions.length) * 100;
        $('#progressBar').css('width', progress + '%').attr('aria-valuenow', progress);
        $('#scoreText').text(`正解: ${score} / ${totalAnswered}`);
        $('#levelText').text(`Level: ${level}`);
    }

    function showFeedback(title, body) {
        $('#feedbackModalLabel').text(title);
        $('#feedbackModalBody').html(body);
        feedbackModal.show();
    }

    function showCompletionScreen() {
        const totalAnswered = currentQuestionIndex + 1; // 最後に答えた問題を含める
        const accuracy = totalAnswered > 0 ? ((score / totalAnswered) * 100).toFixed(0) : 0;
        let completionHtml = `
            <div class="text-center mt-5">
                <h3>${isReviewMode ? '復習完了！' : 'クイズクリア！'}</h3>
                <p class="lead">スコア: ${score} / ${totalAnswered}</p>
                <p>正解率: ${accuracy}% (Level ${level})</p>
                <button id="restartButton" class="btn btn-primary mt-3">
                    <i class="fas fa-redo me-1"></i>もう一度挑戦する
                </button>
        `;

        if (!isReviewMode && incorrectQuestions.length > 0) {
            completionHtml += `
                <button id="reviewButton" class="btn btn-warning mt-3">
                    <i class="fas fa-book-reader me-1"></i>間違えた問題だけ復習する (${incorrectQuestions.length}問)
                </button>
            `;
        }
        completionHtml += `</div>`;
        $('#quizContainer').html(completionHtml);
    }
    // --- 初期化 ---
    bindEvents();

    // 難易度選択のUIイベント
    $('input[name="difficulty"]').on('change', function() {
        difficulty = $(this).val();
        const description = $('#difficulty-description');
        if (difficulty === 'hard') {
            description.text('HARD: 英語の音声を聞いて、日本語の選択肢から選びます。');
        } else {
            description.text('EASY: 英語の音声を聞いて、英語の選択肢から選びます。');
        }
    });

    const startModal = new bootstrap.Modal('#startModal');
    const startGameButton = $('#startGameButton');

    // ページ読み込み時にモーダルを表示
    startModal.show();

    // 「ゲームを始める」ボタンがクリックされたらクイズを開始
    startGameButton.on('click', function() {
        // --- データ読み込みとゲーム開始 ---
        fetch(`phrase.json?v=${new Date().getTime()}`)
            .then(res => res.json())
            .then(data => {
                // データのバリデーションを強化
                const isValid = data && data.length >= 4 && data.every(p => p.phrase_en && p.phrase_ja);
                if (isValid) {
                    phrasesData = data;
                    startGame();
                } else {
                    throw new Error('フレーズデータが不完全です。各項目に英語(phrase_en)と日本語(phrase_ja)の両方が必要です。');
                }
            })
            .catch(error => {
                console.error("フレーズデータの読み込みに失敗しました:", error);
                $('#quizContainer').html(`<p class="text-center text-danger">${error.message}</p>`);
            });
    });
});