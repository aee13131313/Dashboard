function updateKeyMetrics(period) {
    const current = getDataForPeriod(period);
    const previous = getPreviousPeriodData(period);
    const yearAgo = getYearAgoData(period);

    if (!current) return;

    // 更新生产数据
    document.getElementById('productionValue').textContent = formatNumber(current.production);
    
    if (previous) {
        const momChange = MetricsUtils.calculateChange(current.production, previous.production);
        const momElement = document.getElementById('productionMoM');
        if (momChange !== '--') {
            momElement.textContent = (parseFloat(momChange) >= 0 ? '+' : '') + momChange + '%';
            momElement.className = 'change-value ' + (parseFloat(momChange) >= 0 ? 'positive' : 'negative');
        } else {
            momElement.textContent = '--';
            momElement.className = 'change-value';
        }
    }
    
    if (yearAgo) {
        const yoyChange = MetricsUtils.calculateChange(current.production, yearAgo.production);
        const yoyElement = document.getElementById('productionYoY');
        if (yoyChange !== '--') {
            yoyElement.textContent = (parseFloat(yoyChange) >= 0 ? '+' : '') + yoyChange + '%';
            yoyElement.className = 'change-value ' + (parseFloat(yoyChange) >= 0 ? 'positive' : 'negative');
        } else {
            yoyElement.textContent = '--';
            yoyElement.className = 'change-value';
        }
    }

    // 更新消费数据
    document.getElementById('consumptionValue').textContent = formatNumber(current.totalConsumption);
    
    if (previous) {
        const momChange = MetricsUtils.calculateChange(current.totalConsumption, previous.totalConsumption);
        const momElement = document.getElementById('consumptionMoM');
        if (momChange !== '--') {
            momElement.textContent = (parseFloat(momChange) >= 0 ? '+' : '') + momChange + '%';
            momElement.className = 'change-value ' + (parseFloat(momChange) >= 0 ? 'positive' : 'negative');
        } else {
            momElement.textContent = '--';
            momElement.className = 'change-value';
        }
    }
    
    if (yearAgo) {
        const yoyChange = MetricsUtils.calculateChange(current.totalConsumption, yearAgo.totalConsumption);
        const yoyElement = document.getElementById('consumptionYoY');
        if (yoyChange !== '--') {
            yoyElement.textContent = (parseFloat(yoyChange) >= 0 ? '+' : '') + yoyChange + '%';
            yoyElement.className = 'change-value ' + (parseFloat(yoyChange) >= 0 ? 'positive' : 'negative');
        } else {
            yoyElement.textContent = '--';
            yoyElement.className = 'change-value';
        }
    }
}

