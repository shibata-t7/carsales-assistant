// トヨタセールスAIアシスタント JavaScript

// DOM 読み込み完了後に実行
document.addEventListener('DOMContentLoaded', function() {
    // 初期設定
    initApp();
    setupEventListeners();
    loadApiSettings();
});

// グローバル変数
let currentProposals = {
    proposal_1: null,
    proposal_2: null,
    selected: 'proposal_1'
};
let currentCustomerData = null;
let currentSalesTalk = null;

// 提案別Q&A履歴
let qaHistory = {
    proposal_1: [],
    proposal_2: []
};

/**
 * アプリケーションの初期設定
 */
function initApp() {
    // アコーディオン初期化
    initAccordions();
}

/**
 * イベントリスナーのセットアップ
 */
function setupEventListeners() {
    // ナビゲーションタブ切り替え
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            changeTab(this.getAttribute('data-tab'));
        });
    });
    
    // 設定ボタン（管理者用）
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
            toggleModal('settings-modal', true);
        });
    }
    
    // ユーザー名クリック（一般ユーザー用）
    const userName = document.getElementById('user-name');
    if (userName && !settingsBtn) { // 設定ボタンがない場合（一般ユーザー）
        userName.addEventListener('click', function() {
            toggleModal('settings-restricted-modal', true);
        });
    }
    
    // モーダルを閉じるボタン
    const closeModalBtns = document.querySelectorAll('.close-modal-btn');
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.closest('.modal').id;
            toggleModal(modalId, false);
        });
    });
    
    // 通知を閉じるボタン
    const notificationCloseBtn = document.querySelector('.notification-close');
    if (notificationCloseBtn) {
        notificationCloseBtn.addEventListener('click', function() {
            document.getElementById('notification').classList.add('hidden');
        });
    }
    
    // 提案内容生成ボタン
    const generateProposalBtn = document.getElementById('generate-proposal-btn');
    if (generateProposalBtn) {
        generateProposalBtn.addEventListener('click', handleGenerateProposal);
    }
    
    // セールストーク生成ボタン
    const generateSalesTalkBtn = document.getElementById('generate-salestalk-btn');
    if (generateSalesTalkBtn) {
        generateSalesTalkBtn.addEventListener('click', handleGenerateSalesTalk);
    }
    
    // ロールプレイセールストーク生成ボタン
    const generateRoleplayBtn = document.getElementById('generate-roleplay-btn');
    if (generateRoleplayBtn) {
        generateRoleplayBtn.addEventListener('click', handleGenerateRoleplaySalesTalk);
    }
    
    // 履歴に保存ボタン
    const saveProposalBtn = document.getElementById('save-proposal-btn');
    if (saveProposalBtn) {
        saveProposalBtn.addEventListener('click', handleSaveProposal);
    }
    
    // 履歴に保存ボタン（ロールプレイ画面）
    const saveHistoryBtn = document.getElementById('save-history-btn');
    if (saveHistoryBtn) {
        saveHistoryBtn.addEventListener('click', handleSaveProposal);
    }
    
    // 提案画面に戻るボタン
    const backToProposalBtn = document.getElementById('back-to-proposal-btn');
    if (backToProposalBtn) {
        backToProposalBtn.addEventListener('click', function() {
            changeTab('proposal');
        });
    }
    
    // セールス役ロールプレイボタン
    const salesRoleBtn = document.getElementById('sales-role-btn');
    if (salesRoleBtn) {
        salesRoleBtn.addEventListener('click', async function() {
            try {
                const response = await fetch('/api/settings');
                const settings = await response.json();
                
                if (!settings.sales_role_url || settings.sales_role_url.trim() === '') {
                    showNotification('セールス役URLが設定されていません。管理者にURL設定を依頼してください。', 'warning');
                    return;
                }
                
                window.open(settings.sales_role_url, '_blank');
            } catch (error) {
                console.error('設定取得エラー:', error);
                showNotification('設定の取得に失敗しました。', 'error');
            }
        });
    }
    
    // 顧客役ロールプレイボタン
    const customerRoleBtn = document.getElementById('customer-role-btn');
    if (customerRoleBtn) {
        customerRoleBtn.addEventListener('click', async function() {
            try {
                const response = await fetch('/api/settings');
                const settings = await response.json();
                
                if (!settings.customer_role_url || settings.customer_role_url.trim() === '') {
                    showNotification('顧客役URLが設定されていません。管理者にURL設定を依頼してください。', 'warning');
                    return;
                }
                
                window.open(settings.customer_role_url, '_blank');
            } catch (error) {
                console.error('設定取得エラー:', error);
                showNotification('設定の取得に失敗しました。', 'error');
            }
        });
    }
    
    // 質問送信ボタン
    const qaSubmitBtn = document.getElementById('qa-submit');
    if (qaSubmitBtn) {
        qaSubmitBtn.addEventListener('click', handleAskQuestion);
    }
    
    // セールストークコピーボタン
    const copySalesTalkBtn = document.getElementById('copy-sales-talk');
    if (copySalesTalkBtn) {
        copySalesTalkBtn.addEventListener('click', function() {
            const salesTalkContent = document.getElementById('salestalk-content');
            const textToCopy = salesTalkContent.innerText;
            
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    showNotification('セールストークをクリップボードにコピーしました', 'success');
                })
                .catch(err => {
                    showNotification('コピーに失敗しました', 'error');
                });
        });
    }
    
    // 履歴検索ボタン
    const historySearchBtn = document.getElementById('history-search-btn');
    if (historySearchBtn) {
        historySearchBtn.addEventListener('click', function() {
            loadHistoryData(1);
        });
    }
    
    // 履歴エクスポートボタン
    const historyExportBtn = document.getElementById('history-export-btn');
    if (historyExportBtn) {
        historyExportBtn.addEventListener('click', function() {
            const customerName = document.getElementById('history-search').value;
            const period = document.getElementById('history-period').value;
            
            const params = new URLSearchParams();
            if (customerName) params.append('customer_name', customerName);
            if (period) params.append('period', period);
            
            window.location.href = `/api/export-history?${params.toString()}`;
        });
    }
    
    // API設定フォーム送信
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', handleSaveApiSettings);
    }
    
    // API接続テストボタン
    const testConnectionBtn = document.getElementById('test-connection-btn');
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', handleTestApiConnection);
    }
    
    // パスワード表示切替ボタン
    const togglePasswordBtns = document.querySelectorAll('.toggle-password-btn');
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                this.querySelector('i').classList.remove('fa-eye');
                this.querySelector('i').classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                this.querySelector('i').classList.remove('fa-eye-slash');
                this.querySelector('i').classList.add('fa-eye');
            }
        });
    });
    
    // 履歴詳細を閉じるボタン
    const closeDetailBtn = document.querySelector('.close-detail-btn');
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', function() {
            document.getElementById('history-detail-card').classList.add('hidden');
        });
    }
    
    // すべてのFAQを表示するボタン
    const showAllQaBtn = document.getElementById('show-all-qa');
    if (showAllQaBtn) {
        showAllQaBtn.addEventListener('click', function() {
            const faqHeaders = document.querySelectorAll('.qa-accordion-header');
            faqHeaders.forEach(header => {
                if (!header.classList.contains('active')) {
                    // 直接クリックイベントを発火させて、イベントリスナーに処理を任せる
                    header.click();
                }
            });
        });
    }
    
    // 履歴ページが表示されたら、履歴データをロード
    const historyNavItem = document.querySelector('.nav-item[data-tab="history"]');
    if (historyNavItem) {
        historyNavItem.addEventListener('click', function() {
            loadHistoryData(1);
        });
    }
    
    // 提案内容コピーボタン
    const copyProposalBtn = document.getElementById('copy-proposal-btn');
    if (copyProposalBtn) {
        copyProposalBtn.addEventListener('click', copyProposalAsMarkdown);
    }
    
    // 顧客サマリーコピーボタン
    const copyCustomerSummaryBtn = document.getElementById('copy-customer-summary-btn');
    if (copyCustomerSummaryBtn) {
        copyCustomerSummaryBtn.addEventListener('click', copyCustomerSummary);
    }
    
    
    // テキスト整形ボタン
    const formatTextBtn = document.getElementById('format-text-btn');
    if (formatTextBtn) {
        formatTextBtn.addEventListener('click', handleFormatText);
    }
    
    // デュアル提案タブ制御の設定
    setupDualProposalTabs();
    
    // FAQ・Q&A提案選択タブ制御の設定
    setupFaqProposalTabs();
    setupQaProposalTabs();
}

