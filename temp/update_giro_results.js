const pool = require('../server/config/db-pool');
const { v4: uuidv4 } = require('uuid');

async function updateResults() {
  const stage19Id = 'c7783c90-c346-41c8-8799-9080da8b11ee';
  const stage20Id = 'f4ab60ad-2def-44ea-92de-48f1f85f409b';

  const riders = {
    'Kuss': 'a24f58a1-dbd2-4c3e-888a-2da220812842',
    'Gee': '3eed1cfd-70a8-4be7-8ba4-f0fdb452f3a3',
    'Ciccone': '29939633-5080-48c4-82f5-a00fae92a589',
    'Gall': 'b29a749b-1b4c-4a24-81de-870b7b65069f',
    'Vingegaard': 'c381a9a1-6cdf-4946-910f-61c95d72557b',
    'Hindley': '8a18c2d8-eeb5-4929-bb31-b5ac57664881',
    'Arensman': '03356da0-7586-4e8b-a5af-a9bef0ed3779'
  };

  const teams = {
    'Visma': '3d083159-c637-4c74-b07f-365bdbb34415',
    'Lidl': 'ad10ffe6-b665-41bc-b0c6-ca621deb4b56',
    'Decathlon': '28ec796b-4011-478b-812f-5ab44026faff',
    'Bora': '77f24194-6c34-4039-862f-1872f3d7416c',
    'Ineos': 'b4b09d07-14cf-4374-933e-5142a3a627d4'
  };

  const stage19Results = [
    { rank: 1, rider: riders.Kuss, team: teams.Visma, nat: 'USA', gap: '4:08:12' },
    { rank: 2, rider: riders.Gee, team: teams.Lidl, nat: 'CAN', gap: '+ 0:12' },
    { rank: 3, rider: riders.Ciccone, team: teams.Lidl, nat: 'ITA', gap: '+ 0:15' },
    { rank: 4, rider: riders.Gall, team: teams.Decathlon, nat: 'AUT', gap: '+ 1:45' },
    { rank: 5, rider: riders.Vingegaard, team: teams.Visma, nat: 'DEN', gap: '+ 1:45' }
  ];

  const stage20Results = [
    { rank: 1, rider: riders.Vingegaard, team: teams.Visma, nat: 'DEN', gap: '5:03:55' },
    { rank: 2, rider: riders.Gall, team: teams.Decathlon, nat: 'AUT', gap: '+ 1:15' },
    { rank: 3, rider: riders.Hindley, team: teams.Bora, nat: 'AUS', gap: '+ 1:15' },
    { rank: 4, rider: riders.Gee, team: teams.Lidl, nat: 'CAN', gap: '+ 1:15' },
    { rank: 5, rider: riders.Arensman, team: teams.Ineos, nat: 'NED', gap: '+ 1:30' }
  ];

  try {
    // Delete existing results for these stages to avoid duplicates
    await pool.query('DELETE FROM stage_results WHERE stage_id IN (?, ?)', [stage19Id, stage20Id]);

    const insert = async (stageId, results) => {
      for (const res of results) {
        await pool.query(
          `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), stageId, res.rank, res.rider, res.team, res.nat, res.gap]
        );
      }
    };

    await insert(stage19Id, stage19Results);
    await insert(stage20Id, stage20Results);

    console.log('Successfully updated Stage 19 and Stage 20 results.');
  } catch (err) {
    console.error('Error updating results:', err);
  } finally {
    process.exit();
  }
}

updateResults();