// 生成详细指标
function generateDetailedMetrics(period) {
    const current = getDataForPeriod(period);
    const previous = getPreviousPeriodData(period);
    const yearAgo = getYearAgoData(period);

    if (!current) return;

    // 验证数据关系
    const validationResults = validateDataRelationships([current]);
    if (validationResults.length > 0) {
        console.warn('数据关系验证发现问题:', validationResults);
    }

    // 按4个方面分类的指标
    const categories = {
        production: [
            { key: 'production', title: '生产（发布资料）' },
            { key: 'collection', title: '征集（创建专辑）' }
        ],
        consumption: [
            { key: 'totalConsumption', title: '总消费', formula: 'B端消费 + C端消费' },
            { key: 'consumptionRatio', title: '消费占比', isPercentage: true, formula: '总消费 ÷ 大盘消费' },
            { key: 'cConsumption', title: '消费（C端）', formula: '消费（C-储值） + 消费（C-现金）' },
            { key: 'bConsumption', title: '消费（B端）' },
            { key: 'cStoredConsumption', title: '消费（C-储值）' },
            { key: 'cCashConsumption', title: '消费（C-现金）' },
            { key: 'bookstoreConsumption', title: '书城消费（仅教辅）' }
        ],
        download: [
            { key: 'totalDownload', title: '总下载量', formula: '付费下载 + 免费下载' },
            { key: 'paidDownload', title: '下载量（付费）' },
            { key: 'freeDownload', title: '下载量（免费）' }
        ],
        user: [
            { key: 'loginVisitorUV', title: '登录访客UV' },
            { key: 'totalDownloadUsers', title: '总下载用户', formula: 'C端用户 + B端储值卡用户 + B端免费用户' },
            { key: 'cDownloadUsers', title: '下载用户（C端）' },
            { key: 'bCardDownloadUsers', title: '下载用户（B端储值卡）' },
            { key: 'bFreeDownloadUsers', title: '下载用户（B端免费）' }
        ]
    };

    // 生成各分类的指标卡片
    Object.keys(categories).forEach(categoryKey => {
        const containerMap = {
            production: 'productionSection',
            consumption: 'consumptionSection',
            download: 'downloadSection',
            user: 'userSection'
        };
        
        const container = document.getElementById(containerMap[categoryKey]);
        if (!container) return;
        
        container.innerHTML = categories[categoryKey].map(metric => {
            const value = current[metric.key];
            const displayValue = metric.isPercentage ? formatPercentage(value) : formatNumber(value);
            
            let momChange = '--', yoyChange = '--';
            if (previous && previous[metric.key] !== undefined && previous[metric.key] !== null && previous[metric.key] !== 0) {
                momChange = MetricsUtils.calculateChange(value, previous[metric.key]);
            }
            if (yearAgo && yearAgo[metric.key] !== undefined && yearAgo[metric.key] !== null && yearAgo[metric.key] !== 0) {
                yoyChange = MetricsUtils.calculateChange(value, yearAgo[metric.key]);
            }

            // 计算验证值（如果有公式）
            let calculatedValue = '';
            if (metric.formula) {
                let calculated = 0;
                switch (metric.key) {
                    case 'totalConsumption':
                        calculated = MetricsUtils.safeNumber(current.bConsumption) + MetricsUtils.safeNumber(current.cConsumption);
                        break;
                    case 'cConsumption':
                        calculated = MetricsUtils.safeNumber(current.cStoredConsumption) + MetricsUtils.safeNumber(current.cCashConsumption);
                        break;
                    case 'consumptionRatio':
                        calculated = MetricsUtils.safeRatio(current.totalConsumption, current.marketConsumption, 100, null);
                        break;
                    case 'totalDownload':
                        calculated = MetricsUtils.safeNumber(current.paidDownload) + MetricsUtils.safeNumber(current.freeDownload);
                        break;
                    case 'totalDownloadUsers':
                        calculated = MetricsUtils.safeNumber(current.cDownloadUsers) + MetricsUtils.safeNumber(current.bCardDownloadUsers) + MetricsUtils.safeNumber(current.bFreeDownloadUsers);
                        break;
                }
                const calculatedDisplay = calculated === null ? '-' : (metric.isPercentage ? calculated.toFixed(2) + '%' : formatNumber(calculated));
                const isMatch = calculated !== null && Math.abs(MetricsUtils.safeNumber(value) - calculated) < (metric.isPercentage ? 0.01 : 1);
                calculatedValue = `
                    <div class="formula-info">
                        <div class="formula-text">${metric.formula}</div>
                        <div class="calculated-value ${isMatch ? 'match' : 'mismatch'}">
                            计算值: ${calculatedDisplay} ${isMatch ? '✓' : '⚠️'}
                        </div>
                    </div>
                `;
            }

            // 特殊处理消费（B端）、消费（储值）、消费（现金）- 添加占比（占总消费的比例）
            // 以及下载用户（C端）、下载用户（B端储值卡）、下载用户（B端免费）- 添加占比（占总下载用户的比例）
            let extraChangeItem = '';
            const consumptionRatioKeys = ['bConsumption', 'cStoredConsumption', 'cCashConsumption'];
            const userRatioKeys = ['cDownloadUsers', 'bCardDownloadUsers', 'bFreeDownloadUsers'];
            const showRatio = consumptionRatioKeys.includes(metric.key) || userRatioKeys.includes(metric.key);
            if (showRatio) {
                let ratio;
                if (consumptionRatioKeys.includes(metric.key)) {
                    ratio = MetricsUtils.safeRatio(value, current.totalConsumption, 100, null);
                } else {
                    ratio = MetricsUtils.safeRatio(value, current.totalDownloadUsers, 100, null);
                }
                extraChangeItem = `
                    <div class="detail-change-item">
                        <div class="detail-change-type">占比</div>
                        <div class="detail-change-percent neutral">
                            ${ratio === null ? '-' : ratio.toFixed(1) + '%'}
                        </div>
                    </div>
                `;
            }

            const momClass = momChange !== '--' && parseFloat(momChange) >= 0 ? 'positive' : 'negative';
            const yoyClass = yoyChange !== '--' && parseFloat(yoyChange) >= 0 ? 'positive' : 'negative';
            
            return `
                <div class="detail-metric-card">
                    <div class="detail-metric-title">${metric.title}</div>
                    <div class="detail-metric-value">${displayValue}</div>
                    ${calculatedValue}
                    <div class="detail-metric-changes ${showRatio ? 'three-items' : ''}">
                        <div class="detail-change-item">
                            <div class="detail-change-type">环比</div>
                            <div class="detail-change-percent ${momClass}">
                                ${momChange !== '--' ? (parseFloat(momChange) >= 0 ? '+' : '') + momChange + '%' : '--'}
                            </div>
                        </div>
                        <div class="detail-change-item">
                            <div class="detail-change-type">同比</div>
                            <div class="detail-change-percent ${yoyClass}">
                                ${yoyChange !== '--' ? (parseFloat(yoyChange) >= 0 ? '+' : '') + yoyChange + '%' : '--'}
                            </div>
                        </div>
                        ${extraChangeItem}
                    </div>
                </div>
            `;
        }).join('');
    });

    renderBookstoreMerchantRanking(period);
}

