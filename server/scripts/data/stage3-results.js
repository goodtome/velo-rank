// Stage 3 成绩数据
// 数据来源: https://www.giroditalia.it/en/classifiche/di-tappa/3/
// 抓取时间: 2026-05-14
// 赛段: Stage 3 - Plovdiv → Sofia (2026-05-10)

const STAGE3_RESULTS = {
  stage_info: {
    stage_number: 3,
    date: '2026-05-10',
    start: 'Plovdiv',
    finish: 'Sofia',
    distance: '180km',  // 待确认实际距离
    source_url: 'https://www.giroditalia.it/en/classifiche/di-tappa/3/'
  },
  stage_results: [
    // 赛段前三名
    { rank: 1, rider_name: 'Paul MAGNIER', team_name: 'SOUDAL QUICK-STEP', time: '4:09:42', time_gap: '0:00' },
    { rank: 2, rider_name: 'Jonathan MILAN', team_name: 'LIDL-TREK', time: '4:09:42', time_gap: '0:00' },
    { rank: 3, rider_name: 'Dylan GROENEWEGEN', team_name: 'UNIBET ROSE ROCKETS', time: '4:09:42', time_gap: '0:00' },
    { rank: 4, rider_name: 'Madis MIHKELS', team_name: 'EF EDUCATION - EASYPOST', time: '4:09:42', time_gap: '0:00' },
    { rank: 5, rider_name: 'Matteo MALUCELLI', team_name: 'XDS ASTANA TEAM', time: '4:09:42', time_gap: '0:00' },
    { rank: 6, rider_name: 'Erlend BLIKRA', team_name: 'UNO-X MOBILITY', time: '4:09:42', time_gap: '0:00' },
    { rank: 7, rider_name: 'Pascal ACKERMANN', team_name: 'TEAM JAYCO ALULA', time: '4:09:42', time_gap: '0:00' },
    { rank: 8, rider_name: 'Davide BALLERINI', team_name: 'XDS ASTANA TEAM', time: '4:09:42', time_gap: '0:00' },
    { rank: 9, rider_name: 'Tobias Lund ANDRESEN', team_name: 'DECATHLON CMA CGM TEAM', time: '4:09:42', time_gap: '0:00' },
    { rank: 10, rider_name: 'Enrico ZANONCELLO', team_name: 'BARDIANI CSF 7 SABER', time: '4:09:42', time_gap: '0:00' },
    { rank: 11, rider_name: 'Paul PENHOET', team_name: 'GROUPAMA-FDJ UNITED', time: '4:09:42', time_gap: '0:00' },
    { rank: 12, rider_name: 'Robin FROIDEVAUX', team_name: 'TUDOR PRO CYCLING TEAM', time: '4:09:42', time_gap: '0:00' },
    { rank: 13, rider_name: 'Filippo MAGLI', team_name: 'BARDIANI CSF 7 SABER', time: '4:09:42', time_gap: '0:00' },
    { rank: 14, rider_name: 'Ivan GARCIA CORTINA', team_name: 'MOVISTAR TEAM', time: '4:09:42', time_gap: '0:00' },
    { rank: 15, rider_name: 'Sean FLYNN', team_name: 'TEAM PICNIC POSTNL', time: '4:09:42', time_gap: '0:00' },
    { rank: 16, rider_name: 'Toon AERTS', team_name: 'LOTTO INTERMARCHÉ', time: '4:09:42', time_gap: '0:00' },
    { rank: 17, rider_name: 'Ethan VERNON', team_name: 'NSN CYCLING TEAM', time: '4:09:42', time_gap: '0:00' },
    { rank: 18, rider_name: 'Jensen PLOWRIGHT', team_name: 'ALPECIN-PREMIER TECH', time: '4:09:42', time_gap: '0:00' },
    { rank: 19, rider_name: 'Giovanni LONARDI', team_name: 'TEAM POLTI VISITMALTA', time: '4:09:42', time_gap: '0:00' },
    { rank: 20, rider_name: 'Alec SEGAERT', team_name: 'BAHRAIN VICTORIOUS', time: '4:09:42', time_gap: '0:00' },
  ],
  jersey_holders: {
    // Stage 3后的领骑衫归属 (来源: giroditalia.it/livehub/tappa/3/)
    pink: { // Maglia Rosa - 总成绩第一 (粉衫)
      rank: 1,
      rider_name: 'Afonso EULÁLIO',
      team_name: 'BAHRAIN VICTORIOUS',
      note: 'Stage 3后穿上粉衫 - 保加利亚赛段后总成绩领先'
    },
    white: { // Maglia Bianca - 最佳年轻车手 (白衫)
      rank: 1,
      rider_name: 'Afonso EULÁLIO',
      team_name: 'BAHRAIN VICTORIOUS',
      note: 'Stage 3后穿上白衫 - 与粉衫同一人'
    },
    purple: { // Maglia Ciclamino - 冲刺积分 (紫衫)
      rank: 1,
      rider_name: 'Paul MAGNIER',
      team_name: 'SOUDAL QUICK-STEP',
      points: 50,
      note: 'Stage 3赛段冠军+时间奖励，冲刺积分第一'
    },
    blue: { // Maglia Azzurra - 爬坡积分 (蓝衫)
      rank: 1,
      rider_name: 'Diego Pablo SEVILLA',
      team_name: 'TEAM POLTI VISITMALTA',
      points: 18,
      note: 'Borovets Pass爬坡点第一'
    },
  },
  classifications: {
    // Stage 3后的分类排名
    points: [ // Points Classification 冲刺积分
      { rank: 1, rider_name: 'Paul MAGNIER', team_name: 'SOUDAL QUICK-STEP', points: 50 },
      { rank: 2, rider_name: 'Jonathan MILAN', team_name: 'LIDL-TREK', points: 38 },
      { rank: 3, rider_name: 'Dylan GROENEWEGEN', team_name: 'UNIBET ROSE ROCKETS', points: 25 },
      { rank: 4, rider_name: 'Madis MIHKELS', team_name: 'EF EDUCATION - EASYPOST', points: 18 },
      { rank: 5, rider_name: 'Matteo MALUCELLI', team_name: 'XDS ASTANA TEAM', points: 14 },
    ],
    kom: [ // KOM Classification 爬坡积分
      { rank: 1, rider_name: 'Diego Pablo SEVILLA', team_name: 'TEAM POLTI VISITMALTA', points: 18 },
      { rank: 2, rider_name: 'Manuele TAROZZI', team_name: 'BARDIANI CSF 7 SABER', points: 8 },
      { rank: 3, rider_name: 'Alessandro TONELLI', team_name: 'TEAM POLTI VISITMALTA', points: 6 },
      { rank: 4, rider_name: 'Christian SCARONI', team_name: 'XDS ASTANA TEAM', points: 4 },
      { rank: 5, rider_name: 'Gianmarco GAROFOLI', team_name: 'SOUDAL QUICK-STEP', points: 2 },
    ]
  },
  notes: [
    '数据来源: giroditalia.it 官方页面',
    '赛段: Plovdiv → Sofia (保加利亚境内)',
    '✅ 领骑衫数据已通过 giroditalia.it/livehub/tappa/3/ 获取',
    '✅ 赛段成绩已通过 giroditalia.it/en/classifiche/di-tappa/3/ 获取',
    '粉衫: Afonso EULÁLIO (Bahrain Victorious) - Stage 3后总成绩第一',
    '白衫: Afonso EULÁLIO (Bahrain Victorious) - 最佳年轻车手（与粉衫同一人）',
    '紫衫: Paul MAGNIER (Soudal Quick-Step) - 冲刺积分第一 (50分)',
    '蓝衫: Diego Pablo SEVILLA (Team Polti VisitMalta) - 爬坡积分第一 (18分)',
    '⚠️ 需确认: 赛段实际距离',
    '⚠️ 需补充: Stage 3后的完整GC总成绩排名',
    '⚠️ 需补充: 领骑衫获得者照片',
  ]
};

module.exports = STAGE3_RESULTS;
