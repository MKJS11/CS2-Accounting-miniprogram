// app.js
const { VersionManager } = require('./utils/version.js')

App({
  onLaunch() {
    // 初始化版本管理器
    this.versionManager = new VersionManager()
    this.globalData.versionManager = this.versionManager
    
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-0gwn1jxkbe170719',
        traceUser: true,
      });
    }

    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 检查登录状态
    this.checkLoginStatus()
    
    // 延迟检查版本更新（避免影响启动性能）
    setTimeout(() => {
      this.versionManager.checkPendingUpdate()
    }, 2000)
  },

  onShow() {
    // 小程序显示时检查待处理的更新
    if (this.versionManager) {
      this.versionManager.checkPendingUpdate()
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    // 从本地存储获取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    const openid = wx.getStorageSync('openid')
    
    if (userInfo && openid) {
      this.globalData.userInfo = userInfo
      this.globalData.openid = openid
      this.globalData.hasLogin = true
    } else {
      // 重置登录状态
      this.globalData.userInfo = null
      this.globalData.openid = null
      this.globalData.hasLogin = false
      // 尝试获取openid
      this.getOpenId()
    }
  },

  // 获取OpenID
  getOpenId() {
    wx.cloud.callFunction({
      name: 'getUserInfo',
      success: res => {
        if (res.result.openid) {
          this.globalData.openid = res.result.openid
          wx.setStorageSync('openid', res.result.openid)
        }
      },
      fail: err => {
        console.error('获取openid失败:', err)
      }
    })
  },

  // 检查是否需要登录
  checkAuth(callback, failCallback) {
    // 使用统一的登录状态检查
    const isLoggedIn = this.globalData.hasLogin && this.globalData.userInfo && this.globalData.openid
    
    if (isLoggedIn) {
      callback && callback()
    } else {
      wx.showModal({
        title: '提示',
        content: '请先登录后使用',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/user/user'
            })
          } else {
            failCallback && failCallback()
          }
        }
      })
    }
  },

  // 标记主页需要刷新
  markHomeNeedsRefresh() {
    this.globalData.homeNeedsRefresh = true
  },

  // 获取并重置主页刷新标记
  getAndResetHomeRefreshFlag() {
    const needsRefresh = this.globalData.homeNeedsRefresh
    this.globalData.homeNeedsRefresh = false
    return needsRefresh
  },

  // 标记库存页面需要刷新
  markInventoryNeedsRefresh() {
    this.globalData.inventoryNeedsRefresh = true
  },

  // 获取并重置库存页面刷新标记
  getAndResetInventoryRefreshFlag() {
    const needsRefresh = this.globalData.inventoryNeedsRefresh
    this.globalData.inventoryNeedsRefresh = false
    return needsRefresh
  },

  // 标记统计页面需要刷新
  markStatsNeedsRefresh() {
    this.globalData.statsNeedsRefresh = true
  },

  // 获取并重置统计页面刷新标记
  getAndResetStatsRefreshFlag() {
    const needsRefresh = this.globalData.statsNeedsRefresh
    this.globalData.statsNeedsRefresh = false
    return needsRefresh
  },

  // 标记所有页面需要刷新（用于删除记录等重大操作）
  markAllPagesNeedsRefresh() {
    this.globalData.homeNeedsRefresh = true
    this.globalData.inventoryNeedsRefresh = true
    this.globalData.statsNeedsRefresh = true
  },

  // 获取版本管理器
  getVersionManager() {
    return this.versionManager
  },

  globalData: {
    userInfo: null,
    openid: null,
    hasLogin: false,
    homeNeedsRefresh: false,
    inventoryNeedsRefresh: false,
    statsNeedsRefresh: false,
    versionManager: null
  }
})