/**
 * デュアル提案タブ制御の設定
 */
function setupDualProposalTabs() {
    // 各提案のタブ制御を独立して設定
    ['1', '2'].forEach(suffix => {
        const tabs = document.querySelectorAll(`#proposal-tabs-${suffix} .proposal-tab`);
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                handleProposalTabSwitch(suffix, targetTab);
            });
        });
    });
}

/**
 * 提案タブ切り替え処理
 * @param {string} proposalSuffix - 提案番号（'1' または '2'）
 * @param {string} targetTab - 切り替え先タブID
 */
function handleProposalTabSwitch(proposalSuffix, targetTab) {
    // 該当提案のタブとコンテンツを取得
    const tabs = document.querySelectorAll(`#proposal-tabs-${proposalSuffix} .proposal-tab`);
    const contents = document.querySelectorAll(`#tab-content-${proposalSuffix} .proposal-tab-content`);
    
    // 全てのタブから active クラスを削除
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    // 選択されたタブとコンテンツに active クラスを追加
    const selectedTab = document.querySelector(`#proposal-tabs-${proposalSuffix} [data-tab="${targetTab}"]`);
    const selectedContent = document.getElementById(targetTab);
    
    if (selectedTab) selectedTab.classList.add('active');
    if (selectedContent) selectedContent.classList.add('active');
}

/**
 * FAQ提案選択タブの設定
 */
function setupFaqProposalTabs() {
    const faqTabBtns = document.querySelectorAll('.faq-tab-btn');
    faqTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const proposalType = this.getAttribute('data-proposal');
            
            // アクティブタブの切り替え
            faqTabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 選択された提案のFAQを表示
            displaySelectedProposalFaq(proposalType);
        });
    });
}

/**
 * Q&A提案選択タブの設定
 */
function setupQaProposalTabs() {
    const qaTabBtns = document.querySelectorAll('.qa-tab-btn');
    qaTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const proposalType = this.getAttribute('data-proposal');
            
            // アクティブタブの切り替え
            qaTabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 選択された提案をグローバル変数に保存（Q&A送信用）
            currentProposals.selected = proposalType;
            
            // プレースホルダーテキストを更新
            updateQaPlaceholder(proposalType);
            
            // 選択した提案のQ&A履歴を表示
            displayQaHistory(proposalType);
        });
    });
}

/**
 * 選択された提案のFAQを表示
 * @param {string} proposalType - 提案タイプ（'proposal_1' または 'proposal_2'）
 */
function displaySelectedProposalFaq(proposalType) {
    const proposal = currentProposals[proposalType];
    if (proposal && proposal.faq) {
        displayFAQ(proposal.faq);
    } else {
        // FAQが無い場合の表示
        const faqContainer = document.getElementById('faq-items');
        faqContainer.innerHTML = '<p class="text-muted">この提案のFAQはありません。</p>';
    }
}

/**
 * Q&Aプレースホルダーテキストを更新
 * @param {string} proposalType - 提案タイプ（'proposal_1' または 'proposal_2'）
 */
function updateQaPlaceholder(proposalType) {
    const qaInput = document.getElementById('qa-question');
    if (qaInput) {
        const proposalNumber = proposalType === 'proposal_1' ? '①' : '②';
        qaInput.placeholder = `提案${proposalNumber}について質問があれば入力してください`;
    }
}

/**
 * 指定した提案のQ&A履歴を表示
 * @param {string} proposalType - 提案タイプ（'proposal_1' または 'proposal_2'）
 */
function displayQaHistory(proposalType) {
    const qaResponsesContainer = document.getElementById('qa-responses');
    if (!qaResponsesContainer) return;
    
    const history = qaHistory[proposalType] || [];
    
    // 履歴をクリア
    qaResponsesContainer.innerHTML = '';
    
    // 履歴がない場合
    if (history.length === 0) {
        qaResponsesContainer.innerHTML = '<p class="text-muted">まだ質問がありません。</p>';
        return;
    }
    
    // 履歴を表示
    history.forEach(item => {
        const qaItemHtml = `
            <div class="qa-item">
                <div class="qa-question">
                    <span class="qa-badge">Q</span>
                    <p>${item.question}</p>
                </div>
                <div class="qa-answer">
                    <span class="qa-badge">A</span>
                    <p>${item.answer}</p>
                </div>
            </div>
        `;
        qaResponsesContainer.innerHTML += qaItemHtml;
    });
}

/**
 * FAQ・Q&Aタブの表示制御（提案数に応じて）
 */
