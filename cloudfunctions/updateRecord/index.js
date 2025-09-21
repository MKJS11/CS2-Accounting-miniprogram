const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// 更新记录
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { recordId, recordType, updateData } = event
  
  try {
    // 参数校验
    if (!recordId || !recordType || !updateData) {
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
        error: '无权限修改此记录'
      }
    }
    
    // 准备更新数据
    const updateFields = {}
    
    if (recordType === 'recharge') {
      // 充值记录只能修改备注和金额
      if (updateData.rmb_amount !== undefined && updateData.rmb_amount !== record.data.rmb_amount) {
        updateFields.rmb_amount = parseFloat(updateData.rmb_amount)
        // 重新计算汇率
        if (record.data.usd_amount > 0) {
          updateFields.exchange_rate = parseFloat((updateFields.rmb_amount / record.data.usd_amount).toFixed(4))
        }
      }
      if (updateData.remark !== undefined) {
        updateFields.remark = updateData.remark
      }
    } else if (recordType === 'purchase') {
      // 购买记录可以修改物品名称和备注
      if (updateData.item_name !== undefined) {
        updateFields.item_name = updateData.item_name
      }
      if (updateData.remark !== undefined) {
        updateFields.remark = updateData.remark
      }
    }
    
    // 添加更新时间
    updateFields.update_time = new Date()
    
    // 更新记录
    await db.collection(collection).doc(recordId).update({
      data: updateFields
    })
    
    return {
      success: true,
      message: '更新成功',
      updatedFields: updateFields
    }
    
  } catch (err) {
    console.error('更新记录失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}