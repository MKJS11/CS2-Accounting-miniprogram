const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// 格式化时间
function formatTime(date) {
  if (!date) return ''
  
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    return '今天'
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return `${d.getMonth() + 1}-${d.getDate()}`
  }
}

// 获取交易记录
exports.main = async (event, context) => {
  console.log('Cloud function called with event:', JSON.stringify(event))
  
  const wxContext = cloud.getWXContext()
  const { type = 'all', page = 1, limit = 20, openid } = event
  const userId = openid || wxContext.OPENID
  
  console.log('Extracted params:', { type, page, limit, openid, userId })
  
  try {
    const skip = (page - 1) * limit
    const results = {}
    
    // 如果请求可卖出的物品
    if (type === 'available_items') {
      console.log('Querying available items for user:', userId)
      
      try {
        // 先查询所有购买记录
        console.log('Querying with user_id:', userId)
        const allPurchaseQuery = await db.collection('purchase_records')
          .where({ user_id: userId })
          .get()
        
        console.log('Total purchase records:', allPurchaseQuery.data.length)
        console.log('Sample record:', JSON.stringify(allPurchaseQuery.data[0] || 'No records'))
        
        if (allPurchaseQuery.data.length === 0) {
          console.log('No purchase records found for user')
          return {
            success: true,
            data: []
          }
        }
        
        // 先检查数据库中所有的购买记录
        const allRecordsQuery = await db.collection('purchase_records').get()
        console.log('Total records in database:', allRecordsQuery.data.length)
        console.log('All records:', JSON.stringify(allRecordsQuery.data, null, 2))
        
        // 检查用户ID匹配
        console.log('Looking for user_id:', userId)
        const matchingRecords = allRecordsQuery.data.filter(record => record.user_id === userId)
        console.log('Records matching user_id:', matchingRecords.length)
        console.log('Matching records:', JSON.stringify(matchingRecords, null, 2))
        
        // 查询用户的所有购买记录
        const allPurchaseRecords = await db.collection('purchase_records')
          .where({ user_id: userId })
          .orderBy('purchase_time', 'desc')
          .get()
        
        console.log('All purchase records for user:', allPurchaseRecords.data.length)
        
        // 查询所有已卖出的记录
        const soldItemsRes = await db.collection('sell_records')
          .where({ user_id: userId })
          .get()
        
        // 计算每个物品已卖出的数量
        const soldQuantityMap = new Map()
        soldItemsRes.data.forEach(sell => {
          const purchaseId = sell.purchase_id
          const sellQuantity = sell.sell_quantity || 1
          soldQuantityMap.set(purchaseId, (soldQuantityMap.get(purchaseId) || 0) + sellQuantity)
        })
        
        console.log('Sold quantity map:', Array.from(soldQuantityMap.entries()))
        
        // 过滤出还有剩余数量可卖的物品
        const availableRecords = allPurchaseRecords.data.filter(item => {
          const totalQuantity = item.quantity || 1
          const soldQuantity = soldQuantityMap.get(item._id) || 0
          const remainingQuantity = totalQuantity - soldQuantity
          console.log(`Item ${item.item_name}: total=${totalQuantity}, sold=${soldQuantity}, remaining=${remainingQuantity}`)
          return remainingQuantity > 0
        }).map(item => {
          const totalQuantity = item.quantity || 1
          const soldQuantity = soldQuantityMap.get(item._id) || 0
          const remainingQuantity = totalQuantity - soldQuantity
          
          // 计算剩余部分对应的人民币成本
          const originalRmbCost = item.rmb_cost || 0
          const unitRmbCost = totalQuantity > 0 ? originalRmbCost / totalQuantity : 0
          const remainingRmbCost = unitRmbCost * remainingQuantity
          
          console.log(`Item ${item.item_name} cost calculation:`)
          console.log(`- original rmb_cost: ${originalRmbCost}`)
          console.log(`- total quantity: ${totalQuantity}`)
          console.log(`- remaining quantity: ${remainingQuantity}`)
          console.log(`- unit rmb cost: ${unitRmbCost}`)
          console.log(`- remaining rmb cost: ${remainingRmbCost}`)
          
          return {
            ...item,
            quantity: remainingQuantity, // 更新为剩余可卖数量
            rmb_cost: parseFloat(remainingRmbCost.toFixed(2)) // 更新为剩余部分的人民币成本
          }
        })
        
        console.log('Available records after filtering:', availableRecords.length)
        
        // 应用分页
        const paginatedRecords = availableRecords.slice(skip, skip + limit)
        
        // 模拟查询结果格式
        const purchaseQuery = {
          data: paginatedRecords
        }
        
        console.log('Available items query result count:', purchaseQuery.data.length)
        console.log('Available items query result data:', JSON.stringify(purchaseQuery.data, null, 2))
        
        // 详细检查每个记录的rmb_cost字段
        purchaseQuery.data.forEach((item, index) => {
          console.log(`Item ${index}: ${item.item_name}`)
          console.log(`- rmb_cost:`, item.rmb_cost, typeof item.rmb_cost)
          console.log(`- usd_price:`, item.usd_price, typeof item.usd_price)
          console.log(`- Full item:`, JSON.stringify(item))
        })
        
        const availableItems = purchaseQuery.data.map(item => {
          console.log(`Processing available item ${item.item_name}:`)
          console.log(`- rmb_cost: ${item.rmb_cost} (type: ${typeof item.rmb_cost})`)
          console.log(`- original quantity: ${item.quantity}`)
          
          // 计算单位人民币成本
          let unitRmbCost = '0.00'
          if (item.rmb_cost && item.quantity && item.quantity > 0) {
            unitRmbCost = (parseFloat(item.rmb_cost) / parseInt(item.quantity)).toFixed(2)
          }
          
          console.log(`- calculated unitRmbCost: ${unitRmbCost}`)
          
          return {
            _id: item._id,
            item_name: item.item_name,
            item_type: item.item_type,
            quantity: item.quantity, // 剩余可卖数量
            usd_price: item.usd_price, // 兼容旧数据
            usd_unit_price: item.usd_unit_price || item.usd_price, // 单价
            usd_total_price: item.usd_total_price || item.usd_price, // 总价
            rmb_cost: item.rmb_cost, // FIFO计算的人民币成本
            unitRmbCost: unitRmbCost, // 单位人民币成本
            purchase_time: item.purchase_time,
            timeStr: formatTime(item.purchase_time)
          }
        })
        
        console.log('Available items count:', availableItems.length)
        console.log('Available items type:', Array.isArray(availableItems))
        
        const returnData = {
          success: true,
          data: availableItems
        }
        console.log('About to return:', JSON.stringify(returnData))
        
        return returnData
      } catch (availableItemsError) {
        console.error('Error in available_items query:', availableItemsError)
        return {
          success: false,
          error: availableItemsError.message,
          data: []
        }
      }
    }
    
    if (type === 'recharge' || type === 'all') {
      // 获取充值记录
      const rechargeQuery = await db.collection('recharge_records')
        .where({ user_id: userId })
        .orderBy('recharge_time', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
      
      results.recharges = rechargeQuery.data.map(item => ({
        _id: item._id,
        recharge_time: item.recharge_time,
        rmb_amount: item.rmb_amount,
        usd_amount: item.usd_amount,
        exchange_rate: item.exchange_rate,
        remaining_usd: item.remaining_usd
      }))
    }
    
    if (type === 'purchase' || type === 'all') {
      // 获取购买记录
      const purchaseQuery = await db.collection('purchase_records')
        .where({ user_id: userId })
        .orderBy('purchase_time', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
      
      results.purchases = purchaseQuery.data.map(item => ({
        _id: item._id,
        purchase_time: item.purchase_time,
        item_name: item.item_name,
        item_type: item.item_type,
        quantity: item.quantity,
        usd_unit_price: item.usd_unit_price,
        usd_total_price: item.usd_total_price,
        usd_price: item.usd_price || item.usd_total_price, // 兼容旧字段
        rmb_cost: item.rmb_cost,
        recharge_details: item.recharge_details,
        remark: item.remark
      }))
    }
    
    if (type === 'sell' || type === 'all') {
      // 获取卖出记录（从sell_records表查询）
      const sellQuery = await db.collection('sell_records')
        .where({ user_id: userId })
        .orderBy('sell_time', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
      
              results.sells = sellQuery.data.map(item => {
          return {
            _id: item._id,
            sell_time: item.sell_time,
            item_name: item.item_name,
            item_type: item.item_type,
            sell_quantity: item.sell_quantity,
            unit_purchase_price: item.unit_purchase_price,
            unit_sell_price: item.unit_sell_price,
            unit_sell_price_cny: item.unit_sell_price_cny,
            total_purchase_price: item.total_purchase_price,
            total_purchase_price_cny: item.total_purchase_price_cny,
            total_sell_price: item.total_sell_price,
            total_sell_price_cny: item.total_sell_price_cny,
            profit: item.profit_cny || item.profit, // 优先使用人民币利润，兼容旧数据
            profit_usd: item.profit, // 美元利润
            profit_cny: item.profit_cny, // 人民币利润
            exchange_rate: item.exchange_rate,
            purchase_exchange_rate: item.purchase_exchange_rate,
            platform: item.platform || '市场交易',
            notes: item.notes || '',
            // 兼容前端显示字段
            purchase_price: item.unit_purchase_price,
            sell_price: item.unit_sell_price,
            sell_price_cny: item.unit_sell_price_cny || item.total_sell_price_cny
          }
        })
    }
    
    // 如果请求所有记录，合并并排序
    if (type === 'all') {
      const allRecords = []
      
      if (results.recharges) {
        results.recharges.forEach(item => {
          allRecords.push({
            ...item,
            type: 'recharge',
            time: item.recharge_time
          })
        })
      }
      
      if (results.purchases) {
        results.purchases.forEach(item => {
          allRecords.push({
            ...item,
            type: 'purchase', 
            time: item.purchase_time
          })
        })
      }
      
      if (results.sells) {
        results.sells.forEach(item => {
          allRecords.push({
            ...item,
            type: 'sell',
            time: item.sell_time
          })
        })
      }
      
      // 按时间倒序排序
      allRecords.sort((a, b) => new Date(b.time) - new Date(a.time))
      results.all_records = allRecords.slice(0, limit)
    }
    
    return {
      success: true,
      data: results,
      page: page,
      limit: limit
    }
    
  } catch (err) {
    console.error('获取交易记录失败:', err)
    return {
      success: false,
      error: err.message,
      data: []
    }
  }
}