function updateProposalTabsVisibility() {
    const faqProposalTabs = document.querySelector('.faq-proposal-tabs');
    const qaProposalTabs = document.querySelector('.qa-proposal-tabs');
    const faqTab2 = document.querySelector('.faq-tab-btn[data-proposal="proposal_2"]');
    const qaTab2 = document.querySelector('.qa-tab-btn[data-proposal="proposal_2"]');
    
    if (currentProposals.proposal_2) {
        // 提案②がある場合：タブを表示
        if (faqTab2) faqTab2.style.display = 'flex';
        if (qaTab2) qaTab2.style.display = 'flex';
    } else {
        // 提案②がない場合：タブを非表示
        if (faqTab2) faqTab2.style.display = 'none';
        if (qaTab2) qaTab2.style.display = 'none';
        
        // 提案①のタブが選択されていることを確認
        const faqTab1 = document.querySelector('.faq-tab-btn[data-proposal="proposal_1"]');
        const qaTab1 = document.querySelector('.qa-tab-btn[data-proposal="proposal_1"]');
        if (faqTab1) faqTab1.classList.add('active');
        if (qaTab1) qaTab1.classList.add('active');
        
        // 選択を提案①に設定
        currentProposals.selected = 'proposal_1';
        updateQaPlaceholder('proposal_1');
        
        // Q&A履歴を提案①の履歴で更新
        displayQaHistory('proposal_1');
    }
}

/**
 * アコーディオン機能の初期化
 * 新しい実装: 各FAQアイテムに直接イベントリスナーを割り当てる
 */
function initAccordions() {
    // カードのトグルボタンクリック時の処理
    document.querySelectorAll('.card-toggle').forEach(toggleBtn => {
        toggleBtn.addEventListener('click', function() {
            const card = this.closest('.card');
            const cardBody = card.querySelector('.card-body');
            
            if (cardBody.style.display === 'none') {
                cardBody.style.display = 'block';
                this.querySelector('i').style.transform = 'rotate(0deg)';
            } else {
                cardBody.style.display = 'none';
                this.querySelector('i').style.transform = 'rotate(180deg)';
        }
        });
    });
}


/**
 * タブの切り替え処理
 * @param {string} tabId - 表示するタブのID
 */
function changeTab(tabId) {
    // ナビアイテムのアクティブ状態を更新
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.nav-item[data-tab="${tabId}"]`).classList.add('active');
    
    // コンテンツセクションのアクティブ状態を更新
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
}

/**
 * モーダルの表示・非表示切り替え
 * @param {string} modalId - モーダルのID
 * @param {boolean} show - trueで表示、falseで非表示
 */
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    
    if (show) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

/**
 * ローディングオーバーレイの表示・非表示切り替え
 * @param {boolean} show - trueで表示、falseで非表示
 */
function toggleLoading(show) {
    const loadingOverlay = document.getElementById('loading-overlay');
    
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

/**
 * 通知を表示する
 * @param {string} message - 表示するメッセージ
 * @param {string} type - 通知のタイプ（success, error, warning）
 */
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const messageElement = notification.querySelector('.notification-message');
    const iconElement = notification.querySelector('.notification-icon');
    
    messageElement.textContent = message;
    
    // 既存のクラスをリセット
    notification.classList.remove('success', 'error', 'warning');
    iconElement.className = 'notification-icon';
    
    // タイプに応じたクラスを設定
    notification.classList.add(type);
    
    if (type === 'success') {
        iconElement.classList.add('fas', 'fa-check-circle');
    } else if (type === 'error') {
        iconElement.classList.add('fas', 'fa-exclamation-circle');
    } else if (type === 'warning') {
        iconElement.classList.add('fas', 'fa-exclamation-triangle');
    }
    
    // 通知を表示
    notification.classList.remove('hidden');
    
    // 5秒後に自動的に非表示
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 5000);
}

/**
 * API設定を読み込む
 */
function loadApiSettings() {
    fetch('/api/settings')
        .then(response => response.json())
        .then(data => {
            if (data.api_endpoint) {
                document.getElementById('api-endpoint').value = data.api_endpoint;
            }
            if (data.proposal_api_key) {
                document.getElementById('api-key-proposal').value = data.proposal_api_key;
            }
            if (data.qa_api_key) {
                document.getElementById('api-key-qa').value = data.qa_api_key;
            }
            if (data.salestalk_api_key) {
                document.getElementById('api-key-salestalk').value = data.salestalk_api_key;
            }
            if (data.text_format_api_key) {
                document.getElementById('api-key-text-format').value = data.text_format_api_key;
            }
            if (data.customer_role_url) {
                document.getElementById('customer-role-url-setting').value = data.customer_role_url;
            }
            if (data.sales_role_url) {
                document.getElementById('sales-role-url-setting').value = data.sales_role_url;
            }
            
            updateConnectionStatus(data.is_connected);
            
            // 一般ユーザーの場合は入力フィールドを無効化
            if (data.read_only) {
                const inputs = document.querySelectorAll('#api-settings-form input');
                inputs.forEach(input => {
                    input.disabled = true;
                });
            }
        })
        .catch(error => {
            console.error('API設定の読み込みに失敗:', error);
        });
}

/**
 * 接続ステータスを更新する
 * @param {boolean} isConnected - 接続状態
 */
function updateConnectionStatus(isConnected) {
    const indicator = document.getElementById('connection-indicator');
    const statusText = document.getElementById('connection-status-text');
    const details = document.getElementById('connection-details');
    
    indicator.className = 'status-indicator';
    
    if (isConnected === true) {
        indicator.classList.add('success');
        statusText.textContent = '接続OK';
        details.textContent = 'API接続が正常に確立されています。';
    } else if (isConnected === false) {
        indicator.classList.add('error');
        statusText.textContent = '接続エラー';
        details.textContent = 'API接続に問題があります。設定を確認して再度テストしてください。';
    } else {
        indicator.classList.add('warning');
        statusText.textContent = '未テスト';
        details.textContent = '接続テストを実行して、API設定が正しく機能しているか確認してください。';
    }
}

/**
 * API設定を保存する
 */
function handleSaveApiSettings() {
    const apiData = {
        api_endpoint: document.getElementById('api-endpoint').value,
        proposal_api_key: document.getElementById('api-key-proposal').value,
        qa_api_key: document.getElementById('api-key-qa').value,
        salestalk_api_key: document.getElementById('api-key-salestalk').value,
        text_format_api_key: document.getElementById('api-key-text-format').value,
        customer_role_url: document.getElementById('customer-role-url-setting').value,
        sales_role_url: document.getElementById('sales-role-url-setting').value
    };
    
    fetch('/api/settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('API設定を保存しました', 'success');
        } else {
            showNotification('API設定の保存に失敗しました', 'error');
        }
    })
    .catch(error => {
        console.error('API設定の保存エラー:', error);
        showNotification('API設定の保存中にエラーが発生しました', 'error');
    });
}

/**
 * API接続テストを実行する
 */
function handleTestApiConnection() {
    const indicator = document.getElementById('connection-indicator');
    const statusText = document.getElementById('connection-status-text');
    const details = document.getElementById('connection-details');
    
    indicator.className = 'status-indicator warning';
    statusText.textContent = 'テスト中...';
    details.textContent = 'API接続をテストしています...';
    
    fetch('/api/test-connection', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            updateConnectionStatus(true);
            showNotification('API接続テストに成功しました', 'success');
        } else {
            updateConnectionStatus(false);
            showNotification(`API接続テストに失敗しました: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('API接続テストに失敗しました', error);
        updateConnectionStatus(false);
        showNotification('API接続テストに失敗しました', 'error');
    });
}

