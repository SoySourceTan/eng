window.isInitialized = false;

$(document).ready(function() {
    if (window.isInitialized) return;
    window.isInitialized = true;
    console.log('quiz.js ロード開始');

    // --- 定数定義 ---
    const LEVEL_STORAGE_KEY = 'vocabQuizLevel'; // localStorageのキー
    const LEARNING_STATS_KEY = 'learningStats'; // 共通の統計キー
    const POINTS_FOR_LEVEL_UP = 20; // レベルアップに必要なポイント数

    // Bootstrap 5のModalインスタンスは、jQueryオブジェクトではなくDOM要素を渡して生成します。
    const feedbackModal = new bootstrap.Modal(document.getElementById('feedbackModal'));

    // --- 音声ファイルの準備 ---
    const levelUpSound = new Audio('lvup.mp3');

    // --- 変数定義 ---
    let currentQuestion = 0;
    let score = 0; // レベルアップ判定用のスコア
    let currentLevel = parseInt(localStorage.getItem(LEVEL_STORAGE_KEY)) || 1; // localStorageからレベルを読み込む
    // 統計データは `common.js` の `updateLearningStats` で直接localStorageを更新するため、ここでは保持しない
    let incorrectQuestions = [];
    let isReviewMode = false;
    let allWords = []; // 元の単語リストを保持
    let levelUpOccurred = false; // レベルアップしたかを判定するフラグ
    let hintUsed = false;
    let difficulty = 'normal'; // 'normal' or 'hard'

    function startReview() {
        if (incorrectQuestions.length === 0) return;
        console.log('復習セッションを開始します', incorrectQuestions);
        isReviewMode = true;

        // 復習用の単語リストを設定
        window.words = [...incorrectQuestions].sort(() => Math.random() - 0.5);
        incorrectQuestions = []; // 次の通常セッションのためにクリア
        currentQuestion = 0;
        score = 0; // スコアをリセット
        levelUpOccurred = false;

        // 復習モードのUIを更新
        updateProgress();
        generateQuestion();
    }

    function handleNextQuestion() {
        currentQuestion++;
        generateQuestion();
    }

    function generateQuestion() {
        console.log(`クイズ生成開始: currentQuestion=${currentQuestion}, words.length=${window.words.length}`);
        if (!window.words || window.words.length === 0) {
            console.warn('データがありません。デフォルトデータを使用。');
            showToast('データがありません。デフォルトデータを使います。', 'error');
            window.words = fallbackWords.sort(() => Math.random() - 0.5);
        }
        if (currentQuestion >= window.words.length || window.words.length === 0) {
            console.log('現在のセットのクイズが終了しました');
            showCompletionScreen();
            return;
        }

        hintUsed = false; // 新しい問題が始まるのでヒント使用状況をリセット
        const question = window.words[currentQuestion];
        console.log('現在の問題:', question);
        if (!question || !question.word) {
            console.error('無効な問題データ:', question);
            showToast('問題データの読み込みに失敗しました。次へ進みます。', 'error');
            currentQuestion++;
            generateQuestion();
            return;
        }

        const correctAnswer = question.ruby || question.meaning;

        // 修正点: 不正解の選択肢は常に元の全単語リスト(allWords)から探す
        const sourceForChoices = allWords.length > 0 ? allWords : window.words;

        // --- 不正解の選択肢をより堅牢な方法で生成 ---
        // 1. 同じカテゴリの不正解候補をシャッフルして取得
        const sameCategoryChoices = sourceForChoices
            .filter(w => w.category === question.category && w.word !== question.word)
            .sort(() => 0.5 - Math.random());

        // 2. その他のカテゴリの不正解候補をシャッフルして取得
        const otherCategoryChoices = sourceForChoices
            .filter(w => w.category !== question.category)
            .sort(() => 0.5 - Math.random());

        // 3. 候補を結合 (同じカテゴリを優先)
        const wrongAnswerPool = [...sameCategoryChoices, ...otherCategoryChoices];
        
        // 4. 意味が重複しないように3つの不正解を選択
        const wrongAnswers = [];
        const usedMeanings = new Set([correctAnswer]);
        for (const candidate of wrongAnswerPool) {
            if (wrongAnswers.length >= 3) break;
            const meaning = candidate.ruby || candidate.meaning;
            if (!usedMeanings.has(meaning)) {
                wrongAnswers.push(meaning);
                usedMeanings.add(meaning);
            }
        }

        const answers = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);

        $('#quizContainer').empty();
        const icon = question.icon || (window.defaultIcons && window.defaultIcons[question.category]) || 'mdi:help-circle-outline';
        const iconStyle = question.color ? `style="color: ${question.color}"` : '';

        let questionWordHtml;
        let hintSectionHtml;
        let hintButtonText;

        if (difficulty === 'hard') {
            questionWordHtml = `
                <h2 class="display-5 fw-bold mb-0" id="questionWord" style="display: none;">${question.word}</h2>
                <p class="lead" id="hard-mode-text">音声を聞いてください</p>
            `;
            // Hardモードではアイコンは最初から表示（ぼかしなし）
            hintSectionHtml = `<div class="d-flex flex-column align-items-center" style="min-height: 5rem;"><span class="vocab-icon iconify" data-icon="${icon}" ${iconStyle} style="font-size: 4rem;"></span></div>`;
            hintButtonText = '英単語を見る';
        } else { // normal
            questionWordHtml = `<h2 class="display-5 fw-bold mb-0">${question.word}</h2>`;
            // Normalモードではアイコンはぼかす
            hintSectionHtml = `<div id="hint-area" class="d-flex flex-column align-items-center" style="min-height: 5rem;"><span class="vocab-icon iconify" data-icon="${icon}" ${iconStyle} style="font-size: 4rem;"></span></div>`;
            hintButtonText = 'ヒントを見る';
        }

        $('#quizContainer').append(`
            <div class="question-card text-center" data-word="${question.word}" data-audio-file="${question.audio_file || ''}">
                <p class="lead">この単語は何でしょう？</p>
                <div class="my-4 d-flex justify-content-center align-items-center">
                    ${questionWordHtml}
                    <button id="playQuestionSound" class="btn btn-link text-secondary p-0 ms-3" style="font-size: 2.5rem; line-height: 1;" title="音声を聞く">
                        <i class="fas fa-volume-up"></i>
                    </button>
                </div>

                ${hintSectionHtml}

                <div class="mt-3">
                    <button id="hintButton" class="btn btn-outline-secondary">
                        <i class="fas fa-lightbulb me-1"></i> ${hintButtonText}
                    </button>
                </div>
            </div>
            <div class="answer-grid">
                ${answers.map(answer => `
                    <div class="answer-card" data-answer="${answer}">
                        ${answer}
                    </div>
                `).join('')}
            </div>
            <div class="text-center mt-3" id="nextQuestionContainer" style="display: none;">
                <button id="nextQuestionButton" class="btn btn-primary">
                    <i class="fas fa-arrow-right me-2"></i>次へ！
                </button>
            </div>
        `);
        // Normalモードの場合のみ、ヒントエリアのぼかしをリセット
        if (difficulty === 'normal') {
            $('#hint-area').removeClass('revealed');
        }

        console.log('アイコン生成確認:', $('.vocab-icon').length, $('.vocab-icon').data('word'));

        // ★★★ 重要 ★★★
        // 動的に追加された問題のアイコンをIconifyにスキャンさせる
        Iconify.scan();

        // 0.5秒後に音声を自動再生
        setTimeout(() => {
            const currentQuestionData = window.words[currentQuestion];
            if (currentQuestionData && currentQuestionData.word) {
                speakWord(currentQuestionData.word, {
                    audioFile: currentQuestionData.audio_file,
                    caller: 'auto-play',
                    lang: 'en-GB'
                });
            }
        }, 500);
    }

    function bindEvents() {
        console.log('イベントバインド開始');

        // ヒントボタンのイベント
        $(document).on('click', '#hintButton', function() {
            hintUsed = true;
            if (difficulty === 'hard') {
                // Hardモード: 英単語を表示
                $('#questionWord').show();
                $('#hard-mode-text').hide();
            } else {
                // Normalモード: アイコンのぼかしを解除
                $('#hint-area').addClass('revealed');
            }
            $(this).prop('disabled', true).addClass('disabled');
            showToast('ヒントを使用しました (正解で+1点)', 'info');
        });

        $(document).on('click touchstart', '.answer-card', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const $card = $(this);
            if ($card.hasClass('disabled')) return;

            if (!window.audioContext) initAudioContext();
            $('.answer-card, #hintButton').off('click touchstart').addClass('disabled');

            const selectedAnswer = $(this).data('answer');
            const questionData = window.words[currentQuestion];
            const correctAnswer = questionData.ruby || questionData.meaning;
            const correctAnswerEn = questionData.word;
            const isCorrect = selectedAnswer === correctAnswer;

            // 正解・不正解の判定
            if (isCorrect) {
                $card.addClass('correct');
                playCorrectSound();
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                updateStats(questionData, true);

                if (isReviewMode) {
                    // --- 復習モードの正解処理 ---
                    updateProgress(true); // 先に進捗を更新
                    if (currentQuestion + 1 >= window.words.length) {
                        // 全問正解で復習完了
                        levelUpOccurred = true; // 完了画面表示用のフラグ
                        showFeedback('復習完了！', '間違えた問題をすべてクリアしました！');
                    } else {
                        const feedbackBody = `
                            <div class="text-center">
                                <h4 class="text-success">正解！</h4>
                                <p class="fs-5 fw-bold my-3">"${correctAnswerEn}"</p>
                                <p class="text-muted">(${correctAnswer})</p>
                            </div>
                        `;
                        showFeedback('正解です！', feedbackBody);
                    }
                } else {
                    // --- 通常モードの正解処理 ---
                    const points = hintUsed ? 1 : 2;
                    score += points;
                    updateProgress(); // UIを更新
                    showToast(`正解！ +${points}点`, 'success');

                    // レベルアップ判定
                    if (score >= POINTS_FOR_LEVEL_UP) {
                        levelUpOccurred = true;
                        currentLevel++;
                        score = 0; // スコアをリセット
                        localStorage.setItem(LEVEL_STORAGE_KEY, currentLevel);
                        levelUpSound.play().catch(e => console.error("Audio play failed:", e));
                        showFeedback(`レベルアップ！🎉 Level ${currentLevel}達成！`, `おめでとうございます！<br>次のレベルに進みます！`);
                    } else {
                        const feedbackBody = `
                            <div class="text-center">
                                <h4 class="text-success">正解！</h4>
                                <p class="fs-5 fw-bold my-3">"${correctAnswerEn}"</p>
                                <p class="text-muted">(${correctAnswer})</p>
                            </div>
                        `;
                        showFeedback('正解です！', feedbackBody);
                    }
                }
            } else {
                // --- 不正解の処理 (モード共通) ---
                $card.addClass('incorrect');
                playIncorrectSound();
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                if (!isReviewMode && !incorrectQuestions.some(q => q.word === questionData.word)) {
                    incorrectQuestions.push(questionData);
                }
                updateStats(questionData, false);
                
                // 正解のカードをハイライト
                $(`.answer-card[data-answer="${correctAnswer}"]`).addClass('correct');

                const feedbackBody = `
                    <div class="text-center">
                        <p>あなたの回答: <br><span class="text-danger fw-bold">"${selectedAnswer}"</span></p>
                        <hr>
                        <p>正解は...<br><strong class="fs-5">"${correctAnswerEn}"</strong><br><small class="text-muted">(${correctAnswer})</small></p>
                    </div>
                `;
                showFeedback('残念！', feedbackBody);
            }
        });
        // 新しい音声再生ボタンのイベント
        $(document).on('click', '#playQuestionSound', function() {
            const $button = $(this);
            const $card = $button.closest('.question-card');
            const word = $card.data('word');
            const audioFile = $card.data('audio-file');

            if (word) {
                speakWord(word, {
                    audioFile: audioFile,
                    caller: 'quiz-sound-button',
                    lang: 'en-GB'
                });
            }
        });

        $(document).on('click', '#nextQuestionButton', function(e) {
            e.preventDefault();
            console.log('次の問題へボタンクリック');
            $('#nextQuestionContainer').hide();
            handleNextQuestion();
        });

        $(document).on('click', '#nextChallengeButton', function(e) {
            e.preventDefault();
            console.log('「次に挑戦」ボタンクリック');
            startNewChallenge();
        });

        $(document).on('click', '#reviewButton', startReview);

        $('#feedbackModal').on('hidden.bs.modal', function() {
            if (levelUpOccurred) {
                showCompletionScreen();
                levelUpOccurred = false; // フラグをリセット
            } else {
                // クイズ完了画面が表示されていない場合のみ次の問題へ
                if ($('#quizContainer').find('#nextChallengeButton, #reviewButton').length === 0) {
                    handleNextQuestion();
                }
            }
        });
    }

    function showCompletionScreen() {
        let completionHtml = `
            <div class="text-center mt-5">
                <h3 class="mb-3">🎉 ${isReviewMode ? '復習完了！' : 'クイズクリア'} 🎉</h3>
                <p class="lead">${isReviewMode ? '間違えた問題をすべてクリアしました！' : `Level ${currentLevel} になりました！`}</p>
                <button id="nextChallengeButton" class="btn btn-success mt-3">
                    <i class="fas fa-arrow-right me-2"></i>${isReviewMode ? 'クイズに戻る' : '次のレベルに挑戦！'}
                </button>
        `;

        // 通常モードで、間違えた問題がある場合のみ復習ボタンを表示
        if (!isReviewMode && incorrectQuestions.length > 0) {
            completionHtml += `
                <button id="reviewButton" class="btn btn-warning mt-3 ms-2">
                    <i class="fas fa-book-reader me-1"></i>間違えた問題だけ復習する (${incorrectQuestions.length}問)
                </button>
            `;
        }
        completionHtml += `</div>`;
        $('#quizContainer').html(completionHtml);
    }

    function showFeedback(title, body) {
        $('#feedbackModalLabel').text(title);
        $('#feedbackModalBody').html(body);
    feedbackModal.show();
}

    function updateProgress(answeredInReview = false) {
        if (isReviewMode) {
            const total = window.words.length;
            // answeredInReviewがtrueの場合、現在の問題もカウントに含める
            const completed = answeredInReview ? currentQuestion + 1 : currentQuestion;
            const progress = total > 0 ? (completed / total) * 100 : 0;
            $('#progressBar').css('width', progress + '%').attr('aria-valuenow', progress);
            $('#scoreText').text(`復習中: ${completed} / ${total} 問`);
        } else {
            const goal = POINTS_FOR_LEVEL_UP;
            const progress = goal > 0 ? (score / goal) * 100 : 0;
            $('#progressBar').css('width', progress + '%').attr('aria-valuenow', progress);
            // 正解数を表示
            $('#scoreText').text(`スコア: ${score} / ${goal}`);
        }
        // 常に現在のレベルをフッターに表示
        $('#levelText').text(`Level: ${currentLevel}`);
    }

    function startNewChallenge() {
        console.log('新しい挑戦を開始します');
        isReviewMode = false; // 通常モードに設定
        if (!window.audioContext) initAudioContext();
        currentQuestion = 0;
        score = 0;
        // incorrectQuestions はリセットしない（次の通常セッションで使うため）

        // 元の全単語リストから新しいクイズを開始
        window.words = [...allWords].sort(() => Math.random() - 0.5);

        updateProgress();
        generateQuestion();
    }

    /**
     * 統計に基づいて単語リストを優先順位付けする
     * @param {Array} words - 全単語リスト
     * @param {object} stats - 統計データ
     * @returns {Array} 優先順位付けされた単語リスト
     */
    function createPrioritizedWordList(words, stats) {
        if (!stats || !stats.wordStats || Object.keys(stats.wordStats).length === 0) {
            // 統計データがなければ、単純にシャッフルして返す
            return [...words].sort(() => Math.random() - 0.5);
        }

        const scoredWords = words.map(word => {
            const stat = stats.wordStats[word.word] || { correct: 0, incorrect: 0 };
            const attempts = stat.correct + stat.incorrect;
            const incorrectRate = attempts > 0 ? stat.incorrect / attempts : 0;
            // 挑戦回数が少ない単語ほど優先度が高くなるボーナス
            const noveltyBonus = 1 / (attempts + 1);
            const priority = incorrectRate + noveltyBonus;
            return { ...word, priority };
        });

        // 優先度スコアの高い順にソートし、少しランダム性を加えて同じスコアの単語が固まらないようにする
        return scoredWords.sort((a, b) => b.priority - a.priority + (Math.random() * 0.1 - 0.05));
    }


    $('#resetButton').on('click', function() {
        console.log('リセットボタンクリック');
        // localStorageからレベルと統計情報を削除
        // 注意: `LEARNING_STATS_KEY` は全クイズ共通なので、ここでは削除しない方針。
        // 個別のクイズの統計だけリセットしたい場合は、より詳細なロジックが必要。
        localStorage.removeItem(LEVEL_STORAGE_KEY);

        // 変数を初期化
        currentLevel = 1;
        score = 0;
        incorrectQuestions = []; // 間違えた問題リストもリセット

        // UIを更新して新しいクイズを開始
        $('#levelText').text(`Level: ${currentLevel}`); // UIを更新
        startNewChallenge();
    });

    /**
     * 学習統計を更新し、localStorageに保存する
     * @param {object} wordData - 回答した単語のデータ
     * @param {boolean} isCorrect - 正解したかどうか
     */
    function updateStats(wordData, isCorrect) {
        updateLearningStats('wordQuiz', wordData.word, { category: wordData.category }, isCorrect);
    }

    /**
     * スタートモーダルに統計情報を表示する
     */
    function displayStats() {
        const quizStats = (JSON.parse(localStorage.getItem(LEARNING_STATS_KEY)) || {}).wordQuiz || {};
        const learnedWordsCount = Object.keys(quizStats.wordStats || {}).length;
        if (learnedWordsCount === 0) {
            $('#stats-area').hide();
            return;
        }

        const totalQuestions = quizStats.totalQuestions;
        const totalCorrect = quizStats.totalCorrect;
        const accuracy = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0;

        // 苦手な単語トップ3を取得 (不正解数が多い順)
        const weakWords = Object.entries(quizStats.wordStats || {})
            .sort(([, a], [, b]) => b.incorrect - a.incorrect)
            .slice(0, 3)
            .map(([word]) => `<li>${word}</li>`)
            .join('');

        const statsHtml = `
            <div class="row g-2"><div class="col-7"><strong>学習した単語数:</strong></div><div class="col-5 text-end">${learnedWordsCount} 語</div></div>
            <div class="row g-2 mt-1"><div class="col-7"><strong>全体の正解率:</strong></div><div class="col-5 text-end">${accuracy} %</div></div>
            <hr class="my-2"><p class="mb-1"><strong>特に苦手な単語:</strong></p><ul>${weakWords || '<li>まだありません</li>'}</ul>`;
        
        $('#stats-content').html(statsHtml);
        $('#stats-area').show();
    }

    function initializePage() {
        console.log('ページ初期化開始');
        $('body').addClass('quiz-page');
        $('#quizContainer').html('<div class="text-center"><p>クイズを読み込み中...</p></div>');
        $('#toggleSpeechButton').find('.button-text').text(window.speechEnabled ? '音声オフ' : '音声オン');
        // AudioContextの初期化はユーザー操作を起点に行うのがベストプラクティスだが、
        // ここで呼んでおくことで、最初のクリック時の遅延を減らせる可能性がある。
        if (!window.audioContext) initAudioContext();
        generateQuestion();
        updateProgress(); // 初期表示のために呼び出し
        bindEvents();
    }

    // --- クイズ開始ロジック ---
    const startModal = new bootstrap.Modal('#startModal');
    const startGameButton = $('#startGameButton');

    // 難易度選択の説明を更新
    $('input[name="difficulty"]').on('change', function() {
        const desc = $(this).val() === 'hard' 
            ? 'HARD: 音声だけを聞いて、日本語の意味を選びます。ヒントで英単語が表示されます。'
            : 'NORMAL: 英単語を見て、日本語の意味を選びます。';
        $('#difficulty-description').text(desc);
    });

    // ページ読み込み時にモーダルを表示
    displayStats();
    startModal.show();

    // 「ゲームを始める」ボタンがクリックされたらクイズを開始
    startGameButton.on('click', function() {
        difficulty = $('input[name="difficulty"]:checked').val();
        // データの読み込みとクイズの初期化
        loadData(function(data) {
            allWords = data; // 元のデータを保持
            const wordQuizStats = (JSON.parse(localStorage.getItem(LEARNING_STATS_KEY)) || {}).wordQuiz || {};
            window.words = createPrioritizedWordList(allWords, wordQuizStats);

            console.log(`${window.words.length}語を読み込みました`);
            initializePage();
        });
    });
    console.log('quiz.js ロード完了');
});