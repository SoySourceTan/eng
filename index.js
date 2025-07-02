$(document).ready(function() {
    const learnedWordsKey = 'learnedWords';
    const learnedPhrasesKey = 'learnedPhrases';

    function getLearnedItems(key) {
        return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
    }

    function setLearnedItems(key, learnedSet) {
        localStorage.setItem(key, JSON.stringify(Array.from(learnedSet)));
    }

    function bindCardEvents(dataAttribute = 'word') {
        // カード全体をクリックまたはタップした時に音声を再生
        $('#cardContainer').off('click', '.vocab-card').on('click', '.vocab-card', function(e) {
            // クリックされたのがチェックボックス自身なら、何もしない（チェックボックスの動作を優先）
            if ($(e.target).is('.learned-checkbox')) {
                return;
            }

            e.preventDefault();

            const $card = $(this);
            const $icon = $card.find('.vocab-icon');

            const textToSpeak = $(this).data(dataAttribute);
            const audioFile = $(this).data('audio-file'); // 音声ファイルパスを取得

            if (!textToSpeak) {
                console.error('単語データが見つかりません', this);
                return;
            }
            console.log(`音声アイコンクリック: ${textToSpeak}`);

            $icon.addClass('speaking vocab-icon-spin');

            speakWord(textToSpeak, {
                audioFile: audioFile, // 音声ファイルパスを渡す
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
        const learnedWords = getLearnedItems(learnedWordsKey);

        for (const category of sortedCategories) {
            const wordsInCategory = groupedByCategory[category];
            const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
            const sectionHtml = `
            <section id="category-${category}" class="mb-4">
                <h2 class="category-title h4"><span class="iconify me-2" data-icon="${(window.defaultIcons && defaultIcons[category]) || 'mdi:help-circle-outline'}"></span>${categoryTitle}</h2>
                    <div class="row row-cols-2 row-cols-sm-3 row-cols-lg-4 g-3">
                        ${wordsInCategory.map(word => {
                            const isLearned = learnedWords.has(word.word);
                            const icon = word.icon || (window.defaultIcons && defaultIcons[word.category]) || 'mdi:help-circle-outline';
                        const iconStyle = word.color ? `color: ${word.color};` : '';
                            return `
                                <div class="col">
                                    <div class="card vocab-card h-100 ${word.background || 'bg-light'} ${isLearned ? 'learned' : ''}" data-word="${word.word}" data-audio-file="${word.audio_file || ''}">
                                        <input type="checkbox" class="form-check-input learned-checkbox" ${isLearned ? 'checked' : ''} title="学習済みとしてマーク">
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

    function renderPhrasalVerbCards(groupedByPhraseCategory) {
        const $cardContainer = $('#cardContainer');
        $cardContainer.empty();

        const sortedCategories = Object.keys(groupedByPhraseCategory).sort();
        const learnedPhrases = getLearnedItems(learnedPhrasesKey); // 句動詞もフレーズと同じキーで管理

        for (const category of sortedCategories) {
            const phrasesInCategory = groupedByPhraseCategory[category];
            const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
            const sectionHtml = `
            <section id="category-${category}" class="mb-4">
                <h2 class="category-title h4"><span class="iconify me-2" data-icon="${(window.defaultIcons && defaultIcons[category]) || 'mdi:help-circle-outline'}"></span>${categoryTitle}</h2>
                <div class="row row-cols-1 row-cols-md-2 g-3">
                    ${phrasesInCategory.map(phrase => {
                        const isLearned = learnedPhrases.has(phrase.phrase_en);
                        return `
                        <div class="col">
                            <div class="card vocab-card h-100 ${isLearned ? 'learned' : ''}" data-phrase_en="${phrase.phrase_en}" data-audio-file="${phrase.audio_file || ''}">
                                <input type="checkbox" class="form-check-input learned-checkbox" ${isLearned ? 'checked' : ''} title="学習済みとしてマーク">
                                <div class="card-body p-3">
                                    <p class="card-title fw-bold mb-1">${phrase.phrase_en}</p>
                                    <p class="card-text small text-muted mb-2">${phrase.phrase_ja}</p>
                                    ${phrase.example_en ? `<p class="card-text small mt-2 mb-0"><strong class="text-primary">e.g.</strong> <em>${phrase.example_en}</em><br><span class="text-muted">${phrase.example_ja}</span></p>` : ''}
                                    ${phrase.situation ? `<p class="card-text small text-info fst-italic mt-2 mb-0"><i class="fas fa-info-circle me-1"></i>${phrase.situation}</p>` : ''}
                                </div>
                            </div>
                        </div>`;}).join('')}
                </div>
            </section>`;
            $cardContainer.append(sectionHtml);
        }
    }

    function renderPhraseCards(groupedByPhraseCategory) {
        const $cardContainer = $('#cardContainer');
        $cardContainer.empty();

        const sortedCategories = Object.keys(groupedByPhraseCategory).sort();
        const learnedPhrases = getLearnedItems(learnedPhrasesKey);

        for (const category of sortedCategories) {
            const phrasesInCategory = groupedByPhraseCategory[category];
            const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
            const sectionHtml = `
            <section id="category-${category}" class="mb-4">
                <h2 class="category-title h4"><span class="iconify me-2" data-icon="${(window.defaultIcons && defaultIcons[category]) || 'mdi:help-circle-outline'}"></span>${categoryTitle}</h2>
                <div class="row row-cols-1 row-cols-md-2 g-3">
                    ${phrasesInCategory.map(phrase => {
                        const isLearned = learnedPhrases.has(phrase.phrase_en);
                        return `
                        <div class="col">
                            <div class="card vocab-card h-100 ${isLearned ? 'learned' : ''}" data-phrase_en="${phrase.phrase_en}" data-audio-file="${phrase.audio_file || ''}">
                                <input type="checkbox" class="form-check-input learned-checkbox" ${isLearned ? 'checked' : ''} title="学習済みとしてマーク">
                                <div class="card-body p-3">
                                    <p class="card-title fw-bold mb-1">${phrase.phrase_en}</p>
                                    <p class="card-text small text-muted mb-2">${phrase.phrase_ja}</p>
                                    ${phrase.situation ? `<p class="card-text small text-info fst-italic mb-0"><i class="fas fa-info-circle me-1"></i>${phrase.situation}</p>` : ''}
                                </div>
                            </div>
                        </div>`;}).join('')}
                </div>
            </section>`;
            $cardContainer.append(sectionHtml);
        }
    }

    function renderCategoryNav(groupedByCategory) {
        const $mobileNav = $('#categoryNavContainer');
        const $desktopNav = $('#desktopCategoryNavContainer');

        const categories = Object.keys(groupedByCategory).sort();

        // Clear both containers
        $mobileNav.empty();
        $desktopNav.empty();

        let mobileNavHtml = '';
        let desktopNavHtml = '';

        for (const category of categories) {
            const icon = (window.defaultIcons && defaultIcons[category]) || 'mdi:help-circle-outline';
            const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');

            // Mobile version (icon only)
            mobileNavHtml += `
                <a href="#category-${category}" class="category-nav-link" title="${categoryTitle}">
                    <span class="iconify" data-icon="${icon}"></span>
                </a>`;

            // Desktop version (icon + text)
            desktopNavHtml += `
                <a href="#category-${category}" class="btn btn-outline-secondary btn-sm me-2 mb-2 category-nav-link-desktop">
                    <span class="iconify" data-icon="${icon}"></span>
                    ${categoryTitle}
                </a>`;
        }

        $mobileNav.html(mobileNavHtml);
        $desktopNav.html(desktopNavHtml);
    }

    function bindNavEvents() {
        // Combine event handlers for both mobile and desktop navs
        $('body').on('click', 'a.category-nav-link, a.category-nav-link-desktop', function(e) {
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

    function bindCheckboxEvents() {
        $('#cardContainer').on('change', '.learned-checkbox', function(e) {
            e.stopPropagation(); // カードクリックイベントの発火を防ぐ
            const $checkbox = $(this);
            const $card = $checkbox.closest('.vocab-card');
            const isChecked = $checkbox.is(':checked');

            const word = $card.data('word');
            const phrase = $card.data('phrase_en');

            if (word) {
                const learnedItems = getLearnedItems(learnedWordsKey);
                isChecked ? learnedItems.add(word) : learnedItems.delete(word);
                setLearnedItems(learnedWordsKey, learnedItems);
            } else if (phrase) {
                const learnedItems = getLearnedItems(learnedPhrasesKey);
                isChecked ? learnedItems.add(phrase) : learnedItems.delete(phrase);
                setLearnedItems(learnedPhrasesKey, learnedItems);
            }

            if (isChecked) {
                $card.addClass('learned');
            } else {
                $card.removeClass('learned');
            }
        });
    }

    let wordsData = [];
    let phrasesData = [];
    let phrasalVerbsData = [];

    function switchMode(mode) {
        console.log(`Switching to mode: ${mode}`);
        let dataToShow, renderFunction, cardDataAttribute;

        switch (mode) {
            case 'phrases':
                dataToShow = phrasesData;
                renderFunction = renderPhraseCards;
                cardDataAttribute = 'phrase_en';
                break;
            case 'phrasal_verbs':
                dataToShow = phrasalVerbsData;
                renderFunction = renderPhrasalVerbCards;
                cardDataAttribute = 'phrase_en';
                break;
            case 'words':
            default:
                dataToShow = wordsData;
                renderFunction = renderCategorizedCards;
                cardDataAttribute = 'word';
                break;
        }

        const groupedData = groupDataByCategory(dataToShow);
        renderFunction(groupedData);
        renderCategoryNav(groupedData);
        bindCardEvents(cardDataAttribute);
        Iconify.scan();
    }

    $('input[name="mode-toggle"]').on('change', function() {
        const selectedId = this.id;
        let selectedMode = 'words'; // default
        if (selectedId.includes('phrases')) selectedMode = 'phrases';
        if (selectedId.includes('phrasal-verbs')) selectedMode = 'phrasal_verbs';

        // モバイル用とデスクトップ用の両方のボタンの状態を同期させる
        $(`input[id*="${selectedMode}"]`).prop('checked', true);

        switchMode(selectedMode);
    });

    // 両方のJSONファイルを読み込む
    Promise.all([
        fetch(`words-audio.json?v=${new Date().getTime()}`).then(res => res.json()),
        fetch(`phrase_with_audio.json?v=${new Date().getTime()}`).then(res => res.json()),
        fetch(`phrasal_verbs_with_audio.json?v=${new Date().getTime()}`).then(res => res.json())
    ]).then(([words, phrases, phrasalVerbs]) => {
        console.log('単語、フレーズ、句動詞のデータ読み込み成功');
        wordsData = words;
        phrasesData = phrases;
        phrasalVerbsData = phrasalVerbs;
        switchMode('words'); // 初期表示は単語モード
        bindNavEvents();
        bindCheckboxEvents();
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