// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 获取请求参数
    const { trendMonths = 6 } = event
    console.log('获取统计数据，用户ID:', wxContext.OPENID, '趋势月数:', trendMonths)
    
    // 获取用户的所有购买记录
    const purchaseQuery = await db.collection('purchase_records')
      .where({
        user_id: wxContext.OPENID
      })
      .get()
    
    console.log('购买记录数量:', purchaseQuery.data.length)
    
    // 获取用户的所有卖出记录
    const sellQuery = await db.collection('sell_records')
      .where({
        user_id: wxContext.OPENID
      })
      .get()
    
    console.log('卖出记录数量:', sellQuery.data.length)
    
    // 获取用户的充值记录（用于计算平均汇率）
    const rechargeQuery = await db.collection('recharge_records')
      .where({
        user_id: wxContext.OPENID
      })
      .get()
    
    console.log('充值记录数量:', rechargeQuery.data.length)
    
    // 计算平均汇率
    const avgExchangeRate = calculateAverageExchangeRate(rechargeQuery.data)
    console.log('平均汇率:', avgExchangeRate)
    
    // 计算总投入 (人民币)
    const totalInvestment = rechargeQuery.data.reduce((sum, item) => {
      return sum + (item.rmb_amount || 0)
    }, 0)
    
    // 计算总收入 (人民币) - 从卖出记录计算
    const totalIncome = sellQuery.data.reduce((sum, item) => {
      return sum + (item.total_sell_price_cny || 0)
    }, 0)
    
    // 计算完成交易对的利润 (只计算有对应卖出记录的购买记录)
    const transactionPairs = matchTransactionPairs(purchaseQuery.data, sellQuery.data)
    console.log('匹配的交易对数量:', transactionPairs.length)
    
    // 计算完成交易对的人民币利润
    const completedProfitCny = transactionPairs.reduce((sum, pair) => {
      return sum + pair.profitCny
    }, 0)
    

    
    // 计算完成交易对的总成本
    const completedCostCny = transactionPairs.reduce((sum, pair) => {
      return sum + pair.purchaseCostCny
    }, 0)
    

    
    // 计算所有交易的总利润（包括未完成的交易，用于总览）
    const totalPurchaseCny = purchaseQuery.data.reduce((sum, item) => {
      return sum + (item.rmb_cost || 0)
    }, 0)
    
    const totalSellCny = sellQuery.data.reduce((sum, item) => {
      return sum + (item.total_sell_price_cny || 0)
    }, 0)
    
    // 总利润（包括未完成交易）
    const totalProfitCny = totalSellCny - totalPurchaseCny
    
    console.log('总购买CNY:', totalPurchaseCny, '总卖出CNY:', totalSellCny, '总利润CNY:', totalProfitCny)
    console.log('完成交易对利润CNY:', completedProfitCny)
    console.log('完成交易对成本CNY:', completedCostCny)
    
    // 计算分类统计 - 基于完成的交易对
    const categoryStats = calculateCategoryStats(transactionPairs)
    console.log('分类统计:', categoryStats)
    
    // 计算月度趋势 - 基于完成的交易对
    const monthlyTrend = calculateMonthlyTrend(transactionPairs, trendMonths)
    console.log('月度趋势:', monthlyTrend)
    
    // 计算库存成本（所有购买但未完全卖出的物品成本）
    const inventoryCost = calculateInventoryCost(purchaseQuery.data, sellQuery.data, avgExchangeRate)
    console.log('库存成本CNY:', inventoryCost.inventoryCostCny)
    

    
    const result = {
      // 总利润（包括未完成交易）
      totalProfitCny: totalProfitCny,
      // 完成交易对的利润（用于利润率计算）
      completedProfitCny: completedProfitCny,
      // 完成交易对的成本
      completedCostCny: completedCostCny,
      // 库存成本（购买但未完全卖出的物品成本）
      inventoryCostCny: inventoryCost.inventoryCostCny,
      inventoryItemCount: inventoryCost.inventoryItemCount,
      // 完成交易对的统计
      completedTransactionPairs: transactionPairs.length,
      totalInvestment: totalInvestment,
      totalIncome: totalIncome,
      avgExchangeRate: avgExchangeRate,
      categoryStats: categoryStats,
      monthlyTrend: monthlyTrend
    }
    
    console.log('返回统计结果:', result)
    
    return {
      success: true,
      data: result
    }
    
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 匹配交易对 - 只计算有对应卖出记录的购买记录
function matchTransactionPairs(purchaseRecords, sellRecords) {
  const transactionPairs = []
  
  // 创建卖出记录的映射，按purchase_id分组
  const sellRecordsMap = new Map()
  sellRecords.forEach(sell => {
    const purchaseId = sell.purchase_id
    if (!sellRecordsMap.has(purchaseId)) {
      sellRecordsMap.set(purchaseId, [])
    }
    sellRecordsMap.get(purchaseId).push(sell)
  })
  
  console.log('卖出记录映射:', Array.from(sellRecordsMap.entries()).map(([id, sells]) => ({
    purchaseId: id,
    sellCount: sells.length,
    totalSellQuantity: sells.reduce((sum, s) => sum + (s.sell_quantity || 1), 0)
  })))
  
  // 遍历购买记录，找到对应的卖出记录
  purchaseRecords.forEach(purchase => {
    const purchaseId = purchase._id
    const sellsForThisPurchase = sellRecordsMap.get(purchaseId) || []
    
    if (sellsForThisPurchase.length > 0) {
      // 计算这个购买记录对应的所有卖出记录的总利润
      let totalSellPriceCny = 0

      let totalSellQuantity = 0
      
      sellsForThisPurchase.forEach(sell => {
        totalSellPriceCny += (sell.total_sell_price_cny || 0)

        totalSellQuantity += (sell.sell_quantity || 1)
      })
      
      // 计算购买成本（人民币）
      const purchaseCostCny = purchase.rmb_cost || 0

      
      // 如果是部分卖出，按比例计算成本
      const purchaseQuantity = purchase.quantity || 1
      const sellRatio = totalSellQuantity / purchaseQuantity
      const actualPurchaseCostCny = purchaseCostCny * sellRatio

      
      // 计算利润
      const profitCny = totalSellPriceCny - actualPurchaseCostCny
      
      transactionPairs.push({
        purchaseId: purchaseId,
        itemName: purchase.item_name,
        itemType: purchase.item_type,
        purchaseQuantity: purchaseQuantity,
        sellQuantity: totalSellQuantity,
        sellRatio: sellRatio,
        purchaseCostCny: actualPurchaseCostCny,
        sellPriceCny: totalSellPriceCny,
        profitCny: profitCny,
        profitMarginCny: actualPurchaseCostCny > 0 ? (profitCny / actualPurchaseCostCny * 100) : 0,
        sellRecords: sellsForThisPurchase
      })
    }
  })
  
  console.log('匹配的交易对详情:', transactionPairs.map(pair => ({
    itemName: pair.itemName,
    sellRatio: pair.sellRatio,
    profitCny: pair.profitCny,
    profitMarginCny: pair.profitMarginCny
  })))
  
  return transactionPairs
}