function getActiveBookstoreMerchantRankingType() {
    const activeTab = document.querySelector('.merchant-ranking-tab.active');
    return activeTab ? activeTab.dataset.rankingType || 'consumption' : 'consumption';
}

function normalizeBookstoreMerchantRankingRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((item, index) => {
        const totalConsumption = MetricsUtils.safeNumber(
            item.totalConsumption ?? item.consumption ?? item.currentConsumption ?? item.current ?? item.value,
            0
        );
        const yearAgoConsumption = MetricsUtils.safeNumber(
            item.yearAgoConsumption ?? item.lastYearConsumption ?? item.yoyConsumption ?? item.samePeriodLastYearConsumption,
            0
        );
        const diffValue = item.diff ?? item.difference ?? item.consumptionDiff ?? (totalConsumption - yearAgoConsumption);

        return {
            rank: MetricsUtils.safeNumber(item.rank, index + 1),
            merchantId: item.merchantId ?? item.merchantID ?? item.shopId ?? item.id ?? '-',
            merchantName: item.merchantName ?? item.shopName ?? item.name ?? '-',
            totalConsumption,
            yearAgoConsumption,
            diff: MetricsUtils.safeNumber(diffValue, totalConsumption - yearAgoConsumption)
        };
    });
}

function getRowsForBookstoreMerchantRankingType(sourceRows, rankingType) {
    const rows = normalizeBookstoreMerchantRankingRows(sourceRows);

    if (rankingType === 'growth') {
        return rows
            .filter(item => item.diff > 0)
            .sort((a, b) => b.diff - a.diff)
            .slice(0, 20)
            .map((item, index) => ({ ...item, rank: index + 1 }));
    }

    if (rankingType === 'decline') {
        return rows
            .filter(item => item.diff < 0)
            .sort((a, b) => a.diff - b.diff)
            .slice(0, 20)
            .map((item, index) => ({ ...item, rank: index + 1 }));
    }

    return rows
        .sort((a, b) => b.totalConsumption - a.totalConsumption)
        .slice(0, 20)
        .map((item, index) => ({ ...item, rank: index + 1 }));
}