/**
 * 提案内容を生成する
 */
function handleGenerateProposal() {
    const customerName = document.getElementById('customer-name').value;
    
    if (!customerName) {
        showNotification('顧客名を入力してください', 'warning');
        return;
    }
    
    const customerDetails = document.getElementById('customer-details').value;
    const dealerInfo = document.getElementById('dealer-info').value;
    
    const data = {
        customer_name: customerName,
        customer_details: customerDetails,
        dealer_info: dealerInfo
    };
    
    // 顧客データを保存
    currentCustomerData = data;
    
    toggleLoading(true);
    
    fetch('/api/generate-proposal', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        toggleLoading(false);
        
        if (data.status === 'success') {
            // 新形式で提案データを保存
            currentProposals.proposal_1 = data.proposal.proposal_1;
            currentProposals.proposal_2 = data.proposal.proposal_2;
            currentProposals.selected = 'proposal_1';
            
            // 顧客情報サマリーを更新
            updateCustomerSummary();
            
            // 提案内容を表示
            displayProposal(currentProposals);
            
            // タブを提案内容に切り替え
            changeTab('proposal');
            
            showNotification('提案内容を生成しました', 'success');
        } else {
            showNotification(`提案生成に失敗しました: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        toggleLoading(false);
        console.error('提案生成に失敗しました', error);
        showNotification('提案生成に失敗しました', 'error');
    });
}

/**
 * HTMLエスケープ関数
 * @param {string} text - エスケープするテキスト
 * @returns {string} エスケープされたテキスト
 */
function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 顧客情報サマリーを更新する
 */
function updateCustomerSummary() {
    if (!currentCustomerData) return;
    
    document.getElementById('summary-name').textContent = currentCustomerData.customer_name;
    
    // 顧客情報詳細の改行・スペースを保持するため、HTMLエスケープしてから改行をbrタグに変換
    const customerDetails = escapeHtml(currentCustomerData.customer_details);
    const formattedDetails = customerDetails.replace(/\n/g, '<br>');
    document.getElementById('summary-details').innerHTML = formattedDetails;
}

/**
 * デュアル提案内容を表示する
 * @param {Object} proposals - 提案内容のデータ（新形式専用）
 * @param {boolean} isFromHistory - 履歴復元時かどうか
 */
function displayProposal(proposals, isFromHistory = false) {
    if (!proposals || !proposals.proposal_1) return;
    
    // proposal_1 は必須、proposal_2 は null の場合あり
    const proposalCard2 = document.getElementById('proposal-card-2');
    
    if (proposals.proposal_2) {
        // 2案表示
        proposalCard2.classList.remove('hidden');
        displaySingleProposal(proposals.proposal_2, '2');
    } else {
        // proposal_2 が null の場合は非表示
        proposalCard2.classList.add('hidden');
    }
    
    // proposal_1 は必ず表示
    displaySingleProposal(proposals.proposal_1, '1');
    
    // FAQ表示（デフォルトで提案①のFAQを表示）
    displaySelectedProposalFaq('proposal_1');
    
    // FAQ・Q&Aタブの表示制御（提案②がない場合はタブを非表示）
    updateProposalTabsVisibility();
    
    // 新提案生成時のみQ&A履歴をクリア（履歴復元時はクリアしない）
    if (!isFromHistory) {
        qaHistory.proposal_1 = [];
        qaHistory.proposal_2 = [];
    }
    
    // Q&A履歴表示を初期化（選択中の提案の履歴を表示）
    displayQaHistory(currentProposals.selected);
}

/**
 * 単一提案の表示
 * @param {Object} proposal - 提案データ
 * @param {string} suffix - ID接尾辞（'1' または '2'）
 */
function displaySingleProposal(proposal, suffix) {
    if (!proposal) return;
    
    // 車種の情報を表示
    if (proposal.car) {
        document.getElementById(`car-model-${suffix}`).textContent = proposal.car.model || '未設定';
        document.getElementById(`car-grade-${suffix}`).textContent = proposal.car.grade || '未設定';
        document.getElementById(`car-price-${suffix}`).textContent = proposal.car.price || '未設定';
        document.getElementById(`car-shipping-${suffix}`).textContent = proposal.car.shipping_date || '未定';
        document.getElementById(`car-reason-${suffix}`).textContent = proposal.car.reason || '情報がありません';
    }
    
    // 支払方法の情報を表示
    if (proposal.payment) {
        document.getElementById(`payment-method-${suffix}`).textContent = proposal.payment.recommended_method || '未設定';
        document.getElementById(`payment-simulation-${suffix}`).textContent = proposal.payment.simulation || '支払いシミュレーション情報がありません';
        document.getElementById(`payment-reason-${suffix}`).textContent = proposal.payment.reason || '情報がありません';
    }
    
    // 購入時期の情報を表示
    if (proposal.timing) {
        document.getElementById(`recommended-timing-${suffix}`).textContent = proposal.timing.recommended_date || '未設定';
        document.getElementById(`timing-reason-${suffix}`).textContent = proposal.timing.reason || '情報がありません';
    }
    
    // 下取りの情報を表示
    if (proposal.trade_in) {
        document.getElementById(`tradein-car-${suffix}`).textContent = proposal.trade_in.owned_car || '情報なし';
        document.getElementById(`tradein-assessment-${suffix}`).textContent = proposal.trade_in.assessment_price || '未設定';
        
        // 査定サイトURLの処理
        const urlElement = document.getElementById(`tradein-url-${suffix}`);
        if (proposal.trade_in.url && proposal.trade_in.url.trim() !== '') {
            urlElement.href = proposal.trade_in.url;
            urlElement.style.display = 'inline';
        } else {
            urlElement.style.display = 'none';
        }
        
        document.getElementById(`tradein-details-${suffix}`).innerHTML = `
            <ul>
                <li>${proposal.trade_in.reason?.split('。')[0] || '情報がありません'}</li>
                <li>${proposal.trade_in.reason?.split('。')[1] || ''}</li>
                <li>${proposal.trade_in.reason?.split('。')[2] || ''}</li>
            </ul>
        `;
    }
}


/**
 * FAQ表示
 * @param {Object} faq - FAQ データ
 */
function displayFAQ(faq) {
    const faqContainer = document.getElementById('faq-items');
    faqContainer.innerHTML = '';
    
    if (!faq) return;
    
    // FAQの項目を収集
    const faqPairs = [];
    let i = 1;
    while (true) {
        // 質問キーの候補
        const qKeys = [`question${i}`, `quesition${i}`];
        const aKey = `answer${i}`;
        
        // いずれかの質問キーが存在するか確認
        let qFound = false;
        for (const qKey of qKeys) {
            if (faq[qKey]) {
                qFound = true;
                faqPairs.push({ question: faq[qKey], answer: faq[aKey] });
                break;
            }
        }
        
        // 質問が見つからなければ終了
        if (!qFound) break;
        i++;
    }
    
    // FAQペアをHTML要素として表示
    faqPairs.forEach(pair => {
        const faqItemHtml = `
            <div class="qa-accordion-item">
                <div class="qa-accordion-header">
                    <span class="qa-badge">Q</span>
                    <p>${pair.question || '質問が見つかりません'}</p>
                    <i class="fas fa-chevron-down" style="transition: transform 0.3s ease;"></i>
                </div>
                <div class="qa-accordion-content" style="display: none;">
                    <span class="qa-badge">A</span>
                    <p>${pair.answer || '回答が見つかりません'}</p>
                </div>
            </div>
        `;
        faqContainer.innerHTML += faqItemHtml;
    });
    
    // アコーディオンイベントリスナーを追加
    const faqHeaders = faqContainer.querySelectorAll('.qa-accordion-header');
    faqHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const isActive = this.classList.contains('active');
            
            this.classList.toggle('active');
            const icon = this.querySelector('.fas.fa-chevron-down');
            if (icon) {
                icon.style.transform = isActive ? 'rotate(0deg)' : 'rotate(180deg)';
            }
            
            if (isActive) {
                content.style.display = 'none';
                content.classList.remove('active');
            } else {
                content.style.display = 'flex';
                content.classList.add('active');
            }
        });
    });
}

/**
 * 質問を送信して回答を表示する
 */
function handleAskQuestion() {
    const question = document.getElementById('qa-question').value;
    
    if (!question) {
        showNotification('質問を入力してください', 'warning');
        return;
    }
    
    if (!currentCustomerData || !currentProposals.proposal_1) {
        showNotification('提案内容がありません。先に提案を生成してください。', 'warning');
        return;
    }
    
    // 選択された提案のみを送信する
    const selectedProposal = currentProposals[currentProposals.selected];
    if (!selectedProposal) {
        showNotification('選択された提案が見つかりません。', 'warning');
        return;
    }
    
    const data = {
        ...currentCustomerData,
        proposal_1: selectedProposal,  // 選択された提案を proposal_1 として送信
        question: question
    };
    
    // デバッグ出力
    console.log('質疑応答送信データ:', data);
    
    toggleLoading(true);
    
    fetch('/api/ask-question', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        toggleLoading(false);
        
        console.log('APIレスポンス:', data);
        
        if (data.status === 'success') {
            displayAnswer(question, data.answer);
            document.getElementById('qa-question').value = '';
            showNotification('質問に回答しました', 'success');
        } else {
            // エラー詳細がある場合は表示
            let errorMessage = `質問応答に失敗しました: ${data.message}`;
            if (data.detail) {
                console.error('エラー詳細:', data.detail);
                if (typeof data.detail === 'object') {
                    errorMessage += ` (${JSON.stringify(data.detail)})`;
                }
            }
            showNotification(errorMessage, 'error');
        }
    })
    .catch(error => {
        toggleLoading(false);
        console.error('質問応答に失敗しました', error);
        showNotification('質問応答に失敗しました', 'error');
    });
}

/**
 * 質問と回答を表示する
 * @param {string} question - 質問内容
 * @param {Object} answer - 回答データ
 */
function displayAnswer(question, answer) {
    let summary = '';
    let details = '';
    
    // 形式に応じてデータを取得
    if (answer.sales_response) {
        summary = answer.sales_response.summary || '情報なし';
        details = answer.sales_response.details || '情報なし';
    } else {
        summary = answer.回答要約 || '情報なし';
        details = answer.詳細説明 || '情報なし';
    }
    
    // 統合した回答テキストを作成
    const answerText = summary === details ? summary : `${summary}\n\n${details}`;
    
    // 選択中の提案の履歴に追加
    const selectedProposalType = currentProposals.selected;
    if (!qaHistory[selectedProposalType]) {
        qaHistory[selectedProposalType] = [];
    }
    
    qaHistory[selectedProposalType].push({
        question: question,
        answer: answerText
    });
    
    // 選択中の提案の履歴を再表示
    displayQaHistory(selectedProposalType);
}

/**
 * セールストークを生成する
 */
function handleGenerateSalesTalk() {
    if (!currentCustomerData || !currentProposals.proposal_1) {
        showNotification('提案内容がありません。先に提案を生成してください。', 'warning');
        return;
    }
    
    const data = {
        ...currentCustomerData,
        proposal_1: currentProposals.proposal_1,
        proposal_2: currentProposals.proposal_2
    };
    
    console.log('セールストーク送信データ:', data);
    
    toggleLoading(true);
    
    fetch('/api/generate-salestalk', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        toggleLoading(false);
        
        if (data.status === 'success') {
            // セールストークデータを保存
            currentSalesTalk = data.salestalk;
            
            // セールストークを表示
            displaySalesTalk(data.salestalk);
            
            // タブをロールプレイに切り替え
            changeTab('roleplay');
            
            showNotification('セールストークを生成しました', 'success');
        } else {
            showNotification(`セールストーク生成に失敗しました: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        toggleLoading(false);
        console.error('セールストーク生成に失敗しました', error);
        showNotification('セールストーク生成に失敗しました', 'error');
    });
}

/**
 * セールストークを表示する
 * @param {Object} salestalk - セールストークデータ
 */
function displaySalesTalk(salestalk) {
    const salesTalkContent = document.getElementById('salestalk-content');
    
    if (!salestalk || (!salestalk.scenario && !salestalk.messages && !salestalk.key_points)) {
        salesTalkContent.innerHTML = '<p class="text-muted">セールストークの生成に失敗しました。</p>';
        return;
    }
    
    let html = '';
    
    // 1. scenario（前提）を最初に表示
    if (salestalk.scenario) {
        html += '<div class="sales-talk-section"><h3>セールストークの前提</h3>';
        const formattedScenario = salestalk.scenario.replace(/\n/g, '<br>');
        html += `<p>${formattedScenario}</p></div>`;
    }
    
    // 2. 会話内容（対話）を表示
    if (salestalk.messages && Array.isArray(salestalk.messages)) {
        html += '<div class="sales-talk-section"><h3>対話</h3>';
        
        let prevRole = null;
        
        salestalk.messages.forEach(msg => {
            const role = msg.role || '';
            const content = msg.content || '';
            
            // 対話ポイント（解説）の場合は別形式で表示
            if (role === 'sales' && content.startsWith('[対話ポイント]')) {
                html += `<div class="sales-point"><p>${content.replace('[対話ポイント] ', '')}</p></div>`;
                return;
            }
            
            // 通常の会話の場合
            if (role !== prevRole) {
                if (role === 'customer') {
                    html += '<div class="sales-talk-customer"><strong>【お客様】</strong>';
                } else if (role === 'sales') {
                    html += '<div class="sales-talk-sales"><strong>【営業担当】</strong>';
                } else {
                    html += `<div class="sales-talk-other"><strong>【${role}】</strong>`;
                }
            } else {
                html += '<div>';
            }
            
            html += `<p>${content}</p></div>`;
            prevRole = role;
        });
        
        html += '</div>';
    }
    
    // 3. キーポイント（まとめ）を最後に表示
    if (salestalk.key_points && Array.isArray(salestalk.key_points)) {
        html += '<div class="sales-talk-section"><h3>まとめ</h3><ul>';
        salestalk.key_points.forEach(point => {
            html += `<li>${point}</li>`;
        });
        html += '</ul></div>';
    }
    
    // 次のステップがある場合は表示
    if (salestalk.next_steps && Array.isArray(salestalk.next_steps)) {
        html += '<div class="sales-talk-section"><h3>次のステップ</h3><ol>';
        salestalk.next_steps.forEach(step => {
            html += `<li>${step}</li>`;
        });
        html += '</ol></div>';
    }
    
    html += '<button id="copy-sales-talk" class="btn btn-text"><i class="fas fa-copy"></i> 全文コピー</button>';
    
    salesTalkContent.innerHTML = html;
    
    // コピーボタンのイベントリスナーを再設定
    document.getElementById('copy-sales-talk').addEventListener('click', function() {
        const textToCopy = salesTalkContent.innerText;
        
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                showNotification('セールストークをクリップボードにコピーしました', 'success');
            })
            .catch(err => {
                showNotification('コピーに失敗しました', 'error');
            });
    });
}

