const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// 清空用户数据
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  try {
    // 开始事务
    const transaction = await db.startTransaction()
    
    try {
      // 删除充值记录
      await transaction.collection('recharge_records')
        .where({ user_id: openid })
        .remove()
      
      // 删除购买记录
      await transaction.collection('purchase_records')
        .where({ user_id: openid })
        .remove()
      
      // 删除余额记录
      await transaction.collection('user_balance')
        .where({ user_id: openid })
        .remove()
      
      // 删除卖出记录
      await transaction.collection('sell_records')
        .where({ user_id: openid })
        .remove()
      
      // 提交事务
      await transaction.commit()
      
      return {
        success: true,
        message: '数据清空成功'
      }
      
    } catch (err) {
      // 回滚事务
      await transaction.rollback()
      throw err
    }
    
  } catch (err) {
    console.error('清空用户数据失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}