// 计算平均汇率
function calculateAverageExchangeRate(rechargeRecords) {
  if (!rechargeRecords || rechargeRecords.length === 0) {
    return 7.0 // 默认汇率
  }
  
  let totalRmb = 0
  let totalUsd = 0
  
  rechargeRecords.forEach(record => {
    totalRmb += (record.rmb_amount || 0)
    totalUsd += (record.usd_amount || 0)
  })
  
  if (totalUsd === 0) {
    return 7.0
  }
  
  return totalRmb / totalUsd
}

// 计算分类统计 - 基于完成的交易对
function calculateCategoryStats(transactionPairs) {
  const categoryMap = {}
  
  // 统计完成的交易对
  transactionPairs.forEach(pair => {
    const itemType = pair.itemType || 'unknown'
    if (!categoryMap[itemType]) {
      categoryMap[itemType] = {
        item_type: itemType,
        totalPurchaseCny: 0,
        totalSellCny: 0,
        purchaseCount: 0,
        sellCount: 0
      }
    }
    
    // 累加已完成交易对的数据
    categoryMap[itemType].totalPurchaseCny += pair.purchaseCostCny
    categoryMap[itemType].totalSellCny += pair.sellPriceCny
    categoryMap[itemType].purchaseCount += pair.sellQuantity // 使用实际卖出数量
    categoryMap[itemType].sellCount += pair.sellQuantity
  })
  
  // 计算每个分类的利润 (人民币)
  const categoryStats = Object.values(categoryMap).map(category => {
    // totalSellCny 和 totalPurchaseCny 都是人民币
    const profit = category.totalSellCny - category.totalPurchaseCny
    return {
      ...category,
      profit: profit
    }
  })
  
  // 按利润排序
  return categoryStats.sort((a, b) => b.profit - a.profit)
}

