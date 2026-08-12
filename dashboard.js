function isMaterialViewAvailable() {
    return App.dashboard === 'bookstore';
}

function isMerchantViewAvailable() {
    return App.dashboard === 'bookstore';
}

function setActiveBookstoreView(view = 'simple') {
    const allowedViews = ['simple', 'detailed', 'material', 'merchant'];
    const targetView = allowedViews.includes(view) ? view : 'simple';
    const activeView = (targetView === 'material' && !isMaterialViewAvailable()) || (targetView === 'merchant' && !isMerchantViewAvailable()) ? 'simple' : targetView;

    const simpleView = document.getElementById('simple-view');
    const detailedView = document.getElementById('detailed-view');
    const materialView = document.getElementById('material-view');
    const merchantView = document.getElementById('merchant-view');
    const aibcView = document.getElementById('aibc-view');
    const materialViewBtn = document.getElementById('materialViewBtn');
    const merchantViewBtn = document.getElementById('merchantViewBtn');

    document.querySelectorAll('.view-toggle button').forEach(btn => {
        const isActive = btn.dataset.view === activeView;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
    });

    if (materialViewBtn) {
        materialViewBtn.style.display = isMaterialViewAvailable() ? 'block' : 'none';
    }
    if (merchantViewBtn) {
        merchantViewBtn.style.display = isMerchantViewAvailable() ? 'block' : 'none';
    }

    if (simpleView) simpleView.style.display = activeView === 'simple' ? 'block' : 'none';
    if (detailedView) detailedView.style.display = activeView === 'detailed' ? 'block' : 'none';
    if (materialView) {
        materialView.style.display = activeView === 'material' ? 'block' : 'none';
        materialView.classList.toggle('active', activeView === 'material');
    }
    if (merchantView) {
        merchantView.style.display = activeView === 'merchant' ? 'block' : 'none';
        merchantView.classList.toggle('active', activeView === 'merchant');
    }
    if (aibcView) {
        aibcView.style.display = 'none';
        aibcView.classList.remove('active');
    }

    return activeView;
}

