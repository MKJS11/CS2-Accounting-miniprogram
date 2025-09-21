const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// 获取用户余额信息
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 获取用户余额
    const balanceQuery = await db.collection('user_balance')
      .where({ user_id: wxContext.OPENID })
      .get()
    
    let balanceInfo = {
      total_usd_balance: 0,
      total_rmb_cost: 0,
      avg_exchange_rate: 0
    }
    
    if (balanceQuery.data.length > 0) {
      balanceInfo = balanceQuery.data[0]
    }
    
    // 获取最近5条交易记录
    const recentRecharges = await db.collection('recharge_records')
      .where({ user_id: wxContext.OPENID })
      .orderBy('recharge_time', 'desc')
      .limit(3)
      .get()
    
    const recentPurchases = await db.collection('purchase_records')
      .where({ user_id: wxContext.OPENID })
      .orderBy('purchase_time', 'desc')
      .limit(3)
      .get()
    
    // 获取最近的卖出记录（从sell_records表查询）
    const recentSells = await db.collection('sell_records')
      .where({ 
        user_id: wxContext.OPENID
      })
      .orderBy('sell_time', 'desc')
      .limit(3)
      .get()
    
    // 合并并排序最近交易
    const allTransactions = []
    
    recentRecharges.data.forEach(item => {
      allTransactions.push({
        type: 'recharge',
        time: item.recharge_time,
        rmb_amount: item.rmb_amount,
        usd_amount: item.usd_amount,
        exchange_rate: item.exchange_rate
      })
    })
    
    recentPurchases.data.forEach(item => {
      allTransactions.push({
        type: 'purchase',
        time: item.purchase_time,
        item_name: item.item_name,
        item_type: item.item_type,
        quantity: item.quantity || 1,
        usd_unit_price: item.usd_unit_price || item.usd_price, // 兼容旧数据
        usd_total_price: item.usd_total_price || item.usd_price, // 兼容旧数据
        rmb_cost: item.rmb_cost,
        // 为了兼容主页显示，保留旧字段
        usd_price: item.usd_total_price || item.usd_price
      })
    })
    
    recentSells.data.forEach(item => {
      allTransactions.push({
        type: 'sell',
        time: item.sell_time,
        item_name: item.item_name,
        item_type: item.item_type,
        sell_quantity: item.sell_quantity,
        unit_purchase_price: item.unit_purchase_price,
        unit_sell_price: item.unit_sell_price,
        unit_sell_price_cny: item.unit_sell_price_cny,
        total_purchase_price: item.total_purchase_price,
        total_sell_price: item.total_sell_price,
        total_sell_price_cny: item.total_sell_price_cny,
        profit: item.profit,
        exchange_rate: item.exchange_rate,
        platform: item.platform,
        notes: item.notes,
        // 兼容前端显示字段
        sell_price: item.unit_sell_price,
        purchase_price: item.unit_purchase_price,
        remark: item.notes
      })
    })
    
    // 按时间倒序排序
    allTransactions.sort((a, b) => new Date(b.time) - new Date(a.time))
    
    return {
      success: true,
      balance: {
        total_usd_balance: balanceInfo.total_usd_balance || 0,
        total_rmb_cost: balanceInfo.total_rmb_cost || 0,
        avg_exchange_rate: balanceInfo.avg_exchange_rate || 0
      },
      recent_transactions: allTransactions.slice(0, 5)
    }
    
  } catch (err) {
    console.error('获取余额信息失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}