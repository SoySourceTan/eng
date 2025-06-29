$(document).ready(function() {
    function bindCardEvents(dataAttribute = 'word') {
        // カード全体をクリックまたはタップした時に音声を再生
        $('#cardContainer').on('click', '.vocab-card', function(e) {
            e.preventDefault();

            const $card = $(this);
            const $icon = $card.find('.vocab-icon');

            const word = $(this).data(dataAttribute);
            if (!word) {
                console.error('単語データが見つかりません', this);
                return;
            }
            console.log(`音声アイコンクリック: ${word}`);

            $icon.addClass('speaking vocab-icon-spin');

            speakWord(word, {
                caller: 'index-sound-icon',
                onEnd: () => $icon.removeClass('speaking vocab-icon-spin'),
                onError: () => $icon.removeClass('speaking vocab-icon-spin')
            });
        });

    }

    function groupDataByCategory(dataArray) {
        return dataArray.reduce((acc, item) => {
            const category = item.category || 'other';
            if (!acc[category]) acc[category] = [];
            acc[category].push(item);
            return acc;
        }, {});
    }

    function renderCategorizedCards(groupedByCategory) {
        const $cardContainer = $('#cardContainer');
        $cardContainer.empty();

        const sortedCategories = Object.keys(groupedByCategory).sort();

        for (const category of sortedCategories) {
            const wordsInCategory = groupedByCategory[category];
            const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
            const sectionHtml = `
            <section id="category-${category}" class="mb-4">
                <h2 class="category-title h4"><span class="iconify me-2" data-icon="${(window.defaultIcons && defaultIcons[category]) || 'mdi:help-circle-outline'}"></span>${categoryTitle}</h2>
                    <div class="row row-cols-2 row-cols-sm-3 row-cols-lg-4 g-3">
                        ${wordsInCategory.map(word => {
                            const icon = word.icon || (window.defaultIcons && defaultIcons[word.category]) || 'mdi:help-circle-outline';
                        const iconStyle = word.color ? `color: ${word.color};` : '';
                            return `
                                <div class="col">
                                    <div class="card vocab-card h-100 ${word.background || 'bg-light'}" data-word="${word.word}">
                                    <div class="card-body text-center p-2 d-flex flex-column justify-content-center">
                                        <span class="vocab-icon iconify" data-icon="${icon}" style="${iconStyle}"></span>
                                        <h6 class="card-title fw-bold mt-2 mb-1">${word.word}</h6>
                                        <p class="card-text small mb-0">${word.ruby || word.meaning}</p>
                                        </div>
                                    </div>
                                </div>`;
                        }).join('')}
                    </div>
                </section>`;
            $cardContainer.append(sectionHtml);
        }
    }

    function renderPhraseCards(groupedByPhraseCategory) {
        const $cardContainer = $('#cardContainer');
        $cardContainer.empty();

        const sortedCategories = Object.keys(groupedByPhraseCategory).sort();

        for (const category of sortedCategories) {
            const phrasesInCategory = groupedByPhraseCategory[category];
            const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
            const sectionHtml = `
            <section id="category-${category}" class="mb-4">
                <h2 class="category-title h4"><span class="iconify me-2" data-icon="${(window.defaultIcons && defaultIcons[category]) || 'mdi:help-circle-outline'}"></span>${categoryTitle}</h2>
                <div class="row row-cols-1 row-cols-md-2 g-3">
                    ${phrasesInCategory.map(phrase => `
                        <div class="col">
                            <div class="card vocab-card h-100" data-phrase_en="${phrase.phrase_en}">
                                <div class="card-body p-3">
                                    <p class="card-title fw-bold mb-1">${phrase.phrase_en}</p>
                                    <p class="card-text small text-muted mb-2">${phrase.phrase_ja}</p>
                                    ${phrase.situation ? `<p class="card-text small text-info fst-italic mb-0"><i class="fas fa-info-circle me-1"></i>${phrase.situation}</p>` : ''}
                                </div>
                            </div>
                        </div>`).join('')}
                </div>
            </section>`;
            $cardContainer.append(sectionHtml);
        }
    }

    function renderCategoryNav(groupedByCategory) {
        const $navContainer = $('#categoryNavContainer');
        if (!$navContainer.length) return;

        const categories = Object.keys(groupedByCategory).sort();
        $navContainer.empty();
        for (const category of categories) {
            const icon = (window.defaultIcons && defaultIcons[category]) || 'mdi:help-circle-outline';
            const navLinkHtml = `
                <a href="#category-${category}" class="category-nav-link" title="${category}">
                    <span class="iconify" data-icon="${icon}"></span>
                </a>`;
            $navContainer.append(navLinkHtml);
        }
    }

    function bindNavEvents() {
        $('#categoryNavContainer').on('click', 'a.category-nav-link', function(e) {
            e.preventDefault();
            const targetId = $(this).attr('href');
            const $target = $(targetId);
            if ($target.length) {
                const navHeight = $('.navbar').outerHeight() || 0;
                $('html, body').animate({
                    scrollTop: $target.offset().top - navHeight - 15
                }, 300);
            }
        });
    }

    let wordsData = [];
    let phrasesData = [];

    function switchMode(mode) {
        if (mode === 'words') {
            const groupedData = groupDataByCategory(wordsData);
            renderCategorizedCards(groupedData);
            renderCategoryNav(groupedData);
            bindCardEvents('word');
        } else { // mode === 'phrases'
            const groupedData = groupDataByCategory(phrasesData);
            renderPhraseCards(groupedData);
            // フレーズモードでも同じカテゴリナビを再利用
            renderCategoryNav(groupedData);
            bindCardEvents('phrase_en');
        }
        Iconify.scan();
    }

    $('input[name="mode-toggle"]').on('change', function() {
        const selectedMode = this.id === 'mode-words' ? 'words' : 'phrases';
        switchMode(selectedMode);
    });

    // 両方のJSONファイルを読み込む
    Promise.all([
        fetch(`kidswords.json?v=${new Date().getTime()}`).then(res => res.json()),
        fetch(`phrase.json?v=${new Date().getTime()}`).then(res => res.json())
    ]).then(([words, phrases]) => {
        console.log('単語とフレーズのデータ読み込み成功');
        wordsData = words;
        phrasesData = phrases;
        switchMode('words'); // 初期表示は単語モード
        bindNavEvents();
    }).catch(error => {
        console.error("データ読み込みエラー:", error);
        $('#cardContainer').html('<p class="text-center text-danger">データの読み込みに失敗しました。</p>');
    });

    // --- Back to top button logic ---
    const backToTopButton = $('.back-to-top');

    $(window).on('scroll', function() {
        if ($(this).scrollTop() > 200) {
            backToTopButton.fadeIn();
        } else {
            backToTopButton.fadeOut();
        }
    });

    backToTopButton.on('click', function(e) {
        e.preventDefault();
        $('html, body').animate({ scrollTop: 0 }, 300);
    });
});