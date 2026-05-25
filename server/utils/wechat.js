/**
 * 微信API工具函数
 * 处理 access_token 获取和订阅消息发送
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

// access_token 缓存
let accessTokenCache = {
  token: null,
  expireTime: 0
};

/**
 * 获取微信 access_token
 * @returns {Promise<string>} access_token
 */
async function getAccessToken() {
  const now = Date.now();
  
  // 如果 token 还在有效期内（提前5分钟刷新）
  if (accessTokenCache.token && accessTokenCache.expireTime > now + 5 * 60 * 1000) {
    return accessTokenCache.token;
  }
  
  const appId = process.env.WECHAT_APPID;
  const appSecret = process.env.WECHAT_APPSECRET;
  
  if (!appId || !appSecret) {
    throw new Error('缺少微信配置: WECHAT_APPID 或 WECHAT_APPSECRET');
  }
  
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result.errcode) {
            reject(new Error(`获取 access_token 失败: ${result.errmsg}`));
            return;
          }
          
          // 缓存 token
          accessTokenCache.token = result.access_token;
          accessTokenCache.expireTime = now + result.expires_in * 1000;
          
          console.log('获取微信 access_token 成功');
          resolve(result.access_token);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 发送订阅消息
 * @param {Object} params - 推送参数
 * @param {string} params.touser - 接收者的 openid
 * @param {string} params.templateId - 模板消息ID
 * @param {Object} params.data - 模板数据
 * @param {string} [params.page] - 跳转页面
 * @returns {Promise<Object>} 发送结果
 */
async function sendSubscribeMessage(params) {
  const { touser, templateId, data, page } = params;
  
  if (!touser || !templateId || !data) {
    throw new Error('缺少必要参数: touser, templateId, data');
  }
  
  const accessToken = await getAccessToken();
  
  const messageData = {
    touser,
    template_id: templateId,
    data,
    page: page || 'pages/index/index'  // 默认跳转首页
  };
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(messageData);
    const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          
          if (result.errcode === 0) {
            console.log(`订阅消息发送成功: ${touser}`);
            resolve(result);
          } else if (result.errcode === 40001) {
            // access_token 无效，清除缓存重试
            accessTokenCache.token = null;
            reject(new Error(`access_token 无效: ${result.errmsg}`));
          } else {
            reject(new Error(`发送订阅消息失败: ${result.errmsg}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * 批量发送订阅消息
 * @param {Array<Object>} messages - 消息数组
 * @returns {Promise<Object>} 发送结果统计
 */
async function batchSendSubscribeMessage(messages) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  for (const msg of messages) {
    try {
      await sendSubscribeMessage(msg);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        touser: msg.touser,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * 微信登录：用 code 换取 openid 和 session_key
 * @param {string} code - wx.login() 返回的临时凭证
 * @returns {Promise<{openid: string, session_key: string, unionid?: string}>}
 */
async function code2Session(code) {
  const appId = process.env.WECHAT_APPID;
  const appSecret = process.env.WECHAT_SECRET;

  if (!appId || !appSecret) {
    throw new Error('缺少微信配置: WECHAT_APPID 或 WECHAT_SECRET');
  }

  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.errcode) {
            reject(new Error(`code2Session 失败: ${result.errmsg} (errcode=${result.errcode})`));
            return;
          }
          resolve({
            openid: result.openid,
            session_key: result.session_key,
            unionid: result.unionid || null
          });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

module.exports = {
  getAccessToken,
  sendSubscribeMessage,
  batchSendSubscribeMessage,
  code2Session
};
