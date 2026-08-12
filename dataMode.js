async function switchDataMode(mode) {
    if (App.dataMode === mode) {
        return;
    }
    
    const renderSessionId = ChartUtils.beginRenderSession();
    
    // 显示骨架屏，表示图表正在重新加载
    ChartUtils.showAllSkeletons();
    
    showLoading({ text: mode === 'weekly' ? '加载周度数据...' : '加载月度数据...' });

    try {
        await DataLoader.loadData(App.dashboard, mode);
        rebuildDataIndex(App.dashboard, mode);
    } catch (e) {
        console.error(`加载 ${App.dashboard} ${mode} 数据失败`, e);
        hideLoading();
        return;
    }
    
    // 同步更新状态和 UI（非图表部分）
    App.dataMode = mode;
    
    // 重置排行周期（周/月数据的周期键格式不同）
    App.rankingPeriod = null;
    
    // 更新标题
    const title = document.getElementById('dashboardTitle');
    if (App.dashboard === 'bookstore') {
        title.textContent = mode === 'weekly' ? '学科网书城周度数据看板' : '学科网书城月度数据看板';
        
        const label = document.getElementById('timeSelectorLabel');
        if (label) label.textContent = mode === 'weekly' ? '数据周期：' : '数据月份：';
        
        const materialViewBtn = document.getElementById('materialViewBtn');
        if (materialViewBtn) {
            materialViewBtn.style.display = isMaterialViewAvailable() ? 'block' : 'none';
        }
        const merchantViewBtn = document.getElementById('merchantViewBtn');
        if (merchantViewBtn) {
            merchantViewBtn.style.display = isMerchantViewAvailable() ? 'block' : 'none';
        }

        const currentView = document.querySelector('.view-toggle button.active')?.dataset.view || 'simple';
        setActiveBookstoreView(currentView);
    } else {
        title.textContent = mode === 'weekly' ? '学科网智书周度数据看板' : '学科网智书月度数据看板';
    }
    
    // 更新时间选择器选项
    updateTimeSelector(mode, App.dashboard);
    
    // 更新按钮状态
    document.querySelectorAll('.period-btn').forEach(btn => {
        if (btn.dataset.period) {
            btn.classList.remove('active');
            if (btn.dataset.period === mode) {
                btn.classList.add('active');
            }
        }
    });
    
    // 更新排行榜按钮文本
    const weeklyRankingBtn = document.getElementById('weeklyRankingBtn');
    if (weeklyRankingBtn) {
        weeklyRankingBtn.textContent = mode === 'weekly' ? '周排行榜' : '月排行榜';
    }
    
    // 刷新数据（metrics 同步更新，charts 使用 renderWhenReady 异步更新）
    if (App.dashboard === 'bookstore') {
        refreshBookstoreDashboard(renderSessionId);
    } else {
        initAibcDashboard(renderSessionId);
    }
    
    // 短延迟后隐藏加载状态
    ChartUtils.renderWhenReady(() => {
        hideLoading();
        URLState.sync();
    }, 2, renderSessionId);
}

// 更新时间选择器选项 - 动态从数据文件读取
function updateTimeSelector(mode, dashboard = 'bookstore') {
    const timeSelector = document.getElementById('timeSelector');
    if (!timeSelector) return;
    
    const dataSet = getCurrentDataSet();
    if (!dataSet || dataSet.length === 0) return;
    
    const periods = [...new Set(dataSet.map(d => d.period))];
    
    periods.sort((a, b) => {
        return PeriodUtils.parsePeriod(b) - PeriodUtils.parsePeriod(a);
    });
    
    let optionsHTML = '';
    const isWeekly = mode === 'weekly';
    
    periods.forEach((period, index) => {
        const isSelected = index === 0;
        const displayText = isWeekly ? PeriodUtils.formatWeekDisplay(period) : PeriodUtils.formatMonthDisplay(period);
        optionsHTML += `<option value="${period}" ${isSelected ? 'selected' : ''}>${displayText}</option>`;
    });
    
    timeSelector.innerHTML = optionsHTML;
    // 显式设置选中值，确保 refreshBookstoreDashboard 读取到正确的周期
    if (periods.length > 0) {
        timeSelector.value = periods[0];
    }
}

// 更新重点指标
