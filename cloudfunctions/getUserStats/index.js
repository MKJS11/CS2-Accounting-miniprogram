const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// 获取用户统计数据
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  try {
    // 获取充值统计
    const rechargeCount = await db.collection('recharge_records')
      .where({ user_id: openid })
      .count()
    
    // 获取购买统计
    const purchaseCount = await db.collection('purchase_records')
      .where({ user_id: openid })
      .count()
    
    // 获取总支出
    const rechargeRecords = await db.collection('recharge_records')
      .where({ user_id: openid })
      .field({ rmb_amount: true })
      .get()
    
    let totalRmbSpent = 0
    rechargeRecords.data.forEach(record => {
      totalRmbSpent += record.rmb_amount
    })
    
    return {
      success: true,
      stats: {
        totalRecharges: rechargeCount.total,
        totalPurchases: purchaseCount.total,
        totalRmbSpent: totalRmbSpent.toFixed(2)
      }
    }
    
  } catch (err) {
    console.error('获取用户统计失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}