function getBookstoreMerchantRankingRows(period, rankingType = getActiveBookstoreMerchantRankingType()) {
    if (App.dashboard !== 'bookstore') return [];

    const current = getDataForPeriod(period);
    if (!current) return [];

    const standaloneRows = getBookstoreMerchantRankingFromStandaloneData(period, rankingType);
    if (standaloneRows.length > 0) {
        return getRowsForBookstoreMerchantRankingType(standaloneRows, rankingType);
    }

    const currentRows = getBookstoreMerchantRankingFromCurrentData(current);
    return getRowsForBookstoreMerchantRankingType(currentRows, rankingType);
}

function getBookstoreMerchantRankingFromCurrentData(current) {
    const candidateFields = [
        'merchantConsumptionRanking',
        'totalConsumptionMerchantRanking',
        'bookstoreMerchantRanking',
        'merchantRanking'
    ];

    for (const field of candidateFields) {
        if (Array.isArray(current[field])) {
            return current[field];
        }
    }

    return [];
}

function getBookstoreMerchantRankingFromStandaloneData(period, rankingType = 'consumption') {
    const rankingData = App.dataMode === 'weekly'
        ? window.bookstoreWeeklyMerchantRanking
        : window.bookstoreMonthlyMerchantRanking;

    if (!rankingData || !rankingData[period]) {
        return [];
    }

    const periodRanking = rankingData[period];
    if (Array.isArray(periodRanking)) {
        return periodRanking;
    }

    if (periodRanking && Array.isArray(periodRanking[rankingType])) {
        return periodRanking[rankingType];
    }

    if (periodRanking && Array.isArray(periodRanking.consumption)) {
        return periodRanking.consumption;
    }

    return [];
}

function showBookstoreMerchantRankingEmptyState(container, title, description) {
    const table = container.querySelector('.merchant-ranking-table');
    const tbody = document.getElementById('bookstoreMerchantRankingTableBody');

    if (tbody) tbody.innerHTML = '';
    if (table) table.style.display = 'none';

    container.querySelectorAll('.empty-ranking').forEach(el => el.remove());

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
    container.appendChild(emptyDiv);
}

function getBookstoreMerchantRankingLabel(rankingType) {
    const labels = {
        consumption: '消费排行榜',
        growth: '增长排行榜',
        decline: '下降排行榜'
    };
    return labels[rankingType] || labels.consumption;
}

function renderBookstoreMerchantRanking(period) {
    const section = document.getElementById('bookstoreMerchantRankingSection');
    const container = document.querySelector('.bookstore-merchant-ranking-container');
    const tbody = document.getElementById('bookstoreMerchantRankingTableBody');
    const table = container ? container.querySelector('.merchant-ranking-table') : null;

    if (!section || !container || !tbody || !table) return;

    section.style.display = App.dashboard === 'bookstore' ? '' : 'none';
    if (App.dashboard !== 'bookstore') return;

    const rankingType = getActiveBookstoreMerchantRankingType();
    const rows = getBookstoreMerchantRankingRows(period, rankingType);
    if (rows.length === 0) {
        showBookstoreMerchantRankingEmptyState(
            container,
            `暂无${getBookstoreMerchantRankingLabel(rankingType)}数据`,
            `当前${App.dataMode === 'weekly' ? '周度' : '月度'}数据未包含${getBookstoreMerchantRankingLabel(rankingType)} Top20 明细，请补充书城商家排行榜数据源后展示。`
        );
        return;
    }

    table.style.display = '';
    container.querySelectorAll('.empty-ranking').forEach(el => el.remove());

    tbody.innerHTML = rows.map(item => {
        const diffClass = item.diff > 0 ? 'positive' : (item.diff < 0 ? 'negative' : 'neutral');
        const diffPrefix = item.diff > 0 ? '+' : '';
        return `
            <tr>
                <td title="${MetricsUtils.escapeHtml(item.merchantId)}">${MetricsUtils.escapeHtml(item.merchantId)}</td>
                <td title="${MetricsUtils.escapeHtml(item.merchantName)}">${MetricsUtils.escapeHtml(item.merchantName)}</td>
                <td>${formatNumber(item.totalConsumption)}</td>
                <td>${formatNumber(item.yearAgoConsumption)}</td>
                <td class="${diffClass}">${diffPrefix}${formatNumber(item.diff)}</td>
            </tr>
        `;
    }).join('');
}

