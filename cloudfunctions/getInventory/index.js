// 获取库存信息云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  try {
    // 获取所有购买记录
    const purchaseResult = await db.collection('purchase_records')
      .where({
        user_id: openid
      })
      .orderBy('purchase_time', 'asc')
      .get()
    
    // 获取所有卖出记录
    const sellResult = await db.collection('sell_records')
      .where({
        user_id: openid
      })
      .get()
    
    const purchases = purchaseResult.data
    const sales = sellResult.data
    
    // 构建库存映射 - 按物品名称和类型分组
    const inventoryMap = new Map()
    
    // 处理购买记录 - 添加到库存
    purchases.forEach(purchase => {
      const key = `${purchase.item_name}_${purchase.item_type || '普通'}`
      
      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, {
          _id: purchase._id,
          item_name: purchase.item_name,
          item_type: purchase.item_type || '普通',
          total_quantity: 0,
          remaining_quantity: 0,
          total_usd_cost: 0,
          total_rmb_cost: 0,
          avg_unit_price: 0,
          first_purchase_time: purchase.purchase_time,
          last_purchase_time: purchase.purchase_time,
          purchase_records: [],
          purchase_ids: [] // 用于卖出时找到对应的购买记录
        })
      }
      
      const item = inventoryMap.get(key)
      item.total_quantity += purchase.quantity
      item.remaining_quantity += purchase.quantity
      item.total_usd_cost += purchase.usd_total_price
      item.total_rmb_cost += purchase.rmb_cost
      
      // 更新购买时间
      if (purchase.purchase_time < item.first_purchase_time) {
        item.first_purchase_time = purchase.purchase_time
      }
      if (purchase.purchase_time > item.last_purchase_time) {
        item.last_purchase_time = purchase.purchase_time
      }
      
      item.purchase_records.push({
        id: purchase._id,
        quantity: purchase.quantity,
        unit_price: purchase.usd_unit_price,
        total_price: purchase.usd_total_price,
        rmb_cost: purchase.rmb_cost,
        purchase_time: purchase.purchase_time
      })
      
      // 添加购买记录ID到purchase_ids数组
      item.purchase_ids.push(purchase._id)
    })
    
    // 处理卖出记录 - 从库存中扣除，并更新purchase_ids
    // 首先为每个库存项目创建详细的购买记录跟踪
    inventoryMap.forEach(item => {
      // 重新构建purchase_records，包含剩余数量信息
      item.purchase_records = item.purchase_records.map(record => ({
        ...record,
        remaining_quantity: record.quantity // 初始剩余数量等于购买数量
      }))
    })
    
    // 按时间顺序处理所有销售记录（FIFO原则）
    sales.sort((a, b) => new Date(a.sell_time) - new Date(b.sell_time))
    
    sales.forEach(sale => {
      // 根据purchase_id找到对应的购买记录
      const purchase = purchases.find(p => p._id === sale.purchase_id)
      if (purchase) {
        const key = `${purchase.item_name}_${purchase.item_type || '普通'}`
        const item = inventoryMap.get(key)
        
        if (item) {
          // 从对应的购买记录中扣除数量
          const purchaseRecord = item.purchase_records.find(r => r.id === sale.purchase_id)
          if (purchaseRecord) {
            const sellQty = Math.min(sale.sell_quantity, purchaseRecord.remaining_quantity)
            purchaseRecord.remaining_quantity -= sellQty
            
            // 更新总的剩余数量
            item.remaining_quantity -= sellQty
            
            // 按比例调整成本
            const soldRatio = sellQty / purchaseRecord.quantity
            const soldUsdCost = purchaseRecord.total_price * soldRatio
            const soldRmbCost = purchaseRecord.rmb_cost * soldRatio
            
            item.total_usd_cost -= soldUsdCost
            item.total_rmb_cost -= soldRmbCost
          }
        }
      }
    })
    
    // 更新purchase_ids，只保留还有剩余库存的购买记录
    inventoryMap.forEach(item => {
      item.purchase_ids = item.purchase_records
        .filter(record => record.remaining_quantity > 0)
        .map(record => record.id)
    })
    
    // 过滤出还有库存的物品并计算平均单价
    const inventoryItems = []
    let totalItems = 0
    let totalUsdCost = 0
    let totalRmbCost = 0
    
    inventoryMap.forEach(item => {
      if (item.remaining_quantity > 0) {
        // 计算平均单价（美元和人民币）
        item.avg_unit_price = item.remaining_quantity > 0 
          ? parseFloat((item.total_usd_cost / item.remaining_quantity).toFixed(4))
          : 0
        item.avg_rmb_unit_price = item.remaining_quantity > 0 
          ? parseFloat((item.total_rmb_cost / item.remaining_quantity).toFixed(2))
          : 0
        
        // 格式化数值
        item.total_usd_cost = parseFloat(item.total_usd_cost.toFixed(4))
        item.total_rmb_cost = parseFloat(item.total_rmb_cost.toFixed(2))
        
        // 格式化时间显示
        item.first_purchase_time = formatDate(item.first_purchase_time)
        item.last_purchase_time = formatDate(item.last_purchase_time)
        
        inventoryItems.push(item)
        
        // 累计统计
        totalItems += item.remaining_quantity
        totalUsdCost += item.total_usd_cost
        totalRmbCost += item.total_rmb_cost
      }
    })
    
    // 不在云函数中排序，让前端根据用户选择进行排序
    
    const summary = {
      totalItems: totalItems,
      totalUsdCost: parseFloat(totalUsdCost.toFixed(4)),
      totalRmbCost: parseFloat(totalRmbCost.toFixed(2))
    }
    
    return {
      success: true,
      data: {
        items: inventoryItems,
        summary: summary
      }
    }
    
  } catch (error) {
    console.error('获取库存数据错误:', error)
    return {
      success: false,
      error: '获取库存数据失败'
    }
  }
}

// 格式化日期
function formatDate(date) {
  if (!date) return ''
  
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}