async function switchDashboard(dashboard) {
    if (App.dashboard === dashboard) {
        return;
    }
    
    const renderSessionId = ChartUtils.beginRenderSession();
    
    // 显示骨架屏，表示图表正在加载
    ChartUtils.showAllSkeletons();
    
    showLoading({ text: dashboard === 'bookstore' ? '加载书城数据...' : '加载智书数据...' });

    try {
        await DataLoader.loadData(dashboard, App.dataMode);
        rebuildDataIndex(dashboard, App.dataMode);
    } catch (e) {
        console.error(`加载 ${dashboard} ${App.dataMode} 数据失败`, e);
        hideLoading();
        return;
    }
    
    // 同步更新状态和 UI
    App.dashboard = dashboard;
    
    // 更新按钮状态
    document.querySelectorAll('[data-dashboard]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-dashboard="${dashboard}"]`).classList.add('active');
    
    // 更新看板名称
    const dashboardName = document.getElementById('dashboardName');
    dashboardName.textContent = dashboard === 'bookstore' ? '学科网书城数据看板' : '学科网智书数据看板';
    
    // 隐藏/显示相应的内容
    if (dashboard === 'bookstore') {
        setActiveBookstoreView('simple');
        
        const viewToggle = document.querySelector('.view-toggle');
        if (viewToggle) viewToggle.style.display = 'flex';
        
        const title = document.getElementById('dashboardTitle');
        title.textContent = App.dataMode === 'weekly' ? '学科网书城周度数据看板' : '学科网书城月度数据看板';
        
        updateTimeSelector(App.dataMode, 'bookstore');
        refreshBookstoreDashboard(renderSessionId);
    } else {
        document.getElementById('simple-view').style.display = 'none';
        document.getElementById('detailed-view').style.display = 'none';
        document.getElementById('material-view').style.display = 'none';
        document.getElementById('merchant-view').style.display = 'none';
        document.getElementById('aibc-view').style.display = 'block';
        document.getElementById('aibc-view').classList.add('active');
        
        const viewToggle = document.querySelector('.view-toggle');
        if (viewToggle) viewToggle.style.display = 'none';
        
        const title = document.getElementById('dashboardTitle');
        title.textContent = App.dataMode === 'weekly' ? '学科网智书周度数据看板' : '学科网智书月度数据看板';
        
        updateTimeSelector(App.dataMode, 'aibc');
        
        const weeklyRankingBtn = document.getElementById('weeklyRankingBtn');
        if (weeklyRankingBtn) {
            weeklyRankingBtn.textContent = App.dataMode === 'weekly' ? '周排行榜' : '月排行榜';
        }
        
        initAibcDashboard(renderSessionId);
    }
    
    // 短延迟后隐藏加载状态
    ChartUtils.renderWhenReady(() => {
        hideLoading();
        URLState.sync();
    }, 2, renderSessionId);
}

// 刷新书城看板数据
function refreshBookstoreDashboard(renderSessionId = ChartUtils._renderSessionId) {
    if (!ChartUtils.isActiveRenderSession(renderSessionId)) return;
    const timeSelector = document.getElementById('timeSelector');
    if (!timeSelector) return;
    
    const selectedPeriod = timeSelector.value;
    if (!selectedPeriod) return;
    
    // 更新关键指标
    updateKeyMetrics(selectedPeriod);
    generateDetailedMetrics(selectedPeriod);
    
    // 检查当前活动的视图并刷新对应的图表
    const simpleView = document.getElementById('simple-view');
    const detailedView = document.getElementById('detailed-view');
    const materialView = document.getElementById('material-view');
    const merchantView = document.getElementById('merchant-view');
    
    ChartUtils.renderWhenReady(() => {
        // 核心数据视图
        if (simpleView && simpleView.style.display !== 'none') {
            createKeyChart('production', 'productionKeyChart');
            createKeyChart('totalConsumption', 'consumptionKeyChart');
            createProductionConsumptionComparisonChart();
        }
        
        // 详细数据视图
        if (detailedView && detailedView.style.display !== 'none') {
            initCategoryCharts();
        }
        
        // 资料维度视图
        if (materialView && materialView.style.display !== 'none') {
            initMaterialDimensionCharts();
        }

        // 商家维度视图
        if (merchantView && merchantView.style.display !== 'none') {
            renderBookstoreMerchantRanking(selectedPeriod);
        }
        
        // 统一隐藏骨架屏
        ChartUtils.hideAllSkeletons();
    }, 2, renderSessionId);
}

// 初始化智书看板
function initAibcDashboard(renderSessionId = ChartUtils._renderSessionId) {
    if (!ChartUtils.isActiveRenderSession(renderSessionId)) return;
    const dataSet = App.dataMode === 'weekly' ? aibcWeeklyData : aibcMonthlyData;
    if (dataSet.length === 0) return;
    
    // 获取时间选择器的值
    const timeSelector = document.getElementById('timeSelector');
    const selectedPeriod = timeSelector ? timeSelector.value : null;
    
    // 查找对应的数据
    let selectedData = dataSet[0];
    if (selectedPeriod) {
        const found = findDataByPeriod(selectedPeriod, 'aibc', App.dataMode);
        if (found) {
            selectedData = found;
        }
    }
    
    generateAibcMetrics(selectedData);
    generateAibcMerchantTabs(selectedData);
    createAibcCharts(selectedData, renderSessionId);
    updateRankingPeriod(selectedData.period);
}

// 当前排行周期（动态取最新周期，不再硬编码）
// 已迁移到 App.rankingPeriod（在 state.js 中定义）

// 从排行数据中获取最新周期（第一个键）
function getDefaultRankingPeriod() {
    const data = getRankingData();
    if (!data) return null;
    const keys = Object.keys(data);
    return keys.length > 0 ? keys[0] : null;
}

// 当前数据模式下主排行榜字段：周度用 weekly，月度用 monthly
function getPrimaryRankingType() {
    return App.dataMode === 'monthly' ? 'monthly' : 'weekly';
}

// 渲染图书访客排行榜
function renderBookRanking(type) {
    const tbody = document.getElementById('rankingTableBody');
    const container = document.getElementById('aibcBookRankingContainer');
    if (!tbody || !container) return;

    // 获取当前周期的排行榜数据
    // 根据当前数据模式获取对应的排行榜数据
    const bookRankingData = getRankingData();
    
    // 如果排行榜数据未加载，显示空状态
    if (!bookRankingData) {
        showRankingEmptyState(container, '排行榜数据未加载', '请检查网络连接或使用本地服务器打开（双击 start-server.bat）');
        return;
    }
    
    // 如果未设置周期，自动取最新周期
    if (!App.rankingPeriod) {
        App.rankingPeriod = getDefaultRankingPeriod();
    }
    
    const periodData = bookRankingData[App.rankingPeriod];
    
    // 如果没有该周期的数据，显示空状态
    if (!periodData) {
        showRankingEmptyState(container, '暂无该周期的排行榜数据', '请选择其他周期查看');
        return;
    }

    const data = periodData[type];
    if (!data || data.length === 0) {
        const typeName = type === 'total' ? '总排行' : (App.dataMode === 'monthly' ? '月排行' : '周排行');
        showRankingEmptyState(container, `暂无${typeName}数据`, '请选择其他周期或等待数据更新');
        return;
    }

    // 确保表格可见，移除空状态
    const table = container.querySelector('.ranking-table');
    if (table) {
        table.style.display = '';
    }
    container.querySelectorAll('.empty-ranking').forEach(el => el.remove());
    
    tbody.innerHTML = data.map(item => {
        const visitors = MetricsUtils.safeNumber(item.visitors, 0).toLocaleString();
        return `
        <tr>
            <td>${MetricsUtils.escapeHtml(item.rank)}</td>
            <td>${MetricsUtils.escapeHtml(item.bookId)}</td>
            <td>${MetricsUtils.escapeHtml(item.merchantName)}</td>
            <td>${MetricsUtils.escapeHtml(item.bookName)}</td>
            <td>${visitors}</td>
        </tr>
    `;
    }).join('');
}

// 显示排行榜空状态
function showRankingEmptyState(container, title, description) {
    if (!container) return;
    
    // 清空 tbody
    const tbody = document.getElementById('rankingTableBody');
    if (tbody) tbody.innerHTML = '';
    
    // 移除已有的空状态
    container.querySelectorAll('.empty-ranking').forEach(el => el.remove());
    
    // 创建空状态元素
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-ranking';
    emptyDiv.innerHTML = `
        <div class="empty-ranking-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 13h6M9 17h3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" 
                      stroke="#ccc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 7h10M7 11h4" stroke="#ccc" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
        </div>
        <div class="empty-ranking-title">${MetricsUtils.escapeHtml(title)}</div>
        <div class="empty-ranking-desc">${MetricsUtils.escapeHtml(description)}</div>
    `;
    
    // 插入到表格后面或替换表格
    const table = container.querySelector('.ranking-table');
    if (table) {
        table.style.display = 'none';
        container.appendChild(emptyDiv);
    } else {
        container.appendChild(emptyDiv);
    }
}

// 更新排行榜周期
function updateRankingPeriod(period) {
    App.rankingPeriod = period || getDefaultRankingPeriod();
    // 重新渲染当前选中的标签
    const weeklyBtn = document.getElementById('weeklyRankingBtn');
    if (weeklyBtn && weeklyBtn.classList.contains('active')) {
        renderBookRanking(getPrimaryRankingType());
    } else {
        renderBookRanking('total');
    }
}

// 初始化排行榜切换事件
function initRankingTabs() {
    const weeklyBtn = document.getElementById('weeklyRankingBtn');
    const totalBtn = document.getElementById('totalRankingBtn');

    if (weeklyBtn) {
        weeklyBtn.addEventListener('click', function() {
            weeklyBtn.classList.add('active');
            totalBtn.classList.remove('active');
            renderBookRanking(getPrimaryRankingType());
        });
    }

    if (totalBtn) {
        totalBtn.addEventListener('click', function() {
            totalBtn.classList.add('active');
            weeklyBtn.classList.remove('active');
            renderBookRanking('total');
        });
    }
    
    // 初始化时渲染默认的周期主排行榜数据（周度=周排行榜，月度=月排行榜）
    if (!App.rankingPeriod) {
        App.rankingPeriod = getDefaultRankingPeriod();
    }
    renderBookRanking(getPrimaryRankingType());
}

// 商家选择器实例（趋势图 + 指标卡片，共用 MultiSelectWidget）
let merchantTrendSelector = null;
let merchantCardSelector  = null;

// 生成智书商家选择器（自定义多选下拉框）
function generateAibcMerchantTabs(data) {
    if (!data || !data.merchants) return;
    const merchantNames = Object.keys(data.merchants);

    // 首次创建选择器实例
    if (!merchantTrendSelector) {
        merchantTrendSelector = new MultiSelectWidget({
            containerId:    'merchantSelectorContainer',
            buttonId:       'merchantSelectorButton',
            dropdownId:     'merchantSelectorDropdown',
            textId:         'merchantSelectorText',
            checkboxPrefix: 'merchant-trend-',
            onChange: (selected, all) => {
                updateAibcMerchantChart(selected.length > 0 ? selected : [all[0]]);
            }
        });
    }

    // 初始化/刷新选项，默认选中第一个商家（首次）
    merchantTrendSelector.init(merchantNames, [merchantNames[0]]);
}

// 更新智书商家趋势图
function updateAibcMerchantChart(merchantNames) {
    const rawDataSet = App.dataMode === 'weekly' ? aibcWeeklyData : aibcMonthlyData;
    const merchantCtx = document.getElementById('aibcMerchantChart');
    
    if (!merchantCtx || !Array.isArray(rawDataSet) || rawDataSet.length === 0) return;
    
    // 限制显示近25个周期，统一保持左旧右新
    const dataSet = getAibcChronologicalData(rawDataSet, 25);
    
    // 确保merchantNames是数组
    if (!Array.isArray(merchantNames)) {
        merchantNames = [merchantNames];
    }
    
    // 如果没有选中任何商家，显示数据中的第一个商家
    if (merchantNames.length === 0) {
        const firstDataWithMerchants = dataSet.find(d => d && d.merchants && Object.keys(d.merchants).length > 0);
        const firstMerchant = firstDataWithMerchants ? Object.keys(firstDataWithMerchants.merchants)[0] : null;
        if (!firstMerchant) return;
        merchantNames = [firstMerchant];
    }
    
    // 高对比度色板
    const colorPalette = [
        { border: '#1e40af', bg: 'rgba(30, 64, 175, 0.15)' },    // 深蓝色
        { border: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },   // 亮橙色
        { border: '#059669', bg: 'rgba(5, 150, 105, 0.15)' },    // 翠绿色
        { border: '#7c3aed', bg: 'rgba(124, 58, 237, 0.15)' },   // 紫色
        { border: '#dc2626', bg: 'rgba(220, 38, 38, 0.15)' },    // 红色
        { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },    // 青色
        { border: '#d946ef', bg: 'rgba(217, 70, 239, 0.15)' }    // 粉色
    ];
    
    // 简化横坐标显示：dataSet 已按时间正序排列，保持左旧右新
    const labels = dataSet.map(d => formatAibcPeriodLabel(d.period));
    
    // 存储所有商家的环比数据
    const momDataArray = [];
    
    // 为每个商家创建一个数据集
    const datasets = merchantNames.map((merchantName, index) => {
        const colorIndex = index % colorPalette.length;
        const color = colorPalette[colorIndex];
        const merchantData = dataSet.map(d => MetricsUtils.safeNumber(d && d.merchants ? d.merchants[merchantName] : 0));
        
        // 计算环比
        const momData = MetricsUtils.calculateMom(merchantData);
        momDataArray.push(momData);
        
        // 找出最高/最低点
        const validData = merchantData.filter(v => v !== null && v !== undefined && v > 0);
        const maxVal = validData.length > 0 ? Math.max(...validData) : null;
        const minVal = validData.length > 0 ? Math.min(...validData) : null;
        
        return {
            label: merchantName,
            data: merchantData,
            borderColor: color.border,
            backgroundColor: (context) => {
                const chart = context.chart;
                const {ctx, chartArea} = chart;
                if (!chartArea) return color.bg;
                const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                gradient.addColorStop(0, color.bg.replace('0.15', '0.02'));
                gradient.addColorStop(1, color.bg);
                return gradient;
            },
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: merchantData.map(v => {
                if (v === maxVal) return '#ef4444'; // 红色标记最高点
                if (v === minVal) return '#22c55e'; // 绿色标记最低点
                return color.border;
            }),
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: color.border,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 3
        };
    });
    
    const yAxisBounds = MetricsUtils.getSmartYAxisBounds(datasets.flatMap(dataset => dataset.data), {
        startAtZero: false,
        minFloor: 0
    });
    
    if (App.charts.aibcMerchant) {
        App.charts.aibcMerchant.destroy();
    }
    App.charts.aibcMerchant = new Chart(merchantCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        color: '#1f2937',
                        boxWidth: 8,
                        boxHeight: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    cornerRadius: 8,
                    padding: 14,
                    displayColors: true,
                    usePointStyle: true,
                    callbacks: {
                        title: function() { return ''; },
                        label: function(context) {
                            const datasetIndex = context.datasetIndex;
                            const dataIndex = context.dataIndex;
                            const value = context.parsed.y;
                            const mom = momDataArray[datasetIndex] ? momDataArray[datasetIndex][dataIndex] : null;
                            const formattedValue = value >= 10000 ? (value / 10000).toFixed(2) + ' 万' : 
                                                  value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value;
                            let label = `${context.dataset.label}: ${formattedValue}`;
                            if (mom !== null && mom !== undefined && mom !== 'null') {
                                const momSign = parseFloat(mom) >= 0 ? '+' : '';
                                label += ' (环比: ' + momSign + mom + '%)';
                            }
                            return label;
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: yAxisBounds.beginAtZero,
                    suggestedMin: yAxisBounds.suggestedMin,
                    suggestedMax: yAxisBounds.suggestedMax,
                    grid: {
                        color: 'rgba(156, 163, 175, 0.3)',
                        lineWidth: 1,
                        drawBorder: false,
                        borderDash: [5, 5]
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: '500'
                        },
                        color: '#6b7280',
                        padding: 8,
                        callback: function(value) {
                            if (value >= 10000) {
                                return (value / 10000).toFixed(1) + '万';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'k';
                            }
                            return value;
                        }
                    },
                    border: {
                        display: false
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: '500'
                        },
                        color: '#6b7280',
                        padding: 8
                    },
                    border: {
                        display: false
                    }
                }
            }
        },
        plugins: [
            {
                id: 'customDataLabels',
                afterDatasetsDraw(chart) {
                    const ctx = chart.ctx;
                    // 为每个数据集分配不同的垂直偏移，避免标签重叠
                    const offsets = [-10, 18, -28, 36, -46, 54, -64];
                    const baselines = ['bottom', 'top', 'bottom', 'top', 'bottom', 'top', 'bottom'];
                    
                    chart.data.datasets.forEach((dataset, datasetIndex) => {
                        const meta = chart.getDatasetMeta(datasetIndex);
                        const offset = offsets[datasetIndex % offsets.length];
                        const baseline = baselines[datasetIndex % baselines.length];
                        
                        meta.data.forEach((element, index) => {
                            const data = dataset.data[index];
                            if (data !== null && data !== undefined && data > 0) {
                                const x = element.x;
                                const y = element.y;
                                // 直接显示原始数字，不使用千分符
                                ctx.fillStyle = dataset.borderColor;
                                ctx.font = 'bold 10px sans-serif';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = baseline;
                                ctx.fillText(data, x, y + offset);
                            }
                        });
                    });
                }
            }
        ]
    });
}

