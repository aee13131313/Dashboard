/**
 * CSV → JSON 数据转换脚本
 * 
 * 用法: node scripts/csv-to-json.js
 * 
 * 从 CSV 源数据文件自动生成 JSON 数据文件，
 * 替代手动维护的 JS 数据文件。
 * CSV 成为唯一数据源，JSON 为运行时格式。
 */

const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const BASE_DIR = path.resolve(__dirname, '..'); // dashboard root
const DATA_DIR = BASE_DIR; // JSON runtime files are published from project root
const CSV_DIR = BASE_DIR; // CSV files are in project root

// ============== 字段映射 ==============

const BOOKSTORE_WEEKLY_MAP = {
  '生产（发布资料）': 'production',
  '征集（创建专辑）': 'collection',
  '总消费': 'totalConsumption',
  '消费（C）': 'cConsumption',
  '消费（储值）': 'cStoredConsumption',
  '消费（C-储值）': 'cStoredConsumption',
  '消费（现金）': 'cCashConsumption',
  '消费（C-现金）': 'cCashConsumption',
  '消费（B）': 'bConsumption',
  '书城消费（仅教辅）': 'bookstoreConsumption',
  '书城消费': 'bookstoreConsumption',
  '大盘消费': 'marketConsumption',
  '消费占比': 'consumptionRatio',
  '总下载量': 'totalDownload',
  '下载量（付费）': 'paidDownload',
  '下载量（免费）': 'freeDownload',
  '访客uv': 'visitorUV',
  '登录访客uv': 'loginVisitorUV',
  '总下载用户': 'totalDownloadUsers',
  '下载用户（C）': 'cDownloadUsers',
  '下载用户（B储值卡）': 'bCardDownloadUsers',
  '下载用户（B免费）': 'bFreeDownloadUsers',
};

const BOOKSTORE_MONTHLY_EXTRA_MAP = {
  '小学': 'primarySchool',
  '初中': 'middleSchool',
  '高中': 'highSchool',
  '中职': 'vocationalSchool',
  '试卷': 'testPaper',
  '课件': 'courseware',
  '作业': 'homework',
  '题集': 'questionSet',
  '教案': 'teachingPlan',
  '学案': 'studyGuide',
  '备课包': 'preparationPackage',
  '素材': 'material',
  '其他类型': 'otherType',
  '同步教学': 'synchronousTeaching',
  '高考复习': 'gaokaoReview',
  '中考复习': 'zhongkaoReview',
  '寒暑假': 'winterSummerVacation',
  '小升初复习': 'primaryToMiddleReview',
  '中职复习': 'vocationalReview',
  '其他场景': 'otherScene',
  '初升高衔接': 'middleToHighSchool',
  '小升初衔接': 'primaryToMiddleSchool',
  '竞赛': 'competition',
  '初升中职衔接': 'middleToVocational',
  '课后': 'afterSchool'
};

const AIBC_VISITOR_MAP = {
  '小程序访客': 'miniAppVisitors',
  '小程序新增访客': 'miniAppNewVisitors',
  '小程序日均访客': 'miniAppDailyVisitors',
  'H5访客': 'h5Visitors',
  'H5新增访客': 'h5NewVisitors',
};

const AIBC_NON_MERCHANT_ROWS = new Set([
  '',
  ...Object.keys(AIBC_VISITOR_MAP)
]);

// ============== CSV 解析工具 ==============

function readTextFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const utf8Text = buffer.toString('utf-8');
  if (!utf8Text.includes('\uFFFD')) {
    return utf8Text;
  }

  return new TextDecoder('gb18030').decode(buffer);
}

