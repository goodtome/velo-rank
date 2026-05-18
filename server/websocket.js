/**
 * WebSocket服务器
 * 用于实时推送成绩数据（延迟<2s）
 * 支持多客户端连接、房间订阅（按赛事+赛段）
 */

const WebSocket = require('ws');
const pool = require('./config/db-pool');

let wss = null;
const clients = new Map(); // 存储所有连接的客户端

/**
 * 初始化WebSocket服务器
 * @param {http.Server} server - HTTP服务器实例
 */
function initWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws/realtime' });
  
  wss.on('connection', (ws, req) => {
    const clientId = generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      subscriptions: [] // 订阅的房间列表
    };
    
    clients.set(clientId, clientInfo);
    console.log(`WebSocket客户端连接: ${clientId}, 当前连接数: ${clients.size}`);
    
    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'welcome',
      clientId: clientId,
      message: '连接成功，请订阅赛事以获取实时数据'
    }));
    
    // 处理客户端消息
    ws.on('message', (message) => {
      handleClientMessage(clientId, message);
    });
    
    // 处理连接关闭
    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`WebSocket客户端断开: ${clientId}, 剩余连接数: ${clients.size}`);
    });
    
    // 处理错误
    ws.on('error', (error) => {
      console.error(`WebSocket客户端错误 ${clientId}:`, error);
      clients.delete(clientId);
    });
  });
  
  console.log('WebSocket服务器初始化成功，路径: /ws/realtime');
}

/**
 * 处理客户端消息
 * @param {string} clientId - 客户端ID
 * @param {string} message - 消息内容
 */
function handleClientMessage(clientId, message) {
  try {
    const data = JSON.parse(message);
    const client = clients.get(clientId);
    
    if (!client) {
      console.error(`客户端不存在: ${clientId}`);
      return;
    }
    
    switch (data.type) {
      case 'subscribe':
        // 订阅赛事
        handleSubscribe(client, data);
        break;
        
      case 'unsubscribe':
        // 取消订阅
        handleUnsubscribe(client, data);
        break;
        
      case 'ping':
        // 心跳检测
        client.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
        
      default:
        console.warn(`未知消息类型: ${data.type}`);
    }
  } catch (error) {
    console.error(`处理客户端消息失败 ${clientId}:`, error);
  }
}

/**
 * 处理订阅请求
 * @param {Object} client - 客户端信息
 * @param {Object} data - 订阅数据
 */
function handleSubscribe(client, data) {
  const { raceId, stageId } = data;
  
  if (!raceId || !stageId) {
    client.ws.send(JSON.stringify({
      type: 'error',
      message: '缺少必要参数: raceId, stageId'
    }));
    return;
  }
  
  const room = `race_${raceId}_stage_${stageId}`;
  
  if (!client.subscriptions.includes(room)) {
    client.subscriptions.push(room);
  }
  
  client.ws.send(JSON.stringify({
    type: 'subscribed',
    room: room,
    message: `已订阅 ${room}`
  }));
  
  console.log(`客户端 ${client.id} 订阅: ${room}`);
  
  // 立即发送一次当前数据
  sendInitialData(client, raceId, stageId);
}

/**
 * 处理取消订阅请求
 * @param {Object} client - 客户端信息
 * @param {Object} data - 取消订阅数据
 */
function handleUnsubscribe(client, data) {
  const { raceId, stageId } = data;
  const room = `race_${raceId}_stage_${stageId}`;
  
  client.subscriptions = client.subscriptions.filter(r => r !== room);
  
  client.ws.send(JSON.stringify({
    type: 'unsubscribed',
    room: room,
    message: `已取消订阅 ${room}`
  }));
  
  console.log(`客户端 ${client.id} 取消订阅: ${room}`);
}

/**
 * 发送初始数据
 * @param {Object} client - 客户端信息
 * @param {number} raceId - 赛事ID
 * @param {number} stageId - 赛段ID
 */
async function sendInitialData(client, raceId, stageId) {
  try {
    // 获取GC排名
    const [gcRows] = await pool.query(`
      SELECT r.id as riderId, r.name as riderName, t.name as teamName, 
             gc.rank, gc.time_gap as timeGap
      FROM general_classification gc
      JOIN riders r ON gc.rider_id = r.id
      JOIN teams t ON r.team_id = t.id
      WHERE gc.race_id = ? AND gc.stage_id = ?
      ORDER BY gc.rank ASC
      LIMIT 50
    `, [raceId, stageId]);
    
    // 获取赛段成绩
    const [stageRows] = await pool.query(`
      SELECT r.id as riderId, r.name as riderName, t.name as teamName, 
             sr.rank, sr.time
      FROM stage_results sr
      JOIN riders r ON sr.rider_id = r.id
      JOIN teams t ON r.team_id = t.id
      WHERE sr.race_id = ? AND sr.stage_id = ?
      ORDER BY sr.rank ASC
      LIMIT 50
    `, [raceId, stageId]);
    
    // 发送给客户端
    client.ws.send(JSON.stringify({
      type: 'data',
      dataType: 'gc',
      raceId: raceId,
      stageId: stageId,
      lastUpdate: new Date().toISOString(),
      data: gcRows
    }));
    
    client.ws.send(JSON.stringify({
      type: 'data',
      dataType: 'stage',
      raceId: raceId,
      stageId: stageId,
      lastUpdate: new Date().toISOString(),
      data: stageRows
    }));
    
  } catch (error) {
    console.error(`发送初始数据失败:`, error);
    client.ws.send(JSON.stringify({
      type: 'error',
      message: '获取数据失败'
    }));
  }
}

/**
 * 广播数据更新到所有订阅的客户端
 * @param {number} raceId - 赛事ID
 * @param {number} stageId - 赛段ID
 * @param {string} dataType - 数据类型 (gc, stage, points, mountains, youth)
 * @param {Array} data - 更新数据
 */
function broadcastUpdate(raceId, stageId, dataType, data) {
  const room = `race_${raceId}_stage_${stageId}`;
  const message = JSON.stringify({
    type: 'update',
    dataType: dataType,
    raceId: raceId,
    stageId: stageId,
    lastUpdate: new Date().toISOString(),
    data: data
  });
  
  let sentCount = 0;
  
  clients.forEach((client) => {
    if (client.subscriptions.includes(room) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
      sentCount++;
    }
  });
  
  console.log(`广播更新: ${room} ${dataType}, 接收客户端数: ${sentCount}`);
}

/**
 * 生成客户端ID
 * @returns {string} 客户端ID
 */
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取当前连接数
 * @returns {number} 连接数
 */
function getConnectionCount() {
  return clients.size;
}

/**
 * 关闭WebSocket服务器
 */
function closeWebSocket() {
  if (wss) {
    clients.forEach((client) => {
      client.ws.close();
    });
    wss.close();
    console.log('WebSocket服务器已关闭');
  }
}

module.exports = {
  initWebSocket,
  broadcastUpdate,
  getConnectionCount,
  closeWebSocket
};
