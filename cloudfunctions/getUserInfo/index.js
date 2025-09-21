const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-0gwn1jxkbe170719'
})

// 获取用户OpenID和基本信息
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  return {
    success: true,
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID || '',
    env: wxContext.ENV
  }
}