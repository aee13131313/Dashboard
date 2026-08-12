const MetricsUtils = {
    /**
     * 计算环比变化百分比
     * @param {number} current - 当前值
     * @param {number} previous - 前一周期值
     * @returns {string|number} - 变化百分比，如 "12.5"，无法计算时返回 '--'
     */
    calculateChange: function(current, previous) {
        if (current === undefined || current === null || previous === undefined || previous === null || previous === 0) return '--';
        return ((current - previous) / previous * 100).toFixed(1);
    },

    /**
     * 计算数组的环比数据
     * @param {number[]} arr - 数值数组，按时间顺序排列（从旧到新）
     * @returns {(string|null)[]} - 环比数据数组，第一个元素为 null（无环比）
     */
    calculateMom: function(arr) {
        return arr.map((val, idx) => {
            if (idx === 0 || !arr[idx - 1]) return null;
            return ((val - arr[idx - 1]) / arr[idx - 1] * 100).toFixed(1);
        });
    },

    /**
     * 计算同比变化百分比
     * @param {number} current - 当前值
     * @param {number} yearAgo - 去年同期值
     * @returns {string|number} - 变化百分比，无法计算时返回 '--'
     */
    calculateYoy: function(current, yearAgo) {
        if (current === undefined || current === null || yearAgo === undefined || yearAgo === null || yearAgo === 0) return '--';
        return ((current - yearAgo) / yearAgo * 100).toFixed(1);
    },

    /**
     * 格式化百分比显示
     * @param {string|number} num - 百分比数值
     * @returns {string} - 带百分号的显示格式，如 "12.5%"，无效值返回 "-"
     */
    formatPercentage: function(num) {
        if (num === undefined || num === null || num === '--') return '-';
        return num + '%';
    },

    /**
     * 格式化金额为万元单位
     * @param {number} amount - 金额（元）
     * @returns {string} - 格式化后的金额，如 "12.34万元"
     */
    formatCurrency: function(amount) {
        if (amount === undefined || amount === null || isNaN(amount)) return '-';
        return (amount / 10000).toFixed(2) + '万元';
    },

    /**
     * 格式化大数字为万单位
     * @param {number} num - 原始数字
     * @returns {string} - 格式化后的数字，如 "12.34万"
     */
    formatNumber: function(num) {
        if (num === undefined || num === null || isNaN(num)) return '-';
        if (num >= 10000) {
            return (num / 10000).toFixed(2) + '万';
        }
        return num.toFixed(2);
    },

    /**
     * 判断是否为可参与计算的有限数字
     * @param {*} value - 待检查值
     * @returns {boolean}
     */
    isFiniteNumber: function(value) {
        return typeof value === 'number' && Number.isFinite(value);
    },

    /**
     * 安全转换为数字，异常值使用 fallback
     * @param {*} value - 待转换值
     * @param {number} [fallback=0] - 回退值
     * @returns {number}
     */
    safeNumber: function(value, fallback = 0) {
        if (value === undefined || value === null || value === '') return fallback;
        const num = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(num) ? num : fallback;
    },

    /**
     * 安全计算比例，分母无效或为 0 时返回 fallback
     * @param {*} numerator - 分子
     * @param {*} denominator - 分母
     * @param {number} [multiplier=100] - 比例倍数
     * @param {*} [fallback=null] - 回退值
     * @returns {number|null}
     */
    safeRatio: function(numerator, denominator, multiplier = 100, fallback = null) {
        const den = this.safeNumber(denominator, 0);
        if (den === 0) return fallback;
        return this.safeNumber(numerator, 0) / den * multiplier;
    },

    /**
     * 过滤有效数值，避免 Math.max/min 出现 Infinity
     * @param {Array} values - 候选值数组
     * @returns {number[]}
     */
    filterValidNumbers: function(values) {
        return (Array.isArray(values) ? values : []).filter(value => this.isFiniteNumber(value));
    },

    /**
     * 清洗数字字符串（去除引号、千分位逗号等）
     * @param {string|number} value - 需要清洗的值
     * @returns {number} - 清洗后的数字，无法转换返回 0
     */
    cleanNumber: function(value) {
        if (value === undefined || value === null || value === '') return 0;
        if (typeof value === 'number') return value;
        // 去除引号和千分位逗号
        const cleaned = String(value).replace(/["'`]/g, '').replace(/,/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    },

    /**
     * 生成适合当前数据范围的纵坐标范围，适合切换图表时自动重算
     * @param {Array} values - 候选数值数组
     * @param {Object} [options]
     * @param {boolean} [options.startAtZero=false] - 是否优先从 0 开始
     * @param {number} [options.paddingRatio=0.15] - 上下边距比例
     * @param {number|null} [options.minFloor=null] - 最小值下限
     * @param {number|null} [options.maxCeiling=null] - 最大值上限
     * @returns {Object}
     */
    getSmartYAxisBounds: function(values, options = {}) {
        const nums = this.filterValidNumbers(values);
        if (nums.length === 0) {
            return { beginAtZero: true, suggestedMin: 0, suggestedMax: 1 };
        }

        const {
            startAtZero = false,
            paddingRatio = 0.15,
            minFloor = null,
            maxCeiling = null
        } = options;

        let min = Math.min(...nums);
        let max = Math.max(...nums);
        const span = max - min;
        const padding = Math.max(span * paddingRatio, 1);

        let suggestedMin = startAtZero ? 0 : min - padding;
        let suggestedMax = max + padding;

        if (minFloor !== null && minFloor !== undefined) {
            suggestedMin = Math.max(suggestedMin, minFloor);
        }
        if (maxCeiling !== null && maxCeiling !== undefined) {
            suggestedMax = Math.min(suggestedMax, maxCeiling);
        }

        if (suggestedMin === suggestedMax) {
            suggestedMin -= 1;
            suggestedMax += 1;
        }

        return {
            beginAtZero: startAtZero,
            suggestedMin,
            suggestedMax
        };
    },

    /**
     * 转义 HTML 特殊字符，避免数据文本通过 innerHTML 渲染时破坏结构
     * @param {*} value - 待展示文本
     * @returns {string}
     */
    escapeHtml: function(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }
};