/**
 * 提案内容を履歴に保存する
 */
function handleSaveProposal() {
    if (!currentCustomerData || !currentProposals.proposal_1) {
        showNotification('提案内容がありません。先に提案を生成してください。', 'warning');
        return;
    }
    
    const data = {
        ...currentCustomerData,
        proposal_1: currentProposals.proposal_1,
        proposal_2: currentProposals.proposal_2,
        selected_proposal: currentProposals.selected,
        qa_history: qaHistory,
        car_model: currentProposals.proposal_1?.car?.model || '',
        sales_talk: currentSalesTalk ? JSON.stringify(currentSalesTalk) : ''
    };
    
    fetch('/api/save-history', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('提案内容を履歴に保存しました', 'success');
        } else {
            showNotification('履歴の保存に失敗しました', 'error');
        }
    })
    .catch(error => {
        console.error('履歴の保存に失敗しました', error);
        showNotification('履歴の保存に失敗しました', 'error');
    });
}

/**
 * 履歴データを読み込む
 * @param {number} page - ページ番号
 */
function loadHistoryData(page) {
    const customerName = document.getElementById('history-search').value;
    const period = document.getElementById('history-period').value;
    
    const params = new URLSearchParams();
    params.append('page', page);
    if (customerName) params.append('customer_name', customerName);
    if (period) params.append('period', period);
    
    fetch(`/api/get-history?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            displayHistoryData(data);
        })
        .catch(error => {
            console.error('履歴データの読み込みに失敗しました', error);
            showNotification('履歴データの読み込みに失敗しました', 'error');
        });
}

/**
 * 履歴データを表示する
 * @param {Object} data - APIから取得した履歴データ
 */
function displayHistoryData(data) {
    const tableBody = document.getElementById('history-table-body');
    const pagination = document.getElementById('history-pagination');
    const countElement = document.getElementById('history-count');
    
    // テーブルの内容をクリア
    tableBody.innerHTML = '';
    
    // 件数表示の更新
    if (data.total === 0) {
        countElement.textContent = '該当する履歴がありません';
    } else {
        const startIndex = ((data.current_page - 1) * 10) + 1;
        const endIndex = Math.min(data.current_page * 10, data.total);
        countElement.textContent = `全${data.total}件中 ${startIndex}-${endIndex}件を表示`;
    }
    
    // データがない場合
    if (!data.items || data.items.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">該当する履歴がありません</td>
            </tr>
        `;
        pagination.innerHTML = '';
        return;
    }
    
    // 履歴データの表示
    data.items.forEach(item => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${item.created_at}</td>
            <td>${item.username}</td>
            <td>${item.customer_name}</td>
            <td>${item.car_model || '-'}</td>
            <td>
                <button class="btn btn-icon view-detail-btn" data-id="${item.id}" title="詳細表示">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-icon delete-history-btn" data-id="${item.id}" title="削除">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // ページネーションの表示
    displayPagination(data.current_page, data.pages);
    
    // 詳細表示ボタンのイベントリスナーを設定
    const viewDetailBtns = document.querySelectorAll('.view-detail-btn');
    viewDetailBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const historyId = this.getAttribute('data-id');
            showHistoryDetail(historyId);
        });
    });
    
    // 削除ボタンのイベントリスナーを設定
    const deleteHistoryBtns = document.querySelectorAll('.delete-history-btn');
    deleteHistoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const historyId = this.getAttribute('data-id');
            
            if (confirm('この履歴を削除してもよろしいですか？')) {
                deleteHistory(historyId);
            }
        });
    });
}

