class AIAnalyzer {
    constructor() {
        this.isAnalyzing = false;
        this.analysisCache = {}; // 分析结果缓存
        this.cacheExpireTime = 3600000; // 缓存过期时间：1小时
    }

    // 简易加密：使用 XOR + Base64 混淆存储（非安全级加密，但避免明文暴露）
    _obfuscate(text) {
        const key = 'AIBC_DASHBOARD_2026';
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(result);
    }

    _deobfuscate(encoded) {
        try {
            const decoded = atob(encoded);
            const key = 'AIBC_DASHBOARD_2026';
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return result;
        } catch (e) {
            return '';
        }
    }

    // 设置API Key（加密存储）
    setApiKey(apiKey) {
        DEEPSEEK_CONFIG.apiKey = apiKey;
        if (apiKey) {
            localStorage.setItem('deepseek_api_key_enc', this._obfuscate(apiKey));
            // 清除旧的明文存储（兼容迁移）
            localStorage.removeItem('deepseek_api_key');
        } else {
            localStorage.removeItem('deepseek_api_key_enc');
            localStorage.removeItem('deepseek_api_key');
        }
    }

    // 获取API Key（优先从加密存储读取，兼容旧的明文存储）
    getApiKey() {
        if (DEEPSEEK_CONFIG.apiKey) return DEEPSEEK_CONFIG.apiKey;
        const encrypted = localStorage.getItem('deepseek_api_key_enc');
        if (encrypted) return this._deobfuscate(encrypted);
        // 兼容：如果存在旧的明文存储，自动迁移为加密存储
        const plain = localStorage.getItem('deepseek_api_key');
        if (plain) {
            this.setApiKey(plain);
            return plain;
        }
        return '';
    }

    // 生成缓存键
    generateCacheKey(period, dashboard, dataMode) {
        return `${period}_${dashboard}_${dataMode}`;
    }

    // 获取缓存的分析结果
    getCachedAnalysis(period, dashboard, dataMode) {
        const key = this.generateCacheKey(period, dashboard, dataMode);
        const cached = this.analysisCache[key];
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpireTime) {
            return cached.result;
        }
        
        // 清理过期缓存
        if (cached) {
            delete this.analysisCache[key];
        }
        
