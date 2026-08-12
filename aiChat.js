class AIChatManager {
    constructor() {
        this.conversationHistory = [];
        this.isTyping = false;
        this.isMinimized = false;
        this.isCompactMode = false;
    }

    // 获取用户选择的分析数据（基于当前上下文）
    async getSelectedAnalysisData() {
        const period = document.getElementById('timeSelector').value;
        return aiAnalyzer.prepareAnalysisData(period, App.dashboard, App.dataMode);
    }

    // 显示对话弹窗
    showChatModal() {
        // 保存当前焦点
        this.lastFocusedElement = document.activeElement;
        const modal = document.getElementById('aiChatModal');
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('aiChatMinimized').style.display = 'none';
        this.isMinimized = false;
        // 聚焦到输入框
        setTimeout(() => {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) chatInput.focus();
        }, 50);
    }

    // 隐藏对话弹窗
    hideChatModal() {
        document.getElementById('aiChatModal').style.display = 'none';
        document.getElementById('aiChatModal').setAttribute('aria-hidden', 'true');
        document.getElementById('aiChatMinimized').style.display = 'none';
        this.isMinimized = false;
        this.isCompactMode = false;
        this.resetModalStyle();
        // 恢复焦点
        if (this.lastFocusedElement && this.lastFocusedElement.focus) {
            this.lastFocusedElement.focus();
        }
    }

    // 最小化对话窗口
    minimizeChat() {
        document.getElementById('aiChatModal').style.display = 'none';
        document.getElementById('aiChatMinimized').style.display = 'block';
        this.isMinimized = true;
        this.updateMinimizedPreview();
    }

    // 还原对话窗口
    restoreChat() {
        document.getElementById('aiChatModal').style.display = 'flex';
        document.getElementById('aiChatMinimized').style.display = 'none';
        this.isMinimized = false;
        // 还原为紧凑模式
        this.toggleCompactMode(true);
    }

    // 切换紧凑模式
    toggleCompactMode(enable = null) {
        const modal = document.getElementById('aiChatModal');
        const container = modal.querySelector('.ai-chat-container');
        
        if (enable !== null) {
            this.isCompactMode = enable;
        } else {
            this.isCompactMode = !this.isCompactMode;
        }

        if (this.isCompactMode) {
            modal.classList.add('compact-mode');
            container.classList.add('compact');
        } else {
            modal.classList.remove('compact-mode');
            container.classList.remove('compact');
        }
    }

    // 重置弹窗样式
    resetModalStyle() {
        const modal = document.getElementById('aiChatModal');
        const container = modal.querySelector('.ai-chat-container');
        modal.classList.remove('compact-mode');
        container.classList.remove('compact');
        this.isCompactMode = false;
    }

    // 更新最小化预览
    updateMinimizedPreview() {
        const minimizedMessages = document.getElementById('minimizedMessages');
        const messages = document.querySelectorAll('#aiChatMessages .ai-message, #aiChatMessages .user-message');
        
        // 显示最后2条消息
        const lastMessages = Array.from(messages).slice(-2);
        minimizedMessages.innerHTML = lastMessages.map(msg => {
            const isUser = msg.classList.contains('user-message');
            const content = msg.querySelector('.message-content').textContent.trim();
            const shortContent = content.length > 50 ? content.substring(0, 50) + '...' : content;
            
            return `<div class="minimized-message ${isUser ? 'user' : ''}">${MetricsUtils.escapeHtml(shortContent)}</div>`;
        }).join('');
    }

    // 更新状态指示器
    updateStatusIndicator(status = 'idle') {
        const indicator = document.getElementById('minimizedStatus');
        if (!indicator) return;
        
        indicator.className = 'status-indicator';
        if (status === 'thinking') {
            indicator.classList.add('thinking');
        }
    }

    // 添加消息到对话
    addMessage(content, isUser = false) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = isUser ? 'user-message' : 'ai-message';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${isUser ? '我' : 'AI'}</div>
            <div class="message-content">
                ${isUser ? MetricsUtils.escapeHtml(content) : (typeof content === 'string' ? content : content.innerHTML)}
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // 如果是最小化状态，更新预览
        if (this.isMinimized) {
            this.updateMinimizedPreview();
        }
    }

    // 显示输入指示器
    showTypingIndicator() {
        if (this.isTyping) return;
        this.isTyping = true;
        
        // 更新最小化状态指示器
        this.updateStatusIndicator('thinking');
        
        const messagesContainer = document.getElementById('aiChatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message typing-indicator-message';
        typingDiv.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span>AI正在思考</span>
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 隐藏输入指示器
    hideTypingIndicator() {
        this.isTyping = false;
        this.updateStatusIndicator('idle');
        
        const typingIndicator = document.querySelector('.typing-indicator-message');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // 开始数据分析
    async startDataAnalysis() {
        const analysisData = await this.getSelectedAnalysisData();
        
        if (!analysisData) {
            this.addMessage('<p>抱歉，无法获取选定周期的数据。</p>');
            return;
        }

        // 保存最后一次的分析数据用于重试
        this.lastAnalysisData = analysisData;
        
        // 检查API Key是否已配置
        const apiKey = aiAnalyzer.getApiKey();
        if (!apiKey) {
            this.showApiKeyMissingError();
            return;
        }

        this.addMessage(`请分析 ${analysisData.period} 周期的数据表现`, true);
        
        this.showTypingIndicator();
        
        try {
            const prompt = aiAnalyzer.buildAnalysisPrompt(analysisData);
            const result = await aiAnalyzer.callDeepSeekAPI(
                prompt, 
                analysisData.period, 
                analysisData.dashboard, 
                analysisData.dataMode
            );
            
            this.hideTypingIndicator();
            this.addMessage(this.formatMessage(result));
            
            this.conversationHistory.push({
                role: 'user',
                content: `请分析 ${analysisData.period} 周期的数据表现`
            });
            this.conversationHistory.push({
                role: 'assistant',
                content: result
            });
            
        } catch (error) {
            this.hideTypingIndicator();
            this.showErrorMessage(error);
        }
    }

    // 显示API Key缺失的错误提示
    showApiKeyMissingError() {
        const errorHtml = `
            <div class="ai-error-message">
                <div class="error-icon">🔑</div>
                <div class="error-title">未配置API Key</div>
                <div class="error-desc">AI分析功能需要配置API Key才能使用</div>
                <button class="error-action-btn" data-action="promptForApiKey">立即配置API Key</button>
            </div>
        `;
        this.addMessage(errorHtml);
    }

    // 显示错误信息
    showErrorMessage(error) {
        let errorIcon = '⚠️';
        let errorTitle = '分析失败';
        let actionHtml = '';
        
        if (error.message.includes('API Key')) {
            errorIcon = '🔑';
            errorTitle = 'API Key问题';
            actionHtml = `<button class="error-action-btn" data-action="promptForApiKey">重新配置API Key</button>`;
        } else if (error.message.includes('网络')) {
            errorIcon = '🌐';
            errorTitle = '网络连接问题';
            actionHtml = `<button class="error-action-btn" data-action="retryAiChat">重试</button>`;
        } else if (error.message.includes('频繁')) {
            errorIcon = '⏳';
            errorTitle = '请求过于频繁';
            actionHtml = `<span class="error-hint">请稍后重试</span>`;
        } else if (error.message.includes('不可用') || error.message.includes('异常')) {
            errorIcon = '⚡';
            errorTitle = '服务暂时不可用';
            actionHtml = `<span class="error-hint">请稍后重试</span>`;
        }
        
        const errorHtml = `
            <div class="ai-error-message">
                <div class="error-icon">${errorIcon}</div>
                <div class="error-title">${errorTitle}</div>
                <div class="error-desc">${MetricsUtils.escapeHtml(error.message)}</div>
                <div class="error-actions">${actionHtml}</div>
            </div>
        `;
        this.addMessage(errorHtml);
    }

    // 重试上一次的操作
    retryLastAction() {
        if (this.lastAnalysisData) {
            this.startDataAnalysis();
        } else if (this.lastMessage) {
            this.sendMessage(this.lastMessage);
        }
    }

    // 自定义提问
    askCustomQuestion() {
        const input = document.getElementById('chatInput');
        input.focus();
        input.placeholder = '请输入您想了解的数据问题...';
    }

    // 自然语言解析 - 从用户输入中提取模块、维度、时间周期
    async parseUserInput(message) {
        const result = {
            module: null,      // 'bookstore' 或 'aibc'
            dimension: null,   // 'weekly' 或 'monthly'
            period: null,      // 时间周期字符串
            hasExplicitModule: false,
            hasExplicitDimension: false,
            hasExplicitPeriod: false
        };

        // 模块识别
        if (message.match(/智书|AIBC|小程序|H5|商家/)) {
            result.module = 'aibc';
            result.hasExplicitModule = true;
        } else if (message.match(/书城|生产|征集|消费|下载/)) {
            result.module = 'bookstore';
            result.hasExplicitModule = true;
        }

        // 维度识别
        if (message.match(/周度|这周|上周|本周|周的|周内|周期/i)) {
            result.dimension = 'weekly';
            result.hasExplicitDimension = true;
        } else if (message.match(/月度|这月|上月|本月|月的|月内|月份/i)) {
            result.dimension = 'monthly';
            result.hasExplicitDimension = true;
        }

        // 时间周期识别 - 支持多种格式
        // 格式1：2026年2月20日-2月26日（转换为标准格式 YYYY.M.D-YYYY.M.D）
        const weekMatch = message.match(/(\d{4})年(\d{1,2})月(\d{1,2})日-(\d{1,2})月(\d{1,2})日/);
        if (weekMatch) {
            const [, year, month1, day1, month2, day2] = weekMatch;
            result.period = `${year}.${parseInt(month1)}.${parseInt(day1)}-${year}.${parseInt(month2)}.${parseInt(day2)}`;
            result.hasExplicitPeriod = true;
        }

        // 格式2：2026年2月（转换为标准格式 YYYY.M）
        const monthMatch = message.match(/(\d{4})年(\d{1,2})月(?!日)/);
        if (monthMatch && !result.period) {
            const [, year, month] = monthMatch;
            result.period = `${year}.${parseInt(month)}`;
            result.hasExplicitPeriod = true;
        }

        // 格式3：相对时间 - 上周、上月、这周、这月等
        if (!result.period) {
            // 获取当前日期
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1;
            
            if (message.match(/上周|上个周/)) {
                // 计算上周的大致时间范围
                const lastWeekStart = new Date(currentDate);
                lastWeekStart.setDate(currentDate.getDate() - 7);
                
                // 获取可用的周度周期
                const periods = await aiAnalyzer.getAvailablePeriods(result.module || App.dashboard, 'weekly');
                if (periods.length > 0) {
                    // 找到最接近上周的周期
                    result.period = this.findClosestPeriod(periods, lastWeekStart, 'weekly');
                    if (result.period) {
                        result.hasExplicitPeriod = true;
                    } else if (periods.length > 1) {
                        // 如果没有找到最接近的，使用倒数第二个
                        result.period = periods[periods.length - 2];
                        result.hasExplicitPeriod = true;
                    }
                }
            } else if (message.match(/上月|上个月/)) {
                // 计算上月的月份
                const lastMonth = currentMonth - 1 || 12;
                const lastMonthYear = lastMonth === 12 ? currentYear - 1 : currentYear;
                
                // 获取可用的月度周期
                const periods = await aiAnalyzer.getAvailablePeriods(result.module || App.dashboard, 'monthly');
                if (periods.length > 0) {
                    // 找到最接近上月的周期
                    const lastMonthDate = new Date(lastMonthYear, lastMonth - 1, 1);
                    result.period = this.findClosestPeriod(periods, lastMonthDate, 'monthly');
                    if (result.period) {
                        result.hasExplicitPeriod = true;
                    } else if (periods.length > 1) {
                        // 如果没有找到最接近的，使用倒数第二个
                        result.period = periods[periods.length - 2];
                        result.hasExplicitPeriod = true;
                    }
                }
            } else if (message.match(/这周|本周|当前周|今周/)) {
                // 获取当前周的数据
                const periods = await aiAnalyzer.getAvailablePeriods(result.module || App.dashboard, 'weekly');
                if (periods.length > 0) {
                    // 找到最接近当前日期的周期
                    result.period = this.findClosestPeriod(periods, currentDate, 'weekly');
                    if (result.period) {
                        result.hasExplicitPeriod = true;
                    } else {
                        // 如果没有找到最接近的，使用最后一个
                        result.period = periods[periods.length - 1];
                        result.hasExplicitPeriod = true;
                    }
                }
            } else if (message.match(/这月|本月|当前月|今月/)) {
                // 获取当前月的数据
                const periods = await aiAnalyzer.getAvailablePeriods(result.module || App.dashboard, 'monthly');
                if (periods.length > 0) {
                    // 找到最接近当前日期的周期
                    result.period = this.findClosestPeriod(periods, currentDate, 'monthly');
                    if (result.period) {
                        result.hasExplicitPeriod = true;
                    } else {
                        // 如果没有找到最接近的，使用最后一个
                        result.period = periods[periods.length - 1];
                        result.hasExplicitPeriod = true;
                    }
                }
            }
        }

        return result;
    }

    // 查找最接近指定日期的周期
    findClosestPeriod(periods, targetDate, dimension) {
        if (!periods || periods.length === 0) return null;
        
        let closestPeriod = null;
        let closestDiff = Infinity;
        
        periods.forEach(period => {
            let periodDate;
            if (dimension === 'weekly') {
                // 周度周期格式：2026.2.20-2026.2.26 或 2026年2月20日-2月26日
                const dotFormatMatch = period.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
                const yearMonthDayFormatMatch = period.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
                
                if (dotFormatMatch) {
                    const [, year, month, day] = dotFormatMatch;
                    periodDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                } else if (yearMonthDayFormatMatch) {
                    const [, year, month, day] = yearMonthDayFormatMatch;
                    periodDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                }
            } else if (dimension === 'monthly') {
                // 月度周期格式：YYYY.M 或 YYYY年M月
                const dotFormatMatch = period.match(/(\d{4})\.(\d{1,2})/);
                const cnFormatMatch = period.match(/(\d{4})年(\d{1,2})月/);
                if (dotFormatMatch) {
                    const [, year, month] = dotFormatMatch;
                    periodDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                } else if (cnFormatMatch) {
                    const [, year, month] = cnFormatMatch;
                    periodDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                }
            }
            
            if (periodDate) {
                const diff = Math.abs(periodDate - targetDate);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestPeriod = period;
                }
            }
        });
        
        return closestPeriod;
    }

    // 发送消息 - 支持跨模块/跨维度查询
    async sendMessage(message) {
        if (!message.trim()) return;
        
        // 保存最后一条消息用于重试
        this.lastMessage = message;
        
        // 检查API Key是否已配置
        const apiKey = aiAnalyzer.getApiKey();
        if (!apiKey) {
            this.showApiKeyMissingError();
            return;
        }
        
        this.addMessage(message, true);
        this.showTypingIndicator();
        
        try {
            // 解析用户输入，提取模块、维度、时间周期
            const parsedInput = await this.parseUserInput(message);
            
            // 确定要使用的模块、维度、时间周期
            let targetModule = parsedInput.module || App.dashboard;
            let targetDimension = parsedInput.dimension || App.dataMode;
            let targetPeriod = parsedInput.period || document.getElementById('timeSelector').value;
            
            let contextPrompt = '';
            
            // 获取分析数据
            let analysisData = await aiAnalyzer.prepareAnalysisData(targetPeriod, targetModule, targetDimension);
            
            // 如果指定的数据不存在，使用所有维度的数据
            if (!analysisData) {
                // 使用所有维度的数据分析
                contextPrompt = await this.buildAllDimensionsAnalysisPrompt();
            } else {
                // 检测用户是否要求跨模块/跨维度分析
                const crossModuleMatch = message.match(/对比|比较|书城|智书|AIBC/);
                const crossDimensionMatch = message.match(/周度|月度|周|月|对比|比较/);
                
                let comparisonData = null;
                
                // 基础数据上下文
                if (analysisData.isAibc) {
                    // 智书看板数据
                    const current = analysisData.current;
                    contextPrompt = `
当前数据周期: ${analysisData.period}
当前模块: 智书平台
数据类型: ${analysisData.dataMode === 'weekly' ? '周度' : '月度'}数据
整体访客数据:
- 小程序访客: ${formatNumber(current.miniAppVisitors)}
- 小程序新增访客: ${formatNumber(current.miniAppNewVisitors)}
- H5访客: ${formatNumber(current.h5Visitors)}
- H5新增访客: ${formatNumber(current.h5NewVisitors)}

主要商家访客数据:
${Object.entries(current.merchants)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `- ${name}: ${formatNumber(count)}`)
    .join('\n')}`;

                    // 如果要求跨维度对比
                    if (crossDimensionMatch) {
                        const otherMode = analysisData.dataMode === 'weekly' ? 'monthly' : 'weekly';
                        const otherData = await aiAnalyzer.getDataByModuleAndDimension('aibc', otherMode, analysisData.period);
                        if (otherData) {
                            const otherModeText = otherMode === 'weekly' ? '周度' : '月度';
                            contextPrompt += `

${otherModeText}数据对比:
- 小程序访客: ${formatNumber(otherData.miniAppVisitors)}
- H5访客: ${formatNumber(otherData.h5Visitors)}`;
                            comparisonData = {
                                type: 'cross-dimension',
                                other: { current: otherData, dataMode: otherMode }
                            };
                        }
                    }
                    
                    // 如果要求跨模块对比
                    if (crossModuleMatch && message.match(/书城|对比|比较/)) {
                        const bookstoreData = await aiAnalyzer.getDataByModuleAndDimension('bookstore', analysisData.dataMode, analysisData.period);
                        if (bookstoreData) {
                            contextPrompt += `

书城平台对比数据:
- 总消费: ${formatNumber(bookstoreData.totalConsumption)}
- 总下载: ${formatNumber(bookstoreData.totalDownload)}`;
                            comparisonData = {
                                type: 'cross-module',
                                other: { current: bookstoreData, dashboard: 'bookstore' }
                            };
                        }
                    }
                } else {
                    // 书城看板数据
                    contextPrompt = `
当前数据周期: ${analysisData.period}
当前模块: 书城平台
数据类型: ${analysisData.dataMode === 'weekly' ? '周度' : '月度'}数据
核心数据:
- 生产（发布资料）: ${formatNumber(analysisData.current.production)}
- 征集（创建专辑）: ${formatNumber(analysisData.current.collection)}
- 总消费: ${formatNumber(analysisData.current.totalConsumption)}
- C端消费: ${formatNumber(analysisData.current.cConsumption)}
- B端消费: ${formatNumber(analysisData.current.bConsumption)}
- B端消费占比: ${(analysisData.current.bConsumption / analysisData.current.totalConsumption * 100).toFixed(1)}%
- 总下载量: ${formatNumber(analysisData.current.totalDownload)}`;

                    // 如果要求跨维度对比
                    if (crossDimensionMatch) {
                        const otherMode = analysisData.dataMode === 'weekly' ? 'monthly' : 'weekly';
                        const otherData = await aiAnalyzer.getDataByModuleAndDimension('bookstore', otherMode, analysisData.period);
                        if (otherData) {
                            const otherModeText = otherMode === 'weekly' ? '周度' : '月度';
                            contextPrompt += `

${otherModeText}数据对比:
- 生产: ${formatNumber(otherData.production)}
- 总消费: ${formatNumber(otherData.totalConsumption)}`;
                            comparisonData = {
                                type: 'cross-dimension',
                                other: { current: otherData, dataMode: otherMode }
                            };
                        }
                    }
                    
                    // 如果要求跨模块对比
                    if (crossModuleMatch && message.match(/智书|AIBC|对比|比较/)) {
                        const aibcData = await aiAnalyzer.getDataByModuleAndDimension('aibc', analysisData.dataMode, analysisData.period);
                        if (aibcData) {
                            contextPrompt += `

智书平台对比数据:
- 小程序访客: ${formatNumber(aibcData.miniAppVisitors)}
- H5访客: ${formatNumber(aibcData.h5Visitors)}`;
                            comparisonData = {
                                type: 'cross-module',
                                other: { current: aibcData, dashboard: 'aibc' }
                            };
                        }
                    }
                }
            }

            contextPrompt += `

请基于以上数据回答用户问题。回答要专业、简洁、有针对性。`;

            // 构建消息历史
            const messages = [
                {
                    role: 'system',
                    content: `你是学科网数据分析专家。${contextPrompt}`
                },
                ...this.conversationHistory.slice(-6), // 保留最近3轮对话
                {
                    role: 'user',
                    content: message
                }
            ];

            const response = await fetch(DEEPSEEK_CONFIG.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${aiAnalyzer.getApiKey()}`
                },
                body: JSON.stringify({
                    model: DEEPSEEK_CONFIG.model,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1500
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('API Key无效或已过期，请检查您的API Key配置');
                } else if (response.status === 429) {
                    throw new Error('API请求过于频繁，请稍后重试');
                } else if (response.status >= 500) {
                    throw new Error(`AI服务暂时不可用（${response.status}），请稍后重试`);
                } else {
                    throw new Error(`AI分析失败（${response.status}）`);
                }
            }

            const data = await response.json();
            if (!data.choices || !data.choices[0]?.message?.content) {
                throw new Error('AI服务返回异常，请稍后重试');
            }
            const result = data.choices[0].message.content;
            
            this.hideTypingIndicator();
            this.addMessage(this.formatMessage(result));
            
            this.conversationHistory.push({
                role: 'user',
                content: message
            });
            this.conversationHistory.push({
                role: 'assistant',
                content: result
            });
            
        } catch (error) {
            this.hideTypingIndicator();
            this.showErrorMessage(error);
        }
    }

    // 构建所有维度的分析提示词（当指定维度数据不存在时使用）
    async buildAllDimensionsAnalysisPrompt() {
        await Promise.all([
            aiAnalyzer.ensureDataReady('bookstore', 'weekly'),
            aiAnalyzer.ensureDataReady('bookstore', 'monthly'),
            aiAnalyzer.ensureDataReady('aibc', 'weekly'),
            aiAnalyzer.ensureDataReady('aibc', 'monthly')
        ]);

        const bookstoreWeekly = Array.isArray(window.weeklyData) ? window.weeklyData : [];
        const bookstoreMonthly = Array.isArray(window.monthlyData) ? window.monthlyData : [];
        const aibcWeekly = Array.isArray(window.aibcWeeklyData) ? window.aibcWeeklyData : [];
        const aibcMonthly = Array.isArray(window.aibcMonthlyData) ? window.aibcMonthlyData : [];

        let prompt = `
作为学科网的数据分析专家，请分析以下所有数据并提供专业的业务洞察：

`;
        
        // 添加书城周度数据
        prompt += `**书城周度数据**:
`;
        bookstoreWeekly.forEach(item => {
            prompt += `- ${item.period}: 生产=${item.production}, 征集=${item.collection}, 总消费=${item.totalConsumption}
`;
        });
        
        // 添加书城月度数据
        prompt += `
**书城月度数据**:
`;
        bookstoreMonthly.forEach(item => {
            prompt += `- ${item.period}: 生产=${item.production}, 征集=${item.collection}, 总消费=${item.totalConsumption}
`;
        });
        
        // 添加智书周度数据
        prompt += `
**智书周度数据**:
`;
        aibcWeekly.forEach(item => {
            prompt += `- ${item.period}: 小程序访客=${item.miniAppVisitors}, H5访客=${item.h5Visitors}
`;
        });
        
        // 添加智书月度数据
        prompt += `
**智书月度数据**:
`;
        aibcMonthly.forEach(item => {
            prompt += `- ${item.period}: 小程序访客=${item.miniAppVisitors}, H5访客=${item.h5Visitors}
`;
        });
        
        prompt += `
请从以下角度进行综合分析：
1. **整体业务表现**: 两个平台的总体趋势和关键亮点
2. **平台对比**: 两个平台的优势和劣势对比
3. **用户行为**: 不同平台的用户行为差异
4. **增长驱动因素**: 主要增长点分析
5. **风险提示**: 需要关注的问题
6. **策略建议**: 具体的业务优化建议

请用中文回答，语言专业但易懂，重点突出数据背后的业务含义。
        `;
        
        return prompt.trim();
    }

    // 格式化消息
    formatMessage(content) {
        return MetricsUtils.escapeHtml(content)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>')
            .replace(/\n- /g, '<br>• ')
            .replace(/\n(\d+\. )/g, '<br>$1');
    }

    // 清空对话
    clearChat() {
        this.conversationHistory = [];
        
        const messagesContainer = document.getElementById('aiChatMessages');
        messagesContainer.innerHTML = `
            <div class="ai-message">
                <div class="message-avatar">AI</div>
                <div class="message-content">
                    <p>您好！我是您的数据分析助手。我可以帮您分析当前数据周期的业务表现，或者回答您关于数据的任何问题。</p>
                    <p>请选择一个选项开始：</p>
                    <div class="quick-actions">
                        <button class="quick-btn" data-action="startDataAnalysis">📊 分析当前数据</button>
                        <button class="quick-btn" data-action="askCustomQuestion">💬 自定义提问</button>
                    </div>
                </div>
            </div>
        `;
    }
}

// 创建AI对话管理器实例
const aiChat = new AIChatManager();
window.aiChat = aiChat;

// 加载状态管理
let loadingTimer = null;
let loadingStartTime = 0;
const MIN_LOADING_TIME = 300; // 最小显示时间（ms），避免闪烁

// 显示加载状态
function showLoading(options = {}) {
    const { lightweight = false, text = '加载中...' } = options;
    
    // 清除之前的 timer
    if (loadingTimer) {
        clearTimeout(loadingTimer);
        loadingTimer = null;
    }
    
    loadingStartTime = Date.now();
    
    if (lightweight) {
        // 轻量级：只在标题显示 loading 状态
        const title = document.getElementById('dashboardTitle');
        if (title && !title.classList.contains('updating')) {
            title.classList.add('updating');
        }
        return;
    }
    
    // 完整 loading 覆盖层
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        // 更新加载文本
        const loadingText = loadingOverlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
        loadingOverlay.classList.add('active');
    }
    
    // 添加标题动画
    const title = document.getElementById('dashboardTitle');
    if (title) {
        title.classList.add('updating');
    }
    
    // 添加内容淡出效果
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardContent) {
        dashboardContent.classList.add('fade-out');
    }
}

// 隐藏加载状态
function hideLoading() {
    const elapsed = Date.now() - loadingStartTime;
    const waitTime = Math.max(0, MIN_LOADING_TIME - elapsed);
    
    // 如果还没到最小显示时间，延迟隐藏
    if (waitTime > 0) {
        loadingTimer = setTimeout(() => {
            doHideLoading();
        }, waitTime);
    } else {
        doHideLoading();
    }
}

function doHideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
    
    // 移除标题动画
    const title = document.getElementById('dashboardTitle');
    if (title) {
        title.classList.remove('updating');
    }
    
    // 添加内容淡入效果
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardContent) {
        dashboardContent.classList.remove('fade-out');
        // 移除 fade-in 后重新添加以触发动画
        dashboardContent.classList.remove('fade-in');
        // 强制 reflow
        void dashboardContent.offsetWidth;
        dashboardContent.classList.add('fade-in');
        
        // 动画结束后移除 fade-in class
        setTimeout(() => {
            dashboardContent.classList.remove('fade-in');
        }, 300);
    }
}

// 切换看板
