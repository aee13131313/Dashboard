const ChartUtils = {
    // ResizeObserver 实例（全局共享）
    _resizeObserver: null,
    _resizeTimeout: null,
    _resizeDebounceDelay: 100, // ms
    _renderSessionId: 0,

    /**
     * 启动一个新的图表渲染会话，自动使旧会话失效
     * @returns {number}
     */
    beginRenderSession: function() {
        this._renderSessionId += 1;
        return this._renderSessionId;
    },

    /**
     * 判断会话是否仍然有效
     * @param {number} sessionId
     * @returns {boolean}
     */
    isActiveRenderSession: function(sessionId) {
        return sessionId === this._renderSessionId;
    },

    /**
     * 初始化 ResizeObserver，监听所有图表容器尺寸变化
     * 替代暴力重试的 renderWhenReady + resizeAllCharts 模式
     */
    initResizeObserver: function() {
        if (this._resizeObserver) return; // 已初始化

        this._resizeObserver = new ResizeObserver((entries) => {
            // 使用 debounce 避免短时间内多次 resize（如切换视图触发多次）
            if (this._resizeTimeout) {
                clearTimeout(this._resizeTimeout);
            }
            this._resizeTimeout = setTimeout(() => {
                this.resizeAllCharts();
            }, this._resizeDebounceDelay);
        });

        // 监听所有图表容器
        const containers = document.querySelectorAll(
            '.key-chart-container, .chart-container, .pie-chart-container, .trend-chart-container'
        );
        containers.forEach(container => {
            this._resizeObserver.observe(container);
        });
    },

    /**
     * 为新出现的图表容器添加 ResizeObserver 监听
     * @param {HTMLElement} container - 图表容器元素
     */
    observeContainer: function(container) {
        if (this._resizeObserver && container) {
            this._resizeObserver.observe(container);
        }
    },

    /**
     * 创建或更新 Chart.js 图表
     * @param {Object} options - 图表配置选项
     * @param {string} options.chartKey - 图表在 App.charts 对象中的键名
     * @param {CanvasRenderingContext2D} options.ctx - Canvas 上下文
     * @param {string} options.type - 图表类型（如 'line', 'pie', 'bar'）
     * @param {Object} options.data - 图表数据
     * @param {Object} options.options - Chart.js 配置选项
     * @param {Array} [options.plugins] - 插件数组
     * @returns {Chart} - Chart 实例
     */
    createOrUpdateChart: function(options) {
        const { chartKey, ctx, type, data, options: chartOptions, plugins = [] } = options;
        const renderSessionId = this._renderSessionId;

        // 优先用 canvas 真实 id 控制 skeleton/error（chartKey 可能与 canvas id 不同）
        const canvas = ctx && (ctx.canvas || ctx);
        const canvasId = canvas && canvas.id ? canvas.id : chartKey;

        if (!ctx) {
            console.warn('ChartUtils: No canvas context provided for', chartKey);
            this.showError(canvasId, chartKey, '找不到 Canvas 元素');
            return null;
        }

        if (!this.isActiveRenderSession(renderSessionId)) {
            return null;
        }

        // 隐藏骨架屏 + 隐藏错误占位
        this.hideSkeleton(canvasId);
        this.hideError(canvasId);

        // 如果图表已存在，更新数据和选项
        if (App.charts && App.charts[chartKey]) {
            const existingChart = App.charts[chartKey];
            existingChart.data = data;
            existingChart.options = chartOptions;
            
            // 更新即可，ResizeObserver 会自动处理尺寸
            try {
                if (!this.isActiveRenderSession(renderSessionId)) {
                    return existingChart;
                }
                existingChart.update('none');
                // 如果 canvas 不可见，等待 ResizeObserver 触发后自动 resize
                const canvas = existingChart.canvas;
                if (canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
                    existingChart.resize();
                }
            } catch (error) {
                console.error('ChartUtils: Error updating chart', chartKey, error);
                this.showError(canvasId, chartKey, error.message);
            }
            return existingChart;
        }
        
        // 首次创建图表（canvas 已在上方获取）
        try {
            if (!this.isActiveRenderSession(renderSessionId)) {
                return null;
            }
            if (typeof Chart === 'undefined') {
                console.error('ChartUtils: Chart is undefined! CDN may not be loaded.');
                this.showError(canvasId, chartKey, 'Chart.js 未加载，请检查网络连接');
                return null;
            }

            const chart = new Chart(ctx, {
                type: type,
                data: data,
                options: chartOptions,
                plugins: plugins
            });

            if (App.charts) {
                App.charts[chartKey] = chart;
            }

            // 监听图表容器（自动处理 resize）
            const container = canvas.closest('.key-chart-container, .chart-container, .pie-chart-container, .trend-chart-container');
            if (container) {
                this.observeContainer(container);
            }

            return chart;
        } catch (error) {
            console.error('ChartUtils: Error creating chart', chartKey, error);
            this.showError(canvasId, chartKey, error.message);
            return null;
        }
    },

    /**
     * 显示图表骨架屏（加载占位）
     * @param {string} chartKey - 图表键名或 canvas id
     */
    showSkeleton: function(chartKey) {
        const canvas = document.getElementById(chartKey);
        if (!canvas) return;
        const container = canvas.closest('.key-chart-container, .chart-container, .pie-chart-container, .trend-chart-container');
        if (!container) return;
        
        // 确保 container 有 position: relative（骨架屏需要 absolute 定位）
        if (container.style.position !== 'relative' && !container.classList.contains('chart-wrapper')) {
            container.style.position = 'relative';
        }

        let skeleton = container.querySelector('.skeleton-overlay');
        if (!skeleton) {
            skeleton = document.createElement('div');
            skeleton.className = 'skeleton-overlay';
            container.appendChild(skeleton);
        }
        skeleton.classList.add('active');
    },

    /**
     * 隐藏图表骨架屏
     * @param {string} chartKey - 图表键名或 canvas id
     */
    hideSkeleton: function(chartKey) {
        const canvas = document.getElementById(chartKey);
        if (!canvas) return;
        const container = canvas.closest('.key-chart-container, .chart-container, .pie-chart-container, .trend-chart-container');
        if (!container) return;

        const skeleton = container.querySelector('.skeleton-overlay');
        if (skeleton) {
            skeleton.classList.remove('active');
        }
    },

    /**
     * 显示图表错误占位 UI
     * @param {string} canvasId - canvas 元素 id
     * @param {string} chartKey - 图表在 App.charts 中的键名
     * @param {string} message - 错误信息
     */
    showError: function(canvasId, chartKey, message) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const container = canvas.closest('.key-chart-container, .chart-container, .pie-chart-container, .trend-chart-container');
        if (!container) return;

        // 确保 container 有 position: relative
        if (container.style.position !== 'relative') {
            container.style.position = 'relative';
        }

        // 隐藏 canvas
        canvas.style.display = 'none';

        let errorEl = container.querySelector('.chart-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'chart-error';
            errorEl.innerHTML = `
                <div class="chart-error-icon">📊</div>
                <div class="chart-error-msg">图表加载失败</div>
                <div class="chart-error-detail"></div>
                <button class="chart-error-retry" data-action="retryChart" data-canvas-id="${canvasId}">重新加载</button>
            `;
            container.appendChild(errorEl);
        }

        // 保存 chartKey，重试时用于销毁旧实例
        errorEl.dataset.chartKey = chartKey || canvasId;

        const detailEl = errorEl.querySelector('.chart-error-detail');
        if (detailEl) {
            detailEl.textContent = message || '未知错误';
        }
        errorEl.style.display = 'flex';
    },

    /**
     * 隐藏图表错误占位 UI
     * @param {string} chartKey - 图表键名或 canvas id
     */
    hideError: function(chartKey) {
        const canvas = document.getElementById(chartKey);
        if (!canvas) return;
        const container = canvas.closest('.key-chart-container, .chart-container, .pie-chart-container, .trend-chart-container');
        if (!container) return;

        // 恢复 canvas 显示
        canvas.style.display = '';

        const errorEl = container.querySelector('.chart-error');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    },

    /**
     * 重试加载失败的图表
     * @param {string} canvasId - canvas 元素 id
     */
    retryChart: function(canvasId) {
        this.hideError(canvasId);
        this.showSkeleton(canvasId);

        // 如果存在旧图表实例，先销毁
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const container = canvas.closest('.key-chart-container, .chart-container, .pie-chart-container, .trend-chart-container');
            const errorEl = container ? container.querySelector('.chart-error') : null;
            const chartKey = errorEl ? errorEl.dataset.chartKey : canvasId;
            this.destroyChart(chartKey);
        }

        // 延迟后重新触发看板刷新
        const renderSessionId = this.beginRenderSession();
        setTimeout(() => {
            if (!this.isActiveRenderSession(renderSessionId)) {
                return;
            }
            if (App.dashboard === 'bookstore') {
                refreshBookstoreDashboard(renderSessionId);
            } else {
                initAibcDashboard(renderSessionId);
            }
        }, 200);
    },

    /**
     * 显示所有图表的骨架屏
     */
    showAllSkeletons: function() {
        const canvasIds = [
            'productionKeyChart', 'consumptionKeyChart',
            'productionConsumptionComparisonChart',
            'productionChart', 'consumptionChart',
            'downloadChart', 'userChart',
            'gradeDistributionChart', 'typeDistributionChart', 'sceneDistributionChart',
            'gradeChart', 'typeChart', 'sceneChart',
            'aibcOverallChart', 'aibcMerchantChart'
        ];
        canvasIds.forEach(id => {
            if (document.getElementById(id)) {
                this.showSkeleton(id);
            }
        });
    },

    /**
     * 隐藏所有图表的骨架屏
     */
    hideAllSkeletons: function() {
        document.querySelectorAll('.skeleton-overlay.active').forEach(el => {
            el.classList.remove('active');
        });
    },

    /**
     * 销毁指定图表
     * @param {string} chartKey - 图表键名
     */
    destroyChart: function(chartKey) {
        if (App.charts && App.charts[chartKey]) {
            App.charts[chartKey].destroy();
            delete App.charts[chartKey];
        }
    },

    /**
     * 销毁所有图表
     */
    destroyAllCharts: function() {
        if (App.charts) {
            Object.keys(App.charts).forEach(key => {
                App.charts[key].destroy();
            });
            App.charts = {};
        }
    },

    /**
     * 调整所有图表大小
     */
    resizeAllCharts: function() {
        if (App.charts) {
            Object.values(App.charts).forEach(chart => {
                if (chart && chart.canvas) {
                    try {
                        chart.resize();
                        chart.update('none');
                    } catch (e) {
                        // resize 失败不影响其他图表
                        console.warn('ChartUtils: resize error for chart', e);
                    }
                }
            });
        }
    },

    /**
     * 使用 requestAnimationFrame 等待 DOM 就绪后执行回调
     * @param {Function} callback - 要执行的回调函数
     * @param {number} [frameCount=1] - 等待的帧数
     */
    renderWhenReady: function(callback, frameCount = 2, sessionId = null) {
        let framesRemaining = frameCount;
        const execute = () => {
            if (sessionId !== null && !this.isActiveRenderSession(sessionId)) {
                return;
            }
            if (framesRemaining > 0) {
                framesRemaining--;
                requestAnimationFrame(execute);
            } else {
                try {
                    callback();
                } catch (error) {
                    console.error('ChartUtils: render callback error', error);
                }
            }
        };
        requestAnimationFrame(execute);
    },

    /**
     * 等待指定的 canvas 元素可见后执行回调
     * @param {string} canvasId - Canvas 元素 ID
     * @param {Function} callback - 要执行的回调函数
     * @param {number} [maxRetries=5] - 最大重试次数（降低，ResizeObserver 会兜底）
     */
    waitForCanvas: function(canvasId, callback, maxRetries = 5) {
        let retries = 0;
        const execute = () => {
            const canvas = document.getElementById(canvasId);
            if (canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
                try {
                    callback();
                } catch (error) {
                    console.error('ChartUtils: waitForCanvas callback error', error);
                }
            } else if (retries < maxRetries) {
                retries++;
                requestAnimationFrame(execute);
            } else {
                // ResizeObserver 兜底，不需要暴力重试
                console.warn('ChartUtils: Canvas', canvasId, 'not visible after', maxRetries, 'retries, ResizeObserver will handle');
            }
        };
        requestAnimationFrame(execute);
    }
};
