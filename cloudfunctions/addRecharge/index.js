const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// 添加充值记录
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { rmbAmount, usdAmount } = event
  
  try {
    // 参数校验
    if (!rmbAmount || !usdAmount || rmbAmount <= 0 || usdAmount <= 0) {
      return {
        success: false,
        error: '参数无效'
      }
    }
    
    const exchangeRate = parseFloat((rmbAmount / usdAmount).toFixed(4))
    const currentTime = new Date()
    
    // 添加充值记录
    const rechargeResult = await db.collection('recharge_records').add({
      data: {
        user_id: wxContext.OPENID,
        recharge_time: currentTime,
        rmb_amount: rmbAmount,
        usd_amount: usdAmount,
        exchange_rate: exchangeRate,
        remaining_usd: usdAmount,
        create_time: currentTime
      }
    })
    
    // 更新用户余额
    const balanceQuery = await db.collection('user_balance')
      .where({ user_id: wxContext.OPENID })
      .get()
    
    if (balanceQuery.data.length === 0) {
      // 创建新的余额记录
      await db.collection('user_balance').add({
        data: {
          user_id: wxContext.OPENID,
          total_usd_balance: usdAmount,
          total_rmb_cost: rmbAmount,
          avg_exchange_rate: exchangeRate,
          update_time: currentTime
        }
      })
    } else {
      // 更新现有余额记录
      const currentBalance = balanceQuery.data[0]
      const newTotalUsd = currentBalance.total_usd_balance + usdAmount
      const newTotalRmb = currentBalance.total_rmb_cost + rmbAmount
      const newAvgRate = parseFloat((newTotalRmb / newTotalUsd).toFixed(4))
      
      await db.collection('user_balance').doc(currentBalance._id).update({
        data: {
          total_usd_balance: newTotalUsd,
          total_rmb_cost: newTotalRmb,
          avg_exchange_rate: newAvgRate,
          update_time: currentTime
        }
      })
    }
    
    return {
      success: true,
      rechargeId: rechargeResult._id,
      exchangeRate: exchangeRate
    }
    
  } catch (err) {
    console.error('添加充值记录失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}