// 计算月度趋势 - 基于完成的交易对
function calculateMonthlyTrend(transactionPairs, months = 6) {
  const monthlyMap = {}
  
  // 生成指定月数的月份列表
  const monthsList = []
  const currentDate = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthsList.push(monthKey)
    
    // 初始化月份数据
    monthlyMap[monthKey] = {
      month: monthKey,
      purchaseCny: 0,
      sellCny: 0
    }
  }
  
  // 统计完成的交易对 - 按卖出时间归类
  transactionPairs.forEach(pair => {
    // 获取最新的卖出时间作为该交易对的完成时间
    const latestSellTime = pair.sellRecords.reduce((latest, sell) => {
      const sellTime = new Date(sell.sell_time || sell.create_time)
      return sellTime > latest ? sellTime : latest
    }, new Date(0))
    
    const monthKey = `${latestSellTime.getFullYear()}-${String(latestSellTime.getMonth() + 1).padStart(2, '0')}`
    
    // 只统计指定月数范围内的数据
    if (monthlyMap[monthKey]) {
      monthlyMap[monthKey].purchaseCny += pair.purchaseCostCny
      monthlyMap[monthKey].sellCny += pair.sellPriceCny
    }
  })
  
  // 计算每月利润 (人民币)
  const monthlyTrend = monthsList.map(monthKey => {
    const month = monthlyMap[monthKey]
    const profit = month.sellCny - month.purchaseCny
    return {
      month: month.month,
      profit: profit,
      purchaseCny: month.purchaseCny,
      sellCny: month.sellCny
    }
  })
  
  return monthlyTrend
}



// 计算库存成本 - 所有购买但未完全卖出的物品成本
function calculateInventoryCost(purchaseRecords, sellRecords, avgExchangeRate) {
  let inventoryCostCny = 0
  let inventoryItemCount = 0
  
  // 创建卖出记录的映射，按purchase_id分组，计算每个购买记录的总卖出数量
  const sellQuantityMap = new Map()
  sellRecords.forEach(sell => {
    const purchaseId = sell.purchase_id
    if (!sellQuantityMap.has(purchaseId)) {
      sellQuantityMap.set(purchaseId, 0)
    }
    sellQuantityMap.set(purchaseId, sellQuantityMap.get(purchaseId) + (sell.sell_quantity || 1))
  })
  
  // 遍历购买记录，计算库存成本
  purchaseRecords.forEach(purchase => {
    const purchaseId = purchase._id
    const purchaseQuantity = purchase.quantity || 1
    const soldQuantity = sellQuantityMap.get(purchaseId) || 0
    const remainingQuantity = purchaseQuantity - soldQuantity
    
    // 如果还有库存（未完全卖出）
    if (remainingQuantity > 0) {
      // 计算剩余库存的人民币成本
      const totalPurchaseCostCny = purchase.rmb_cost || 0
      
      // 按比例计算剩余库存的成本
      const remainingRatio = remainingQuantity / purchaseQuantity
      const remainingCostCny = totalPurchaseCostCny * remainingRatio
      
      inventoryCostCny += remainingCostCny
      inventoryItemCount += remainingQuantity
      
      console.log(`库存物品: ${purchase.item_name}, 购买数量: ${purchaseQuantity}, 卖出数量: ${soldQuantity}, 剩余: ${remainingQuantity}, 剩余成本CNY: ${remainingCostCny}`)
    }
  })
  
  return {
    inventoryCostCny: inventoryCostCny,
    inventoryItemCount: inventoryItemCount
  }
}
