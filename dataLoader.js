/**
 * 数据懒加载工具
 * 按需从 JSON 或 JS 文件加载不同看板/周期的数据
 * CSV 为唯一数据源，JSON 为运行时格式
 *
 * 自动检测协议：
 * - http:// → fetch JSON 文件（推荐，支持懒加载）
 * - file:// → 动态加载 JS 数据文件（兼容双击打开）
 */

const DataLoader = {
    // 数据文件版本号：更新 CSV 后同步提升，避免浏览器继续读取旧 JSON/JS 缓存
    dataVersion: '20260821-weekly-20260814-0820',

    // 是否使用 file:// 协议打开
    isFileProtocol: window.location.protocol === 'file:',

    // JSON 数据文件映射（http:// 模式使用）
    jsonFiles: {
        bookstore: {
            weekly: ['bookstore-weekly.json', 'bookstore-weekly-merchant-ranking.json'],
            monthly: ['bookstore-monthly.json', 'bookstore-monthly-merchant-ranking.json']
        },
        aibc: {
            weekly: ['aibc-weekly.json', 'aibc-weekly-ranking.json'],
            monthly: ['aibc-monthly.json', 'aibc-monthly-ranking.json']
        }
    },

    // JS 数据文件映射（file:// 模式使用）
    jsFiles: {
        bookstore: {
            weekly: ['weeklyData.js', 'bookstoreWeeklyMerchantRanking.js'],
            monthly: ['monthlyData.js', 'bookstoreMonthlyMerchantRanking.js']
        },
        aibc: {
            weekly: ['aibcWeeklyData.js', 'aibcWeeklyRanking.js'],
            monthly: ['aibcMonthlyData.js', 'aibcMonthlyRanking.js']
        }
    },

    // 加载后对应的 window 全局变量名映射
    globalVarMap: {
        // JSON 文件
        'bookstore-weekly.json': 'weeklyData',
        'bookstore-monthly.json': 'monthlyData',
        'bookstore-weekly-merchant-ranking.json': 'bookstoreWeeklyMerchantRanking',
        'bookstore-monthly-merchant-ranking.json': 'bookstoreMonthlyMerchantRanking',
        'aibc-weekly.json': 'aibcWeeklyData',
        'aibc-monthly.json': 'aibcMonthlyData',
        'aibc-weekly-ranking.json': 'aibcWeeklyRanking',
        'aibc-monthly-ranking.json': 'aibcMonthlyRanking',
        // JS 文件
        'weeklyData.js': 'weeklyData',
        'monthlyData.js': 'monthlyData',
        'bookstoreWeeklyMerchantRanking.js': 'bookstoreWeeklyMerchantRanking',
        'bookstoreMonthlyMerchantRanking.js': 'bookstoreMonthlyMerchantRanking',
        'aibcWeeklyData.js': 'aibcWeeklyData',
        'aibcMonthlyData.js': 'aibcMonthlyData',
        'aibcWeeklyRanking.js': 'aibcWeeklyRanking',
        'aibcMonthlyRanking.js': 'aibcMonthlyRanking'
    },

    // 已加载的数据缓存
    loadedData: {
        bookstore: { weekly: false, monthly: false },
        aibc: { weekly: false, monthly: false }
    },

    // 正在加载的 Promise 缓存（避免重复加载）
    loadingPromises: {
        bookstore: { weekly: null, monthly: null },
        aibc: { weekly: null, monthly: null }
    },

    /**
     * 加载指定看板和周期的数据
     * @param {string} dashboard - 看板类型 ('bookstore' | 'aibc')
     * @param {string} dataMode - 数据周期 ('weekly' | 'monthly')
     * @returns {Promise} - 加载完成后的 Promise
     */
    loadData: function(dashboard, dataMode) {
        // 如果已加载，直接返回 resolved Promise
        if (this.loadedData[dashboard] && this.loadedData[dashboard][dataMode]) {
            return Promise.resolve();
        }

        // 如果正在加载，返回已有的 Promise
        if (this.loadingPromises[dashboard] && this.loadingPromises[dashboard][dataMode]) {
            return this.loadingPromises[dashboard][dataMode];
        }

        // 根据协议选择加载方式
        const files = this.isFileProtocol
            ? this.jsFiles[dashboard][dataMode]
            : this.jsonFiles[dashboard][dataMode];
        const versionedFiles = files.map(file => this.withVersion(file));

        const loadMethod = this.isFileProtocol ? 'loadScript' : 'loadJSON';
        const loadPromises = versionedFiles.map(file => this[loadMethod](file));

        const loadingPromise = Promise.all(loadPromises)
            .then(() => {
                this.loadedData[dashboard][dataMode] = true;
                this.loadingPromises[dashboard][dataMode] = null;
            })
            .catch(error => {
                this.loadingPromises[dashboard][dataMode] = null;
                console.error(`DataLoader: Failed to load ${dashboard} ${dataMode} data`, error);
                throw error;
            });

        this.loadingPromises[dashboard][dataMode] = loadingPromise;
        return loadingPromise;
    },

    /**
     * 给数据文件追加版本号，避免静态站点缓存旧数据
     */
    withVersion: function(file) {
        if (!this.dataVersion || file.includes('?')) {
            return file;
        }
        return `${file}?v=${this.dataVersion}`;
    },

    /**
     * 获取文件名对应的全局变量，兼容带 ?v= 的缓存版本参数
     */
    getGlobalName: function(file) {
        return this.globalVarMap[file.split('?')[0]];
    },

    /**
     * 通过 fetch 加载 JSON 文件，并挂载到对应的 window 全局变量
     * 用于 http:// 协议访问
     */
    loadJSON: function(url) {
        const globalName = this.getGlobalName(url);
        if (globalName && window[globalName]) {
            return Promise.resolve();
        }

        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${url}: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (globalName) {
                    window[globalName] = data;
                }
            });
    },

    /**
     * 通过动态 <script> 标签加载 JS 数据文件
     * 用于 file:// 协议访问（双击打开 HTML）
     */
    loadScript: function(src) {
        const globalName = this.getGlobalName(src);
        if (globalName && window[globalName]) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    },

    /**
     * 检查数据是否已加载
     */
    isLoaded: function(dashboard, dataMode) {
        return this.loadedData[dashboard] && this.loadedData[dashboard][dataMode];
    },

    /**
     * 预加载所有数据
     */
    preloadAll: function() {
        const promises = [];
        for (const dashboard of ['bookstore', 'aibc']) {
            for (const dataMode of ['weekly', 'monthly']) {
                if (!this.isLoaded(dashboard, dataMode)) {
                    promises.push(this.loadData(dashboard, dataMode));
                }
            }
        }
        return Promise.all(promises);
    },

    /**
     * 获取加载进度信息
     */
    getLoadStatus: function() {
        const status = {};
        for (const dashboard of ['bookstore', 'aibc']) {
            status[dashboard] = {};
            for (const dataMode of ['weekly', 'monthly']) {
                status[dashboard][dataMode] = {
                    loaded: this.loadedData[dashboard][dataMode],
                    loading: this.loadingPromises[dashboard][dataMode] !== null
                };
            }
        }
        return status;
    },

    /**
     * 重置加载状态（主要用于测试）
     */
    reset: function() {
        this.loadedData = {
            bookstore: { weekly: false, monthly: false },
            aibc: { weekly: false, monthly: false }
        };
        this.loadingPromises = {
            bookstore: { weekly: null, monthly: null },
            aibc: { weekly: null, monthly: null }
        };
    }
};
