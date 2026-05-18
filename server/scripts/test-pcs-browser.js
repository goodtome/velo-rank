/**
 * PCS爬虫测试脚本（浏览器模式）
 * 测试爬取2026环意Stage 5数据
 */

const { scrapeStageResult, scrapeRaceStages } = require('./scrape-pcs-v2');

const TEST_RACE_CODE = 'giro-ditalia-2026';
const TEST_STAGE_NUMBER = 5;

async function testScrape() {
  console.log('🧪 开始PCS爬虫测试（浏览器模式）\n');
  console.log('='.repeat(60));
  
  try {
    // 测试1: 爬取赛段列表
    console.log('\n📋 测试1: 爬取赛段列表');
    console.log('-'.repeat(60));
    const stages = await scrapeRaceStages(TEST_RACE_CODE);
    console.log(`结果: ${stages.length} 个赛段`);
    if (stages.length > 0) {
      stages.slice(0, 5).forEach(s => {
        console.log(`  Stage ${s.stage_number}: ${s.stage_name} (${s.date_str})`);
      });
    }
    
    // 测试2: 爬取单赛段成绩
    console.log('\n📊 测试2: 爬取Stage 5成绩');
    console.log('-'.repeat(60));
    const results = await scrapeStageResult(TEST_RACE_CODE, TEST_STAGE_NUMBER);
    if (results && results.length > 0) {
      console.log(`✅ 成功爬取 ${results.length} 条成绩`);
      console.log('前10名:');
      results.slice(0, 10).forEach(r => {
        console.log(`  ${r.rank}. ${r.rider_name} (${r.team_name}) - ${r.time_gap}`);
      });
    } else {
      console.log('⚠️ 未爬取到成绩数据');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 测试完成！');
    
  } catch (err) {
    console.error('\n❌ 测试失败:', err);
    process.exit(1);
  }
}

testScrape().then(() => {
  console.log('\n✅ Promise resolved');
  process.exit(0);
}).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
