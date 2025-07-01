$(document).ready(function() {
    const LEARNING_STATS_KEY = 'learningStats'; // 共通キーを定義
    const $tabContent = $('#statsTabContent');
    const $statsTab = $('#statsTab');

    /**
     * Generates the HTML for a single quiz's statistics.
     * @param {object} quizStats - The statistics object for one quiz type.
     * @param {string} quizName - The display name of the quiz (e.g., '単語', 'フレーズ').
     * @returns {string} The HTML content for the tab pane.
     */
    function generateQuizStatHtml(quizStats, quizName) {
        if (!quizStats || !quizStats.itemStats || Object.keys(quizStats.itemStats).length === 0) {
            return `<div class="text-center p-5"><p class="text-muted">このクイズの学習記録はまだありません。</p></div>`;
        }

        // 1. Summary Stats
        const totalQuestions = quizStats.totalQuestions || 0;
        const totalCorrect = quizStats.totalCorrect || 0;
        const overallAccuracy = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0;
        const learnedItemsCount = Object.keys(quizStats.itemStats).length;

        const summaryHtml = `
            <div class="row text-center mb-4 g-3">
                <div class="col-md-4">
                    <div class="card bg-light h-100">
                        <div class="card-body">
                            <h5 class="card-title small text-muted">学習した${quizName}数</h5>
                            <p class="card-text display-6 fw-bold">${learnedItemsCount}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-light h-100">
                        <div class="card-body">
                            <h5 class="card-title small text-muted">総回答回数</h5>
                            <p class="card-text display-6 fw-bold">${totalQuestions}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-light h-100">
                        <div class="card-body">
                            <h5 class="card-title small text-muted">正解率</h5>
                            <p class="card-text display-6 fw-bold">${overallAccuracy}<small class="fs-5">%</small></p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 2. Category Stats Table
        const categoryStats = {};
        Object.values(quizStats.itemStats).forEach(stat => {
            const category = stat.category || 'unknown';
            if (!categoryStats[category]) {
                categoryStats[category] = { correct: 0, incorrect: 0 };
            }
            categoryStats[category].correct += stat.correct;
            categoryStats[category].incorrect += stat.incorrect;
        });

        const categoryStatsArray = Object.entries(categoryStats).map(([category, stats]) => {
            const attempts = stats.correct + stats.incorrect;
            const accuracy = attempts > 0 ? (stats.correct / attempts) * 100 : 0;
            const displayName = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
            return { category: displayName, ...stats, attempts, accuracy };
        });

        // Sort by lowest accuracy
        categoryStatsArray.sort((a, b) => a.accuracy - b.accuracy);

        const categoryTableHtml = `
            <h4 class="mt-5 mb-3">カテゴリごとの正解率</h4>
            <div class="table-responsive">
                <table class="table table-sm table-borderless">
                    <tbody>
                        ${categoryStatsArray.map(stat => `
                            <tr>
                                <td class="fw-bold" style="width: 30%;">${stat.category}</td>
                                <td><div class="progress" style="height: 20px;"><div class="progress-bar" role="progressbar" style="width: ${stat.accuracy.toFixed(0)}%;" aria-valuenow="${stat.accuracy.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">${stat.accuracy.toFixed(0)}%</div></div></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;

        // 3. Detailed Item Stats Table
        const itemStatsArray = Object.entries(quizStats.itemStats).map(([item, stats]) => {
            const attempts = stats.correct + stats.incorrect;
            const accuracy = attempts > 0 ? (stats.correct / attempts) * 100 : 0;
            return { item, ...stats, attempts, accuracy };
        });

        // Sort by: most incorrect > most attempts > lowest accuracy
        itemStatsArray.sort((a, b) => {
            if (b.incorrect !== a.incorrect) return b.incorrect - a.incorrect;
            if (b.attempts !== a.attempts) return b.attempts - a.attempts;
            return a.accuracy - b.accuracy;
        });

        const tableHtml = `
            <h4 class="mt-5 mb-3">${quizName}ごとの成績</h4>
            <div class="table-responsive">
                <table class="table table-striped table-hover small">
                    <thead class="table-dark">
                        <tr>
                            <th>${quizName}</th>
                            <th class="text-center">正解</th>
                            <th class="text-center">不正解</th>
                            <th class="text-center">挑戦回数</th>
                            <th class="text-center">正解率</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemStatsArray.map(stat => `
                            <tr>
                                <td class="fw-bold">${stat.item}</td>
                                <td class="text-center text-success">${stat.correct}</td>
                                <td class="text-center text-danger">${stat.incorrect}</td>
                                <td class="text-center">${stat.attempts}</td>
                                <td class="text-center">${stat.accuracy.toFixed(0)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        return summaryHtml + categoryTableHtml + tableHtml;
    }

    /**
     * Renders all statistics into the tabbed interface.
     */
    function renderAllStats() {
        const allStats = JSON.parse(localStorage.getItem(LEARNING_STATS_KEY)) || {};

        if (Object.keys(allStats).length === 0) {
            $statsTab.hide();
            $tabContent.html('<div class="text-center p-5"><p class="text-muted">まだ学習記録はありません。<br>いずれかのクイズをプレイして、あなたの学習記録を作りましょう！</p></div>');
            return;
        }

        const wordStatsHtml = generateQuizStatHtml(allStats.wordQuiz, '単語');
        const phraseStatsHtml = generateQuizStatHtml(allStats.phraseQuiz, 'フレーズ');
        const phrasalVerbStatsHtml = generateQuizStatHtml(allStats.phrasalVerbQuiz, '句動詞');

        $tabContent.html(`
            <div class="tab-pane fade show active" id="word-stats-pane" role="tabpanel" aria-labelledby="word-stats-tab">${wordStatsHtml}</div>
            <div class="tab-pane fade" id="phrase-stats-pane" role="tabpanel" aria-labelledby="phrase-stats-tab">${phraseStatsHtml}</div>
            <div class="tab-pane fade" id="phrasal-verb-stats-pane" role="tabpanel" aria-labelledby="phrasal-verb-stats-tab">${phrasalVerbStatsHtml}</div>
        `);
    }

    // Initial render
    renderAllStats();
});