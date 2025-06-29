$(document).ready(function() {
    let phrasesData = [];
    let questions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let feedbackModal;

    // --- データ読み込みとゲーム開始 ---
    fetch(`phrase.json?v=${new Date().getTime()}`)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 3) {
                phrasesData = data;
                feedbackModal = new bootstrap.Modal($('#feedbackModal'));
                startGame();
            } else {
                throw new Error('フレーズデータが不足しています。クイズには最低4つのフレーズが必要です。');
            }
        })
        .catch(error => {
            console.error("フレーズデータの読み込みに失敗しました:", error);
            $('#quizContainer').html(`<p class="text-center text-danger">${error.message}</p>`);
        });

    function startGame() {
        questions = [...phrasesData].sort(() => 0.5 - Math.random());
        currentQuestionIndex = 0;
        score = 0;
        updateProgress();
        generateQuestion();
    }

    // --- 問題生成 ---
    function generateQuestion() {
        if (currentQuestionIndex >= questions.length) {
            showFeedback('クイズ完了！', `お疲れ様でした！あなたのスコアは ${score} / ${questions.length} です。`);
            $('#quizContainer').html(`<h3 class="text-center mt-5">クイズ完了！<br>スコア: ${score} / ${questions.length}</h3>`);
            return;
        }

        const question = questions[currentQuestionIndex];
        const correctAnswer = question.phrase_en;

        const wrongAnswers = [];
        const tempPhrases = [...phrasesData].filter(p => p.phrase_en !== correctAnswer);
        while (wrongAnswers.length < 3 && tempPhrases.length > 0) {
            const randomIndex = Math.floor(Math.random() * tempPhrases.length);
            wrongAnswers.push(tempPhrases.splice(randomIndex, 1)[0].phrase_en);
        }

        const answers = [correctAnswer, ...wrongAnswers].sort(() => 0.5 - Math.random());

        const quizHtml = `
            <div class="question-card text-center">
                <p class="lead mb-3">この音声のフレーズはどれ？</p>
                <button id="playQuestionSound" class="btn btn-lg btn-primary mb-4 shadow-sm">
                    <span class="iconify" data-icon="fa-solid:volume-up" style="font-size: 1.5rem; vertical-align: middle;"></span>
                    <span class="ms-2">音声を聞く</span>
                </button>
            </div>
            <div class="row row-cols-1 row-cols-md-2 g-3">
                ${answers.map(answer => `
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
        speakWord(correctAnswer, { lang: 'en-GB' });
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
            const correctAnswer = questions[currentQuestionIndex].phrase_en;

            if (selectedAnswer === correctAnswer) {
                score++;
                playCorrectSound();
                $card.addClass('correct');
                setTimeout(handleNextQuestion, 1500); // 1.5秒後に次の問題へ
            } else {
                playIncorrectSound();
                $card.addClass('incorrect');
                // 正解のカードをハイライト
                $(`.answer-card[data-answer="${correctAnswer}"]`).addClass('correct');
                showFeedback('残念！', `正解は...<br><strong>"${correctAnswer}"</strong><br>でした。`);
            }
            updateProgress(true); // 回答したので分母を増やす
        });

        // リセットボタン
        $('#resetButton').on('click', startGame);

        // モーダルが閉じた後の処理
        $('#feedbackModal').on('hidden.bs.modal', function() {
            if (currentQuestionIndex < questions.length) {
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
    }

    function showFeedback(title, body) {
        $('#feedbackModalLabel').text(title);
        $('#feedbackModalBody').html(body);
        feedbackModal.show();
    }

    // --- 初期化 ---
    bindEvents();
});