// 创建核心数据图表（同比趋势）
// 获取趋势图数据（动态从数据文件读取）
function getTrendChartData(dataSet, maxPoints = 25) {
    // 获取所有周期并排序（旧的在前）
    const allPeriods = [...new Set((Array.isArray(dataSet) ? dataSet : []).map(d => d.period).filter(Boolean))].sort((a, b) => {
        return PeriodUtils.parsePeriod(a) - PeriodUtils.parsePeriod(b);
    });
    
    // 获取最新年份
    if (allPeriods.length === 0) {
        return { labels: [], currentData: [], yearAgoData: [] };
    }
    const maxYear = Math.max(...allPeriods.map(p => {
        const yearMatch = p.match(/^(\d{4})/);
        return yearMatch ? parseInt(yearMatch[1]) : 2026;
    }));
    
    // 根据数据模式决定显示范围
    let recentPeriods;
    if (App.dataMode === 'monthly') {
        // 月度模式：显示以最新月份为基准向前推12个月（跨年度）
        // 取最近12个月的数据（包含跨年数据）
        recentPeriods = allPeriods.slice(-12);
    } else {
        // 周度模式：显示当前年份的数据
        const currentYearPeriods = allPeriods.filter(period => {
            const yearMatch = period.match(/^(\d{4})/);
            return yearMatch && parseInt(yearMatch[1]) === maxYear;
        });
        // 取最近的数据点
        recentPeriods = currentYearPeriods.slice(-maxPoints);
    }
    
    // 生成标签
    const labels = recentPeriods.map(period => {
        // 匹配周度格式：YYYY.M.D-YYYY.M.D
        const weekMatch = period.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})-(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
        if (weekMatch) {
            const startMonth = parseInt(weekMatch[2]);
            const startDay = parseInt(weekMatch[3]);
            const endMonth = parseInt(weekMatch[5]);
            const endDay = parseInt(weekMatch[6]);
            if (startMonth === endMonth) {
                return `${startMonth}月${startDay}-${endDay}日`;
            }
            return `${startMonth}月${startDay}日-${endMonth}月${endDay}日`;
        }
        // 匹配月度格式：YYYY.M
        const monthMatch = period.match(/^(\d{4})\.(\d{1,2})$/);
        if (monthMatch) {
            return `${monthMatch[1]}年${parseInt(monthMatch[2])}月`;
        }
        return period;
    });
    
    // 获取当前年份数据（按时间顺序，旧的在前）
    // 优化：使用 Map 索引进行 O(1) 查找
    const currentData = recentPeriods.map(period => findDataByPeriod(period, App.dashboard, App.dataMode));
    
    // 获取去年同期数据
    const yearAgoData = recentPeriods.map(period => {
        const yearAgoPeriod = PeriodUtils.calculateYearAgoPeriod(period, App.dataMode === 'weekly');
        return yearAgoPeriod ? findDataByPeriod(yearAgoPeriod, App.dashboard, App.dataMode) : null;
    });
    
    return { labels, currentData, yearAgoData };
}

