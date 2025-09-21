const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// FIFO算法计算购买成本
async function calculatePurchaseCost(userId, usdPrice) {
  // 获取用户所有有余额的充值记录（按时间排序）
  const recharges = await db.collection('recharge_records')
    .where({
      user_id: userId,
      remaining_usd: db.command.gt(0)
    })
    .orderBy('recharge_time', 'asc')
    .get()

  let remainingToPay = usdPrice
  let totalRmbCost = 0
  const usedRecharges = []

  // FIFO消耗充值记录
  for (let recharge of recharges.data) {
    if (remainingToPay <= 0) break
    
    const useAmount = Math.min(remainingToPay, recharge.remaining_usd)
    const rmbCost = parseFloat((useAmount * recharge.exchange_rate).toFixed(2))
    
    totalRmbCost = parseFloat((totalRmbCost + rmbCost).toFixed(2))
    remainingToPay = parseFloat((remainingToPay - useAmount).toFixed(2))
    
    usedRecharges.push({
      recharge_id: recharge._id,
      used_usd: useAmount,
      exchange_rate: recharge.exchange_rate,
      rmb_cost: rmbCost
    })
  }

  return {
    total_rmb_cost: totalRmbCost,
    used_recharges: usedRecharges,
    success: remainingToPay <= 0.01 // 允许0.01的误差
  }
}

// 添加购买记录
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { itemName, usdPrice, quantity, totalPrice, itemType, remark } = event
  
  console.log('购买记录参数:', {
    itemName,
    usdPrice,
    quantity,
    totalPrice,
    itemType,
    remark
  })
  
  try {
    // 参数校验
    if (!itemName || !usdPrice || usdPrice <= 0 || !itemType || !quantity || quantity <= 0 || !totalPrice || totalPrice <= 0) {
      return {
        success: false,
        error: '参数无效'
      }
    }
    
    // 计算购买成本（使用总价）
    const costResult = await calculatePurchaseCost(wxContext.OPENID, totalPrice)
    
    if (!costResult.success) {
      return {
        success: false,
        error: '余额不足'
      }
    }
    
    const currentTime = new Date()
    
    // 开始事务
    const transaction = await db.startTransaction()
    
    try {
      // 添加购买记录
      console.log('准备写入数据库的购买记录:', {
        user_id: wxContext.OPENID,
        item_name: itemName,
        item_type: itemType,
        quantity: quantity,
        usd_unit_price: usdPrice,
        usd_total_price: totalPrice,
        rmb_cost: costResult.total_rmb_cost
      })
      
      const purchaseResult = await transaction.collection('purchase_records').add({
        data: {
          user_id: wxContext.OPENID,
          item_name: itemName,
          item_type: itemType,
          quantity: quantity,
          usd_unit_price: usdPrice,
          usd_total_price: totalPrice,
          rmb_cost: costResult.total_rmb_cost,
          purchase_time: currentTime,
          recharge_details: costResult.used_recharges,
          remark: remark || '',
          create_time: currentTime
        }
      })
      
      console.log('购买记录已写入数据库，ID:', purchaseResult._id)
      
      // 更新充值记录的剩余余额
      for (let usedRecharge of costResult.used_recharges) {
        const recharge = await db.collection('recharge_records')
          .doc(usedRecharge.recharge_id)
          .get()
        
        const newRemaining = parseFloat((recharge.data.remaining_usd - usedRecharge.used_usd).toFixed(2))
        
        await transaction.collection('recharge_records')
          .doc(usedRecharge.recharge_id)
          .update({
            data: {
              remaining_usd: newRemaining
            }
          })
      }
      
      // 更新用户余额
      const balanceQuery = await db.collection('user_balance')
        .where({ user_id: wxContext.OPENID })
        .get()
      
      if (balanceQuery.data.length > 0) {
        const currentBalance = balanceQuery.data[0]
        const newTotalUsd = parseFloat((currentBalance.total_usd_balance - totalPrice).toFixed(2))
        const newTotalRmb = parseFloat((currentBalance.total_rmb_cost - costResult.total_rmb_cost).toFixed(2))
        const newAvgRate = newTotalUsd > 0 ? parseFloat((newTotalRmb / newTotalUsd).toFixed(4)) : 0
        
        await transaction.collection('user_balance').doc(currentBalance._id).update({
          data: {
            total_usd_balance: newTotalUsd,
            total_rmb_cost: newTotalRmb,
            avg_exchange_rate: newAvgRate,
            update_time: currentTime
          }
        })
      }
      
      // 提交事务
      await transaction.commit()
      
      return {
        success: true,
        purchaseId: purchaseResult._id,
        rmbCost: costResult.total_rmb_cost,
        usedRecharges: costResult.used_recharges
      }
      
    } catch (err) {
      // 回滚事务
      await transaction.rollback()
      throw err
    }
    
  } catch (err) {
    console.error('添加购买记录失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}