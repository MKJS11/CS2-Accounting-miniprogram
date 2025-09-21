const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

const db = cloud.database()

// 保存或更新用户信息
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { userInfo } = event
  
  try {
    const openid = wxContext.OPENID
    const currentTime = new Date()
    
    // 查询用户是否存在
    const userQuery = await db.collection('users')
      .where({ openid: openid })
      .get()
    
    if (userQuery.data.length === 0) {
      // 新用户，创建记录
      await db.collection('users').add({
        data: {
          openid: openid,
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl,
          gender: userInfo.gender,
          country: userInfo.country,
          province: userInfo.province,
          city: userInfo.city,
          language: userInfo.language,
          createTime: currentTime,
          lastLoginTime: currentTime
        }
      })
    } else {
      // 更新现有用户信息
      await db.collection('users').doc(userQuery.data[0]._id).update({
        data: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl,
          gender: userInfo.gender,
          country: userInfo.country,
          province: userInfo.province,
          city: userInfo.city,
          language: userInfo.language,
          lastLoginTime: currentTime
        }
      })
    }
    
    return {
      success: true,
      openid: openid
    }
    
  } catch (err) {
    console.error('保存用户信息失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}