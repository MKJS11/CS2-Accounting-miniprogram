const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// 删除记录
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { recordId, recordType } = event
  
  console.log('deleteRecord 云函数开始执行', { recordId, recordType, userId: wxContext.OPENID })
  
  try {
    // 参数校验
    if (!recordId || !recordType) {
      return {
        success: false,
        error: '参数无效'
      }
    }
    
    // 根据类型选择集合
    let collection = ''
    if (recordType === 'recharge') {
      collection = 'recharge_records'
    } else if (recordType === 'purchase') {
      collection = 'purchase_records'
    } else if (recordType === 'sell') {
      collection = 'sell_records'
    } else {
      return {
        success: false,
        error: '记录类型无效'
      }
    }
    
    // 先查询记录是否属于当前用户
    const record = await db.collection(collection)
      .doc(recordId)
      .get()
    
    if (!record.data || record.data.user_id !== wxContext.OPENID) {
      return {
        success: false,
        error: '无权限删除此记录'
      }
    }
    
    // 如果是充值记录，需要处理余额恢复
    if (recordType === 'recharge' && record.data.remaining_usd > 0) {
      // 更新用户余额
      const balanceQuery = await db.collection('user_balance')
        .where({ user_id: wxContext.OPENID })
        .get()
      
      if (balanceQuery.data.length > 0) {
        const currentBalance = balanceQuery.data[0]
        const newTotalUsd = currentBalance.total_usd_balance - record.data.remaining_usd
        const newTotalRmb = currentBalance.total_rmb_cost - (record.data.rmb_amount * record.data.remaining_usd / record.data.usd_amount)
        
        await db.collection('user_balance').doc(currentBalance._id).update({
          data: {
            total_usd_balance: Math.max(0, newTotalUsd),
            total_rmb_cost: Math.max(0, newTotalRmb),
            update_time: new Date()
          }
        })
      }
    }
    
    // 如果是购买记录，需要恢复余额
    if (recordType === 'purchase') {
      const purchaseRecord = record.data
      
      // 更新用户余额（恢复购买时花费的金额）
      const balanceQuery = await db.collection('user_balance')
        .where({ user_id: wxContext.OPENID })
        .get()
      
      if (balanceQuery.data.length > 0) {
        const currentBalance = balanceQuery.data[0]
        
        // 恢复购买时花费的美元和人民币
        const purchaseUsdCost = purchaseRecord.usd_total_price || 0
        const purchaseRmbCost = purchaseRecord.rmb_cost || 0
        
        console.log(`删除购买记录 ${purchaseRecord.item_name}:`)
        console.log(`- 恢复美元: ${purchaseUsdCost}`)
        console.log(`- 恢复人民币成本: ${purchaseRmbCost}`)
        
        const newTotalUsd = currentBalance.total_usd_balance + purchaseUsdCost
        const newTotalRmb = currentBalance.total_rmb_cost + purchaseRmbCost
        
        await db.collection('user_balance').doc(currentBalance._id).update({
          data: {
            total_usd_balance: newTotalUsd,
            total_rmb_cost: newTotalRmb,
            update_time: new Date()
          }
        })
        
        console.log(`余额更新完成: USD ${newTotalUsd}, RMB ${newTotalRmb}`)
      }
    }
    
    // 如果是卖出记录，需要处理相关逻辑
    if (recordType === 'sell') {
      const sellRecord = record.data
      
      // 更新用户余额（减去卖出获得的收入）
      const balanceQuery = await db.collection('user_balance')
        .where({ user_id: wxContext.OPENID })
        .get()
      
      if (balanceQuery.data.length > 0) {
        const currentBalance = balanceQuery.data[0]
        
        // 计算需要减去的收入（卖出价格）
        const sellIncome = sellRecord.sell_price || 0
        const newTotalUsd = Math.max(0, currentBalance.total_usd_balance - sellIncome)
        
        await db.collection('user_balance').doc(currentBalance._id).update({
          data: {
            total_usd_balance: newTotalUsd,
            update_time: new Date()
          }
        })
      }
      
      // 注意：删除卖出记录后，对应的购买记录会自动恢复为可卖出状态
      // 因为卖出状态是通过查询sell_records表来判断的，删除记录后自然就变为未卖出
    }
    
    // 删除记录
    await db.collection(collection).doc(recordId).remove()
    
    return {
      success: true,
      message: '删除成功'
    }
    
  } catch (err) {
    console.error('删除记录失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}