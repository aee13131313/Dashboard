function initEventListeners() {
    // 看板切换按钮事件监听
    const dashboardBtns = document.querySelectorAll('[data-dashboard]');
    dashboardBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const dashboard = this.dataset.dashboard;
            switchDashboard(dashboard);
        });
    });
    
    // 周度/月度切换按钮事件监听
    const periodBtns = document.querySelectorAll('.period-btn');
    periodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // 检查是否是看板切换按钮
            if (this.dataset.dashboard) {
                return; // 由看板切换处理
            }
            const period = this.dataset.period;
            switchDataMode(period);
        });
    });

    // 时间选择器
    document.getElementById('timeSelector').addEventListener('change', function(e) {
        const selectedPeriod = e.target.value;
        
        // 使用轻量级 loading 反馈（标题显示更新状态）
        showLoading({ lightweight: true });
        const renderSessionId = ChartUtils.beginRenderSession();
        
        if (App.dashboard === 'bookstore') {
            updateKeyMetrics(selectedPeriod);
            generateDetailedMetrics(selectedPeriod);
            
            // 重新创建生产与总消费对比趋势图（确保数据与选择周期匹配）
            ChartUtils.renderWhenReady(() => {
                createProductionConsumptionComparisonChart();
                ChartUtils.hideAllSkeletons();
                URLState.sync();
                hideLoading();
            }, 2, renderSessionId);
            
            // 如果当前在资料维度视图，更新资料维度图表
            if (document.getElementById('material-view').style.display !== 'none') {
                initMaterialDimensionCharts();
            }

            // 如果当前在商家维度视图，更新商家排行榜
            if (document.getElementById('merchant-view').style.display !== 'none') {
                renderBookstoreMerchantRanking(selectedPeriod);
            }
        } else {
            // 智书看板：清空商家选择，重新计算默认选择
            aibcSelectedMerchants.clear();
            initAibcDashboard(renderSessionId);
            URLState.sync();
            hideLoading();
        }
    });

    // 视图切换 - 使用事件委托处理隐藏的按钮
    const viewToggleContainer = document.querySelector('.view-toggle');
    if (viewToggleContainer) {
        viewToggleContainer.addEventListener('click', function(e) {
            const button = e.target.closest('button');
            if (!button) return;
            
            const view = button.dataset.view;
            if ((view === 'material' && !isMaterialViewAvailable()) || (view === 'merchant' && !isMerchantViewAvailable())) {
                hideLoading();
                return;
            }
            
            // 使用轻量级 loading 反馈
            showLoading({ lightweight: true });
            const renderSessionId = ChartUtils.beginRenderSession();
            
            // 更新按钮状态
            document.querySelectorAll('.view-toggle button').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            // 切换视图
            if (view === 'simple') {
                document.getElementById('simple-view').style.display = 'block';
                document.getElementById('detailed-view').style.display = 'none';
                document.getElementById('material-view').style.display = 'none';
                document.getElementById('material-view').classList.remove('active');
                document.getElementById('merchant-view').style.display = 'none';
                document.getElementById('merchant-view').classList.remove('active');
                // 创建核心图表，ResizeObserver 自动处理 resize
                ChartUtils.renderWhenReady(() => {
                    createKeyChart('production', 'productionKeyChart');
                    createKeyChart('totalConsumption', 'consumptionKeyChart');
                    createProductionConsumptionComparisonChart();
                    ChartUtils.hideAllSkeletons();
                    URLState.sync();
                    hideLoading();
                }, 2, renderSessionId);
            } else if (view === 'detailed') {
                document.getElementById('simple-view').style.display = 'none';
                document.getElementById('detailed-view').style.display = 'block';
                document.getElementById('material-view').style.display = 'none';
                document.getElementById('material-view').classList.remove('active');
                document.getElementById('merchant-view').style.display = 'none';
                document.getElementById('merchant-view').classList.remove('active');
                ChartUtils.renderWhenReady(() => {
                    initCategoryCharts();
                    ChartUtils.hideAllSkeletons();
                    URLState.sync();
                    hideLoading();
                }, 2, renderSessionId);
            } else if (view === 'material') {
                document.getElementById('simple-view').style.display = 'none';
                document.getElementById('detailed-view').style.display = 'none';
                document.getElementById('material-view').style.display = 'block';
                document.getElementById('material-view').classList.add('active');
                document.getElementById('merchant-view').style.display = 'none';
                document.getElementById('merchant-view').classList.remove('active');
                ChartUtils.renderWhenReady(() => {
                    initMaterialDimensionCharts();
                    ChartUtils.hideAllSkeletons();
                    URLState.sync();
                    hideLoading();
                }, 2, renderSessionId);
            } else if (view === 'merchant') {
                document.getElementById('simple-view').style.display = 'none';
                document.getElementById('detailed-view').style.display = 'none';
                document.getElementById('material-view').style.display = 'none';
                document.getElementById('material-view').classList.remove('active');
                document.getElementById('merchant-view').style.display = 'block';
                document.getElementById('merchant-view').classList.add('active');
                ChartUtils.renderWhenReady(() => {
                    const timeSelector = document.getElementById('timeSelector');
                    renderBookstoreMerchantRanking(timeSelector ? timeSelector.value : null);
                    ChartUtils.hideAllSkeletons();
                    URLState.sync();
                    hideLoading();
                }, 2, renderSessionId);
            }
        });
    }

    // 分类图表标签切换
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const metric = this.dataset.metric;
            const category = this.dataset.category;
            
            // 更新同一分类下的标签状态
            const categoryTabs = document.querySelectorAll(`[data-category="${category}"]`);
            categoryTabs.forEach(t => {
                t.classList.remove('active');
            });
            this.classList.add('active');
            
            // 更新对应分类的图表
            if (['grade', 'type', 'scene'].includes(category)) {
                // 资料维度图表
                createMaterialTrendChart(category, metric);
            } else {
                // 常规分类图表
                currentMetrics[category] = metric;
                createCategoryChart(category, metric);
            }
        });
    });

    // 商家维度排行榜切换
    document.querySelectorAll('.merchant-ranking-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.merchant-ranking-tab').forEach(btn => {
                const isActive = btn === this;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', String(isActive));
            });

            const timeSelector = document.getElementById('timeSelector');
            renderBookstoreMerchantRanking(timeSelector ? timeSelector.value : null);
        });
    });

    // AI分析按钮事件 - 改为打开对话弹窗
    document.getElementById('aiAnalysisBtn').addEventListener('click', function() {
        aiChat.showChatModal();
    });
    
    // --- 全局事件委托：替代 inline onclick/onchange ---
    // AI聊天快捷操作按钮（data-action 委托）
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;

        switch (action) {
            case 'startDataAnalysis':
                aiChat.startDataAnalysis();
                break;
            case 'askCustomQuestion':
                aiChat.askCustomQuestion();
                break;
            case 'promptForApiKey':
                aiAnalyzer.promptForApiKey();
                break;
            case 'retryAiChat':
                aiChat.retryLastAction();
                break;
            case 'retryChart':
                const canvasId = btn.dataset.canvasId;
                if (canvasId) ChartUtils.retryChart(canvasId);
                break;
        }
    });

    // 关闭AI对话弹窗
    document.getElementById('closeChatModal').addEventListener('click', function() {
        aiChat.hideChatModal();
    });

    // 最小化对话窗口
    document.getElementById('minimizeChatBtn').addEventListener('click', function() {
        aiChat.minimizeChat();
    });

    // 调整大小按钮
    document.getElementById('resizeChatBtn').addEventListener('click', function() {
        aiChat.toggleCompactMode();
    });

    // 还原对话窗口
    document.getElementById('restoreChatBtn').addEventListener('click', function() {
        aiChat.restoreChat();
    });

    // 关闭最小化窗口
    document.getElementById('closeMinimizedBtn').addEventListener('click', function() {
        aiChat.hideChatModal();
    });

    // 点击最小化窗口头部还原
    document.querySelector('.minimized-header').addEventListener('click', function(e) {
        if (!e.target.closest('.minimized-controls')) {
            aiChat.restoreChat();
        }
    });

    // 发送消息事件
    document.getElementById('sendChatBtn').addEventListener('click', function() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        if (message) {
            aiChat.sendMessage(message);
            input.value = '';
        }
    });

    // 回车发送消息
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const message = this.value.trim();
            if (message) {
                aiChat.sendMessage(message);
                this.value = '';
            }
        }
    });

    // 点击弹窗外部关闭（仅在非紧凑模式下）
    document.getElementById('aiChatModal').addEventListener('click', function(e) {
        if (e.target === this && !aiChat.isCompactMode) {
            aiChat.hideChatModal();
        }
    });

    // 键盘事件处理 - ESC关闭模态框 + 焦点陷阱
    document.addEventListener('keydown', function(e) {
        // ESC键关闭模态框
        if (e.key === 'Escape') {
            const aiChatModal = document.getElementById('aiChatModal');
            if (aiChatModal.style.display === 'flex') {
                aiChat.hideChatModal();
                e.preventDefault();
                return;
            }
        }
        
        // Tab键焦点陷阱 - AI对话模态框
        const aiChatModal = document.getElementById('aiChatModal');
        if (aiChatModal.style.display === 'flex') {
            const focusableElements = aiChatModal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length > 0) {
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (e.key === 'Tab') {
                    if (e.shiftKey && document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    } else if (!e.shiftKey && document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        }
        
        // 全局快捷键 - 仅在没有模态框打开时生效
        const isAnyModalOpen = aiChatModal?.style.display === 'flex';
        if (!isAnyModalOpen && (e.altKey || e.metaKey)) {
            switch(e.key.toLowerCase()) {
                case 'a': // Alt+A: 打开AI分析
                    if (!aiChatModal || aiChatModal.style.display !== 'flex') {
                        aiChat.showChatModal();
                        e.preventDefault();
                    }
                    break;
                case '1': // Alt+1: 周度数据
                    if (App.dataMode !== 'weekly') {
                        switchDataMode('weekly');
                        e.preventDefault();
                    }
                    break;
                case '2': // Alt+2: 月度数据
                    if (App.dataMode !== 'monthly') {
                        switchDataMode('monthly');
                        e.preventDefault();
                    }
                    break;
                case 'b': // Alt+B: 书城看板
                    if (App.dashboard !== 'bookstore') {
                        switchDashboard('bookstore');
                        e.preventDefault();
                    }
                    break;
                case 'i': // Alt+I: 智书看板
                    if (App.dashboard !== 'aibc') {
                        switchDashboard('aibc');
                        e.preventDefault();
                    }
                    break;
            }
        }
    });
}

// 初始化
