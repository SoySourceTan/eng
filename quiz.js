window.isInitialized = false;

$(document).ready(function() {
    if (window.isInitialized) return;
    window.isInitialized = true;
    console.log('quiz.js ロード開始');

    // --- 定数定義 ---
    const LEVEL_STORAGE_KEY = 'vocabQuizLevel'; // localStorageのキー
    const POINTS_FOR_LEVEL_UP = 20; // レベルアップに必要なポイント数

    // --- 音声ファイルの準備 ---
    const levelUpSound = new Audio('lvup.mp3');

    // --- 変数定義 ---
    let currentQuestion = 0;
    let score = 0; // レベルアップ判定用のスコア
    let currentLevel = parseInt(localStorage.getItem(LEVEL_STORAGE_KEY)) || 1; // localStorageからレベルを読み込む
    let incorrectQuestions = [];
    let isReviewMode = false;
    let allWords = []; // 元の単語リストを保持
    let levelUpOccurred = false; // レベルアップしたかを判定するフラグ
    let hintUsed = false;

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
        const wrongAnswers = [];
        const usedMeanings = new Set([question.meaning]);

        // 修正点: 不正解の選択肢は常に元の全単語リスト(allWords)から探す
        const sourceForChoices = allWords.length > 0 ? allWords : window.words;

        // 同じカテゴリから不正解の選択肢を探す
        const sameCategoryWords = sourceForChoices.filter(w => w.category === question.category && w.meaning !== question.meaning);
        while (wrongAnswers.length < 3 && sameCategoryWords.length > 0) {
            const randomIndex = Math.floor(Math.random() * sameCategoryWords.length);
            const randomWord = sameCategoryWords[randomIndex];
            if (!usedMeanings.has(randomWord.meaning)) {
                wrongAnswers.push(randomWord.ruby || randomWord.meaning);
                usedMeanings.add(randomWord.meaning);
            }
            sameCategoryWords.splice(randomIndex, 1); // 一度使った候補は削除
        }
        // それでも足りない場合は、カテゴリに関係なく不正解の選択肢を探す
        while (wrongAnswers.length < 3 && sourceForChoices.length > wrongAnswers.length + 1) {
            const randomWord = sourceForChoices[Math.floor(Math.random() * sourceForChoices.length)];
            if (!usedMeanings.has(randomWord.meaning)) {
                wrongAnswers.push(randomWord.ruby || randomWord.meaning);
                usedMeanings.add(randomWord.meaning);
            }
        }
        const answers = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);

        $('#quizContainer').empty();
        // 単語のアイコンがあればそれを使い、なければカテゴリのデフォルトアイコンを使う
        const icon = question.icon || (window.defaultIcons && window.defaultIcons[question.category]) || 'mdi:help-circle-outline';
        const iconStyle = question.color ? `style="color: ${question.color}"` : '';
        $('#quizContainer').append(`
            <div class="question-card text-center" data-word="${question.word}">
                <p class="lead">この単語は何でしょう？</p>
                <div class="my-3">
                    <i class="fas fa-volume-up sound-icon" data-word="${question.word}" style="font-size: 3rem; cursor: pointer;"></i>
                </div>
                <div id="hint-area" style="min-height: 7rem;">
                    <span class="vocab-icon iconify" data-icon="${icon}" ${iconStyle} style="font-size: 4rem;"></span>
                    <h4 class="mt-2" id="questionWord">${question.word}</h4>
                </div>
                <div class="mt-3">
                    <button id="hintButton" class="btn btn-outline-secondary">
                        <i class="fas fa-lightbulb me-1"></i> ヒントを見る
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
        // 前の問題で表示されたヒントの revealed クラスを削除し、ぼかし状態に戻す
        $('#hint-area').removeClass('revealed');

        console.log('アイコン生成確認:', $('.vocab-icon').length, $('.vocab-icon').data('word'));

        // ★★★ 重要 ★★★
        // 動的に追加された問題のアイコンをIconifyにスキャンさせる
        Iconify.scan();

        // 0.5秒後に音声を自動再生
        setTimeout(() => {
            const currentQuestionData = window.words[currentQuestion];
            if (currentQuestionData && currentQuestionData.word) {
                speakWord(currentQuestionData.word, {
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
            $('#hint-area').addClass('revealed');
            $(this).prop('disabled', true).addClass('disabled');
            showToast('ヒントを使用しました (正解で+1点)', 'info');
        });

        $(document).on('click touchstart', '.answer-card', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('回答選択:', $(this).data('answer'));
            if (!window.audioContext) initAudioContext();
            const selectedAnswer = $(this).data('answer');
            const correctAnswer = window.words[currentQuestion].ruby || window.words[currentQuestion].meaning;
            const $card = $(this);

            $('.answer-card, #hintButton').off('click touchstart').addClass('disabled');

            // 正解・不正解の判定
            if (selectedAnswer === correctAnswer) {
                $card.addClass('correct');
                playCorrectSound();
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

                if (isReviewMode) {
                    // --- 復習モードの正解処理 ---
                    updateProgress(true); // 先に進捗を更新
                    if (currentQuestion + 1 >= window.words.length) {
                        // 全問正解で復習完了
                        levelUpOccurred = true; // 完了画面表示用のフラグ
                        showFeedback('復習完了！', '間違えた問題をすべてクリアしました！');
                    } else {
                        setTimeout(handleNextQuestion, 1500);
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

                        // 1. レベルを永続化
                        localStorage.setItem(LEVEL_STORAGE_KEY, currentLevel);
                        // 2. 効果音を再生
                        levelUpSound.play().catch(e => console.error("Audio play failed:", e));
                        // 3. フィードバックを表示
                        showFeedback(`レベルアップ！🎉 Level ${currentLevel}達成！`, `おめでとうございます！<br>次のレベルに進みます！`);
                    } else {
                        // レベルアップしない場合は、次の問題へ
                        setTimeout(handleNextQuestion, 1500);
                    }
                }
            } else {
                // --- 不正解の処理 (モード共通) ---
                $card.addClass('incorrect');
                playIncorrectSound();
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                if (!isReviewMode && !incorrectQuestions.some(q => q.word === window.words[currentQuestion].word)) {
                    incorrectQuestions.push(window.words[currentQuestion]);
                }
                const feedbackBody = `"${window.words[currentQuestion].word}" は <strong>"${correctAnswer}"</strong> です、<br>"${selectedAnswer}" ではありません！`;
                showFeedback('おっと！もう一度挑戦！😉', feedbackBody);
            }
        });

        $(document).on('click touchstart', '.vocab-icon', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const $icon = $(this);

            console.log('アイコンタップ検知');
            const word = $(this).data('word');
            console.log('タップされた単語:', word, 'speechEnabled:', window.speechEnabled, 'speechSynthesis:', !!window.speechSynthesis);

            $icon.addClass('speaking vocab-icon-spin');
            speakWord(word, {
                caller: 'vocab-icon',
                lang: 'en-GB',
                onEnd: () => $icon.removeClass('speaking vocab-icon-spin'),
                onError: () => {
                    $icon.removeClass('speaking vocab-icon-spin');
                }
            });
        });

        $(document).on('click touchstart', '.sound-icon', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const $icon = $(this);

            console.log('音声ボタンタップ');
            const word = $(this).data('word');
            console.log('タップされた単語:', word, 'speechEnabled:', window.speechEnabled, 'speechSynthesis:', !!window.speechSynthesis);

            $icon.addClass('speaking');
            speakWord(word, {
                caller: 'sound-icon',
                lang: 'en-GB',
                onEnd: () => $icon.removeClass('speaking'),
                onError: () => {
                    $icon.removeClass('speaking');
                }
            });
        });

        $(document).on('click', '#testSpeechButton', function(e) {
            e.preventDefault();
            console.log('音声テストボタンクリック');
            speakWord('Hello, welcome to the quiz', { caller: 'test-button', lang: 'en-GB' });
            showToast('音声テストを実行中: en-GB', 'info');
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
            console.log('モーダル閉じ検知');
            if (levelUpOccurred) {
                showCompletionScreen();
                levelUpOccurred = false; // フラグをリセット
            } else if ($('#quizContainer').find('#nextChallengeButton, #reviewButton').length === 0) {
                // クイズ完了画面が表示されていない場合のみ次の問題へ
                handleNextQuestion();
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
        // モーダルが既に表示されている場合は内容だけ更新
        if ($('#feedbackModal').hasClass('show')) return;
        $('#feedbackModal').modal('show');
    }

    $('#feedbackModal .btn-primary').on('click', function() {
        console.log('モーダルOKクリック');
        $('#feedbackModal').modal('hide');
    });

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

    $('#resetButton').on('click', function() {
        console.log('リセットボタンクリック');
        // localStorageからレベル情報を削除
        localStorage.removeItem(LEVEL_STORAGE_KEY);
        currentLevel = 1; // レベルをリセット
        incorrectQuestions = []; // 間違えた問題リストもリセット
        $('#levelText').text(`Level: ${currentLevel}`); // UIを更新
        startNewChallenge();
    });

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

    // ページ読み込み時にモーダルを表示
    startModal.show();

    // 「ゲームを始める」ボタンがクリックされたらクイズを開始
    startGameButton.on('click', function() {
        // データの読み込みとクイズの初期化
        loadData(function(data) {
            allWords = data; // 元のデータを保持
            window.words = [...allWords].sort(() => Math.random() - 0.5);
            console.log(`${window.words.length}語を読み込みました`);
            initializePage();
        });
    });
    console.log('quiz.js ロード完了');
});