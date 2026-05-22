  // 插入赛段成绩到数据库
  async function insertStageResults(conn, stageId, results) {
    console.log(`    💾 插入 ${results.length} 条赛段成绩...`);
    
    let inserted = 0;
    let skipped = 0;
    
    // 预先准备SQL（避免模板字符串中的反引号问题）
    const rankCol = '`rank`';
    const sql = `
      INSERT IGNORE INTO stage_results 
      (id, stage_id, rider_id, team_id, ${rankCol}, time_gap, nationality)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    for (const result of results) {
      try {
        // 先确保车手存在
        let riderId = null;
        const [riders] = await conn.query(
          'SELECT id FROM riders WHERE rider_slug = ?',
          [result.rider_slug]
        );
        
        if (riders.length > 0) {
          riderId = riders[0].id;
        } else {
          // 创建新车手
          riderId = crypto.randomUUID();
          await conn.query(`
            INSERT IGNORE INTO riders 
            (id, rider_name, rider_slug)
            VALUES (?, ?, ?)
          `, [riderId, result.rider_name, result.rider_slug]);
        }
        
        // 确保车队存在
        let teamId = null;
        if (result.team_slug) {
          const [teams] = await conn.query(
            'SELECT id FROM teams WHERE team_slug = ?',
            [result.team_slug]
          );
          
          if (teams.length > 0) {
            teamId = teams[0].id;
          } else {
            // 创建新车队
            teamId = crypto.randomUUID();
            await conn.query(`
              INSERT IGNORE INTO teams 
              (id, team_name, team_slug)
              VALUES (?, ?, ?)
            `, [teamId, result.team_name, result.team_slug]);
          }
        }
        
        // 插入赛段成绩
        await conn.query(sql, [
          crypto.randomUUID(), 
          stageId, 
          riderId, 
          teamId, 
          parseInt(result.rank) || null, 
          result.time_gap || null, 
          result.nationality || null
        ]);
        
        inserted++;
        
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          skipped++;
        } else {
          console.error(`    ❌ 插入成绩失败:`, error.message);
        }
      }
    }
    
    console.log(`    ✓ 插入 ${inserted} 条，跳过 ${skipped} 条`);
    return inserted;
  }