let currentMetrics = {
    production: 'production',
    consumption: 'totalConsumption',
    download: 'totalDownload',
    user: 'loginVisitorUV'
};

// 智书商家筛选状态
let aibcSelectedMerchants = new Set();

// DeepSeek API配置
const DEEPSEEK_CONFIG = {
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: '', // 请通过"设置API Key"功能配置，或使用 promptForApiKey()
    model: 'deepseek-chat'
};

// AI分析功能
