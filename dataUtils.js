/**
 * 数据工具函数模块
 * 从 aiChat.js 抽取，提供数据查询、格式化、验证等通用功能
 */

// 获取当前数据集
function getCurrentDataSet() {
    if (App.dashboard === 'aibc') {
        return App.dataMode === 'weekly' ? window.aibcWeeklyData : window.aibcMonthlyData;
    } else {
        return App.dataMode === 'weekly' ? window.weeklyData : window.monthlyData;
    }
}

// 获取指定周期的数据
function getDataForPeriod(period) {
    return findDataByPeriod(period, App.dashboard, App.dataMode);
}

// 获取上一周期数据（动态从数据文件读取）
function getPreviousPeriodData(currentPeriod) {
    const dataSet = getCurrentDataSet();
    if (!dataSet || dataSet.length === 0) return null;

    // 获取所有周期并排序（最新的在前）
    const periods = [...new Set(dataSet.map(d => d.period))].sort((a, b) => {
        return PeriodUtils.parsePeriod(b) - PeriodUtils.parsePeriod(a);
    });

    const currentIndex = periods.indexOf(currentPeriod);
    if (currentIndex >= 0 && currentIndex < periods.length - 1) {
        return getDataForPeriod(periods[currentIndex + 1]);
    }
    return null;
}

// 获取去年同期数据
function getYearAgoData(currentPeriod) {
    const isWeekly = App.dataMode === 'weekly';
    const yearAgoPeriod = PeriodUtils.calculateYearAgoPeriod(currentPeriod, isWeekly);

    if (!yearAgoPeriod) return null;

    // 使用索引快速查找
    return findDataByPeriod(yearAgoPeriod, App.dashboard, App.dataMode);
}

// 工具函数：格式化数字显示（千位分隔符）
function formatNumber(num) {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString();
}

// 工具函数：格式化百分比显示
function formatPercentage(value) {
    if (value === undefined || value === null) return '-';
    return value.toFixed(1) + '%';
}

// 数据验证函数：验证指标间的计算关系
function validateDataRelationships(data) {
    const validationResults = [];

    data.forEach(item => {
        const period = item.period;

        // 1. 验证消费（C端）= 消费（储值）+ 消费（现金）
        const calculatedCConsumption = item.cStoredConsumption + item.cCashConsumption;
        const cConsumptionDiff = Math.abs(item.cConsumption - calculatedCConsumption);
        if (cConsumptionDiff > 0.01) {
            validationResults.push({
                period,
                type: 'C端消费计算',
                expected: calculatedCConsumption,
                actual: item.cConsumption,
                diff: cConsumptionDiff
            });
        }

        // 2. 验证总消费 = 消费（B）+ 消费（C）
        const calculatedTotalConsumption = item.bConsumption + item.cConsumption;
        const totalConsumptionDiff = Math.abs(item.totalConsumption - calculatedTotalConsumption);
        if (totalConsumptionDiff > 0.01) {
            validationResults.push({
                period,
                type: '总消费计算',
                expected: calculatedTotalConsumption,
                actual: item.totalConsumption,
                diff: totalConsumptionDiff
            });
        }

        // 3. 验证消费占比 = 总消费/大盘消费 * 100
        const calculatedRatio = (item.totalConsumption / item.marketConsumption * 100);
        const ratioDiff = Math.abs(item.consumptionRatio - calculatedRatio);
        if (ratioDiff > 0.01) {
            validationResults.push({
                period,
                type: '消费占比计算',
                expected: calculatedRatio.toFixed(2),
                actual: item.consumptionRatio,
                diff: ratioDiff
            });
        }

        // 4. 验证总下载量 = 下载量（付费）+ 下载量（免费）
        const calculatedTotalDownload = item.paidDownload + item.freeDownload;
        const downloadDiff = Math.abs(item.totalDownload - calculatedTotalDownload);
        if (downloadDiff > 0) {
            validationResults.push({
                period,
                type: '总下载量计算',
                expected: calculatedTotalDownload,
                actual: item.totalDownload,
                diff: downloadDiff
            });
        }

        // 5. 验证总下载用户 = 下载用户（C端）+ 下载用户（B端储值卡）+ 下载用户（B端免费）
        const calculatedTotalUsers = item.cDownloadUsers + item.bCardDownloadUsers + item.bFreeDownloadUsers;
        const usersDiff = Math.abs(item.totalDownloadUsers - calculatedTotalUsers);
        if (usersDiff > 0) {
            validationResults.push({
                period,
                type: '总下载用户计算',
                expected: calculatedTotalUsers,
                actual: item.totalDownloadUsers,
                diff: usersDiff
            });
        }
    });

    return validationResults;
}
