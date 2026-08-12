const PeriodUtils = {
    /**
     * 将周期字符串解析为 Date 对象
     * @param {string} p - 周期字符串，支持格式：YYYY.M.D 或 YYYY.M
     * @returns {Date} - 解析后的 Date 对象
     */
    parsePeriod: function(p) {
        const weekMatch = p.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
        if (weekMatch) return new Date(weekMatch[1], weekMatch[2] - 1, weekMatch[3]);
        const monthMatch = p.match(/^(\d{4})\.(\d{1,2})/);
        if (monthMatch) return new Date(monthMatch[1], monthMatch[2] - 1, 1);
        return new Date(0);
    },

    /**
     * 计算去年同期周期
     * @param {string} currentPeriod - 当前周期
     * @param {boolean} isWeekly - 是否为周度数据
     * @returns {string|null} - 去年同期周期，格式与当前周期一致
     */
    calculateYearAgoPeriod: function(currentPeriod, isWeekly) {
        if (isWeekly) {
            // 周度格式：YYYY.M.D-YYYY.M.D
            const match = currentPeriod.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})-(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
            if (!match) return null;
            const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = match;
            return `${parseInt(startYear) - 1}.${startMonth}.${startDay}-${parseInt(endYear) - 1}.${endMonth}.${endDay}`;
        } else {
            // 月度格式：YYYY.M
            const match = currentPeriod.match(/^(\d{4})\.(\d{1,2})$/);
            if (!match) return null;
            return `${parseInt(match[1]) - 1}.${match[2]}`;
        }
    },

    /**
     * 格式化月度周期为显示格式
     * @param {string} period - 月度周期，格式：YYYY.M
     * @returns {string} - 显示格式，如 "2026年6月"
     */
    formatMonthDisplay: function(period) {
        const match = period.match(/^(\d{4})\.(\d{1,2})$/);
        if (!match) return period;
        return `${match[1]}年${parseInt(match[2])}月`;
    },

    /**
     * 格式化周度周期为显示格式
     * @param {string} period - 周度周期，格式：YYYY.M.D-YYYY.M.D
     * @returns {string} - 显示格式，如 "2026年7月3日-7月9日"
     */
    formatWeekDisplay: function(period) {
        const match = period.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})-(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
        if (!match) return period;
        const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = match;
        if (startYear === endYear && startMonth === endMonth) {
            return `${startYear}年${parseInt(startMonth)}月${parseInt(startDay)}日-${parseInt(endDay)}日`;
        }
        return `${startYear}年${parseInt(startMonth)}月${parseInt(startDay)}日-${endYear}年${parseInt(endMonth)}月${parseInt(endDay)}日`;
    },

    /**
     * 判断周期是否为周度格式
     * @param {string} period - 周期字符串
     * @returns {boolean} - 是否为周度格式
     */
    isWeeklyFormat: function(period) {
        return /^\d{4}\.\d{1,2}\.\d{1,2}-\d{4}\.\d{1,2}\.\d{1,2}$/.test(period);
    },

    /**
     * 判断周期是否为月度格式
     * @param {string} period - 周期字符串
     * @returns {boolean} - 是否为月度格式
     */
    isMonthlyFormat: function(period) {
        return /^\d{4}\.\d{1,2}$/.test(period);
    },

    /**
     * 比较两个周期的大小
     * @param {string} a - 周期A
     * @param {string} b - 周期B
     * @returns {number} - 负数表示A<B，正数表示A>B，0表示相等
     */
    compare: function(a, b) {
        return this.parsePeriod(b) - this.parsePeriod(a);
    }
};
