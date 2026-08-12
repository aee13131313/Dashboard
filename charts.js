function getMetricValue(dataPoint, metric) {
    if (!dataPoint) return null;
    const value = dataPoint[metric];
    return MetricsUtils.isFiniteNumber(value) ? value : null;
}

function addBConsumptionRatio(dataPoint) {
    if (!dataPoint) return null;
    return {
        ...dataPoint,
        bConsumptionRatio: MetricsUtils.safeRatio(dataPoint.bConsumption, dataPoint.totalConsumption, 100, 0)
    };
}

function createKeyChart(metric, canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');
    const chartKey = metric + 'Key';

    // 获取当前数据集
    const dataSet = getCurrentDataSet();
    if (!dataSet || dataSet.length === 0) return;
    
    // 获取趋势图数据（近25个周期）
    const { labels, currentData, yearAgoData } = getTrendChartData(dataSet, 25);
    
    let data2026 = currentData;
    let data2025 = yearAgoData;
    
    // 计算B端消费占比
    if (metric === 'bConsumptionRatio') {
        data2026 = data2026.map(addBConsumptionRatio);
        data2025 = data2025.map(addBConsumptionRatio);
    }
    
    const metricTitles = {
        production: '生产（发布资料）',
        collection: '征集（创建专辑）',
        totalConsumption: '总消费'
    };

    const isPercentage = metric === 'consumptionRatio' || metric === 'bConsumptionRatio';
    
    const currentLabel = '今年';
    const yearAgoLabel = '去年';

    const currentValues = MetricsUtils.filterValidNumbers(data2026.map(d => getMetricValue(d, metric)));
    const currentMax = currentValues.length > 0 ? Math.max(...currentValues) : null;
    const currentMin = currentValues.length > 0 ? Math.min(...currentValues) : null;
    
    const yearAgoValues = MetricsUtils.filterValidNumbers(data2025.map(d => getMetricValue(d, metric)));
    const yearAgoMax = yearAgoValues.length > 0 ? Math.max(...yearAgoValues) : null;
    const yearAgoMin = yearAgoValues.length > 0 ? Math.min(...yearAgoValues) : null;

    const yAxisBounds = MetricsUtils.getSmartYAxisBounds([...currentValues, ...yearAgoValues], {
        startAtZero: isPercentage,
        minFloor: 0
    });

    const chartData = {
        labels: labels,
        datasets: [{
            label: currentLabel,
            data: data2026.map(d => getMetricValue(d, metric)),
            borderColor: '#dc2626',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            tension: 0.5,
            fill: false,
            pointBackgroundColor: '#dc2626',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: data2026.map(d => {
                const val = getMetricValue(d, metric);
                if (val === currentMax || val === currentMin) return 7;
                return 5;
            }),
            pointHoverRadius: 10,
            pointHoverBackgroundColor: '#dc2626',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 3,
            segment: {
                borderDash: []
            }
        }, {
            label: yearAgoLabel,
            data: data2025.map(d => getMetricValue(d, metric)),
            borderColor: '#6b7280',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            tension: 0.5,
            fill: false,
            pointBackgroundColor: '#6b7280',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: data2025.map(d => {
                const val = getMetricValue(d, metric);
                if (val === yearAgoMax || val === yearAgoMin) return 7;
                return 5;
            }),
            pointHoverRadius: 10,
            pointHoverBackgroundColor: '#6b7280',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 3,
            segment: {
                borderDash: [5, 5]
            }
        }]
    };

    const chartOptions = {
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
                borderColor: '#dc2626',
                borderWidth: 2,
                cornerRadius: 8,
                padding: 14,
                displayColors: true,
                usePointStyle: true,
                callbacks: {
                    title: function() { return ''; },
                    label: function(context) {
                        const value = context.parsed.y;
                        const dataIndex = context.dataIndex;
                        const isCurrent = context.datasetIndex === 0;
                        const dataPoint = isCurrent ? currentData[dataIndex] : yearAgoData[dataIndex];
                        
                        if (!dataPoint) return null;
                        
                        const period = dataPoint.period;
                        const periodLabel = App.dataMode === 'weekly' 
                            ? PeriodUtils.formatWeekDisplay(period) 
                            : PeriodUtils.formatMonthDisplay(period);
                        
                        const mom = isCurrent ? (dataPoint.mom !== undefined && dataPoint.mom !== null ? dataPoint.mom : null) : null;
                        
                        let label = periodLabel + ': ' + (isPercentage ? value.toFixed(2) + '%' : formatNumber(value));
                        if (mom !== null && mom !== undefined && mom !== 'null') {
                            const momSign = parseFloat(mom) >= 0 ? '+' : '';
                            label += ' (环比: ' + momSign + mom + '%)';
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: yAxisBounds.beginAtZero,
                suggestedMin: yAxisBounds.suggestedMin,
                suggestedMax: yAxisBounds.suggestedMax,
                grid: {
                    color: '#e5e7eb',
                    drawBorder: false,
                    lineWidth: 1
                },
                ticks: {
                    font: {
                        size: 11,
                        weight: '500'
                    },
                    color: '#6b7280',
                    padding: 8,
                    callback: function(value) {
                        if (isPercentage) {
                            return value.toFixed(1) + '%';
                        }
                        return formatNumber(value);
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
    };

    ChartUtils.createOrUpdateChart({
        chartKey: chartKey,
        ctx: chartCtx,
        type: 'line',
        data: chartData,
        options: chartOptions,
        plugins: []
    });
}
// 创建生产和总消费对比趋势图
function createProductionConsumptionComparisonChart() {
    const ctx = document.getElementById('productionConsumptionComparisonChart');
    if (!ctx) {
        console.warn('productionConsumptionComparisonChart canvas not found');
        return;
    }
    
    const chartCtx = ctx.getContext('2d');
    const chartKey = 'productionConsumptionComparison';

    // 获取当前数据集
    const dataSet = getCurrentDataSet();
    if (!dataSet || dataSet.length === 0) {
        console.warn('No data available for production consumption chart');
        return;
    }
    
    // 获取趋势图数据（近25个周期）
    const { labels, currentData, yearAgoData } = getTrendChartData(dataSet, 25);
    
    // 过滤掉 null 数据点，同时保持 labels 和数据同步
    const filteredLabels = [];
    const filteredCurrentData = [];
    const filteredYearAgoData = [];
    
    currentData.forEach((d, index) => {
        if (d && d.production !== null && d.production !== undefined && 
            d.totalConsumption !== null && d.totalConsumption !== undefined) {
            filteredCurrentData.push(d);
            filteredYearAgoData.push(yearAgoData[index] || null);
            filteredLabels.push(labels[index]);
        }
    });
    
    if (filteredCurrentData.length === 0) {
        console.warn('No valid data points for production consumption chart');
        return;
    }
    
    // 生产数据（柱状图）
    const productionData = filteredCurrentData.map(d => d.production);
    const productionYearAgoData = filteredYearAgoData.map(d => d ? d.production : null);
    
    // 消费数据（折线图）
    const consumptionData = filteredCurrentData.map(d => d.totalConsumption);
    const consumptionYearAgoData = filteredYearAgoData.map(d => d ? d.totalConsumption : null);

    // 生产和消费分别计算纵坐标范围，切换时自动适配
    const consumptionYAxisBounds = MetricsUtils.getSmartYAxisBounds([...consumptionData, ...consumptionYearAgoData], {
        startAtZero: false,
        minFloor: 0
    });
    const productionYAxisBounds = MetricsUtils.getSmartYAxisBounds([...productionData, ...productionYearAgoData], {
        startAtZero: false,
        minFloor: 0
    });

    const chartData = {
        labels: filteredLabels,
        datasets: [
            // 生产 - 今年（柱状图）
            {
                label: '今年生产（发布资料）',
                type: 'bar',
                data: productionData,
                backgroundColor: 'rgba(30, 64, 175, 0.7)',
                borderColor: '#1e40af',
                borderWidth: 1,
                borderRadius: 4,
                yAxisID: 'y1',
                order: 2
            },
            // 生产 - 去年同期（柱状图）
            {
                label: '去年生产（发布资料）',
                type: 'bar',
                data: productionYearAgoData,
                backgroundColor: 'rgba(107, 114, 128, 0.5)',
                borderColor: '#6b7280',
                borderWidth: 1,
                borderRadius: 4,
                yAxisID: 'y1',
                order: 2
            },
            // 消费 - 今年（折线图）
            {
                label: '今年总消费',
                type: 'line',
                data: consumptionData,
                borderColor: '#dc2626',
                backgroundColor: 'transparent',
                borderWidth: 2.5,
                tension: 0.5,
                fill: false,
                pointBackgroundColor: '#dc2626',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#dc2626',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3,
                yAxisID: 'y',
                order: 1
            },
            // 消费 - 去年同期（折线图）
            {
                label: '去年总消费',
                type: 'line',
                data: consumptionYearAgoData,
                borderColor: '#dc2626',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.5,
                fill: false,
                pointBackgroundColor: '#dc2626',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#dc2626',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3,
                yAxisID: 'y',
                order: 1
            }
        ]
    };

    const chartOptions = {
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
                    padding: 15,
                    font: {
                        size: 11,
                        weight: '500'
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
                borderColor: '#dc2626',
                borderWidth: 2,
                cornerRadius: 8,
                padding: 14,
                displayColors: true,
                usePointStyle: true,
                callbacks: {
                    title: function() { return ''; },
                    label: function(context) {
                        const value = context.parsed.y;
                        const dataIndex = context.dataIndex;
                        const datasetIndex = context.datasetIndex;
                        const isProduction = datasetIndex < 2;
                        const isCurrent = datasetIndex % 2 === 0;
                        
                        // 获取对应的周期日期
                        const dataPoint = isCurrent ? filteredCurrentData[dataIndex] : filteredYearAgoData[dataIndex];
                        if (!dataPoint) return null;
                        
                        const period = dataPoint.period;
                        const periodLabel = App.dataMode === 'weekly' 
                            ? PeriodUtils.formatWeekDisplay(period) 
                            : PeriodUtils.formatMonthDisplay(period);
                        
                        const typeLabel = isProduction ? '（生产）' : '（消费）';
                        return periodLabel + typeLabel + ': ' + formatNumber(value);
                    }
                }
            }
        },
        scales: {
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
            },
                y: {
                type: 'linear',
                display: true,
                position: 'left',
                beginAtZero: consumptionYAxisBounds.beginAtZero,
                suggestedMin: consumptionYAxisBounds.suggestedMin,
                suggestedMax: consumptionYAxisBounds.suggestedMax,
                grid: {
                    color: '#e5e7eb',
                    drawBorder: false,
                    lineWidth: 1
                },
                ticks: {
                    font: {
                        size: 11,
                        weight: '500'
                    },
                    color: '#dc2626',
                    padding: 8,
                    callback: function(value) {
                        return formatNumber(value);
                    }
                },
                border: {
                    display: false
                },
                title: {
                    display: true,
                    text: '消费（元）',
                    font: {
                        size: 11,
                        weight: 'bold'
                    },
                    color: '#dc2626'
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                beginAtZero: productionYAxisBounds.beginAtZero,
                suggestedMin: productionYAxisBounds.suggestedMin,
                suggestedMax: productionYAxisBounds.suggestedMax,
                grid: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 11,
                        weight: '500'
                    },
                    color: '#1e40af',
                    padding: 8,
                    callback: function(value) {
                        return formatNumber(value);
                    }
                },
                border: {
                    display: false
                },
                title: {
                    display: true,
                    text: '生产（份）',
                    font: {
                        size: 11,
                        weight: 'bold'
                    },
                    color: '#1e40af'
                }
            }
        }
    };

    ChartUtils.createOrUpdateChart({
        chartKey: chartKey,
        ctx: chartCtx,
        type: 'bar',
        data: chartData,
        options: chartOptions,
        plugins: []
    });
}

function createCategoryChart(category, metric) {
    const canvasId = category + 'Chart';
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');

    // 获取当前数据集
    const dataSet = getCurrentDataSet();
    if (!dataSet || dataSet.length === 0) return;
    
    // 获取趋势图数据（近12个周期）
    const { labels, currentData, yearAgoData } = getTrendChartData(dataSet, 25);
    
    let data2026 = currentData;
    let data2025 = yearAgoData;
    
    // 计算B端消费占比
    if (metric === 'bConsumptionRatio') {
        data2026 = data2026.map(addBConsumptionRatio);
        data2025 = data2025.map(addBConsumptionRatio);
    }
    
    const metricTitles = {
        production: '生产（发布资料）',
        collection: '征集（创建专辑）',
        totalConsumption: '总消费',
        cConsumption: 'C端消费',
        cStoredConsumption: '消费（储值）',
        cCashConsumption: '消费（现金）',
        bConsumption: 'B端消费',
        bConsumptionRatio: 'B端消费占比',
        bookstoreConsumption: '书城消费（仅教辅）',
        marketConsumption: '大盘消费',
        consumptionRatio: '消费占比',
        totalDownload: '总下载量',
        paidDownload: '付费下载',
        freeDownload: '免费下载',
        loginVisitorUV: '登录访客UV',
        totalDownloadUsers: '总下载用户',
        cDownloadUsers: 'C端用户',
        bCardDownloadUsers: 'B端储值卡用户',
        bFreeDownloadUsers: 'B端免费用户'
    };

    const isPercentage = metric === 'consumptionRatio' || metric === 'bConsumptionRatio';
    
    const currentLabel = '今年' + metricTitles[metric];
    const yearAgoLabel = '去年' + metricTitles[metric];

    const currentValues = MetricsUtils.filterValidNumbers(data2026.map(d => getMetricValue(d, metric)));
    const currentMax = currentValues.length > 0 ? Math.max(...currentValues) : null;
    const currentMin = currentValues.length > 0 ? Math.min(...currentValues) : null;
    
    const yearAgoValues = MetricsUtils.filterValidNumbers(data2025.map(d => getMetricValue(d, metric)));
    const yearAgoMax = yearAgoValues.length > 0 ? Math.max(...yearAgoValues) : null;
    const yearAgoMin = yearAgoValues.length > 0 ? Math.min(...yearAgoValues) : null;

    const yAxisBounds = MetricsUtils.getSmartYAxisBounds([...currentValues, ...yearAgoValues], {
        startAtZero: isPercentage,
        minFloor: 0
    });

    if (App.charts[category]) {
        App.charts[category].destroy();
    }
    App.charts[category] = new Chart(chartCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: currentLabel,
                data: data2026.map(d => getMetricValue(d, metric)),
                borderColor: '#dc2626',
                backgroundColor: 'transparent',
                borderWidth: 2.5,
                tension: 0.5,
                fill: false,
                pointBackgroundColor: '#dc2626',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: data2026.map(d => {
                    const val = getMetricValue(d, metric);
                    if (val === currentMax || val === currentMin) return 7;
                    return 5;
                }),
                pointHoverRadius: 10,
                pointHoverBackgroundColor: '#dc2626',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3
            }, {
                label: yearAgoLabel,
                data: data2025.map(d => getMetricValue(d, metric)),
                borderColor: '#6b7280',
                backgroundColor: 'transparent',
                borderWidth: 2.5,
                tension: 0.5,
                fill: false,
                pointBackgroundColor: '#6b7280',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: data2025.map(d => {
                    const val = getMetricValue(d, metric);
                    if (val === yearAgoMax || val === yearAgoMin) return 7;
                    return 5;
                }),
                pointHoverRadius: 10,
                pointHoverBackgroundColor: '#6b7280',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3,
                segment: {
                    borderDash: [5, 5]
                }
            }]
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
                    borderColor: '#dc2626',
                    borderWidth: 2,
                    cornerRadius: 8,
                    padding: 14,
                    displayColors: true,
                    usePointStyle: true,
                    callbacks: {
                        title: function() { return ''; },
                        label: function(context) {
                            const value = context.parsed.y;
                            const dataIndex = context.dataIndex;
                            const isCurrent = context.datasetIndex === 0;
                            const dataPoint = isCurrent ? currentData[dataIndex] : yearAgoData[dataIndex];
                            
                            if (!dataPoint) return null;
                            
                            const period = dataPoint.period;
                            const periodLabel = App.dataMode === 'weekly' 
                                ? PeriodUtils.formatWeekDisplay(period) 
                                : PeriodUtils.formatMonthDisplay(period);
                            
                            const mom = isCurrent ? (dataPoint.mom !== undefined && dataPoint.mom !== null ? dataPoint.mom : null) : null;
                            
                            let label = periodLabel + ': ' + (isPercentage ? value.toFixed(2) + '%' : formatNumber(value));
                            if (mom !== null && mom !== undefined && mom !== 'null') {
                                const momSign = parseFloat(mom) >= 0 ? '+' : '';
                                label += ' (环比: ' + momSign + mom + '%)';
                            }
                            return label;
                        }
                    }
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
                            if (isPercentage) {
                                return value.toFixed(1) + '%';
                            }
                            return formatNumber(value);
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
        plugins: []
    });
}

