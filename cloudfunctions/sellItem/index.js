const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()
const _ = db.command

// 卖出物品云函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = event.openid || wxContext.OPENID
  const { itemId, sellUnitPrice, sellUnitPriceCNY, sellQuantity = 1, remark } = event
  
  // 参数验证
  if (!itemId) {
    return {
      success: false,
      message: '请选择要卖出的物品'
    }
  }
  
  // 验证人民币价格（用户直接输入）
  const finalSellPrice = sellUnitPriceCNY || sellUnitPrice
  if (!finalSellPrice || finalSellPrice <= 0) {
    return {
      success: false,
      message: '请输入有效的卖出价格'
    }
  }
  
  if (!sellQuantity || sellQuantity <= 0) {
    return {
      success: false,
      message: '请输入有效的卖出数量'
    }
  }
  
  try {
    // 查询要卖出的物品
    const itemRes = await db.collection('purchase_records')
      .doc(itemId)
      .get()
    
    if (!itemRes.data) {
      return {
        success: false,
        message: '物品不存在'
      }
    }
    
    const item = itemRes.data
    
    // 检查物品所有者
    if (item.user_id !== openid) {
      return {
        success: false,
        message: '无权卖出此物品'
      }
    }
    
    // 检查可用数量
    const availableQuantity = item.quantity || 1
    
    // 查询已卖出的数量
    const existingSellRes = await db.collection('sell_records')
      .where({
        purchase_id: itemId,
        user_id: openid
      })
      .get()
    
    const soldQuantity = existingSellRes.data.reduce((sum, record) => sum + (record.sell_quantity || 1), 0)
    const remainingQuantity = availableQuantity - soldQuantity
    
    if (remainingQuantity <= 0) {
      return {
        success: false,
        message: '此物品已全部卖出'
      }
    }
    
    if (sellQuantity > remainingQuantity) {
      return {
        success: false,
        message: `可卖数量不足，剩余数量: ${remainingQuantity}`
      }
    }
    
    // 创建独立的卖出记录
    const currentTime = new Date()
    
    // 使用购买记录中的精确人民币成本（从 rmb_cost 字段获取）
    const unitRmbCost = item.rmb_cost && item.quantity > 0 ? item.rmb_cost / item.quantity : 0
    const totalPurchasePriceCny = unitRmbCost * sellQuantity
    
    // 直接使用用户提交的人民币价格
    const unitSellPriceCny = sellUnitPriceCNY || sellUnitPrice // 用户直接提交人民币价格
    const totalSellPriceCny = unitSellPriceCny * sellQuantity
    const totalProfitCny = totalSellPriceCny - totalPurchasePriceCny
    
    // 计算美元价格
    const unitPurchasePriceUsd = item.usd_unit_price || 0 // 原始美元单价
    const totalPurchasePriceUsd = unitPurchasePriceUsd * sellQuantity // 美元总购买价格
    
    const sellRecord = {
      user_id: openid,
      purchase_id: itemId,
      item_name: item.item_name,
      item_type: item.item_type || '普通',
      sell_quantity: sellQuantity,
      unit_purchase_price: parseFloat(unitPurchasePriceUsd.toFixed(2)), // 美元买入单价
      unit_purchase_price_cny: parseFloat(unitRmbCost.toFixed(2)), // 人民币买入单价
      unit_sell_price_cny: parseFloat(unitSellPriceCny.toFixed(2)), // 人民币卖出单价
      total_purchase_price: parseFloat(totalPurchasePriceUsd.toFixed(2)), // 美元总购买价格
      total_purchase_price_cny: parseFloat(totalPurchasePriceCny.toFixed(2)), // 人民币总购买价格
      total_sell_price_cny: parseFloat(totalSellPriceCny.toFixed(2)), // 人民币总卖出价格
      profit_cny: parseFloat(totalProfitCny.toFixed(2)), // 人民币利润
      exchange_rate: 0, // 不再使用汇率字段
      sell_time: currentTime,
      platform: '市场交易',
      condition: item.item_type || '普通',
      notes: remark || '',
      create_time: currentTime
    }
    
    await db.collection('sell_records').add({
      data: sellRecord
    })
    
    // 计算利润率（基于人民币）
    const profitRate = totalPurchasePriceCny > 0 ? (totalProfitCny / totalPurchasePriceCny * 100) : 0
    
    return {
      success: true,
      message: '卖出成功',
      data: {
        itemName: item.item_name,
        sellQuantity: sellQuantity,
        unitBuyPriceCny: unitRmbCost.toFixed(2),
        unitSellPriceCny: unitSellPriceCny.toFixed(2),
        totalBuyPriceCny: totalPurchasePriceCny.toFixed(2),
        totalSellPriceCny: totalSellPriceCny.toFixed(2),
        totalProfitCny: totalProfitCny.toFixed(2),
        profitRate: profitRate.toFixed(1)
      }
    }
    
  } catch (err) {
    console.error('卖出物品失败:', err)
    return {
      success: false,
      message: '卖出失败，请重试'
    }
  }
}
