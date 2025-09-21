const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// 格式化日期
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

// 转换数组为CSV格式
function arrayToCSV(data) {
  if (!data || data.length === 0) return ''
  
  const headers = Object.keys(data[0])
  const csvRows = []
  
  // 添加标题行
  csvRows.push(headers.join(','))
  
  // 添加数据行
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]
      // 处理包含逗号或引号的值
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value || ''
    })
    csvRows.push(values.join(','))
  }
  
  return csvRows.join('\n')
}

// 导出数据
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID
  const batchSize = event.batchSize || 0 // 0表示不分批
  const batchIndex = event.batchIndex || 0 // 批次索引
  
  try {
    console.log('开始导出用户数据，用户ID:', userId, '批次大小:', batchSize, '批次索引:', batchIndex)
    
    // 获取用户的所有充值记录
    const rechargeQuery = await db.collection('recharge_records')
      .where({ user_id: userId })
      .orderBy('recharge_time', 'desc')
      .get()
    
    console.log('充值记录数量:', rechargeQuery.data.length)
    
    // 获取用户的所有购买记录
    const purchaseQuery = await db.collection('purchase_records')
      .where({ user_id: userId })
      .orderBy('purchase_time', 'desc')
      .get()
    
    console.log('购买记录数量:', purchaseQuery.data.length)
    
    // 获取用户的所有卖出记录
    const sellQuery = await db.collection('sell_records')
      .where({ user_id: userId })
      .orderBy('sell_time', 'desc')
      .get()
    
    console.log('卖出记录数量:', sellQuery.data.length)
    
    // 格式化充值记录
    const rechargeData = rechargeQuery.data.map(record => ({
      '类型': '充值',
      '时间': formatDate(record.recharge_time),
      '人民币金额': record.rmb_amount?.toFixed(2) || '',
      '美元金额': record.usd_amount?.toFixed(2) || '',
      '汇率': record.exchange_rate?.toFixed(4) || '',
      '剩余美元': record.remaining_usd?.toFixed(2) || '',
      '物品名称': '',
      '物品类型': '',
      '数量': '',
      '单价': '',
      '总价': '',
      '实际成本': '',
      '卖出价格': '',
      '备注': record.note || ''
    }))
    
    // 格式化购买记录
    const purchaseData = purchaseQuery.data.map(record => ({
      '类型': '购买',
      '时间': formatDate(record.purchase_time),
      '人民币金额': '',
      '美元金额': '',
      '汇率': '',
      '剩余美元': '',
      '物品名称': record.item_name || '',
      '物品类型': record.item_type || '',
      '数量': record.quantity || '',
      '单价': record.usd_price?.toFixed(2) || '',
      '总价': record.total_price?.toFixed(2) || '',
      '实际成本': record.rmb_cost?.toFixed(2) || '',
      '卖出价格': '',
      '备注': record.note || ''
    }))
    
    // 格式化卖出记录
    const sellData = sellQuery.data.map(record => ({
      '类型': '卖出',
      '时间': formatDate(record.sell_time),
      '人民币金额': '',
      '美元金额': '',
      '汇率': '',
      '剩余美元': '',
      '物品名称': record.item_name || '',
      '物品类型': record.item_type || '',
      '数量': record.sell_quantity || '',
      '单价': record.sell_price_per_item?.toFixed(2) || '',
      '总价': record.total_sell_price?.toFixed(2) || '',
      '实际成本': record.purchase_cost_cny?.toFixed(2) || '',
      '卖出价格': record.total_sell_price_cny?.toFixed(2) || '',
      '备注': record.note || ''
    }))
    
    // 合并所有数据并按时间排序
    const allData = [...rechargeData, ...purchaseData, ...sellData]
    allData.sort((a, b) => new Date(b['时间']) - new Date(a['时间']))
    
    // 检查数据大小并决定是否分批
    const totalRecords = allData.length
    let finalData = allData
    let isBatched = false
    let batchInfo = null
    
    // 如果记录数量超过2000条，建议分批处理
    if (totalRecords > 2000 && batchSize === 0) {
      return {
        success: true,
        needBatch: true,
        totalRecords: totalRecords,
        suggestedBatchSize: 1000,
        totalBatches: Math.ceil(totalRecords / 1000),
        message: '记录数量较多，建议分批导出'
      }
    }
    
    // 分批处理逻辑
    if (batchSize > 0) {
      const startIndex = batchIndex * batchSize
      const endIndex = Math.min(startIndex + batchSize, totalRecords)
      finalData = allData.slice(startIndex, endIndex)
      isBatched = true
      batchInfo = {
        currentBatch: batchIndex + 1,
        totalBatches: Math.ceil(totalRecords / batchSize),
        currentRecords: finalData.length,
        totalRecords: totalRecords,
        isLastBatch: endIndex >= totalRecords
      }
      console.log('分批导出 - 批次:', batchInfo.currentBatch, '/', batchInfo.totalBatches, '记录数:', finalData.length)
    }
    
    // 转换为CSV
    const csvContent = arrayToCSV(finalData)
    
    // 估算CSV大小（字节）
    const csvSize = Buffer.byteLength(csvContent, 'utf8')
    console.log('CSV数据大小:', csvSize, '字节')
    
    // 如果单批次数据仍然过大，提醒用户
    if (csvSize > 800 * 1024) { // 800KB
      console.warn('警告: CSV数据大小超过800KB，可能超出剪贴板限制')
    }
    
    // 生成统计摘要
    const summary = {
      '总充值次数': rechargeQuery.data.length,
      '总充值金额(RMB)': rechargeQuery.data.reduce((sum, r) => sum + (r.rmb_amount || 0), 0).toFixed(2),
      '总充值金额(USD)': rechargeQuery.data.reduce((sum, r) => sum + (r.usd_amount || 0), 0).toFixed(2),
      '总购买次数': purchaseQuery.data.length,
      '总购买金额(USD)': purchaseQuery.data.reduce((sum, p) => sum + (p.total_price || 0), 0).toFixed(2),
      '总购买成本(RMB)': purchaseQuery.data.reduce((sum, p) => sum + (p.rmb_cost || 0), 0).toFixed(2),
      '总卖出次数': sellQuery.data.length,
      '总卖出金额(USD)': sellQuery.data.reduce((sum, s) => sum + (s.total_sell_price || 0), 0).toFixed(2),
      '总卖出收入(RMB)': sellQuery.data.reduce((sum, s) => sum + (s.total_sell_price_cny || 0), 0).toFixed(2),
      '导出时间': formatDate(new Date())
    }
    
    console.log('数据导出成功, 记录总数:', finalData.length)
    
    return {
      success: true,
      data: {
        csv: csvContent,
        csvSize: csvSize,
        summary: summary,
        totalRecords: totalRecords,
        currentRecords: finalData.length,
        rechargeCount: rechargeQuery.data.length,
        purchaseCount: purchaseQuery.data.length,
        sellCount: sellQuery.data.length,
        isBatched: isBatched,
        batchInfo: batchInfo
      }
    }
    
  } catch (err) {
    console.error('导出数据失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
