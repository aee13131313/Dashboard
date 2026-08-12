/**
 * App 命名空间 — 看板全局状态集中管理
 * 所有核心状态通过 App.xxx 访问，避免散落的 window 全局变量
 */
const App = {
    dashboard: 'bookstore',      // 当前看板（bookstore / aibc）
    dataMode: 'weekly',          // 当前数据模式（weekly / monthly）
    charts: {},                  // 图表实例集合
    dataIndex: {                 // 数据索引缓存（O(1)查找）
        bookstore: { weekly: null, monthly: null },
        aibc: { weekly: null, monthly: null }
    },
    rankingPeriod: null,         // 当前排行榜周期
};
window.App = App;

// URL 状态管理工具
const URLState = {
    // 从 URL 读取状态
    read() {
        const params = new URLSearchParams(window.location.search);
        return {
            dashboard: params.get('dashboard') || 'bookstore',
            period: params.get('period') || 'weekly',
            date: params.get('date') || null,
            view: params.get('view') || 'simple'
        };
    },
    
    // 更新 URL 状态
    update(state) {
        const params = new URLSearchParams(window.location.search);
        
        if (state.dashboard) params.set('dashboard', state.dashboard);
        if (state.period) params.set('period', state.period);
        if (state.date) params.set('date', state.date);
        if (state.view) params.set('view', state.view);
        
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '');
        window.history.replaceState({}, '', newUrl);
    },
    
    // 同步当前状态到 URL
    sync() {
        const timeSelector = document.getElementById('timeSelector');
        const selectedDate = timeSelector ? timeSelector.value : null;
        
        // 获取当前活动的视图
        let currentView = 'simple';
        
        if (App.dashboard === 'aibc') {
            currentView = 'aibc';
        } else {
            const detailedView = document.getElementById('detailed-view');
            const materialView = document.getElementById('material-view');
            
            if (detailedView && detailedView.style.display !== 'none') {
                currentView = 'detailed';
            } else if (materialView && materialView.style.display !== 'none') {
                currentView = 'material';
            }
        }
        
        this.update({
            dashboard: App.dashboard,
            period: App.dataMode,
            date: selectedDate,
            view: currentView
        });
    }
};

// 获取当前数据模式对应的排行榜数据
function getRankingData() {
    return App.dataMode === 'weekly' ? window.aibcWeeklyRanking : window.aibcMonthlyRanking;
}

// 初始化数据索引