function parseCSV(filePath) {
  const raw = readTextFile(filePath);
  // Remove BOM
  const content = raw.replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    // Simple CSV split - handles quoted values with commas
    const result = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function parseNumber(val) {
  if (!val || val === '') return 0;
  // Remove quotes/commas in numbers like "87,316.30"
  const cleaned = val.replace(/,/g, '').replace(/"/g, '');
  // Percentage like "9.50%" → 9.5
  if (cleaned.endsWith('%')) {
    return parseFloat(cleaned.slice(0, -1));
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ============== 转换函数 ==============

/**
 * 转换书城横向表格型 CSV → JSON 数组
 * weekly.csv, monthly.csv
 */
function convertBookstoreCSV(csvFile, isMonthly = false) {
  const rows = parseCSV(csvFile);
  const header = rows[0];
  const periods = header.slice(1); // Skip first column (row label)

  const result = [];
  // Create period objects
  for (let i = 0; i < periods.length; i++) {
    result.push({ period: periods[i] });
  }

  // Fill in values per row
  for (let r = 1; r < rows.length; r++) {
    const rowLabel = rows[r][0];
    const jsKey = BOOKSTORE_WEEKLY_MAP[rowLabel] || BOOKSTORE_MONTHLY_EXTRA_MAP[rowLabel];

    for (let i = 1; i < rows[r].length && i - 1 < result.length; i++) {
      const val = parseNumber(rows[r][i]);
      if (jsKey) {
        result[i - 1][jsKey] = val;
      } else {
        // Unknown rows (e.g. category dimensions in monthly) - store with original key
        result[i - 1][rowLabel] = val;
      }
    }
  }

  return result;
}

/**
 * 转换书城商家排行榜 CSV → JSON 对象
 * bookstore-weekly-merchant-ranking.csv, bookstore-monthly-merchant-ranking.csv
 *
 * 推荐 CSV format: period,rankingType,rank,merchantId,merchantName,totalConsumption,yearAgoConsumption,diff
 * 兼容旧 CSV format: period,rank,merchantId,merchantName,totalConsumption,yearAgoConsumption,diff
 *
 * rankingType values:
 *   consumption / 消费排行榜：按当前总消费降序 Top20
 *   growth / 增长排行榜：相较去年同期差额为正，按差额降序 Top20
 *   decline / 下降排行榜：相较去年同期差额为负，按差额升序 Top20
 */
function convertBookstoreMerchantRankingCSV(csvFile) {
  if (!fs.existsSync(csvFile)) {
    return {};
  }

  const rows = parseCSV(csvFile);
  if (rows.length <= 1) {
    return {};
  }

  const result = {};
  const header = rows[0].map(col => col.replace(/^\uFEFF/, ''));
  const columnIndex = new Map(header.map((col, index) => [col, index]));
  const hasRankingType = columnIndex.has('rankingType');

  function getValue(row, columnName) {
    const index = columnIndex.get(columnName);
    return index === undefined ? '' : (row[index] || '').trim();
  }

  function normalizeRankingType(value) {
    const raw = String(value || '').trim();
    const map = {
      consumption: 'consumption',
      total: 'consumption',
      consume: 'consumption',
      '消费排行榜': 'consumption',
      '消费': 'consumption',
      growth: 'growth',
      increase: 'growth',
      rising: 'growth',
      '增长排行榜': 'growth',
      '增长': 'growth',
      decline: 'decline',
      decrease: 'decline',
      falling: 'decline',
      drop: 'decline',
      '下降排行榜': 'decline',
      '下降': 'decline'
    };
    return map[raw] || 'consumption';
  }

  function ensurePeriod(period) {
    if (!result[period]) {
      result[period] = {
        consumption: [],
        growth: [],
        decline: []
      };
    }
    if (Array.isArray(result[period])) {
      result[period] = {
        consumption: result[period],
        growth: [],
        decline: []
      };
    }
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const period = getValue(row, 'period');
    const merchantId = getValue(row, 'merchantId');
    const merchantName = getValue(row, 'merchantName');

    if (!period || !merchantId || !merchantName) {
      continue;
    }

    ensurePeriod(period);

    const totalConsumption = parseNumber(getValue(row, 'totalConsumption'));
    const yearAgoConsumption = parseNumber(getValue(row, 'yearAgoConsumption'));
    const diffRaw = getValue(row, 'diff');
    const diff = diffRaw === '' ? totalConsumption - yearAgoConsumption : parseNumber(diffRaw);
    const rankingType = hasRankingType ? normalizeRankingType(getValue(row, 'rankingType')) : 'consumption';

    result[period][rankingType].push({
      rank: parseNumber(getValue(row, 'rank')) || result[period][rankingType].length + 1,
      merchantId,
      merchantName,
      totalConsumption,
      yearAgoConsumption,
      diff
    });
  }

  Object.keys(result).forEach(period => {
    const periodRankings = result[period];
    const baseRows = periodRankings.consumption || [];

    if (!hasRankingType) {
      periodRankings.growth = baseRows.filter(item => item.diff > 0);
      periodRankings.decline = baseRows.filter(item => item.diff < 0);
    }

    periodRankings.consumption = (periodRankings.consumption || [])
      .sort((a, b) => b.totalConsumption - a.totalConsumption)
      .slice(0, 20)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    periodRankings.growth = (periodRankings.growth || [])
      .filter(item => item.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 20)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    periodRankings.decline = (periodRankings.decline || [])
      .filter(item => item.diff < 0)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 20)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  });

  return result;
}

/**
 * 转换 AIBC 横向表格型 CSV → JSON 数组（含商家子对象）
 * weeklyaibc.csv, monthlyaibc.csv
 */
function convertAIBCVisitorCSV(csvFile) {
  const rows = parseCSV(csvFile);
  const header = rows[0];
  const periods = header.slice(1); // First column is empty for aibc

  const result = [];
  for (let i = 0; i < periods.length; i++) {
    result.push({
      period: periods[i],
      merchants: {}
    });
  }

  for (let r = 1; r < rows.length; r++) {
    const rowLabel = rows[r][0];
    const jsKey = AIBC_VISITOR_MAP[rowLabel];
    const isMerchant = rowLabel && !AIBC_NON_MERCHANT_ROWS.has(rowLabel);

    for (let i = 1; i < rows[r].length && i - 1 < result.length; i++) {
      const val = parseNumber(rows[r][i]);
      if (jsKey) {
        result[i - 1][jsKey] = val;
      } else if (isMerchant) {
        result[i - 1].merchants[rowLabel] = val;
      }
    }
  }

  return result;
}

/**
 * 转换排行型 CSV → JSON 对象
 * weeklyuvaibc.csv, monthlyuvaibc.csv
 * 
 * CSV format: period header → ranking rows (10) → ranking header → ranking rows (10) → next period...
 */
function convertAIBCRankingCSV(csvFile, rankingType) {
  const rows = parseCSV(csvFile);
  const result = {};
  const rankingKeys = [rankingType, 'total'];
  
  let currentPeriod = null;
  let currentSectionIndex = -1;
  let currentEntries = [];
  let skipHeader = false;

  function saveCurrentEntries() {
    if (!currentPeriod || currentSectionIndex < 0 || currentEntries.length === 0) return;
    if (!result[currentPeriod]) {
      result[currentPeriod] = {};
    }
    result[currentPeriod][rankingKeys[currentSectionIndex] || rankingType] = [...currentEntries].sort((a, b) => a.rank - b.rank);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstCol = row[0];

    // Detect period header: a line that looks like a period date (e.g. "2026.7.17-2026.7.23" or "2026.6")
    if (isPeriodHeader(firstCol, row)) {
      saveCurrentEntries();
      currentPeriod = firstCol.replace(/^\uFEFF/, '');
      currentSectionIndex = -1;
      currentEntries = [];
      skipHeader = true; // Next line is column headers
      continue;
    }

    // Ranking CSV uses repeated header rows to separate current period ranking and total ranking.
    if (firstCol === '排序' || (skipHeader && firstCol.match(/^(排序|图书id)/i))) {
      saveCurrentEntries();
      currentSectionIndex += 1;
      currentEntries = [];
      skipHeader = false;
      continue;
    }

    // Parse ranking entry
    if (currentPeriod && currentSectionIndex >= 0 && row.length >= 5) {
      const rank = parseNumber(row[0]);
      const bookId = parseNumber(row[1]);
      const merchantName = row[2];
      const bookName = row[3];
      const visitors = parseNumber(row[4]);

      if (rank > 0 && bookName) {
        currentEntries.push({
          rank: rank,
          bookId: bookId,
          merchantName: merchantName,
          bookName: bookName,
          visitors: visitors
        });
      }
    }
  }

  saveCurrentEntries();
  return result;
}

function isPeriodHeader(firstCol, row) {
  // Period headers have the period in first column and empty/numeric values in rest
  // Weekly: "2026.7.17-2026.7.23"  Monthly: "2026.6"
  if (!firstCol) return false;
  // Check if it looks like a date period
  const isWeeklyPeriod = /^\d{4}\.\d{1,2}\.\d{1,2}-\d{4}\.\d{1,2}\.\d{1,2}$/.test(firstCol);
  const isMonthlyPeriod = /^\d{4}\.\d{1,2}$/.test(firstCol);
  return isWeeklyPeriod || isMonthlyPeriod;
}

// ============== 主流程 ==============

function main() {
  // Create data directory
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log('🔄 CSV → JSON 数据转换开始...\n');

  // 1. 书城周度数据
  console.log('处理 weekly.csv → bookstore-weekly.json');
  const weeklyData = convertBookstoreCSV(path.join(CSV_DIR, 'weekly.csv'));
  fs.writeFileSync(
    path.join(DATA_DIR, 'bookstore-weekly.json'),
    JSON.stringify(weeklyData, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'weeklyData.js'),
    `window.weeklyData = ${JSON.stringify(weeklyData, null, 2)};\n`,
    'utf-8'
  );
  console.log(`  ✅ ${weeklyData.length} 个周期\n`);

  // 1.1 书城周度商家排行榜数据
  console.log('处理 bookstore-weekly-merchant-ranking.csv → bookstore-weekly-merchant-ranking.json');
  const bookstoreWeeklyMerchantRanking = convertBookstoreMerchantRankingCSV(path.join(CSV_DIR, 'bookstore-weekly-merchant-ranking.csv'));
  fs.writeFileSync(
    path.join(DATA_DIR, 'bookstore-weekly-merchant-ranking.json'),
    JSON.stringify(bookstoreWeeklyMerchantRanking, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'bookstoreWeeklyMerchantRanking.js'),
    `window.bookstoreWeeklyMerchantRanking = ${JSON.stringify(bookstoreWeeklyMerchantRanking, null, 2)};\n`,
    'utf-8'
  );
  console.log(`  ✅ ${Object.keys(bookstoreWeeklyMerchantRanking).length} 个周期\n`);

  // 2. 书城月度数据
  console.log('处理 monthly.csv → bookstore-monthly.json');
  const monthlyData = convertBookstoreCSV(path.join(CSV_DIR, 'monthly.csv'), true);
  fs.writeFileSync(
    path.join(DATA_DIR, 'bookstore-monthly.json'),
    JSON.stringify(monthlyData, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'monthlyData.js'),
    `window.monthlyData = ${JSON.stringify(monthlyData, null, 2)};\n`,
    'utf-8'
  );
  console.log(`  ✅ ${monthlyData.length} 个周期\n`);

  // 2.1 书城月度商家排行榜数据
  console.log('处理 bookstore-monthly-merchant-ranking.csv → bookstore-monthly-merchant-ranking.json');
  const bookstoreMonthlyMerchantRanking = convertBookstoreMerchantRankingCSV(path.join(CSV_DIR, 'bookstore-monthly-merchant-ranking.csv'));
  fs.writeFileSync(
    path.join(DATA_DIR, 'bookstore-monthly-merchant-ranking.json'),
    JSON.stringify(bookstoreMonthlyMerchantRanking, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'bookstoreMonthlyMerchantRanking.js'),
    `window.bookstoreMonthlyMerchantRanking = ${JSON.stringify(bookstoreMonthlyMerchantRanking, null, 2)};\n`,
    'utf-8'
  );
  console.log(`  ✅ ${Object.keys(bookstoreMonthlyMerchantRanking).length} 个周期\n`);

  // 3. 智书周度访客数据
  console.log('处理 weeklyaibc.csv → aibc-weekly.json');
  const aibcWeeklyData = convertAIBCVisitorCSV(path.join(CSV_DIR, 'weeklyaibc.csv'));
  fs.writeFileSync(
    path.join(DATA_DIR, 'aibc-weekly.json'),
    JSON.stringify(aibcWeeklyData, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'aibcWeeklyData.js'),
    `window.aibcWeeklyData = ${JSON.stringify(aibcWeeklyData, null, 2)};\n`,
    'utf-8'
  );
  console.log(`  ✅ ${aibcWeeklyData.length} 个周期\n`);

  // 4. 智书月度访客数据
  console.log('处理 monthlyaibc.csv → aibc-monthly.json');
  const aibcMonthlyData = convertAIBCVisitorCSV(path.join(CSV_DIR, 'monthlyaibc.csv'));
  fs.writeFileSync(
    path.join(DATA_DIR, 'aibc-monthly.json'),
    JSON.stringify(aibcMonthlyData, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'aibcMonthlyData.js'),
    `window.aibcMonthlyData = ${JSON.stringify(aibcMonthlyData, null, 2)};\n`,
    'utf-8'
  );
  console.log(`  ✅ ${aibcMonthlyData.length} 个周期\n`);

  // 5. 智书周度排行数据
  // 排行 CSV 只有当前周期数据，需要合并 JS 历史排行数据
  console.log('处理 weeklyuvaibc.csv + aibcWeeklyRanking.js → aibc-weekly-ranking.json');
  let aibcWeeklyRanking = convertAIBCRankingCSV(path.join(CSV_DIR, 'weeklyuvaibc.csv'), 'weekly');
  // Merge with existing JS ranking data for historical periods
  const jsWeeklyRanking = path.join(BASE_DIR, 'aibcWeeklyRanking.js');
  if (fs.existsSync(jsWeeklyRanking)) {
    const jsContent = fs.readFileSync(jsWeeklyRanking, 'utf-8');
    const match = jsContent.match(/window\.aibcWeeklyRanking\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (match) {
      const jsData = JSON.parse(match[1]);
      // Merge: CSV data stays first for the newest period, JS data fills historical periods.
      aibcWeeklyRanking = { ...aibcWeeklyRanking, ...jsData, ...aibcWeeklyRanking };
    }
  }
  fs.writeFileSync(
    path.join(DATA_DIR, 'aibc-weekly-ranking.json'),
    JSON.stringify(aibcWeeklyRanking, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'aibcWeeklyRanking.js'),
    `window.aibcWeeklyRanking = ${JSON.stringify(aibcWeeklyRanking, null, 2)};\n`,
    'utf-8'
  );
  console.log(`  ✅ ${Object.keys(aibcWeeklyRanking).length} 个周期\n`);

  // 6. 智书月度排行数据
  console.log('处理 monthlyuvaibc.csv + aibcMonthlyRanking.js → aibc-monthly-ranking.json');
  let aibcMonthlyRanking = convertAIBCRankingCSV(path.join(CSV_DIR, 'monthlyuvaibc.csv'), 'monthly');
  const jsMonthlyRanking = path.join(BASE_DIR, 'aibcMonthlyRanking.js');
  if (fs.existsSync(jsMonthlyRanking)) {
    const jsContent = fs.readFileSync(jsMonthlyRanking, 'utf-8');
    const match = jsContent.match(/window\.aibcMonthlyRanking\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (match) {
      const jsData = JSON.parse(match[1]);
      // Merge: CSV data stays first for the newest period, JS data fills historical periods.
      aibcMonthlyRanking = { ...aibcMonthlyRanking, ...jsData, ...aibcMonthlyRanking };
    }
  }
  fs.writeFileSync(
    path.join(DATA_DIR, 'aibc-monthly-ranking.json'),
    JSON.stringify(aibcMonthlyRanking, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'aibcMonthlyRanking.js'),
    `window.aibcMonthlyRanking = ${JSON.stringify(aibcMonthlyRanking, null, 2)};\n`,
    'utf-8'
  );
  console.log(`  ✅ ${Object.keys(aibcMonthlyRanking).length} 个周期\n`);

  console.log('🎉 全部转换完成！JSON 数据文件已保存到项目根目录');
}

main();