// 生成智书图表横坐标数据，统一保持左旧右新
function getAibcChronologicalData(dataSet, maxPoints = 25) {
    return [...dataSet]
        .filter(item => item && item.period)
        .sort((a, b) => PeriodUtils.parsePeriod(a.period) - PeriodUtils.parsePeriod(b.period))
        .slice(-maxPoints);
}

function formatAibcPeriodLabel(period) {
    const weekMatch = period.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})-(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
    if (weekMatch) {
        const startYear = weekMatch[1];
        const startMonth = parseInt(weekMatch[2]);
        const startDay = parseInt(weekMatch[3]);
        const endYear = weekMatch[4];
        const endMonth = parseInt(weekMatch[5]);
        const endDay = parseInt(weekMatch[6]);
        if (startYear !== endYear) {
            return `${startYear}年${startMonth}月${startDay}日-${endYear}年${endMonth}月${endDay}日`;
        }
        if (startMonth === endMonth) {
            return `${startMonth}月${startDay}-${endDay}日`;
        }
        return `${startMonth}月${startDay}日-${endMonth}月${endDay}日`;
    }

    const monthMatch = period.match(/^(\d{4})\.(\d{1,2})$/);
    if (monthMatch) {
        return `${monthMatch[1]}年${parseInt(monthMatch[2])}月`;
    }

    return period;
}

