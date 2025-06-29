window.isInitialized = false;

$(document).ready(function() {
    if (window.isInitialized) {
        console.log('quiz.js 既に初期化済み、スキップ');
        return;
    }
    window.isInitialized = true;
    console.log('quiz.js ロード開始');
    let currentQuestion = 0;
    let score = 0;
    let totalQuestions = 0;
    let currentLevel = 1;
    let hintUsed = false;
    const POINTS_FOR_LEVEL_UP = 20;

    function generateQuestion() {
        console.log(`クイズ生成開始: currentQuestion=${currentQuestion}, words.length=${window.words.length}`);
        if (window.words.length === 0) {
            console.warn('データがありません。デフォルトデータを使用。');
            showToast('データがありません。デフォルトデータを使います。', 'error');
            window.words = fallbackWords.sort(() => Math.random() - 0.5);
        }
        if (currentQuestion >= window.words.length) {
            console.log('クイズ終了');
            $('#quizContainer').html(`<h3 class="text-center">クイズが終わりました！最終スコア: ${score}/${totalQuestions} (Level ${currentLevel})</h3>`);
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
        const sameCategoryWords = window.words.filter(w => w.category === question.category && w.meaning !== question.meaning);
        while (wrongAnswers.length < 3 && sameCategoryWords.length > 0) {
            const randomIndex = Math.floor(Math.random() * sameCategoryWords.length);
            const randomWord = sameCategoryWords[randomIndex];
            if (!usedMeanings.has(randomWord.meaning)) {
                wrongAnswers.push(randomWord.ruby || randomWord.meaning);
                usedMeanings.add(randomWord.meaning);
                sameCategoryWords.splice(randomIndex, 1);
            }
        }
        while (wrongAnswers.length < 3 && window.words.length > 1) {
            const randomWord = window.words[Math.floor(Math.random() * window.words.length)];
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
                <div id="hint-area" style="visibility: hidden; min-height: 7rem;">
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
            $('#hint-area').css('visibility', 'visible');
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

            if (selectedAnswer === correctAnswer) {
                const points = hintUsed ? 1 : 2;
                score += points;
                $card.addClass('correct');
                playCorrectSound();
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                if (score >= POINTS_FOR_LEVEL_UP) {
                    currentLevel++;
                    updateProgress();
                    showFeedback(`レベルアップ！🎉 Level ${currentLevel}達成！`, `おめでとうございます！<br>${POINTS_FOR_LEVEL_UP}点獲得でクイズクリアです！`);
                    $('#quizContainer').html(`
                        <div class="text-center mt-5">
                            <h3 class="mb-3">🎉 クイズクリア 🎉</h3>
                            <p class="lead">Level ${currentLevel} になりました！</p>
                            <button id="nextChallengeButton" class="btn btn-success mt-3">
                                <i class="fas fa-arrow-right me-2"></i>次に挑戦！
                            </button>
                        </div>
                    `);
                } else {
                    showToast(`正解！ +${points}点`, 'success');
                    setTimeout(handleNextQuestion, 1500); // 1.5秒後に自動で次の問題へ
                }
            } else {
                $card.addClass('incorrect');
                playIncorrectSound();
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                showFeedback('おっと！もう一度挑戦！😉', `"${window.words[currentQuestion].word}" は "${correctAnswer}" です、"${selectedAnswer}" ではありません！`);
            }

            updateProgress();
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

        $('#feedbackModal').on('hidden.bs.modal', function() {
            console.log('モーダル閉じ検知');
            $('#nextQuestionContainer').show();
            document.activeElement.blur();
        });
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

    function handleNextQuestion() {
        currentQuestion++;
        generateQuestion();
    }

    function updateProgress() {
        const progress = Math.min((score / POINTS_FOR_LEVEL_UP) * 100, 100);
        $('#progressBar').css('width', progress + '%').attr('aria-valuenow', progress);
        $('#scoreText').text(`スコア: ${score} / ${POINTS_FOR_LEVEL_UP} (Level ${currentLevel})`);
    }

    function startNewChallenge() {
        console.log('新しい挑戦を開始します');
        if (!window.audioContext) initAudioContext();
        currentQuestion = 0;
        score = 0;
        window.words.sort(() => Math.random() - 0.5);
        updateProgress();
        generateQuestion();
    }

    $('#resetButton').on('click', function() {
        console.log('リセットボタンクリック');
        currentLevel = 1; // レベルをリセット
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
        bindEvents();
    }

    loadData(function(data) {
        window.words = data.sort(() => Math.random() - 0.5);
        console.log(`${window.words.length}語を読み込みました`);
        initializePage();
    });
    console.log('quiz.js ロード完了');
});