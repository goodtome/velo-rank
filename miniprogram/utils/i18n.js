/**
 * 中文本地化配置
 * 支持简体中文（zh-CN）和繁体中文（zh-TW）
 */

const locales = {
  'zh-CN': {
    // 通用
    appName: '骑行成绩追踪器',
    loading: '加载中...',
    error: '出错啦',
    retry: '重试',
    cancel: '取消',
    confirm: '确定',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    search: '搜索',
    noData: '暂无数据',
    noMore: '没有更多了',
    
    // 首页
    home: '首页',
    todayRace: '今日赛事',
    upcomingRace: '即将开始',
    finishedRace: '已结束',
    viewDetails: '查看详情',
    
    // 赛事
    races: '赛事',
    raceCalendar: '赛程日历',
    raceArchive: '赛事归档',
    stage: '赛段',
    distance: '距离',
    elevation: '爬升',
    type: '类型',
    
    // 成绩
    results: '成绩',
    gc: '总成绩',
    stageResult: '赛段成绩',
    points: '冲刺积分',
    mountains: '爬坡积分',
    youth: '青年排名',
    rank: '排名',
    rider: '车手',
    team: '车队',
    time: '时间',
    gap: '时间差',
    
    // 车手
    riders: '车手',
    nationality: '国籍',
    age: '年龄',
    height: '身高',
    weight: '体重',
    specialties: '特长',
    
    // 车队
    teams: '车队',
    country: '国家',
    
    // 用户
    profile: '我的',
    login: '登录',
    logout: '退出登录',
    settings: '设置',
    language: '语言',
    notifications: '推送设置',
    dnd: '免打扰',
    about: '关于',
    
    // 搜索
    searchPlaceholder: '搜索车手、车队、赛事',
    searchHistory: '搜索历史',
    clearHistory: '清空历史',
    
    // 推送
    notificationTitle: '推送通知',
    notificationRaceStart: '赛事即将开始',
    notificationRaceEnd: '赛段结束',
    notificationRankChange: '排名变化',
    dndStart: '免打扰开始',
    dndEnd: '免打扰结束',
    
    // 赛事百科
    encyclopedia: '赛事百科',
    termGC: '总成绩 (GC)',
    termGCDesc: 'General Classification，赛段累计时间总和的排名。领先者穿领骑衫。',
    termPoints: '冲刺积分',
    termPointsDesc: '平路赛段终点冲刺获得的积分，领先者穿绿衫（环法）或紫衫（环意）。',
    termMountains: '爬坡积分',
    termMountainsDesc: '爬坡路段按难度获得的积分，领先者穿圆点衫（环法）或蓝衫（环意）。',
    termYouth: '青年排名',
    termYouthDesc: '25岁以下车手的GC排名，领先者穿白衫。',
    termBreakaway: '突围',
    termBreakawayDesc: '指脱离主集团的骑行策略，通常为小规模车手群体。',
    termDomestique: '副将',
    termDomestiqueDesc: '指为队长服务的车手，负责带风、送水、保护队长等任务。',
    
    // 错误提示
    errorNetwork: '网络错误，请检查网络连接',
    errorServer: '服务器错误，请稍后重试',
    errorNotFound: '未找到相关数据',
    errorTimeout: '请求超时，请重试',
    
    // 首页新增
    pullToRefresh: '下拉刷新试试',
    statusActive: '🔴 进行中',
    statusUpcoming: '🔵 即将开始',
    to: '至',
    totalStages: '共',
    stages: '赛段',
    
    // Profile 页面
    cyclingEnthusiast: '骑行爱好者',
    welcome: '欢迎使用领骑',
    searchHistory: '搜索历史',
    raceData: '赛事数据',
    clearCache: '清除缓存',
    appDesc: '专业自行车赛事成绩查询',
    version: '版本',
    
    // 提示信息
    tips: '提示',
    confirmClearCache: '确定要清除所有缓存数据吗？',
    cacheCleared: '缓存已清除',
    
    // race-detail 页面
    km: '公里',
    stageList: '赛段列表（共 {count} 个）',
    noStageData: '暂无赛段数据',
    gcTitle: '总成绩榜',
    gcSub: '赛事总排名',
    
    // 错误信息
    missingRaceId: '缺少赛事ID',
    raceNotFound: '赛事不存在',
    dataError: '数据错误',
    
    // rider-detail 页面
    riderNotFound: '未找到车手信息',
    basicInfo: '基本信息',
    birthDate: '出生日期',
    height: '身高',
    weight: '体重',
    uciId: 'UCI ID',
    status: '状态',
    retired: '已退役',
    active: '现役',
    belongTeam: '所属车队',
    
    // encyclopedia 页面
    searchPlaceholder: '搜索术语...',
    all: '全部',
    rankingTerm: '排名术语',
    tacticTerm: '战术术语',
    ruleTerm: '赛事规则',
    termDefinition: '定义',
    termDetail: '详细说明',
    termExample: '示例',
    termRelated: '相关术语',
    encyclopediaTitle: '赛事百科 - 自行车赛事术语全知道',
    
    // push-settings 页面
    pushSettings: '推送设置',
    pushDesc: '管理您的推送通知偏好',
    pushEnabledLabel: '推送通知',
    pushEnabledDesc: '总开关，关闭后不再接收任何推送',
    notifyRaceStartLabel: '赛事开始提醒',
    notifyRaceStartDesc: '赛事开始前15分钟推送提醒',
    notifyStageEndLabel: '赛段结束通知',
    notifyStageEndDesc: '赛段结束后推送成绩摘要',
    notifyRiderChangeLabel: '关注车手排名变化',
    notifyRiderChangeDesc: '您关注的车手排名发生变化时推送',
    notifyKeyEventsLabel: '关键事件通知',
    notifyKeyEventsDesc: '进攻、摔车、冲刺等关键事件',
    dndSettings: '免打扰时段',
    dndEnabledLabel: '启用免打扰',
    dndEnabledDesc: '在指定时间段内不推送通知',
    dndStartLabel: '开始时间',
    dndEndLabel: '结束时间',
    dndTip: '免打扰时段内，系统将记录事件但不推送通知。您可以在早上打开App时查看"夜间赛事摘要"。',
    pushFrequencyLabel: '推送频率',
    freqRealtime: '实时推送',
    freqRealtimeDesc: '排名变化立即推送',
    freq30min: '每30分钟',
    freq30minDesc: '每半小时汇总推送一次',
    freqDaily: '每日汇总',
    freqDailyDesc: '每天早上推送昨日汇总',
    testPush: '发送测试推送',
    testPushSending: '发送中...',
    testPushSent: '测试推送已发送',
    testPushContent: '这是一条测试推送通知，如果您看到此消息，说明推送功能正常工作。',
    pushTip: '推送通知需要您在手机系统设置中允许"领骑"应用发送通知。如果收不到推送，请检查系统通知权限。',
    allowNotification: '允许"领骑"应用发送通知',
    
    // race-calendar 页面
    today: '今天',
    monthYear: '{year}年{month}月',
    noRaces: '当天无赛事',
    upcoming: '即将开始',
    addToCalendar: '添加',
    addToCalendarTitle: '添加到日历',
    addToCalendarContent: '将"{raceName}"添加到系统日历？',
    addedToCalendar: '已添加提醒',
    countdownToday: '今天开始',
    countdownTomorrow: '明天开始',
    countdownDays: '{days}天后开始',
    
    // search 页面
    searchRiders: '车手',
    searchTeams: '车队',
    searchHistoryTitle: '搜索历史',
    clearHistory: '清除',
    searching: '搜索中...',
    searchFailed: '搜索失败，请检查网络',
    retrySearch: '重新搜索',
    noResults: '未找到相关结果',
    initialText: '搜索车手或车队名称',
    clearHistoryConfirm: '确定要清除搜索历史吗？',
    historyCleared: '已清除',
  },
  
  'zh-TW': {
    // 通用
    appName: '騎行成績追蹤器',
    loading: '載入中...',
    error: '出錯啦',
    retry: '重試',
    cancel: '取消',
    confirm: '確定',
    save: '儲存',
    delete: '刪除',
    edit: '編輯',
    search: '搜尋',
    noData: '暫無資料',
    noMore: '沒有更多了',
    
    // 首页
    home: '首頁',
    todayRace: '今日賽事',
    upcomingRace: '即將開始',
    finishedRace: '已結束',
    viewDetails: '查看詳情',
    
    // 赛事
    races: '賽事',
    raceCalendar: '賽程日曆',
    raceArchive: '賽事歸檔',
    stage: '賽段',
    distance: '距離',
    elevation: '爬升',
    type: '類型',
    
    // 成绩
    results: '成績',
    gc: '總成績',
    stageResult: '賽段成績',
    points: '衝刺積分',
    mountains: '爬坡積分',
    youth: '青年排名',
    rank: '排名',
    rider: '車手',
    team: '車隊',
    time: '時間',
    gap: '時間差',
    
    // 车手
    riders: '車手',
    nationality: '國籍',
    age: '年齡',
    height: '身高',
    weight: '體重',
    specialties: '特長',
    
    // 车队
    teams: '車隊',
    country: '國家',
    
    // 用户
    profile: '我的',
    login: '登入',
    logout: '登出',
    settings: '設定',
    language: '語言',
    notifications: '推播設定',
    dnd: '免打擾',
    about: '關於',
    
    // 搜索
    searchPlaceholder: '搜尋車手、車隊、賽事',
    searchHistory: '搜尋紀錄',
    clearHistory: '清除紀錄',
    
    // 推送
    notificationTitle: '推播通知',
    notificationRaceStart: '賽事即將開始',
    notificationRaceEnd: '賽段結束',
    notificationRankChange: '排名變化',
    dndStart: '免打擾開始',
    dndEnd: '免打擾結束',
    
    // 赛事百科
    encyclopedia: '賽事百科',
    termGC: '總成績 (GC)',
    termGCDesc: 'General Classification，賽段累計時間總和的排名。領先者穿領騎衫。',
    termPoints: '衝刺積分',
    termPointsDesc: '平路賽段終點衝刺獲得的積分，領先者穿綠衫（環法）或紫衫（環意）。',
    termMountains: '爬坡積分',
    termMountainsDesc: '爬坡路段按難度獲得的積分，領先者穿圓點衫（環法）或藍衫（環意）。',
    termYouth: '青年排名',
    termYouthDesc: '25歲以下車手的GC排名，領先者穿白衫。',
    termBreakaway: '突圍',
    termBreakawayDesc: '指脫離主集團的騎行策略，通常為小規模車手群體。',
    termDomestique: '副將',
    termDomestiqueDesc: '指為隊長服務的車手，負責帶風、送水、保護隊長等任務。',
    
    // 错误提示
    errorNetwork: '網絡錯誤，請檢查網絡連接',
    errorServer: '伺服器錯誤，請稍後重試',
    errorNotFound: '未找到相關資料',
    errorTimeout: '請求超時，請重試',
    
    // 首頁新增
    pullToRefresh: '下拉刷新試試',
    statusActive: '🔴 進行中',
    statusUpcoming: '🔵 即將開始',
    to: '至',
    totalStages: '共',
    stages: '賽段',
    
    // Profile 頁面
    cyclingEnthusiast: '騎行愛好者',
    welcome: '歡迎使用領騎',
    searchHistory: '搜尋歷紀錄',
    raceData: '賽事數據',
    clearCache: '清除緩存',
    appDesc: '專業自行車賽事成績查詢',
    version: '版本',
    
    // 提示信息
    tips: '提示',
    confirmClearCache: '確定要清除所有緩存數據嗎？',
    cacheCleared: '緩存已清除',
    
    // race-detail 頁面
    km: '公裡',
    stageList: '賽段列表（共 {count} 個）',
    noStageData: '暫無賽段數據',
    gcTitle: '總成績榜',
    gcSub: '賽事總排名',
    
    // 錯誤信息
    missingRaceId: '缺少賽事ID',
    raceNotFound: '賽事不存在',
    dataError: '數據錯誤',
    
    // rider-detail 页面
    riderNotFound: '未找到車手信息',
    basicInfo: '基本信息',
    birthDate: '出生日期',
    height: '身高',
    weight: '體重',
    uciId: 'UCI ID',
    status: '狀態',
    retired: '已退役',
    active: '現役',
    belongTeam: '所屬車隊',
    
    // encyclopedia 页面
    searchPlaceholder: '搜索術語...',
    all: '全部',
    rankingTerm: '排名術語',
    tacticTerm: '戰術術語',
    ruleTerm: '賽事規則',
    termDefinition: '定義',
    termDetail: '詳細說明',
    termExample: '示例',
    termRelated: '相關術語',
    encyclopediaTitle: '賽事百科 - 自行車賽事術語全知道',
    
    // push-settings 页面
    pushSettings: '推送設定',
    pushDesc: '管理您的推送通知偏好',
    pushEnabledLabel: '推送通知',
    pushEnabledDesc: '總開關，關閉後不再接收任何推送',
    notifyRaceStartLabel: '賽事開始提醒',
    notifyRaceStartDesc: '賽事開始前15分鐘推送提醒',
    notifyStageEndLabel: '賽段結束通知',
    notifyStageEndDesc: '賽段結束後推送成績摘要',
    notifyRiderChangeLabel: '關注車手排名變化',
    notifyRiderChangeDesc: '您關注的車手排名發生變化時推送',
    notifyKeyEventsLabel: '關鍵事件通知',
    notifyKeyEventsDesc: '進攻、摔車、衝刺等關鍵事件',
    dndSettings: '免打擾時段',
    dndEnabledLabel: '啟用免打擾',
    dndEnabledDesc: '在指定時間段內不推送通知',
    dndStartLabel: '開始時間',
    dndEndLabel: '結束時間',
    dndTip: '免打擾時段內，系統將記錄事件但不推送通知。您可以在早上打開App時查看"夜間賽事摘要"。',
    pushFrequencyLabel: '推送頻率',
    freqRealtime: '即時推送',
    freqRealtimeDesc: '排名變化立即推送',
    freq30min: '每30分鐘',
    freq30minDesc: '每半小時彙總推送一次',
    freqDaily: '每日彙總',
    freqDailyDesc: '每天早上推送昨日彙總',
    testPush: '發送測試推送',
    testPushSending: '發送中...',
    testPushSent: '測試推送已發送',
    testPushContent: '這是一條測試推送通知，如果您看到此訊息，說明推送功能正常工作。',
    pushTip: '推送通知需要您在手機系統設定中允許"領騎"應用發送通知。如果收不到推送，請檢查系統通知權限。',
    allowNotification: '允許"領騎"應用發送通知',
    
    // race-calendar 页面
    today: '今天',
    monthYear: '{year}年{month}月',
    noRaces: '當天無賽事',
    upcoming: '即將開始',
    addToCalendar: '添加',
    addToCalendarTitle: '添加到日曆',
    addToCalendarContent: '將"{raceName}"添加到系統日曆？',
    addedToCalendar: '已添加提醒',
    countdownToday: '今天開始',
    countdownTomorrow: '明天開始',
    countdownDays: '{days}天後開始',
    
    // search 页面
    searchRiders: '車手',
    searchTeams: '車隊',
    searchHistoryTitle: '搜尋歷史',
    clearHistory: '清除',
    searching: '搜尋中...',
    searchFailed: '搜尋失敗，請檢查網絡',
    retrySearch: '重新搜尋',
    noResults: '未找到相關結果',
    initialText: '搜尋車手或車隊名稱',
    clearHistoryConfirm: '確定要清除搜尋歷史嗎？',
    historyCleared: '已清除',
  },
};

/**
 * 获取本地化文本
 * @param {string} key - 文本键
 * @param {string} [locale='zh-CN'] - 语言代码
 * @returns {string} 本地化文本
 */
function t(key, locale = 'zh-CN') {
  if (!locales[locale]) {
    locale = 'zh-CN'; // 默认简体中文
  }
  
  return locales[locale][key] || key;
}

/**
 * 设置语言
 * @param {string} locale - 语言代码 ('zh-CN' | 'zh-TW')
 */
function setLocale(locale) {
  if (!locales[locale]) {
    throw new Error(`Unsupported locale: ${locale}`);
  }
  
  wx.setStorageSync('locale', locale);
}

/**
 * 获取当前语言
 * @returns {string} 语言代码
 */
function getLocale() {
  return wx.getStorageSync('locale') || 'zh-CN';
}

module.exports = {
  t,
  setLocale,
  getLocale,
  locales
};
