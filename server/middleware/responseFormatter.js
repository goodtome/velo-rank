/**
 * 统一响应格式中间件
 * 为所有响应添加标准格式
 */

/**
 * 成功响应格式
 * {
 *   code: 200,
 *   message: 'success',
 *   data: {...}
 * }
 */

/**
 * 响应格式化中间件
 */
function responseFormatter(req, res, next) {
  // 保存原始的json方法
  const originalJson = res.json.bind(res);

  // 重写json方法，统一格式
  res.json = function(data) {
    // 如果已经是正确的格式（包含code和message字段），直接返回
    if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
      return originalJson(data);
    }

    // 如果有code字段但没有message字段，添加message
    if (data && typeof data === 'object' && 'code' in data && !('message' in data)) {
      data.message = 'success';
      return originalJson(data);
    }

    // 否则包装为成功响应
    const formatted = {
      code: 200,
      message: 'success',
      data: data
    };

    return originalJson(formatted);
  };

  next();
}

/**
 * 快速发送成功响应
 */
function sendSuccess(res, data = null, message = 'success', statusCode = 200) {
  const response = {
    code: statusCode,
    message
  };

  if (data !== null) {
    response.data = data;
  }

  res.status(statusCode).json(response);
}

/**
 * 快速发送分页响应
 */
function sendPaginated(res, data, pagination, message = 'success') {
  res.json({
    code: 200,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit)
    }
  });
}

module.exports = {
  responseFormatter,
  sendSuccess,
  sendPaginated
};