// 生成智书指标卡片
function generateAibcMetrics(data) {
    const overallContainer = document.getElementById('aibcOverallMetrics');
    const merchantContainer = document.getElementById('aibcMerchantMetrics');
    
    if (!overallContainer || !merchantContainer || !data) return;
    
    // 获取当前选中的期间 - 直接从data对象获取
    const currentPeriod = data.period;
    const valueOf = key => MetricsUtils.safeNumber(data[key]);
    
    // 计算聚合指标
    const totalVisitors = valueOf('miniAppVisitors') + valueOf('h5Visitors');
    const totalNewVisitors = valueOf('miniAppNewVisitors') + valueOf('h5NewVisitors');
    
    // 整体访客数据 - 包含总访客、总新增访客以及各渠道数据
    const overallMetrics = [
        { title: '总访客', value: totalVisitors, key: 'totalVisitors', isAggregate: true },
        { title: '总新增访客', value: totalNewVisitors, key: 'totalNewVisitors', isAggregate: true },
        { title: '小程序访客', value: valueOf('miniAppVisitors'), key: 'miniAppVisitors', dailyValue: valueOf('miniAppDailyVisitors') },
        { title: '小程序新增访客', value: valueOf('miniAppNewVisitors'), key: 'miniAppNewVisitors' },
        { title: 'H5访客', value: valueOf('h5Visitors'), key: 'h5Visitors' },
        { title: 'H5新增访客', value: valueOf('h5NewVisitors'), key: 'h5NewVisitors' }
    ];
    
    // 辅助函数：计算聚合指标的环比
    function calculateAggregateMom(metricKey, currentIndex, dataSet) {
        if (currentIndex < 0 || currentIndex >= dataSet.length - 1) return 0;
        const previousData = dataSet[currentIndex + 1];
        if (!previousData) return 0;
        
        let previousValue = 0;
        if (metricKey === 'totalVisitors') {
            previousValue = MetricsUtils.safeNumber(previousData.miniAppVisitors) + MetricsUtils.safeNumber(previousData.h5Visitors);
        } else if (metricKey === 'totalNewVisitors') {
            previousValue = MetricsUtils.safeNumber(previousData.miniAppNewVisitors) + MetricsUtils.safeNumber(previousData.h5NewVisitors);
        }
        
        return previousValue > 0 ? previousValue : 0;
    }
    
    // 辅助函数：计算聚合指标的同比
    function calculateAggregateYoy(metricKey, yearAgoData) {
        if (!yearAgoData) return null;
        
        let yearAgoValue = 0;
        if (metricKey === 'totalVisitors') {
            yearAgoValue = MetricsUtils.safeNumber(yearAgoData.miniAppVisitors) + MetricsUtils.safeNumber(yearAgoData.h5Visitors);
        } else if (metricKey === 'totalNewVisitors') {
            yearAgoValue = MetricsUtils.safeNumber(yearAgoData.miniAppNewVisitors) + MetricsUtils.safeNumber(yearAgoData.h5NewVisitors);
        }
        
        return yearAgoValue > 0 ? yearAgoValue : null;
    }
    
    overallContainer.innerHTML = overallMetrics.map(metric => {
        const dataSet = App.dataMode === 'weekly' ? aibcWeeklyData : aibcMonthlyData;
        if (!Array.isArray(dataSet) || dataSet.length === 0) return '';
        let momChange = 0;
        let yoyChange = null;
        let hasYoyData = false;
        
        // 计算环比
        const currentIndex = dataSet.findIndex(d => d.period === currentPeriod);
        
        if (metric.isAggregate) {
            // 聚合指标：手动计算环比
            const previousValue = calculateAggregateMom(metric.key, currentIndex, dataSet);
            if (previousValue > 0) {
                momChange = MetricsUtils.calculateChange(metric.value, previousValue);
            }
        } else if (currentIndex >= 0 && currentIndex < dataSet.length - 1) {
            // 普通指标：从数据集中获取
            const previousData = dataSet[currentIndex + 1];
            if (previousData && previousData[metric.key] !== undefined && previousData[metric.key] !== null && previousData[metric.key] > 0) {
                momChange = MetricsUtils.calculateChange(data[metric.key], previousData[metric.key]);
            }
        }
        
        // 计算同比
        if (currentPeriod) {
            const yearAgoData = getYearAgoData(currentPeriod);
            
            if (metric.isAggregate) {
                // 聚合指标：手动计算同比
                const yearAgoValue = calculateAggregateYoy(metric.key, yearAgoData);
                if (yearAgoValue !== null && yearAgoValue > 0) {
                    yoyChange = MetricsUtils.calculateChange(metric.value, yearAgoValue);
                    hasYoyData = true;
                }
            } else if (yearAgoData && yearAgoData[metric.key] !== undefined && yearAgoData[metric.key] !== null && yearAgoData[metric.key] > 0) {
                // 普通指标：从数据集中获取
                yoyChange = MetricsUtils.calculateChange(data[metric.key], yearAgoData[metric.key]);
                hasYoyData = true;
            }
        }
        
        const momDisplay = momChange === '--' ? '--' : `${parseFloat(momChange) >= 0 ? '+' : ''}${momChange}%`;
        const momClass = momChange !== '--' && parseFloat(momChange) >= 0 ? 'positive' : 'negative';
        const hasDailyValue = metric.dailyValue !== undefined && metric.dailyValue !== null;
        
        return `
            <div class="detail-metric-card">
                <div class="detail-metric-title">${MetricsUtils.escapeHtml(metric.title)}</div>
                <div class="detail-metric-value">${formatNumber(metric.value)}</div>
                <div class="detail-metric-changes ${hasDailyValue ? 'three-items' : ''}">
                    <div class="detail-change-item">
                        <div class="detail-change-type">环比</div>
                        <div class="detail-change-percent ${momClass}">
                            ${momDisplay}
                        </div>
                    </div>
                    ${hasDailyValue ? `
                    <div class="detail-change-item daily-item">
                        <div class="detail-change-type">日均</div>
                        <div class="detail-change-percent">${formatNumber(metric.dailyValue)}</div>
                    </div>
                    ` : ''}
                    ${hasYoyData ? `
                    <div class="detail-change-item">
                        <div class="detail-change-type">同比</div>
                        <div class="detail-change-percent ${parseFloat(yoyChange) >= 0 ? 'positive' : 'negative'}">
                            ${parseFloat(yoyChange) >= 0 ? '+' : ''}${yoyChange}%
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // 生成筛选器 - 使用 MultiSelectWidget 组件
    const allMerchants = data.merchants ? Object.keys(data.merchants).sort() : [];
    
    // 初始化选中的商家（如果还没有选择，则默认选择访客数最多的4个）
    if (aibcSelectedMerchants.size === 0 && allMerchants.length > 0) {
        const merchantsByVisitors = allMerchants
            .map(name => ({ name, visitors: MetricsUtils.safeNumber(data.merchants[name]) }))
            .sort((a, b) => b.visitors - a.visitors)
            .slice(0, 4)
            .map(item => item.name);
        merchantsByVisitors.forEach(m => aibcSelectedMerchants.add(m));
    }

    // 首次创建卡片选择器实例
    if (!merchantCardSelector) {
        merchantCardSelector = new MultiSelectWidget({
            containerId:    'merchantCardSelectorContainer',
            buttonId:       'merchantCardSelectorButton',
            dropdownId:     'merchantCardSelectorDropdown',
            textId:         'merchantCardSelectorText',
            checkboxPrefix: 'merchant-card-',
            onChange: null
        });
    }

    // 每次刷新都更新回调，避免选择器继续引用旧周期数据
    merchantCardSelector.onChange = (selected) => {
        aibcSelectedMerchants.clear();
        selected.forEach(m => aibcSelectedMerchants.add(m));
        generateAibcMerchantCards(data, currentPeriod);
    };

    // 初始化/刷新选项，传入当前选中项
    merchantCardSelector.init(allMerchants, Array.from(aibcSelectedMerchants), false);
    
    // 生成商家卡片
    generateAibcMerchantCards(data, currentPeriod);
}

// 生成智书商家卡片
function generateAibcMerchantCards(data, currentPeriod) {
    const merchantContainer = document.getElementById('aibcMerchantMetrics');
    if (!merchantContainer || !data || !data.merchants) return;
    
    const merchants = Array.from(aibcSelectedMerchants)
        .filter(name => data.merchants && name in data.merchants)
        .map(name => [name, data.merchants[name]]);
    
    merchantContainer.innerHTML = merchants.map(([name, value], index) => {
        const dataSet = App.dataMode === 'weekly' ? aibcWeeklyData : aibcMonthlyData;
        if (!Array.isArray(dataSet)) return '';
        const currentValue = MetricsUtils.safeNumber(value);
        let momChange = 0;
        let yoyChange = null;
        let hasYoyData = false;
        
        // 计算环比 - 找到当前数据在数组中的位置，然后获取前一个月的数据
        const currentIndex = dataSet.findIndex(d => d.period === currentPeriod);
        if (currentIndex >= 0 && currentIndex < dataSet.length - 1) {
            const previousData = dataSet[currentIndex + 1];
            if (previousData && previousData.merchants && previousData.merchants[name] !== undefined) {
                const previousValue = MetricsUtils.safeNumber(previousData.merchants[name]);
                if (previousValue > 0) {
                    momChange = MetricsUtils.calculateChange(currentValue, previousValue);
                }
            }
        }
        
        // 计算同比（仅在月度模式下）
        if (App.dataMode === 'monthly' && currentPeriod) {
            const yearAgoData = getYearAgoData(currentPeriod);
            if (yearAgoData && yearAgoData.merchants && yearAgoData.merchants[name] !== undefined && yearAgoData.merchants[name] !== null) {
                const yearAgoValue = MetricsUtils.safeNumber(yearAgoData.merchants[name]);
                if (yearAgoValue > 0) {
                    yoyChange = MetricsUtils.calculateChange(currentValue, yearAgoValue);
                    hasYoyData = true;
                }
            }
        }
        const momDisplay = momChange === '--' ? '--' : `${parseFloat(momChange) >= 0 ? '+' : ''}${momChange}%`;
        const momClass = momChange !== '--' && parseFloat(momChange) >= 0 ? 'positive' : 'negative';
        
        return `
            <div class="detail-metric-card">
                <div class="detail-metric-title">${MetricsUtils.escapeHtml(name)}</div>
                <div class="detail-metric-value">${formatNumber(value)}</div>
                <div class="detail-metric-changes">
                    <div class="detail-change-item">
                        <div class="detail-change-type">环比</div>
                        <div class="detail-change-percent ${momClass}">
                            ${momDisplay}
                        </div>
                    </div>
                    ${App.dataMode === 'monthly' ? `
                    <div class="detail-change-item">
                        <div class="detail-change-type">同比</div>
                        <div class="detail-change-percent ${hasYoyData ? (parseFloat(yoyChange) >= 0 ? 'positive' : 'negative') : 'no-data'}">
                            ${hasYoyData ? (parseFloat(yoyChange) >= 0 ? '+' : '') + yoyChange + '%' : '-'}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 当前图表视图模式
let aibcChartViewMode = 'total'; // 'total', 'miniApp', 'h5'
let aibcChartTogglesInitialized = false;

// 创建智书图表
function createAibcCharts(data, renderSessionId = ChartUtils._renderSessionId) {
    const dataSet = App.dataMode === 'weekly' ? aibcWeeklyData : aibcMonthlyData;
    if (!data || !Array.isArray(dataSet) || dataSet.length === 0 || !ChartUtils.isActiveRenderSession(renderSessionId)) return;
    
    ChartUtils.renderWhenReady(() => {
        // 初始化切换按钮事件
        initAibcChartToggles();
        
        // 整体访客趋势图
        updateAibcOverallChart(dataSet);
        
        // 商家访客趋势图 - 显示第一个商家的数据
        if (data.merchants) {
            const merchantNames = Object.keys(data.merchants);
            if (merchantNames.length > 0) {
                updateAibcMerchantChart(merchantNames[0]);
            }
        }
        
        // 统一隐藏骨架屏
        ChartUtils.hideAllSkeletons();
    }, 2, renderSessionId);
}

// 初始化图表切换按钮
function initAibcChartToggles() {
    if (aibcChartTogglesInitialized) return;
    aibcChartTogglesInitialized = true;
    
    const totalBtn = document.getElementById('aibcChartToggleTotal');
    const miniAppBtn = document.getElementById('aibcChartToggleMiniApp');
    const h5Btn = document.getElementById('aibcChartToggleH5');
    
    totalBtn?.addEventListener('click', () => {
        if (aibcChartViewMode !== 'total') {
            aibcChartViewMode = 'total';
            updateToggleButtons();
            updateAibcOverallChart(App.dataMode === 'weekly' ? aibcWeeklyData : aibcMonthlyData);
        }
    });
    
    miniAppBtn?.addEventListener('click', () => {
        if (aibcChartViewMode !== 'miniApp') {
            aibcChartViewMode = 'miniApp';
            updateToggleButtons();
            updateAibcOverallChart(App.dataMode === 'weekly' ? aibcWeeklyData : aibcMonthlyData);
        }
    });
    
    h5Btn?.addEventListener('click', () => {
        if (aibcChartViewMode !== 'h5') {
            aibcChartViewMode = 'h5';
            updateToggleButtons();
            updateAibcOverallChart(App.dataMode === 'weekly' ? aibcWeeklyData : aibcMonthlyData);
        }
    });
}

// 更新切换按钮状态
function updateToggleButtons() {
    const totalBtn = document.getElementById('aibcChartToggleTotal');
    const miniAppBtn = document.getElementById('aibcChartToggleMiniApp');
    const h5Btn = document.getElementById('aibcChartToggleH5');
    
    [totalBtn, miniAppBtn, h5Btn].forEach(btn => btn?.classList.remove('active'));
    
    switch(aibcChartViewMode) {
        case 'total':
            totalBtn?.classList.add('active');
            break;
        case 'miniApp':
            miniAppBtn?.classList.add('active');
            break;
        case 'h5':
            h5Btn?.classList.add('active');
            break;
    }
}

// 更新整体访客趋势图
function updateAibcOverallChart(dataSet) {
    const overallCtx = document.getElementById('aibcOverallChart');
    if (!overallCtx || !Array.isArray(dataSet) || dataSet.length === 0) return;
    
    // 限制显示近25个周期，统一保持左旧右新
    const limitedDataSet = getAibcChronologicalData(dataSet, 25);
    
    // 简化横坐标显示，去掉年份；limitedDataSet 已按时间正序排列，保持左旧右新
    const labels = limitedDataSet.map(d => formatAibcPeriodLabel(d.period));
    
    // 获取图表数据：limitedDataSet 已经是旧到新顺序，不再反转
    const getSafe = (row, key) => MetricsUtils.safeNumber(row && row[key]);
    const totalVisitorsData = limitedDataSet.map(d => getSafe(d, 'miniAppVisitors') + getSafe(d, 'h5Visitors'));
    const totalNewVisitorsData = limitedDataSet.map(d => getSafe(d, 'miniAppNewVisitors') + getSafe(d, 'h5NewVisitors'));
    const miniAppVisitorsData = limitedDataSet.map(d => getSafe(d, 'miniAppVisitors'));
    const miniAppNewVisitorsData = limitedDataSet.map(d => getSafe(d, 'miniAppNewVisitors'));
    const h5VisitorsData = limitedDataSet.map(d => getSafe(d, 'h5Visitors'));
    const h5NewVisitorsData = limitedDataSet.map(d => getSafe(d, 'h5NewVisitors'));
    
    const totalVisitorsMom = MetricsUtils.calculateMom(totalVisitorsData);
    const totalNewVisitorsMom = MetricsUtils.calculateMom(totalNewVisitorsData);
    const miniAppVisitorsMom = MetricsUtils.calculateMom(miniAppVisitorsData);
    const miniAppNewVisitorsMom = MetricsUtils.calculateMom(miniAppNewVisitorsData);
    const h5VisitorsMom = MetricsUtils.calculateMom(h5VisitorsData);
    const h5NewVisitorsMom = MetricsUtils.calculateMom(h5NewVisitorsData);
    
    // 根据视图模式选择数据集
    let datasets = [];
    let momDataArray = [];
    // 高对比度色板配置
    const colorPalette = {
        blue: '#1e40af',      // 深蓝色 - 主数据
        orange: '#f97316',    // 亮橙色 - 对比数据
        green: '#059669',     // 翠绿色 - 正向指标
        purple: '#7c3aed',    // 紫色 - 区分数据
        red: '#dc2626',       // 红色 - 强调/警告
        cyan: '#06b6d4',      // 青色 - 额外数据
        darkBlue: '#1e3a8a',  // 更深蓝
        teal: '#14b8a6'       // 青色变体
    };
    
    switch(aibcChartViewMode) {
        case 'total':
            datasets = [
                {
                    label: '总访客',
                    data: totalVisitorsData,
                    borderColor: colorPalette.blue,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return 'rgba(30, 64, 175, 0.1)';
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(30, 64, 175, 0.02)');
                        gradient.addColorStop(1, 'rgba(30, 64, 175, 0.15)');
                        return gradient;
                    },
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: colorPalette.blue,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: colorPalette.blue,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 3
                },
                {
                    label: '总新增访客',
                    data: totalNewVisitorsData,
                    borderColor: colorPalette.orange,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return 'rgba(249, 115, 22, 0.1)';
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(249, 115, 22, 0.02)');
                        gradient.addColorStop(1, 'rgba(249, 115, 22, 0.15)');
                        return gradient;
                    },
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: colorPalette.orange,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: colorPalette.orange,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 3
                }
            ];
            momDataArray = [totalVisitorsMom, totalNewVisitorsMom];
            break;
        case 'miniApp':
            datasets = [
                {
                    label: '小程序访客',
                    data: miniAppVisitorsData,
                    borderColor: colorPalette.blue,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return 'rgba(30, 64, 175, 0.1)';
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(30, 64, 175, 0.02)');
                        gradient.addColorStop(1, 'rgba(30, 64, 175, 0.15)');
                        return gradient;
                    },
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: colorPalette.blue,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: colorPalette.blue,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 3
                },
                {
                    label: '小程序新增访客',
                    data: miniAppNewVisitorsData,
                    borderColor: colorPalette.purple,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return 'rgba(124, 58, 237, 0.1)';
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(124, 58, 237, 0.02)');
                        gradient.addColorStop(1, 'rgba(124, 58, 237, 0.15)');
                        return gradient;
                    },
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: colorPalette.purple,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: colorPalette.purple,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 3
                }
            ];
            momDataArray = [miniAppVisitorsMom, miniAppNewVisitorsMom];
            break;
        case 'h5':
            datasets = [
                {
                    label: 'H5访客',
                    data: h5VisitorsData,
                    borderColor: colorPalette.green,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return 'rgba(5, 150, 105, 0.1)';
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(5, 150, 105, 0.02)');
                        gradient.addColorStop(1, 'rgba(5, 150, 105, 0.15)');
                        return gradient;
                    },
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: colorPalette.green,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: colorPalette.green,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 3
                },
                {
                    label: 'H5新增访客',
                    data: h5NewVisitorsData,
                    borderColor: colorPalette.cyan,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return 'rgba(6, 182, 212, 0.1)';
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.02)');
                        gradient.addColorStop(1, 'rgba(6, 182, 212, 0.15)');
                        return gradient;
                    },
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: colorPalette.cyan,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: colorPalette.cyan,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 3
                }
            ];
            momDataArray = [h5VisitorsMom, h5NewVisitorsMom];
            break;
    }
    
    // 标记最高/最低点
    datasets.forEach((dataset, idx) => {
        const data = dataset.data;
        const validData = MetricsUtils.filterValidNumbers(data);
        const maxVal = validData.length > 0 ? Math.max(...validData) : null;
        const minVal = validData.length > 0 ? Math.min(...validData) : null;
        dataset.pointBackgroundColor = data.map(v => {
            if (maxVal !== null && v === maxVal) return '#ef4444'; // 红色标记最高点
            if (minVal !== null && v === minVal) return '#22c55e'; // 绿色标记最低点
            return dataset.borderColor;
        });
        dataset.pointRadius = data.map(v => {
            if ((maxVal !== null && v === maxVal) || (minVal !== null && v === minVal)) return 6;
            return 4;
        });
    });
    
    const yAxisBounds = MetricsUtils.getSmartYAxisBounds(datasets.flatMap(dataset => dataset.data), {
        startAtZero: false,
        minFloor: 0
    });
    
    if (App.charts.aibcOverall) {
        App.charts.aibcOverall.destroy();
    }
    App.charts.aibcOverall = new Chart(overallCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        color: '#1f2937',
                        boxWidth: 8,
                        boxHeight: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    cornerRadius: 8,
                    padding: 14,
                    displayColors: true,
                    titleFont: {
                        size: 13,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 12
                    },
                    usePointStyle: true,
                    callbacks: {
                        title: function() { return ''; },
                        label: function(context) {
                            const datasetIndex = context.datasetIndex;
                            const dataIndex = context.dataIndex;
                            const value = context.parsed.y;
                            const mom = momDataArray[datasetIndex] ? momDataArray[datasetIndex][dataIndex] : null;
                            const formattedValue = value >= 10000 ? (value / 10000).toFixed(2) + ' 万' : 
                                                  value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value;
                            let label = `${context.dataset.label}: ${formattedValue}`;
                            if (mom !== null && mom !== undefined && mom !== 'null') {
                                const momSign = parseFloat(mom) >= 0 ? '+' : '';
                                label += ' (环比: ' + momSign + mom + '%)';
                            }
                            return label;
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: yAxisBounds.beginAtZero,
                    suggestedMin: yAxisBounds.suggestedMin,
                    suggestedMax: yAxisBounds.suggestedMax,
                    grid: {
                        color: 'rgba(156, 163, 175, 0.3)',
                        lineWidth: 1,
                        drawBorder: false,
                        borderDash: [5, 5]
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: '500'
                        },
                        color: '#6b7280',
                        padding: 8,
                        callback: function(value) {
                            if (value >= 10000) {
                                return (value / 10000).toFixed(1) + '万';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'k';
                            }
                            return value;
                        }
                    },
                    border: {
                        display: false
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 10,
                            weight: '500'
                        },
                        color: '#6b7280',
                        padding: 8,
                        maxRotation: 45,
                        minRotation: 45
                    },
                    border: {
                        display: false
                    }
                }
            },
            elements: {
                line: {
                    capStyle: 'round',
                    joinStyle: 'round'
                }
            }
        },
        plugins: [
            {
                id: 'customDataLabels',
                afterDatasetsDraw(chart) {
                    const ctx = chart.ctx;
                    const offsets = [-12, 20, -30, 38];
                    const baselines = ['bottom', 'top', 'bottom', 'top'];
                    
                    chart.data.datasets.forEach((dataset, datasetIndex) => {
                        const meta = chart.getDatasetMeta(datasetIndex);
                        const offset = offsets[datasetIndex % offsets.length];
                        const baseline = baselines[datasetIndex % baselines.length];
                        
                        meta.data.forEach((element, index) => {
                            const data = dataset.data[index];
                            if (data !== null && data !== undefined && data > 0) {
                                const x = element.x;
                                const y = element.y;
                                ctx.fillStyle = dataset.borderColor;
                                ctx.font = 'bold 10px sans-serif';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = baseline;
                                const displayValue = data >= 10000 ? (data / 10000).toFixed(1) + 'w' : 
                                                      data >= 1000 ? (data / 1000).toFixed(1) + 'k' : data;
                                ctx.fillText(displayValue, x, y + offset);
                            }
                        });
                    });
                }
            }
        ]
    });
}

// 切换数据模式
