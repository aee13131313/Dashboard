function initDataIndex() {
    // 书城周度数据索引
    if (typeof window.weeklyData !== 'undefined' && window.weeklyData) {
        App.dataIndex.bookstore.weekly = new Map(window.weeklyData.map(d => [d.period, d]));
    }
    // 书城月度数据索引
    if (typeof window.monthlyData !== 'undefined' && window.monthlyData) {
        App.dataIndex.bookstore.monthly = new Map(window.monthlyData.map(d => [d.period, d]));
    }
    // 智书周度数据索引
    if (typeof window.aibcWeeklyData !== 'undefined' && window.aibcWeeklyData) {
        App.dataIndex.aibc.weekly = new Map(window.aibcWeeklyData.map(d => [d.period, d]));
    }
    // 智书月度数据索引
    if (typeof window.aibcMonthlyData !== 'undefined' && window.aibcMonthlyData) {
        App.dataIndex.aibc.monthly = new Map(window.aibcMonthlyData.map(d => [d.period, d]));
    }
}

/**
 * 重建指定看板 + 周期的数据索引（懒加载场景下使用）
 */
function rebuildDataIndex(dashboard, dataMode) {
    if (dashboard === 'bookstore') {
        const data = dataMode === 'weekly' ? window.weeklyData : window.monthlyData;
        if (data) {
            App.dataIndex.bookstore[dataMode] = new Map(data.map(d => [d.period, d]));
        }
    } else if (dashboard === 'aibc') {
        const data = dataMode === 'weekly' ? window.aibcWeeklyData : window.aibcMonthlyData;
        if (data) {
            App.dataIndex.aibc[dataMode] = new Map(data.map(d => [d.period, d]));
        }
    }
}

// 为动态加载的数据创建全局引用
// 数据文件加载后会自动设置 window.xxxData
// 确保向后兼容，数据文件内部需要将数据挂载到 window 对象

// 通过索引快速查找数据
function findDataByPeriod(period, dashboard, dataMode) {
    const index = App.dataIndex[dashboard]?.[dataMode];
    return index ? index.get(period) : null;
}
