document.addEventListener('DOMContentLoaded', async function() {
    // 显示图表骨架屏（数据加载期间占位）
    ChartUtils.showAllSkeletons();
    
    // 从 URL 读取状态
    const urlState = URLState.read();
    
    // 如果 URL 中有 dashboard 参数，更新当前看板
    if (urlState.dashboard && (urlState.dashboard === 'bookstore' || urlState.dashboard === 'aibc')) {
        App.dashboard = urlState.dashboard;
    }
    
    // 如果 URL 中有 period 参数，更新当前数据模式
    if (urlState.period && (urlState.period === 'weekly' || urlState.period === 'monthly')) {
        App.dataMode = urlState.period;
    }
    
    // 根据 URL 状态加载对应数据
    let dataLoadFailed = false;
    let dataLoadErrorMsg = '';
    try {
        await DataLoader.loadData(App.dashboard, App.dataMode);
    } catch (e) {
        console.error(`初始化加载 ${App.dashboard} ${App.dataMode} 数据失败`, e);
        dataLoadFailed = true;
        dataLoadErrorMsg = e.message || String(e);

        // 尝试回退到默认书城周度数据
        try {
            await DataLoader.loadData('bookstore', 'weekly');
            App.dashboard = 'bookstore';
            App.dataMode = 'weekly';
            dataLoadFailed = false;
        } catch (fallbackError) {
            console.error('回退到默认数据也失败', fallbackError);
        }
    }

    // 显示数据加载错误提示
    const errorBanner = document.getElementById('dataLoadError');
    const errorMsgSpan = document.getElementById('dataLoadErrorMsg');
    if (errorBanner) {
        if (dataLoadFailed) {
            errorBanner.style.display = 'flex';
            if (errorMsgSpan) {
                errorMsgSpan.textContent = `加载数据失败：${dataLoadErrorMsg}`;
            }
        } else {
            errorBanner.style.display = 'none';
        }
    }

    // 初始化数据索引（基于已加载的数据）
    initDataIndex();
    
    initEventListeners();
    
    // 初始化时间选择器
    updateTimeSelector(App.dataMode, App.dashboard);
    
    // 如果 URL 中有 date 参数，设置时间选择器的值
    const timeSelector = document.getElementById('timeSelector');
    if (timeSelector && urlState.date) {
        // 检查日期是否在选项中存在
        const optionExists = Array.from(timeSelector.options).some(opt => opt.value === urlState.date);
        if (optionExists) {
            timeSelector.value = urlState.date;
        }
    }
    
    // 如果 URL 中有 view 参数，切换到对应视图
    const requestedView = urlState.view || 'simple';
    const targetView = App.dashboard === 'bookstore' && App.dataMode === 'weekly' && requestedView === 'material'
        ? 'simple'
        : requestedView;
    
    // 提前定义视图变量，以便后面的代码可以访问
    const simpleView = document.getElementById('simple-view');
    const detailedView = document.getElementById('detailed-view');
    const materialView = document.getElementById('material-view');
    
    if (App.dashboard === 'bookstore') {
        // 书城看板：切换 simple/detailed/material 视图
        setActiveBookstoreView(targetView);
        
        // 显示视图切换按钮
        const viewToggle = document.querySelector('.view-toggle');
        if (viewToggle) viewToggle.style.display = 'flex';
    } else {
        // 智书看板：显示 aibc-view
        const aibcView = document.getElementById('aibc-view');
        
        if (simpleView) simpleView.style.display = 'none';
        if (detailedView) detailedView.style.display = 'none';
        if (materialView) {
            materialView.style.display = 'none';
            materialView.classList.remove('active');
        }
        if (aibcView) {
            aibcView.style.display = 'block';
            aibcView.classList.add('active');
        }
        
        // 隐藏视图切换按钮
        const viewToggle = document.querySelector('.view-toggle');
        if (viewToggle) viewToggle.style.display = 'none';
    }
    
    // 切换看板按钮状态
    document.querySelectorAll('[data-dashboard]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dashboard === App.dashboard);
    });
    
    // 切换周期按钮状态
    document.querySelectorAll('.period-btn').forEach(btn => {
        if (btn.dataset.period) {
            btn.classList.toggle('active', btn.dataset.period === App.dataMode);
        }
    });
    
    // 根据选中周期更新数据
    const selectedPeriod = timeSelector ? timeSelector.value : null;
    if (selectedPeriod) {
        updateKeyMetrics(selectedPeriod);
        generateDetailedMetrics(selectedPeriod);
    } else {
        // 动态获取最新的周期数据
        const dataSet = getCurrentDataSet();
        if (dataSet && dataSet.length > 0) {
            const periods = [...new Set(dataSet.map(d => d.period))].sort((a, b) => {
                return PeriodUtils.parsePeriod(b) - PeriodUtils.parsePeriod(a);
            });
            const latestPeriod = periods[0];
            updateKeyMetrics(latestPeriod);
            generateDetailedMetrics(latestPeriod);
        }
    }
    
    const renderSessionId = ChartUtils.beginRenderSession();
    
    // 使用 requestAnimationFrame 延迟初始化图表
    // ResizeObserver 会自动处理 resize，无需多次暴力重试
    ChartUtils.renderWhenReady(() => {
        // 根据当前视图创建对应图表
        if (simpleView && simpleView.style.display !== 'none') {
            createKeyChart('production', 'productionKeyChart');
            createKeyChart('totalConsumption', 'consumptionKeyChart');
            createProductionConsumptionComparisonChart();
        }
        
        if (detailedView && detailedView.style.display !== 'none') {
            initCategoryCharts();
        }
        
        if (materialView && materialView.style.display !== 'none') {
            initMaterialDimensionCharts();
        }
        
        // 智书看板初始化
        if (App.dashboard === 'aibc') {
            initAibcDashboard(renderSessionId);
        }
        
        // 初始化 ResizeObserver（一次性，之后自动处理所有 resize）
        ChartUtils.initResizeObserver();
        
        // 所有图表创建完成后，统一隐藏骨架屏
        ChartUtils.hideAllSkeletons();
        
        // 同步 URL 状态
        URLState.sync();
    }, 2, renderSessionId);
    
    // 初始化排行榜切换事件
    initRankingTabs();
});