// 初始化所有分类图表
function initCategoryCharts() {
    Object.keys(currentMetrics).forEach(category => {
        createCategoryChart(category, currentMetrics[category]);
    });
}

// 初始化资料维度图表
function initMaterialDimensionCharts() {
    const currentPeriod = document.getElementById('timeSelector').value;
    const currentData = getDataForPeriod(currentPeriod);
    const previousData = getPreviousPeriodData(currentPeriod);
    const yearAgoData = getYearAgoData(currentPeriod);
    
    if (!currentData) return;
    updateMaterialPeriodLabels();
    
    // 生成学段数据卡片
    generateMaterialMetrics('grade', currentData, previousData, yearAgoData);
    
    // 生成类型数据卡片
    generateMaterialMetrics('type', currentData, previousData, yearAgoData);
    
    // 生成场景数据卡片
    generateMaterialMetrics('scene', currentData, previousData, yearAgoData);
    
    // 创建学段分布饼图
    createPieChart('gradeDistributionChart', {
        '小学': getMaterialMetricValue(currentData, 'primarySchool'),
        '初中': getMaterialMetricValue(currentData, 'middleSchool'),
        '高中': getMaterialMetricValue(currentData, 'highSchool'),
        '中职': getMaterialMetricValue(currentData, 'vocationalSchool')
    });
    
    // 创建类型分布饼图（每项单独列出）
    createPieChart('typeDistributionChart', {
        '试卷': getMaterialMetricValue(currentData, 'testPaper'),
        '课件': getMaterialMetricValue(currentData, 'courseware'),
        '作业': getMaterialMetricValue(currentData, 'homework'),
        '题集': getMaterialMetricValue(currentData, 'questionSet'),
        '教案': getMaterialMetricValue(currentData, 'teachingPlan'),
        '学案': getMaterialMetricValue(currentData, 'studyGuide'),
        '备课包': getMaterialMetricValue(currentData, 'preparationPackage'),
        '素材': getMaterialMetricValue(currentData, 'material'),
        '其他类型': getMaterialMetricValue(currentData, 'otherType')
    });
    
    // 创建场景分布饼图（每项单独列出）
    createPieChart('sceneDistributionChart', {
        '同步教学': getMaterialMetricValue(currentData, 'synchronousTeaching'),
        '高考复习': getMaterialMetricValue(currentData, 'gaokaoReview'),
        '中考复习': getMaterialMetricValue(currentData, 'zhongkaoReview'),
        '寒暑假': getMaterialMetricValue(currentData, 'winterSummerVacation'),
        '小升初复习': getMaterialMetricValue(currentData, 'primaryToMiddleReview'),
        '中职复习': getMaterialMetricValue(currentData, 'vocationalReview'),
        '初中升高中衔接': getMaterialMetricValue(currentData, 'middleToHighSchool'),
        '小学升初中衔接': getMaterialMetricValue(currentData, 'primaryToMiddleSchool'),
        '竞赛': getMaterialMetricValue(currentData, 'competition'),
        '初中升中职': getMaterialMetricValue(currentData, 'middleToVocational'),
        '课后服务': getMaterialMetricValue(currentData, 'afterSchool'),
        '其他场景': getMaterialMetricValue(currentData, 'otherScene')
    });
    
    // 创建趋势图
    createMaterialTrendChart('grade', 'primarySchool');
    createMaterialTrendChart('type', 'testPaper');
    createMaterialTrendChart('scene', 'synchronousTeaching');
}

