const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// 初始化数据库集合和索引
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 创建集合并设置权限
    const collections = [
      'recharge_records',
      'purchase_records', 
      'user_balance',
      'users'  // 添加用户集合
    ]
    
    const results = []
    
    for (let collectionName of collections) {
      try {
        await db.createCollection(collectionName)
        console.log(`集合 ${collectionName} 创建成功`)
        results.push(`集合 ${collectionName} 创建成功`)
      } catch (e) {
        if (e.errCode === -502002) {
          console.log(`集合 ${collectionName} 已存在`)
          results.push(`集合 ${collectionName} 已存在`)
        } else {
          throw e
        }
      }
    }
    
    // 为充值记录创建索引
    try {
      await db.collection('recharge_records').createIndex({
        keys: { user_id: 1, recharge_time: -1 }
      })
      results.push('充值记录索引创建成功')
    } catch (e) {
      results.push('充值记录索引已存在或创建失败')
    }
    
    // 为购买记录创建索引  
    try {
      await db.collection('purchase_records').createIndex({
        keys: { user_id: 1, purchase_time: -1 }
      })
      results.push('购买记录索引创建成功')
    } catch (e) {
      results.push('购买记录索引已存在或创建失败')
    }
    
    // 为用户集合创建索引
    try {
      await db.collection('users').createIndex({
        keys: { openid: 1 }
      })
      results.push('用户索引创建成功')
    } catch (e) {
      results.push('用户索引已存在或创建失败')
    }
    
    return {
      success: true,
      results: results,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
    }
  } catch (err) {
    console.error('初始化数据库失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}