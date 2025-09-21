// records.js
const app = getApp()

// 物品种类映射
const ITEM_TYPE_MAP = {
  'gun': { icon: '🔫', label: '枪械' },
  'sticker': { icon: '🏷️', label: '贴纸' },
  'case': { icon: '📦', label: '箱子' },
  'knife': { icon: '🔪', label: '匕首' },
  'glove': { icon: '🧤', label: '手套' },
  'gloves': { icon: '🧤', label: '手套' },
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
    activeTab: 'all',
    records: [],
    page: 1,
    limit: 20,
    hasMore: true,
    loading: false,
    refreshing: false,
    needLogin: false,
    showEditModal: false,
    editingItem: {}
  },

  onLoad() {
    this.checkLogin()
  },

  onShow() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
    
    // 每次显示时检查登录状态
    this.checkLogin()
  },

  // 检查登录状态
  checkLogin() {
    // 使用统一的登录状态检查
    const isLoggedIn = app.globalData.hasLogin && app.globalData.userInfo && app.globalData.openid
    
    if (isLoggedIn) {
      // 已登录，加载数据
      this.setData({ needLogin: false })
      this.refreshData()
    } else {
      // 未登录
      this.setData({ needLogin: true })
    }
  },

  // 刷新数据
  refreshData() {
    this.setData({
      records: [],
      page: 1,
      hasMore: true
    })
    this.loadRecords()
  },

  // 下拉刷新
  onRefresh() {
    this.setData({ refreshing: true })
    this.refreshData()
    setTimeout(() => {
      this.setData({ refreshing: false })
    }, 500)
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab !== this.data.activeTab) {
      this.setData({
        activeTab: tab
      })
      this.refreshData()
    }
  },

  // 加载记录
  loadRecords() {
    if (this.data.loading || !this.data.hasMore || this.data.needLogin) return

    this.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'getRecords',
      data: {
        type: this.data.activeTab,
        page: this.data.page,
        limit: this.data.limit
      },
      success: res => {
        if (res.result.success) {
          const data = res.result.data
          let newRecords = []

          if (this.data.activeTab === 'all' && data.all_records) {
            newRecords = data.all_records
          } else if (this.data.activeTab === 'recharge' && data.recharges) {
            newRecords = data.recharges.map(item => ({
              ...item,
              type: 'recharge'
            }))
          } else if (this.data.activeTab === 'purchase' && data.purchases) {
            newRecords = data.purchases.map(item => ({
              ...item,
              type: 'purchase'
            }))
          } else if (this.data.activeTab === 'sell' && data.sells) {
            newRecords = data.sells.map(item => ({
              ...item,
              type: 'sell'
            }))
          }

          // 格式化时间和处理显示数据
          newRecords.forEach(item => {
            const time = item.recharge_time || item.purchase_time || item.sell_time || item.time
            item.timeStr = this.formatTime(new Date(time))
            
            // 为购买记录添加折叠状态，默认折叠
            if (item.type === 'purchase') {
              item.detailsExpanded = false
            }
            
            // 处理购买记录的明细计算
            if (item.type === 'purchase' && item.recharge_details) {
              item.recharge_details = item.recharge_details.map(detail => {
                if (!detail.rmb_cost) {
                  detail.rmb_cost = (detail.used_usd * detail.exchange_rate).toFixed(2)
                }
                return detail
              })
            }
            
            // 处理卖出记录的价格格式化
            if (item.type === 'sell') {
              // 确保所有价格都显示为2位小数
              if (item.sell_price_cny) {
                item.sell_price_cny = parseFloat(item.sell_price_cny).toFixed(2)
              }
              if (item.total_sell_price_cny) {
                item.total_sell_price_cny = parseFloat(item.total_sell_price_cny).toFixed(2)
              }
              if (item.total_purchase_price_cny) {
                item.total_purchase_price_cny = parseFloat(item.total_purchase_price_cny).toFixed(2)
              }
              if (item.profit) {
                item.profit = parseFloat(item.profit).toFixed(2)
              }
              if (item.unit_sell_price_cny) {
                item.unit_sell_price_cny = parseFloat(item.unit_sell_price_cny).toFixed(2)
              }
            }
            
            // 为购买记录和卖出记录添加物品种类显示信息
            if ((item.type === 'purchase' || item.type === 'sell') && item.item_type) {
              const typeDisplay = getItemTypeDisplay(item.item_type)
              if (typeDisplay) {
                item.item_type_icon = typeDisplay.icon
                item.item_type_label = typeDisplay.label
              }
            }
          })

          // 合并记录
          const allRecords = this.data.page === 1 ? 
            newRecords : 
            [...this.data.records, ...newRecords]

          this.setData({
            records: allRecords,
            hasMore: newRecords.length >= this.data.limit,
            loading: false
          })
        } else {
          this.setData({ loading: false })
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        console.error('加载记录失败:', err)
        this.setData({ loading: false })
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    })
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        page: this.data.page + 1
      })
      this.loadRecords()
    }
  },

  // 格式化时间
  formatTime(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    
    const now = new Date()
    if (year === now.getFullYear() && 
        month === (now.getMonth() + 1).toString().padStart(2, '0') && 
        day === now.getDate().toString().padStart(2, '0')) {
      return `今天 ${hour}:${minute}`
    }
    
    if (year === now.getFullYear()) {
      return `${month}-${day} ${hour}:${minute}`
    }
    
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  // 删除记录
  deleteRecord(e) {
    const { id, type } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认删除',
      content: '删除后将无法恢复，确定要删除这条记录吗？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
          })
          
          console.log('准备删除记录:', { recordId: id, recordType: type })
          
          wx.cloud.callFunction({
            name: 'deleteRecord',
            data: {
              recordId: id,
              recordType: type
            },
            success: res => {
              wx.hideLoading()
              console.log('删除记录云函数返回:', res.result)
              
              if (res.result.success) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                })
                // 从列表中移除该记录
                const records = this.data.records.filter(item => item._id !== id)
                this.setData({ records })
                
                // 标记所有页面需要刷新（删除记录会影响余额、库存和统计）
                const app = getApp()
                app.markAllPagesNeedsRefresh()
              } else {
                wx.showToast({
                  title: res.result.error || '删除失败',
                  icon: 'none'
                })
              }
            },
            fail: err => {
              wx.hideLoading()
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              })
            }
          })
        }
      }
    })
  },

  // 编辑记录
  editRecord(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      showEditModal: true,
      editingItem: {...item}
    })
  },

  // 关闭编辑弹窗
  closeEditModal() {
    this.setData({
      showEditModal: false,
      editingItem: {}
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    return false
  },

  // 编辑物品名称
  onEditItemName(e) {
    this.setData({
      'editingItem.item_name': e.detail.value
    })
  },

  // 编辑备注
  onEditRemark(e) {
    const { editingItem } = this.data
    if (editingItem.type === 'recharge') {
      this.setData({
        'editingItem.rmb_amount': e.detail.value
      })
    } else {
      this.setData({
        'editingItem.remark': e.detail.value
      })
    }
  },

  // 确认编辑
  confirmEdit() {
    const { editingItem } = this.data
    
    wx.showLoading({
      title: '保存中...',
    })
    
    wx.cloud.callFunction({
      name: 'updateRecord',
      data: {
        recordId: editingItem._id,
        recordType: editingItem.type,
        updateData: editingItem
      },
      success: res => {
        wx.hideLoading()
        if (res.result.success) {
          wx.showToast({
            title: '修改成功',
            icon: 'success'
          })
          
          // 更新列表中的记录
          const records = this.data.records.map(item => {
            if (item._id === editingItem._id) {
              return editingItem
            }
            return item
          })
          
          this.setData({
            records,
            showEditModal: false,
            editingItem: {}
          })
        } else {
          wx.showToast({
            title: res.result.error || '修改失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        wx.hideLoading()
        wx.showToast({
          title: '修改失败',
          icon: 'none'
        })
      }
    })
  },

  // 切换购买记录明细展开状态
  togglePurchaseDetails(e) {
    const index = e.currentTarget.dataset.index
    const records = this.data.records
    records[index].detailsExpanded = !records[index].detailsExpanded
    this.setData({ records })
  },

  // 切换充值记录详情展开状态
  toggleRechargeDetails(e) {
    const index = e.currentTarget.dataset.index
    const records = this.data.records
    records[index].detailsExpanded = !records[index].detailsExpanded
    this.setData({ records })
  },

  // 切换卖出记录详情展开状态
  toggleSellDetails(e) {
    const index = e.currentTarget.dataset.index
    const records = this.data.records
    records[index].detailsExpanded = !records[index].detailsExpanded
    this.setData({ records })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'CS2记账 - 查看我的交易记录',
      path: '/pages/records/records',
      imageUrl: ''
    }
  }
})