function updateMaterialPeriodLabels() {
    const currentLabel = App.dataMode === 'weekly' ? '本周' : '本月';
    const previousLabel = App.dataMode === 'weekly' ? '上周' : '上月';
    document.querySelectorAll('[data-material-current-label]').forEach(el => {
        el.textContent = currentLabel;
    });
    document.querySelectorAll('[data-material-previous-label]').forEach(el => {
        el.textContent = previousLabel;
    });
}

function hasMaterialMetric(data, key) {
    return !!data && Object.prototype.hasOwnProperty.call(data, key) && data[key] !== null && data[key] !== undefined;
}

function getMaterialMetricValue(data, key) {
    return hasMaterialMetric(data, key) ? data[key] : 0;
}

function formatMaterialCell(data, key) {
    return hasMaterialMetric(data, key) ? formatNumber(data[key]) : '-';
}

function formatMaterialCellWithPercent(data, key, percent) {
    if (!hasMaterialMetric(data, key)) return '-';
    return `${formatNumber(data[key])}<span class="percentage">(${percent}%)</span>`;
}

// 生成资料维度数据表格（按当前值降序排序）
function generateMaterialMetrics(category, currentData, previousData, yearAgoData) {
    const tableMap = {
        grade: 'gradeMetricsTable',
        type: 'typeMetricsTable',
        scene: 'sceneMetricsTable'
    };
    
    const metricsMap = {
        grade: [
            { key: 'primarySchool', title: '小学' },
            { key: 'middleSchool', title: '初中' },
            { key: 'highSchool', title: '高中' },
            { key: 'vocationalSchool', title: '中职' }
        ],
        type: [
            { key: 'testPaper', title: '试卷' },
            { key: 'courseware', title: '课件' },
            { key: 'homework', title: '作业' },
            { key: 'questionSet', title: '题集' },
            { key: 'teachingPlan', title: '教案' },
            { key: 'studyGuide', title: '学案' },
            { key: 'preparationPackage', title: '备课包' },
            { key: 'material', title: '素材' },
            { key: 'otherType', title: '其他类型' }
        ],
        scene: [
            { key: 'synchronousTeaching', title: '同步教学' },
            { key: 'gaokaoReview', title: '高考复习' },
            { key: 'zhongkaoReview', title: '中考复习' },
            { key: 'winterSummerVacation', title: '寒暑假' },
            { key: 'primaryToMiddleReview', title: '小升初复习' },
            { key: 'vocationalReview', title: '中职复习' },
            { key: 'middleToHighSchool', title: '初中升高中衔接' },
            { key: 'primaryToMiddleSchool', title: '小学升初中衔接' },
            { key: 'competition', title: '竞赛' },
            { key: 'middleToVocational', title: '初中升中职' },
            { key: 'afterSchool', title: '课后服务' },
            { key: 'otherScene', title: '其他场景' }
        ]
    };
    
    const tableBody = document.getElementById(tableMap[category]);
    if (!tableBody) return;
    
    const metrics = metricsMap[category];
    
    const getMetricValue = (data, metric) => getMaterialMetricValue(data, metric.key);
    
    // 计算当前、去年同期、上月的总和（用于计算占比）
    let currentTotal = 0, yearAgoTotal = 0, previousTotal = 0;
    metrics.forEach(metric => {
        currentTotal += getMetricValue(currentData, metric);
        yearAgoTotal += getMetricValue(yearAgoData, metric);
        previousTotal += getMetricValue(previousData, metric);
    });
    
    // 计算每个指标的本月值并按降序排序
    const sortedMetrics = metrics.map(metric => {
        const currentValue = getMetricValue(currentData, metric);
        return {
            ...metric,
            currentValue: currentValue
        };
    }).sort((a, b) => b.currentValue - a.currentValue);
    
    // 类型分布和场景分布只展示前6项，学段展示全部
    const displayMetrics = (category === 'type' || category === 'scene') ? sortedMetrics.slice(0, 6) : sortedMetrics;
    
    tableBody.innerHTML = displayMetrics.map(metric => {
        const currentValue = getMetricValue(currentData, metric);
        const previousValue = getMetricValue(previousData, metric);
        const yearAgoValue = getMetricValue(yearAgoData, metric);
        
        // 计算占比（保留整数）
        const currentPercent = currentTotal > 0 ? Math.round((currentValue / currentTotal) * 100) : 0;
        const yearAgoPercent = yearAgoTotal > 0 ? Math.round((yearAgoValue / yearAgoTotal) * 100) : 0;
        const previousPercent = previousTotal > 0 ? Math.round((previousValue / previousTotal) * 100) : 0;
        
        // 计算同比
        let yoyChange = '--', yoyDiff = '--';
        if (yearAgoValue !== 0) {
            yoyChange = MetricsUtils.calculateChange(currentValue, yearAgoValue);
            yoyDiff = currentValue - yearAgoValue;
        }
        
        // 计算环比
        let momChange = '--', momDiff = '--';
        if (previousValue !== 0) {
            momChange = MetricsUtils.calculateChange(currentValue, previousValue);
            momDiff = currentValue - previousValue;
        }
        
        const yoyClass = yoyChange !== '--' && parseFloat(yoyChange) >= 0 ? 'positive' : 'negative';
        const momClass = momChange !== '--' && parseFloat(momChange) >= 0 ? 'positive' : 'negative';
        
        return `
            <tr>
                <td style="font-weight: 700; color: #1f2937;">${MetricsUtils.escapeHtml(metric.title)}</td>
                <td class="highlight-value">${formatMaterialCellWithPercent(currentData, metric.key, currentPercent)}</td>
                <td>${formatMaterialCellWithPercent(yearAgoData, metric.key, yearAgoPercent)}</td>
                <td class="${yoyClass}">${yoyChange !== '--' ? (parseFloat(yoyChange) >= 0 ? '+' : '') + yoyChange + '%' : '--'}</td>
                <td class="${yoyClass}">${yoyDiff !== '--' ? (yoyDiff >= 0 ? '+' : '') + formatNumber(yoyDiff) : '--'}</td>
                <td>${formatMaterialCellWithPercent(previousData, metric.key, previousPercent)}</td>
                <td class="${momClass}">${momChange !== '--' ? (parseFloat(momChange) >= 0 ? '+' : '') + momChange + '%' : '--'}</td>
                <td class="${momClass}">${momDiff !== '--' ? (momDiff >= 0 ? '+' : '') + formatNumber(momDiff) : '--'}</td>
            </tr>
        `;
    }).join('');
}

