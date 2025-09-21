// index.js
const app = getApp()

// 物品种类映射（与records页面保持一致）
const ITEM_TYPE_MAP = {
  'gun': { icon: '🔫', label: '枪械' },
  'sticker': { icon: '🏷️', label: '贴纸' },
  'case': { icon: '📦', label: '箱子' },
  'knife': { icon: '🔪', label: '匕首' },
  'agent': { icon: '👤', label: '探员' },
  'custom': { icon: '⚙️', label: '自定义' }
}

// 获取物品种类显示信息
function getItemTypeDisplay(itemType) {
  if (!itemType) return null
  
  // 如果是预定义类型
  if (ITEM_TYPE_MAP[itemType]) {
    return ITEM_TYPE_MAP[itemType]
  }
  
  // 自定义类型
  return {
    icon: '⚙️',
    label: itemType
  }
}

Page({
  data: {
    balance: {
      total_usd_balance: 0,
      total_rmb_cost: 0,
      avg_exchange_rate: 0
    },
    recentTransactions: [],
    hasInit: false,
    needLogin: false,
    isLoading: false,
    dataLoaded: false,
    lastRefreshTime: 0,
    needsRefresh: false,
    cacheKey: 'homepage_data_cache',
    cacheExpiry: 5 * 60 * 1000 // 5分钟缓存过期时间
  },

  onLoad() {
    // 尝试从缓存加载数据
    this.loadFromCache()
    // 检查登录状态
    this.checkLogin()
  },

  onShow() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
    
    // 检查登录状态
    const isLoggedIn = app.globalData.hasLogin && app.globalData.userInfo && app.globalData.openid
    
    if (isLoggedIn) {
      this.setData({ needLogin: false })
      
      // 只在以下情况才刷新数据：
      // 1. 首次加载
      // 2. 全局标记需要刷新
      // 3. 超过5分钟未刷新
      const now = Date.now()
      const hasGlobalRefreshFlag = app.getAndResetHomeRefreshFlag()
      const shouldRefresh = !this.data.hasInit || 
                           hasGlobalRefreshFlag || 
                           (now - this.data.lastRefreshTime > 5 * 60 * 1000)
      
      if (shouldRefresh) {
        if (!this.data.hasInit) {
          this.checkCloudFunctions()
        } else {
          this.getBalance()
        }
      }
    } else {
      // 未登录，显示登录提示
      this.setData({ 
        needLogin: true,
        hasInit: false
      })
    }
  },

  // 检查登录状态
  checkLogin() {
    // 使用统一的登录状态检查
    const isLoggedIn = app.globalData.hasLogin && app.globalData.userInfo && app.globalData.openid
    
    if (isLoggedIn) {
      // 已登录，检查云函数
      this.setData({ needLogin: false })
      if (!this.data.hasInit) {
        this.checkCloudFunctions()
      } else {
        this.getBalance()
      }
    } else {
      // 未登录，显示登录提示
      this.setData({ 
        needLogin: true,
        hasInit: false
      })
    }
  },

  // 检查云函数部署状态
  checkCloudFunctions() {
    wx.cloud.callFunction({
      name: 'getBalance',
      success: res => {
        // 云函数正常，获取数据
        this.setData({ hasInit: true })
        this.getBalance()
      },
      fail: err => {
        console.error('云函数未部署:', err)
        // 显示部署提示
        wx.showModal({
          title: '初始化提示',
          content: '检测到云函数未部署，请按以下步骤操作：\n1. 重新编译项目\n2. 右键点击cloudfunctions文件夹\n3. 选择"上传并部署：云端安装依赖"\n4. 等待所有云函数部署完成后刷新页面',
          showCancel: false,
          confirmText: '我知道了',
          success: (res) => {
            if (res.confirm) {
              // 提供初始化数据库的选项
              wx.showModal({
                title: '初始化数据库',
                content: '是否立即初始化数据库？',
                success: (res2) => {
                  if (res2.confirm) {
                    this.initDatabase()
                  }
                }
              })
            }
          }
        })
      }
    })
  },

  // 初始化数据库
  initDatabase() {
    wx.showLoading({
      title: '初始化中...',
    })
    
    wx.cloud.callFunction({
      name: 'initDatabase',
      success: res => {
        wx.hideLoading()
        if (res.result.success) {
          wx.showToast({
            title: '初始化成功',
            icon: 'success'
          })
          this.setData({ hasInit: true })
          setTimeout(() => {
            this.getBalance()
          }, 1500)
        }
      },
      fail: err => {
        wx.hideLoading()
        wx.showToast({
          title: '请先部署云函数',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  // 从缓存加载数据
  loadFromCache() {
    try {
      const cached = wx.getStorageSync(this.data.cacheKey)
      if (cached && cached.timestamp) {
        const now = Date.now()
        const isValid = (now - cached.timestamp) < this.data.cacheExpiry
        
        if (isValid && cached.data) {
          // 使用缓存数据
          this.setData({
            balance: cached.data.balance,
            recentTransactions: cached.data.recentTransactions,
            dataLoaded: true,
            lastRefreshTime: cached.timestamp
          })
          console.log('已从缓存加载数据')
        }
      }
    } catch (error) {
      console.log('缓存加载失败:', error)
    }
  },

  // 保存数据到缓存
  saveToCache(data) {
    try {
      const cacheData = {
        timestamp: Date.now(),
        data: data
      }
      wx.setStorageSync(this.data.cacheKey, cacheData)
    } catch (error) {
      console.log('缓存保存失败:', error)
    }
  },

  // 清除缓存
  clearCache() {
    try {
      wx.removeStorageSync(this.data.cacheKey)
    } catch (error) {
      console.log('缓存清除失败:', error)
    }
  },

  // 下拉刷新事件
  onPullDownRefresh() {
    this.refreshData()
  },

  // 刷新数据
  refreshData(showLoading = false) {
    if (showLoading) {
      wx.showLoading({
        title: '刷新中...',
      })
    }
    
    this.getBalance(true)
  },

  // 获取余额信息
  getBalance(isRefresh = false) {
    this.setData({ isLoading: !isRefresh })
    
    if (!isRefresh) {
      wx.showLoading({
        title: '加载中...',
      })
    }

    wx.cloud.callFunction({
      name: 'getBalance',
      success: res => {
        wx.hideLoading()
        if (res.result.success) {
          const balance = res.result.balance
          const transactions = res.result.recent_transactions || []
          
          // 格式化交易时间和处理显示数据
          transactions.forEach(item => {
            const date = new Date(item.time)
            item.timeStr = this.formatTime(date)
            
            // 为购买记录和卖出记录添加物品种类显示信息
            if ((item.type === 'purchase' || item.type === 'sell') && item.item_type) {
              const typeDisplay = getItemTypeDisplay(item.item_type)
              if (typeDisplay) {
                item.item_type_icon = typeDisplay.icon
                item.item_type_label = typeDisplay.label
              }
            }
            
            // 为购买记录使用历史人民币成本（不重新计算）
            if (item.type === 'purchase') {
              const totalUsdPrice = item.usd_total_price || item.usd_price
              const unitUsdPrice = item.usd_unit_price || item.usd_price
              const quantity = item.quantity || 1
              const totalRmbCost = item.rmb_cost || 0
              
              // 使用存储在数据库中的历史人民币成本，不重新计算
              item.unit_rmb_cost = (totalRmbCost / quantity).toFixed(2)
              
              // 确保显示字段正确
              item.display_unit_price = unitUsdPrice
              item.display_total_price = totalUsdPrice
            }
            
            // 为卖出记录格式化价格显示
            if (item.type === 'sell') {
              // 确保所有价格都显示为2位小数
              if (item.sell_price) {
                item.sell_price = parseFloat(item.sell_price).toFixed(2)
              }
              if (item.total_sell_price_cny) {
                item.total_sell_price_cny = parseFloat(item.total_sell_price_cny).toFixed(2)
              }
              if (item.total_purchase_price_cny) {
                item.total_purchase_price_cny = parseFloat(item.total_purchase_price_cny).toFixed(2)
              }
              if (item.unit_sell_price_cny) {
                item.unit_sell_price_cny = parseFloat(item.unit_sell_price_cny).toFixed(2)
              }
            }
          })

          const formattedBalance = {
            total_usd_balance: balance.total_usd_balance.toFixed(2),
            total_rmb_cost: balance.total_rmb_cost.toFixed(2),
            avg_exchange_rate: balance.avg_exchange_rate.toFixed(4)
          }
          
          this.setData({
            balance: formattedBalance,
            recentTransactions: transactions,
            hasInit: true,
            isLoading: false,
            dataLoaded: true,
            lastRefreshTime: Date.now()
          })
          
          // 保存到缓存
          this.saveToCache({
            balance: formattedBalance,
            recentTransactions: transactions
          })
          
          // 如果是下拉刷新，停止下拉刷新动画
          if (isRefresh) {
            wx.stopPullDownRefresh()
          }
        } else {
          wx.showToast({
            title: '获取余额失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        wx.hideLoading()
        this.setData({ isLoading: false })
        console.error('获取余额失败:', err)
        
        // 如果是下拉刷新，停止下拉刷新动画
        if (isRefresh) {
          wx.stopPullDownRefresh()
          wx.showToast({
            title: '刷新失败',
            icon: 'none'
          })
        }
        // 不再显示错误提示，因为已经在checkCloudFunctions中处理
      }
    })
  },

  // 格式化时间
  formatTime(date) {
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      const hours = date.getHours()
      const minutes = date.getMinutes()
      return `今天 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${month}月${day}日`
    }
  },

  // 跳转到充值页面
  goToRecharge() {
    if (this.data.needLogin) {
      wx.switchTab({
        url: '/pages/user/user'
      })
      return
    }
    
    if (!this.data.hasInit) {
      wx.showToast({
        title: '请先部署云函数',
        icon: 'none'
      })
      return
    }
    
    app.checkAuth(() => {
      wx.navigateTo({
        url: '/pages/recharge/recharge'
      })
    })
  },

  // 跳转到购买页面
  goToPurchase() {
    if (this.data.needLogin) {
      wx.switchTab({
        url: '/pages/user/user'
      })
      return
    }
    
    if (!this.data.hasInit) {
      wx.showToast({
        title: '请先部署云函数',
        icon: 'none'
      })
      return
    }
    
    app.checkAuth(() => {
      wx.navigateTo({
        url: '/pages/purchase/purchase'
      })
    })
  },

  // 跳转到卖出页面
  goToSell() {
    if (this.data.needLogin) {
      wx.switchTab({
        url: '/pages/user/user'
      })
      return
    }
    
    if (!this.data.hasInit) {
      wx.showToast({
        title: '请先部署云函数',
        icon: 'none'
      })
      return
    }
    
    app.checkAuth(() => {
      wx.navigateTo({
        url: '/pages/sell/sell'
      })
    })
  },

  // 切换交易记录详情展开/折叠
  toggleTransactionDetail(e) {
    const index = e.currentTarget.dataset.index
    const key = `recentTransactions[${index}].expanded`
    const currentExpanded = this.data.recentTransactions[index].expanded || false
    
    this.setData({
      [key]: !currentExpanded
    })
  },

  // 跳转到记录页面
  goToRecords() {
    if (this.data.needLogin) {
      wx.switchTab({
        url: '/pages/user/user'
      })
      return
    }
    
    if (!this.data.hasInit) {
      wx.showToast({
        title: '请先部署云函数',
        icon: 'none'
      })
      return
    }
    
    app.checkAuth(() => {
      wx.switchTab({
        url: '/pages/records/records'
      })
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'CS2记账 - 精确核算你的道具交易成本',
      path: '/pages/index/index',
      imageUrl: ''
    }
  }
})