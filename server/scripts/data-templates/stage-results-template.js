// Stage 5 成绩数据收集模板
// 复制此文件，填入从 PCS 复制的成绩数据

const STAGE_RESULTS_TEMPLATE = [
  // 格式说明：
  // rank: 排名（数字）
  // rider_name: 车手姓名（字符串）
  // team_name: 车队名称（字符串）
  // time_gap: 时间差（字符串，如 "4h 35' 12\"" 或 "+ 0\""）
  
  { rank: 1, rider_name: '', team_name: '', time_gap: '' },
  { rank: 2, rider_name: '', team_name: '', time_gap: '' },
  { rank: 3, rider_name: '', team_name: '', time_gap: '' },
  // ... 继续添加
];

// 领骑衫数据收集模板
const JERSEYS_TEMPLATE = [
  // jersey_type: 领骑衫类型
  //   - pink: 粉衫（总成绩第一）
  //   - purple: 紫衫（冲刺积分第一）
  //   - blue: 蓝衫（爬坡积分第一）
  //   - white: 白衫（年轻车手第一）
  
  { jersey_type: 'pink', rider_name: '', team_name: '', time_gap: '' },
  { jersey_type: 'purple', rider_name: '', team_name: '', time_gap: '' },
  { jersey_type: 'blue', rider_name: '', team_name: '', time_gap: '' },
  { jersey_type: 'white', rider_name: '', team_name: '', time_gap: '' },
];