/**
 * ページネーションを表示する
 * @param {number} currentPage - 現在のページ番号
 * @param {number} totalPages - 総ページ数
 */
function displayPagination(currentPage, totalPages) {
    const pagination = document.getElementById('history-pagination');
    pagination.innerHTML = '';
    
    if (totalPages <= 1) {
        return;
    }
    
    // 前のページへのリンク
    const prevLi = document.createElement('li');
    prevLi.classList.add('page-item');
    if (currentPage === 1) {
        prevLi.classList.add('disabled');
    }
    
    const prevLink = document.createElement('a');
    prevLink.classList.add('page-link');
    prevLink.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevLink.href = '#';
    
    if (currentPage > 1) {
        prevLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadHistoryData(currentPage - 1);
        });
    }
    
    prevLi.appendChild(prevLink);
    pagination.appendChild(prevLi);
    
    // ページ番号のリンク
    for (let i = 1; i <= totalPages; i++) {
        if (totalPages > 7 && i > 2 && i < totalPages - 1 && Math.abs(i - currentPage) > 1) {
            // ページ数が多い場合は省略
            if (i === 3 && currentPage > 4) {
                const ellipsisLi = document.createElement('li');
                ellipsisLi.classList.add('page-item', 'disabled');
                ellipsisLi.innerHTML = '<span class="page-link">...</span>';
                pagination.appendChild(ellipsisLi);
            }
            continue;
        }
        
        const li = document.createElement('li');
        li.classList.add('page-item');
        if (i === currentPage) {
            li.classList.add('active');
        }
        
        const link = document.createElement('a');
        link.classList.add('page-link');
        link.textContent = i;
        link.href = '#';
        
        link.addEventListener('click', function(e) {
            e.preventDefault();
            loadHistoryData(i);
        });
        
        li.appendChild(link);
        pagination.appendChild(li);
    }
    
    // 次のページへのリンク
    const nextLi = document.createElement('li');
    nextLi.classList.add('page-item');
    if (currentPage === totalPages) {
        nextLi.classList.add('disabled');
    }
    
    const nextLink = document.createElement('a');
    nextLink.classList.add('page-link');
    nextLink.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextLink.href = '#';
    
    if (currentPage < totalPages) {
        nextLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadHistoryData(currentPage + 1);
        });
    }
    
    nextLi.appendChild(nextLink);
    pagination.appendChild(nextLi);
}