// 创建饼图
function createPieChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');
    
    const labels = Object.keys(data);
    const values = Object.values(data);
    const colors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e',
        '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'
    ];
    
    if (App.charts[canvasId]) {
        App.charts[canvasId].destroy();
    }
    App.charts[canvasId] = new Chart(chartCtx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 11
                        },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = values.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
                            return context.label + ': ' + formatNumber(context.parsed) + ' (' + percentage + '%)';
                        }
                    }
                },
                // 添加数据标签插件
                datalabels: {
                    display: true,
                    color: '#ffffff',
                    font: {
                        size: 11,
                        weight: 'bold'
                    },
                    formatter: function(value, context) {
                        const total = values.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        // 只显示占比大于5%的标签，避免标签重叠
                        if (percentage >= 5) {
                            return percentage + '%';
                        }
                        return '';
                    },
                    anchor: 'center',
                    align: 'center'
                }
            }
        },
        // 添加数据标签插件
        plugins: [{
            id: 'datalabels',
            afterDatasetsDraw: function(chart) {
                const ctx = chart.ctx;
                const total = values.reduce((a, b) => a + b, 0);
                
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((element, index) => {
                        const value = dataset.data[index];
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                        
                        // 只显示占比大于5%的标签
                        if (percentage >= 5) {
                            const position = element.tooltipPosition();
                            
                            ctx.fillStyle = '#ffffff';
                            ctx.font = 'bold 11px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(percentage + '%', position.x, position.y);
                        }
                    });
                });
            }
        }]
    });
}

