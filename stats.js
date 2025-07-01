$(document).ready(function() {
    const STATS_STORAGE_KEY = 'vocabQuizStats';
    const $container = $('#stats-container');

    function renderStats() {
        const statsData = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY));

        if (!statsData || !statsData.wordStats || Object.keys(statsData.wordStats).length === 0) {
            $container.html('<p class="text-center text-muted">まだ学習記録はありません。<br>単語クイズをプレイして、あなたの学習記録を作りましょう！</p>');
            return;
        }

        // 1. Overall Stats
        const totalQuestions = statsData.totalQuestions || 0;
        const totalCorrect = statsData.totalCorrect || 0;
        const overallAccuracy = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0;
        const learnedWordsCount = Object.keys(statsData.wordStats).length;

        const overallHtml = `
            <div class="row text-center mb-4 g-3">
                <div class="col-md-4">
                    <div class="card bg-light h-100">
                        <div class="card-body">
                            <h5 class="card-title small text-muted">学習単語数</h5>
                            <p class="card-text display-6 fw-bold">${learnedWordsCount}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-light h-100">
                        <div class="card-body">
                            <h5 class="card-title small text-muted">総回答数</h5>
                            <p class="card-text display-6 fw-bold">${totalQuestions}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-light h-100">
                        <div class="card-body">
                            <h5 class="card-title small text-muted">全体の正解率</h5>
                            <p class="card-text display-6 fw-bold">${overallAccuracy}<small class="fs-5">%</small></p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 2. Detailed Word Stats Table
        const wordStatsArray = Object.entries(statsData.wordStats).map(([word, stats]) => {
            const attempts = stats.correct + stats.incorrect;
            const accuracy = attempts > 0 ? (stats.correct / attempts) * 100 : 0;
            // 不正解数が多い順、同じ場合は挑戦回数が多い順でソート
            return { word, ...stats, attempts, accuracy };
        });

        wordStatsArray.sort((a, b) => b.incorrect - a.incorrect || b.attempts - a.attempts);

        const tableHtml = `
            <h4 class="mt-5 mb-3">単語ごとの成績</h4>
            <div class="table-responsive">
                <table class="table table-striped table-hover small">
                    <thead class="table-dark">
                        <tr>
                            <th>単語</th>
                            <th class="text-center">正解</th>
                            <th class="text-center">不正解</th>
                            <th class="text-center">正解率</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${wordStatsArray.map(stat => `
                            <tr>
                                <td class="fw-bold">${stat.word}</td>
                                <td class="text-center text-success">${stat.correct}</td>
                                <td class="text-center text-danger">${stat.incorrect}</td>
                                <td class="text-center">${stat.accuracy.toFixed(0)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        $container.html(overallHtml + tableHtml);
    }

    renderStats();
});