/**
 * 履歴詳細を表示する
 * @param {number} historyId - 履歴ID
 */
function showHistoryDetail(historyId) {
    fetch(`/api/history/${historyId}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                showNotification(data.message, 'error');
                return;
            }
            
            // 詳細データを表示
            document.getElementById('detail-customer-name').textContent = `${data.customer_name}様 - ${data.created_at}`;
            document.getElementById('detail-car-model').textContent = data.car_model || '未設定';
            document.getElementById('detail-payment-method').textContent = data.proposal?.payment?.recommended_method || '未設定';
            document.getElementById('detail-customer-type').textContent = data.customer_type;
            document.getElementById('detail-customer-info').textContent = data.customer_details;
            
            // 詳細カードを表示
            document.getElementById('history-detail-card').classList.remove('hidden');
            
            // 履歴から復元ボタンのイベントリスナー
            document.getElementById('restore-from-history-btn').onclick = function() {
                // Step 1: 全データを復元
                currentCustomerData = {
                    customer_name: data.customer_name,
                    customer_type: data.customer_type,
                    customer_details: data.customer_details,
                    dealer_info: data.dealer_info
                };
                
                currentProposals.proposal_1 = data.proposal_1 || data.proposal;
                currentProposals.proposal_2 = data.proposal_2 || null;
                currentProposals.selected = data.selected_proposal || 'proposal_1';
                
                // セールストークがあれば設定
                if (data.sales_talk) {
                    try {
                        currentSalesTalk = JSON.parse(data.sales_talk);
                    } catch (e) {
                        console.error('セールストークのパースに失敗しました', e);
                    }
                }
                
                // Q&A履歴があれば復元
                if (data.qa_history) {
                    qaHistory = data.qa_history;
                } else {
                    qaHistory = { proposal_1: [], proposal_2: [] };
                }
                
                // Step 2: 顧客情報入力画面のDOM更新
                document.getElementById('customer-name').value = data.customer_name;
                
                const customerTypeRadios = document.querySelectorAll('input[name="customer-type"]');
                customerTypeRadios.forEach(radio => {
                    if (radio.value === data.customer_type) {
                        radio.checked = true;
                    }
                });
                
                document.getElementById('customer-details').value = data.customer_details;
                document.getElementById('dealer-info').value = data.dealer_info;
                
                // Step 3: 提案内容画面のデータ更新
                updateCustomerSummary();
                displayProposal(currentProposals, true);
                
                // Step 4: 顧客情報入力画面に移動
                changeTab('customer-input');
                
                // Step 5: 詳細カードを非表示
                document.getElementById('history-detail-card').classList.add('hidden');
            };
        })
        .catch(error => {
            console.error('履歴詳細の取得に失敗しました', error);
            showNotification('履歴詳細の取得に失敗しました', 'error');
        });
}

/**
 * 履歴を削除する
 * @param {number} historyId - 履歴ID
 */
function deleteHistory(historyId) {
    fetch(`/api/history/${historyId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('履歴を削除しました', 'success');
            
            // 履歴一覧を再読み込み
            loadHistoryData(1);
            
            // 詳細カードが表示されている場合は非表示
            document.getElementById('history-detail-card').classList.add('hidden');
        } else {
            showNotification(`履歴の削除に失敗しました: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('履歴の削除に失敗しました', error);
        showNotification('履歴の削除に失敗しました', 'error');
    });
}

/**
 * ロールプレイ用セールストークを生成する
 */
function handleGenerateRoleplaySalesTalk() {
    if (!currentCustomerData || !currentProposals.proposal_1) {
        showNotification('提案内容がありません。先に提案を生成してください。', 'warning');
        return;
    }
    
    const data = {
        ...currentCustomerData,
        proposal: currentProposals.proposal_1
    };
    
    // JSONデータを圧縮して文字数を削減
    const compressedData = {
        customer_name: data.customer_name,
        customer_type: data.customer_type,
        customer_details: data.customer_details.substring(0, 1000), // 詳細は1000文字に制限
        proposal: {
            car: data.proposal.car,
            payment: data.proposal.payment,
            timing: data.proposal.timing, 
            trade_in: data.proposal.trade_in
        }
    };
    
    // デバッグ用にデータサイズを確認
    console.log('リクエストデータサイズ:', JSON.stringify(compressedData).length);
    
    toggleLoading(true);
    
    fetch('/api/generate-conversation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(compressedData)
    })
    .then(response => response.json())
    .then(data => {
        toggleLoading(false);
        
        if (data.status === 'success') {
            // セールストークデータを保存
            currentSalesTalk = data.conversation;
            
            // セールストークを表示
            displaySalesTalk(data.conversation);
            
            showNotification('ロールプレイ用セールストークを生成しました', 'success');
        } else {
            showNotification(`セールストーク生成に失敗しました: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        toggleLoading(false);
        console.error('セールストーク生成に失敗しました', error);
        showNotification('セールストーク生成に失敗しました', 'error');
    });
}

/**
 * 顧客情報と全提案をクリップボードにコピーする
 */
function copyCustomerSummary() {
    const customerNameElement = document.getElementById('summary-name');
    const customerDetailsElement = document.getElementById('summary-details');
    
    if (!customerNameElement || !customerDetailsElement) {
        showNotification('顧客情報が見つかりません', 'warning');
        return;
    }
    
    const customerName = customerNameElement.textContent.trim();
    const customerDetails = customerDetailsElement.textContent.trim();
    
    if (!customerName && !customerDetails) {
        showNotification('コピーする顧客情報がありません', 'warning');
        return;
    }
    
    // 販売店情報を取得（履歴復元時も考慮してcurrentCustomerDataから優先取得）
    const dealerInfo = currentCustomerData?.dealer_info || document.getElementById('dealer-info').value.trim();
    
    // 統合マークダウンを生成
    const combinedMarkdown = generateCombinedMarkdown(customerName, customerDetails, dealerInfo, currentProposals.proposal_1, currentProposals.proposal_2);
    
    // クリップボードにコピー
    navigator.clipboard.writeText(combinedMarkdown).then(() => {
        showNotification('顧客情報と全提案をコピーしました', 'success');
    }).catch(err => {
        console.error('コピーに失敗しました:', err);
        showNotification('コピーに失敗しました', 'error');
    });
}

/**
 * 統合マークダウンを生成する
 * @param {string} customerName - 顧客名
 * @param {string} customerDetails - 顧客詳細情報
 * @param {string} dealerInfo - 販売店情報
 * @param {Object} proposal1 - 提案①
 * @param {Object} proposal2 - 提案②
 * @returns {string} 統合マークダウン
 */
function generateCombinedMarkdown(customerName, customerDetails, dealerInfo, proposal1, proposal2) {
    let markdown = `# ${customerName}様 提案書\n\n`;
    
    // 顧客情報セクション
    markdown += `## 顧客情報\n`;
    markdown += `**顧客名:** ${customerName}様\n\n`;
    if (customerDetails) {
        markdown += `**顧客詳細:**\n${customerDetails}\n\n`;
    }
    
    // 販売店情報セクション
    if (dealerInfo) {
        markdown += `## 販売店情報・キャンペーン\n${dealerInfo}\n\n`;
    }
    
    // 提案①セクション
    if (proposal1) {
        markdown += `## 提案①\n\n`;
        markdown += generateProposalSection(proposal1);
        markdown += `\n`;
    }
    
    // 提案②セクション
    if (proposal2) {
        markdown += `## 提案②\n\n`;
        markdown += generateProposalSection(proposal2);
        markdown += `\n`;
    }
    
    return markdown;
}

/**
 * 提案セクションのマークダウンを生成する
 * @param {Object} proposal - 提案データ
 * @returns {string} 提案セクションのマークダウン
 */
function generateProposalSection(proposal) {
    let section = '';
    
    // 車種情報
    if (proposal.car) {
        section += `### 提案車種\n`;
        section += `**モデル:** ${proposal.car.model || '未設定'}\n`;
        section += `**グレード:** ${proposal.car.grade || '未設定'}\n`;
        section += `**価格帯:** ${proposal.car.price || '未設定'}\n`;
        section += `**提案理由:** ${proposal.car.reason || '情報がありません'}\n\n`;
    }
    
    // 支払方法
    if (proposal.payment) {
        section += `### 支払方法\n`;
        section += `**推奨方法:** ${proposal.payment.recommended_method || '未設定'}\n`;
        section += `**シミュレーション:** ${proposal.payment.simulation || '支払いシミュレーション情報がありません'}\n`;
        section += `**提案理由:** ${proposal.payment.reason || '情報がありません'}\n\n`;
    }
    
    // 購入時期
    if (proposal.timing) {
        section += `### 購入時期\n`;
        section += `**推奨時期:** ${proposal.timing.recommended_date || '未設定'}\n`;
        section += `**提案理由:** ${proposal.timing.reason || '情報がありません'}\n\n`;
    }
    
    // 下取り
    if (proposal.trade_in) {
        section += `### 下取り\n`;
        section += `**現在の車:** ${proposal.trade_in.owned_car || '情報なし'}\n`;
        section += `**査定額:** ${proposal.trade_in.assesment || '未設定'}\n`;
        section += `**理由:** ${proposal.trade_in.reason || '情報がありません'}\n\n`;
    }
    
    return section;
}


/**
 * テキスト整形処理
 */
function handleFormatText() {
    const textArea = document.getElementById('customer-details');
    const rawText = textArea.value.trim();
    
    if (!rawText) {
        showNotification('整形するテキストを入力してください', 'warning');
        return;
    }
    
    // 処理中の状態表示
    showFormatting(true);
    
    fetch('/api/format-text', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            raw_text: rawText
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            textArea.value = data.formatted_text;
            showNotification('テキストを整形しました', 'success');
        } else {
            showNotification(`整形エラー: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('テキスト整形エラー:', error);
        showNotification('整形処理中にエラーが発生しました', 'error');
    })
    .finally(() => {
        // 処理完了後の状態復元
        showFormatting(false);
    });
}

/**
 * テキスト整形の処理状態表示
 * @param {boolean} show - 表示するかどうか
 */
function showFormatting(show) {
    const statusDiv = document.getElementById('format-status');
    const formatBtn = document.getElementById('format-text-btn');
    
    if (show) {
        statusDiv.classList.remove('hidden');
        formatBtn.disabled = true;
        formatBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> 整形中...';
    } else {
        statusDiv.classList.add('hidden');
        formatBtn.disabled = false;
        formatBtn.innerHTML = '<i class="fas fa-magic"></i> テキストを整形';
    }
} 