// 创建资料维度趋势图
function createMaterialTrendChart(category, metric) {
    const canvasId = category + 'Chart';
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');
    
    // 从当前书城数据集中获取资料维度数据，周度/月度共用同一资料维度看板
    const materialDataSet = getCurrentDataSet();
    const validData = (Array.isArray(materialDataSet) ? materialDataSet : [])
        .filter(item => hasMaterialMetric(item, metric))
        .map(item => ({
            period: item.period,
            value: item[metric]
        }));
    
    // 按时间排序（旧的在前）
    validData.sort((a, b) => {
        return PeriodUtils.parsePeriod(a.period) - PeriodUtils.parsePeriod(b.period);
    });
    
    // 取最近12个月的数据（跨年度）
    const recentData = validData.slice(-12);
    
    // 准备图表数据
    const labels = [];
    const currentYearData = [];
    const yearAgoData = [];
    
    // 遍历最近12个月的数据
    recentData.forEach(item => {
        const [year, month] = item.period.split('.');
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        
        // 当前年份数据
        currentYearData.push(item.value);
        
        // 去年同期数据
        const yearAgoPeriod = PeriodUtils.calculateYearAgoPeriod(item.period, App.dataMode === 'weekly');
        const yearAgoItem = yearAgoPeriod ? validData.find(d => d.period === yearAgoPeriod) : null;
        yearAgoData.push(yearAgoItem ? yearAgoItem.value : null);
        
        // 添加标签
        labels.push(App.dataMode === 'weekly' ? PeriodUtils.formatWeekDisplay(item.period) : `${yearNum}年${monthNum}月`);
    });
    
    const metricTitles = {
        primarySchool: '小学',
        middleSchool: '初中',
        highSchool: '高中',
        vocationalSchool: '中职',
        testPaper: '试卷',
        courseware: '课件',
        homework: '作业',
        questionSet: '题集',
        teachingPlan: '教案',
        studyGuide: '学案',
        preparationPackage: '备课包',
        material: '素材',
        otherType: '其他类型',
        synchronousTeaching: '同步教学',
        gaokaoReview: '高考复习',
        zhongkaoReview: '中考复习',
        winterSummerVacation: '寒暑假',
        primaryToMiddleReview: '小升初复习',
        vocationalReview: '中职复习',
        middleToHighSchool: '初中升高中衔接',
        primaryToMiddleSchool: '小学升初中衔接',
        competition: '竞赛',
        middleToVocational: '初中升中职',
        afterSchool: '课后服务',
        otherScene: '其他场景'
    };
    
    const datasets = [];
    
    // 添加当前年度数据（如果有）
    if (currentYearData.some(v => v !== null)) {
        datasets.push({
            label: '今年' + metricTitles[metric],
            data: currentYearData,
            borderColor: '#dc2626',
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
            pointBackgroundColor: '#dc2626',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 6,
            spanGaps: true
        });
    }
    
    // 添加去年同期数据（如果有）
    if (yearAgoData.some(v => v !== null)) {
        datasets.push({
            label: '去年' + metricTitles[metric],
            data: yearAgoData,
            borderColor: '#6b7280',
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
            pointBackgroundColor: '#6b7280',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 6,
            spanGaps: true
        });
    }

    const yAxisBounds = MetricsUtils.getSmartYAxisBounds([...currentYearData, ...yearAgoData], {
        startAtZero: false,
        minFloor: 0
    });
    
    if (App.charts[category]) {
        App.charts[category].destroy();
    }
    App.charts[category] = new Chart(chartCtx, {
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
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#10b981',
                    borderWidth: 2,
                    cornerRadius: 8,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        title: function() { return ''; },
                        label: function(context) {
                            if (context.parsed.y === null) return null;
                            const dataIndex = context.dataIndex;
                            const datasetIndex = context.datasetIndex;
                            const period = recentData[dataIndex].period;
                            
                            let displayPeriod;
                            if (datasetIndex === 0) {
                                displayPeriod = App.dataMode === 'weekly' ? PeriodUtils.formatWeekDisplay(period) : PeriodUtils.formatMonthDisplay(period);
                            } else {
                                const yearAgoPeriod = PeriodUtils.calculateYearAgoPeriod(period, App.dataMode === 'weekly');
                                displayPeriod = yearAgoPeriod
                                    ? (App.dataMode === 'weekly' ? PeriodUtils.formatWeekDisplay(yearAgoPeriod) : PeriodUtils.formatMonthDisplay(yearAgoPeriod))
                                    : '-';
                            }
                            
                            return displayPeriod + ': ' + formatNumber(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: yAxisBounds.beginAtZero,
                    suggestedMin: yAxisBounds.suggestedMin,
                    suggestedMax: yAxisBounds.suggestedMax,
                    grid: {
                        color: '#e5e7eb'
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#374151',
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#374151'
                    }
                }
            }
        }
    });
}

