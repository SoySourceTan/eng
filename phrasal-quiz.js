window.isInitialized = false;

$(document).ready(function() {
    if (window.isInitialized) return;
    window.isInitialized = true;
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
        if (currentQuestionIndex >= currentPhrases.length) {
            // 全ての問題を一周したら、再度シャッフルして続ける
            currentQuestionIndex = 0;
            currentPhrases.sort(() => 0.5 - Math.random());
        }

        const phrase = currentPhrases[currentQuestionIndex];
        const correctAnswerText = (difficulty === 'easy') ? phrase.phrase_en : phrase.phrase_ja;

        // 不正解の選択肢を作成
        const wrongAnswers = new Set();
        while (wrongAnswers.size < 3 && wrongAnswers.size < allPhrases.length - 1) {
            const randomPhrase = allPhrases[Math.floor(Math.random() * allPhrases.length)];
            const randomAnswerText = (difficulty === 'easy') ? randomPhrase.phrase_en : randomPhrase.phrase_ja;
            if (randomAnswerText !== correctAnswerText) {
                wrongAnswers.add(randomAnswerText);
            }
        }

        const answers = [correctAnswerText, ...wrongAnswers].sort(() => 0.5 - Math.random());

        const quizHtml = `
            <div class="question-card text-center">
                <p class="lead">この句動詞は何でしょう？</p>
                <div class="my-4">
                    <i class="fas fa-volume-up sound-icon" data-phrase="${escapeAttr(phrase.phrase_en)}" style="font-size: 4rem; cursor: pointer;"></i>
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

        if (selectedAnswer === correctAnswer) {
            $card.addClass('correct');
            playCorrectSound();
            correctAnswersCount++;
            updateProgress();

            if (correctAnswersCount >= CORRECT_ANSWERS_FOR_LEVEL_UP) {
                levelUpOccurred = true;
                currentLevel++;
                correctAnswersCount = 0; // カウンターリセット
                localStorage.setItem(LEVEL_STORAGE_KEY, currentLevel);
                levelUpSound.play().catch(e => console.error("Audio play failed:", e));
                showFeedback(`レベルアップ！🎉 Level ${currentLevel}達成！`, `おめでとうございます！<br>次のレベルに進みます！`);
            } else {
                setTimeout(handleNextQuestion, 1500);
            }
        } else {
            $card.addClass('incorrect');
            playIncorrectSound();
            const feedbackBody = `正解は <strong>"${correctAnswer}"</strong> でした。<br><hr><em>"${currentPhrase.phrase_en}"</em>: ${currentPhrase.phrase_ja}`;
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
        $('#feedbackModal').modal('show');
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

    // 回答カードのクリック
    $(document).on('click', '.answer-card', function() {
        if ($(this).hasClass('disabled')) return;
        checkAnswer($(this));
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
        // レベルアップ時はリセットされるので次の問題には進まない
        if (!levelUpOccurred) {
            handleNextQuestion();
        } else {
            // レベルアップ後は新しいチャレンジを開始
            startNewChallenge();
            levelUpOccurred = false;
        }
    });

    // --- 初期表示 ---
    const startModal = new bootstrap.Modal('#startModal');
    startModal.show();
});