        return null;
    }

    // 缓存分析结果
    cacheAnalysis(period, dashboard, dataMode, result) {
        const key = this.generateCacheKey(period, dashboard, dataMode);
        this.analysisCache[key] = {
            timestamp: Date.now(),
            result: result
        };
        
        // 限制缓存大小，最多保存10条记录
        const keys = Object.keys(this.analysisCache);
        if (keys.length > 10) {
            // 删除最早的缓存
            const sortedKeys = keys.sort((a, b) => 
                this.analysisCache[a].timestamp - this.analysisCache[b].timestamp
            );
            delete this.analysisCache[sortedKeys[0]];
        }
    }

    // 清理所有缓存
    clearCache() {
        this.analysisCache = {};
    }

    // 获取指定看板/周期的数据集
    getDataSet(dashboard, dataMode) {
        if (dashboard === 'aibc') {
            return dataMode === 'weekly' ? window.aibcWeeklyData : window.aibcMonthlyData;
        }
        if (dashboard === 'bookstore') {
            return dataMode === 'weekly' ? window.weeklyData : window.monthlyData;
        }
        return null;
    }

    // 确保目标数据已加载并重建索引
    async ensureDataReady(dashboard, dataMode) {
        if (!['bookstore', 'aibc'].includes(dashboard) || !['weekly', 'monthly'].includes(dataMode)) {
            return [];
        }

        if (typeof DataLoader !== 'undefined' && !DataLoader.isLoaded(dashboard, dataMode)) {
            await DataLoader.loadData(dashboard, dataMode);
            rebuildDataIndex(dashboard, dataMode);
        }

        const dataSet = this.getDataSet(dashboard, dataMode);
        return Array.isArray(dataSet) ? dataSet : [];
    }

    // 跨模块获取数据 - 支持指定模块和维度
    async getDataByModuleAndDimension(dashboard, dataMode, period) {
        const dataSet = await this.ensureDataReady(dashboard, dataMode);
        if (dataSet.length === 0) return null;
        return findDataByPeriod(period, dashboard, dataMode) || dataSet.find(d => d.period === period) || null;
    }

    // 获取所有可用的时间周期
    async getAvailablePeriods(dashboard, dataMode) {
        const dataSet = await this.ensureDataReady(dashboard, dataMode);
        return dataSet.map(d => d.period).filter(Boolean);
    }

    // 获取跨维度对比数据（同一模块，不同维度）
    async getCrossDimensionData(dashboard, period) {
        const weeklyData = await this.getDataByModuleAndDimension(dashboard, 'weekly', period);
        const monthlyData = await this.getDataByModuleAndDimension(dashboard, 'monthly', period);
        
        return {
            weekly: weeklyData,
            monthly: monthlyData,
            hasBoth: weeklyData && monthlyData
        };
    }

    // 获取跨模块对比数据（同一维度，不同模块）
    async getCrossModuleData(dataMode, period) {
        const bookstoreData = await this.getDataByModuleAndDimension('bookstore', dataMode, period);
        const aibcData = await this.getDataByModuleAndDimension('aibc', dataMode, period);
        
        return {
            bookstore: bookstoreData,
            aibc: aibcData,
            hasBoth: bookstoreData && aibcData
        };
    }

    // 准备分析数据 - 按需读取，仅获取当前周期核心数据
    async prepareAnalysisData(period, dashboard = null, dataMode = null) {
        // 如果未指定，使用当前看板的设置
        const targetDashboard = dashboard || App.dashboard;
        const targetDataMode = dataMode || App.dataMode;
        const dataSet = await this.ensureDataReady(targetDashboard, targetDataMode);
        if (dataSet.length === 0) return null;
        
        // 只查找当前周期数据（按需读取）
        const current = findDataByPeriod(period, targetDashboard, targetDataMode) || dataSet.find(d => d.period === period);
        if (!current) return null;
        
        // 按需获取对比数据（延迟加载）
        const previous = this.getPreviousPeriodData(period, dataSet);
        const yearAgo = this.getYearAgoPeriodData(period, dataSet, targetDataMode);
        
        return {
            period: period,
            current: current,
            previous: previous,
            yearAgo: yearAgo,
            isAibc: targetDashboard === 'aibc',
            dashboard: targetDashboard,
            dataMode: targetDataMode,
            // 延迟计算变化数据
            getMomChanges: () => previous ? this.calculateMomChanges(current, previous) : null,
            getYoyChanges: () => yearAgo ? this.calculateYoyChanges(current, yearAgo) : null
        };
    }

    // 获取上一周期数据
    getPreviousPeriodData(period, dataSet) {
        if (!Array.isArray(dataSet) || dataSet.length === 0) return null;
        const allPeriods = [...new Set(dataSet.map(d => d.period).filter(Boolean))].sort((a, b) => {
            return PeriodUtils.parsePeriod(b) - PeriodUtils.parsePeriod(a);
        });
        
        const currentIndex = allPeriods.indexOf(period);
        if (currentIndex >= 0 && currentIndex < allPeriods.length - 1) {
            return dataSet.find(d => d.period === allPeriods[currentIndex + 1]);
        }
        return null;
    }

    // 获取去年同期数据
    getYearAgoPeriodData(period, dataSet, dataMode) {
        if (!Array.isArray(dataSet) || dataSet.length === 0) return null;
        const yearAgoPeriod = PeriodUtils.calculateYearAgoPeriod(period, dataMode === 'weekly');
        if (yearAgoPeriod) {
            return dataSet.find(d => d.period === yearAgoPeriod);
        }
        return null;
    }

    // 计算环比变化
    calculateMomChanges(current, previous) {
        return {
            production: MetricsUtils.calculateChange(current.production, previous.production),
            collection: MetricsUtils.calculateChange(current.collection, previous.collection),
            totalConsumption: MetricsUtils.calculateChange(current.totalConsumption, previous.totalConsumption),
            cConsumption: MetricsUtils.calculateChange(current.cConsumption, previous.cConsumption),
            bConsumption: MetricsUtils.calculateChange(current.bConsumption, previous.bConsumption),
            totalDownload: MetricsUtils.calculateChange(current.totalDownload, previous.totalDownload),
            visitorUV: MetricsUtils.calculateChange(current.visitorUV, previous.visitorUV)
        };
    }

    // 计算同比变化
    calculateYoyChanges(current, yearAgo) {
        return {
            production: MetricsUtils.calculateChange(current.production, yearAgo.production),
            collection: MetricsUtils.calculateChange(current.collection, yearAgo.collection),
            totalConsumption: MetricsUtils.calculateChange(current.totalConsumption, yearAgo.totalConsumption),
            cConsumption: MetricsUtils.calculateChange(current.cConsumption, yearAgo.cConsumption),
            bConsumption: MetricsUtils.calculateChange(current.bConsumption, yearAgo.bConsumption),
            totalDownload: MetricsUtils.calculateChange(current.totalDownload, yearAgo.totalDownload),
            visitorUV: MetricsUtils.calculateChange(current.visitorUV, yearAgo.visitorUV)
        };
    }

    // 构建分析提示词 - 支持跨模块/跨维度分析（按需加载数据）
    buildAnalysisPrompt(data, comparisonData = null) {
        const periodType = data.dataMode === 'weekly' ? '周' : '月';
        const isAibc = data.isAibc;
        const current = data.current;
        
        // 基础分析模板 - 简洁版本
        let prompt = `分析${periodType}数据【${data.period}】：\n\n`;
        
        if (isAibc) {
            // 智书看板 - 精简数据
            prompt += `**核心指标**:\n` +
                `小程序访客: ${current.miniAppVisitors}` + (current.miniAppNewVisitors ? ` (新增${current.miniAppNewVisitors})` : '') + `\n` +
                `H5访客: ${current.h5Visitors}` + (current.h5NewVisitors ? ` (新增${current.h5NewVisitors})` : '') + `\n`;
            
            // TOP3商家（按需加载，仅在需要时处理）
            if (current.merchants) {
                const topMerchants = Object.entries(current.merchants)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3);
                if (topMerchants.length > 0) {
                    prompt += `\n**TOP3商家**:\n` +
                        topMerchants.map(([name, value]) => `${name}: ${value}`).join('\n') + `\n`;
                }
            }
        } else {
            // 书城看板 - 精简数据（按需读取）
            prompt += `**核心指标**:\n` +
                `生产: ${current.production || 0} | 征集: ${current.collection || 0}\n` +
                `总消费: ${formatNumber(current.totalConsumption || 0)} | C端: ${formatNumber(current.cConsumption || 0)} | B端: ${formatNumber(current.bConsumption || 0)}\n` +
                `下载量: ${formatNumber(current.totalDownload || 0)}\n`;
        }
        
        // 变化分析（延迟计算，仅在需要时调用）
        const changes = [];
        const momChanges = typeof data.getMomChanges === 'function' ? data.getMomChanges() : data.momChanges;
        if (momChanges) {
            Object.entries(momChanges).forEach(([key, value]) => {
                if (value !== null && value !== undefined && Math.abs(value) > 1) {
                    changes.push(`环比${key}: ${parseFloat(value) >= 0 ? '+' : ''}${value}%`);
                }
            });
        }
        const yoyChanges = typeof data.getYoyChanges === 'function' ? data.getYoyChanges() : data.yoyChanges;
        if (yoyChanges) {
            Object.entries(yoyChanges).forEach(([key, value]) => {
                if (value !== null && value !== undefined && Math.abs(value) > 1) {
                    changes.push(`同比${key}: ${parseFloat(value) >= 0 ? '+' : ''}${value}%`);
                }
            });
        }
        if (changes.length > 0) {
            prompt += `\n**变化摘要**:\n${changes.slice(0, 5).join(' | ')}\n`;
        }
        
        // 对比数据（仅在需要时添加）
        if (comparisonData && comparisonData.other) {
            const otherType = comparisonData.type === 'cross-dimension' ? 
                (data.dataMode === 'weekly' ? '月度' : '周度') :
                (data.dashboard === 'bookstore' ? '智书' : '书城');
            prompt += `\n**${otherType}对比**:\n`;
            const otherData = comparisonData.other.current;
            if (otherData) {
                if (isAibc) {
                    prompt += `小程序访客: ${otherData.miniAppVisitors}\n`;
                } else {
                    prompt += `总消费: ${formatNumber(otherData.totalConsumption || 0)}\n`;
                }
            }
        }
        
        // 分析指令（精简版）
        prompt += `\n请分析：1)整体趋势 2)关键变化 3)业务建议。用中文，简明扼要。`;
        
        return prompt.trim();
    }

    // 调用DeepSeek API（带缓存）
    async callDeepSeekAPI(prompt, period, dashboard, dataMode) {
        // 先检查缓存
        const cachedResult = this.getCachedAnalysis(period, dashboard, dataMode);
        if (cachedResult) {
            console.log('使用缓存分析结果');
            return cachedResult;
        }
        
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('未配置API Key，请先在设置中配置您的DeepSeek API Key');
        }

        try {
            const response = await fetch(DEEPSEEK_CONFIG.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: DEEPSEEK_CONFIG.model,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1500
                })
            });

            if (!response.ok) {
                let errorDetail = response.statusText;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.error?.message || errorDetail;
                } catch (e) {}
                
                if (response.status === 401) {
                    throw new Error('API Key无效或已过期，请检查您的API Key配置');
                } else if (response.status === 429) {
                    throw new Error('API请求过于频繁，请稍后重试');
                } else if (response.status >= 500) {
                    throw new Error(`AI服务暂时不可用（${response.status}），请稍后重试`);
                } else {
                    throw new Error(`AI分析失败（${response.status}）：${errorDetail}`);
                }
            }

            const data = await response.json();
            if (!data.choices || !data.choices[0]?.message?.content) {
                throw new Error('AI服务返回异常，请稍后重试');
            }
            
            const result = data.choices[0].message.content;
            
            // 缓存分析结果
            this.cacheAnalysis(period, dashboard, dataMode, result);
            
            return result;
        } catch (error) {
            if (error.message.includes('API Key') || 
                error.message.includes('无效') || 
                error.message.includes('频繁') ||
                error.message.includes('不可用') ||
                error.message.includes('异常')) {
                throw error;
            }
            // 网络连接异常
            throw new Error('网络连接失败，请检查网络后重试');
        }
    }

    // 生成演示模式分析结果（仅供演示，不会在生产环境中使用）
    generateMockAnalysis(prompt) {
        const mockResults = [
            `> ⚠️ **演示模式**：当前显示的是模拟分析结果，配置API Key后将显示真实AI分析。\n\n## 数据分析报告\n\n**概览**：当前${prompt.includes('周') ? '周' : '月'}度业务表现${prompt.includes('+') ? '良好，呈增长趋势' : '平稳'}\n\n**关键发现**：核心指标正常，建议持续关注。\n\n**建议**：保持现有策略，优化用户体验。`,
            `> ⚠️ **演示模式**：当前显示的是模拟分析结果，配置API Key后将显示真实AI分析。\n\n## 业务分析\n\n**数据摘要**：本周期运营状况健康\n\n**亮点**：${prompt.includes('小程序') ? '小程序访客稳定' : '消费数据正常'}\n\n**建议**：关注增长机会，提升内容质量。`,
            `> ⚠️ **演示模式**：当前显示的是模拟分析结果，配置API Key后将显示真实AI分析。\n\n## 分析结果\n\n**评估**：业务运行良好\n\n**洞察**：各维度数据协同发展\n\n**建议**：继续优化运营策略。`
        ];
        
        if (prompt.includes('智书') || prompt.includes('aibc')) {
            return mockResults[1];
        } else {
            return mockResults[Math.floor(Math.random() * mockResults.length)];
        }
    }



    // 弹窗表单输入API Key（替代 prompt/alert）
    promptForApiKey() {
        // 如果弹窗已存在，直接显示
        let modal = document.getElementById('apiKeyModal');
        if (modal) {
            modal.style.display = 'flex';
            const input = document.getElementById('apiKeyInput');
            if (input) input.value = this.getApiKey();
            return;
        }

        // 创建弹窗 DOM
        modal = document.createElement('div');
        modal.id = 'apiKeyModal';
        modal.style.cssText = 'display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:12px;padding:32px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
                <h3 style="margin:0 0 8px;font-size:18px;color:#1a1a1a;">配置 DeepSeek API Key</h3>
                <p style="margin:0 0 20px;font-size:13px;color:#666;line-height:1.6;">
                    API Key 将以加密形式存储在本地，不会明文暴露。<br>
                    <span style="color:#e74c3c;font-size:12px;">⚠ 注意：纯前端存储仍存在安全风险，建议通过后端代理调用 API。</span>
                </p>
                <label style="display:block;margin-bottom:8px;font-size:14px;color:#333;font-weight:500;">API Key</label>
                <input id="apiKeyInput" type="password" placeholder="sk-..." 
                    style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;" />
                <div style="display:flex;gap:12px;margin-top:20px;">
                    <button id="apiKeySaveBtn" style="flex:1;padding:10px;background:#4A90D9;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;">
                        保存
                    </button>
                    <button id="apiKeyCancelBtn" style="flex:1;padding:10px;background:#f0f0f0;color:#333;border:none;border-radius:8px;font-size:14px;cursor:pointer;">
                        取消
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // 预填现有 Key
        if (input) {
            input.value = this.getApiKey();
            input.addEventListener('focus', () => {
                input.style.borderColor = '#4A90D9';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#ddd';
            });
        }

        // 保存按钮
        const saveBtn = document.getElementById('apiKeySaveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const val = document.getElementById('apiKeyInput').value.trim();
                if (val) {
                    this.setApiKey(val);
                    modal.style.display = 'none';
                    // 显示成功提示（替代 alert）
                    this._showToast('API Key 已安全保存！', 'success');
                } else {
                    input.style.borderColor = '#e74c3c';
                }
            });
        }

        // 取消按钮
        const cancelBtn = document.getElementById('apiKeyCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // 点击遮罩层关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        // ESC 关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });
    }

    // Toast 提示（替代 alert）
    _showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#e74c3c' : '#3b82f6';
        toast.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${bgColor};color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;z-index:10001;opacity:0;transition:opacity 0.3s;`;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// 创建AI分析器实例
const aiAnalyzer = new AIAnalyzer();
window.aiAnalyzer = aiAnalyzer;

// 初始化时设置API Key
if (DEEPSEEK_CONFIG.apiKey) {
    aiAnalyzer.setApiKey(DEEPSEEK_CONFIG.apiKey);
}

// AI对话功能
