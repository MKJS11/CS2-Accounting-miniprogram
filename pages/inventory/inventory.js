// pages/inventory/inventory.js

// 物品种类映射
const ITEM_TYPE_MAP = {
  'weapon': { icon: '🔫', label: '武器' },
  'weapons': { icon: '🔫', label: '武器' },
  'knife': { icon: '🔪', label: '匕首' },
  'knives': { icon: '🔪', label: '匕首' },
  'glove': { icon: '🧤', label: '手套' },
  'gloves': { icon: '🧤', label: '手套' },
  'case': { icon: '📦', label: '箱子' },
  'cases': { icon: '📦', label: '箱子' },
  'key': { icon: '🔑', label: '钥匙' },
  'keys': { icon: '🔑', label: '钥匙' },
  'sticker': { icon: '🏷️', label: '贴纸' },
  'stickers': { icon: '🏷️', label: '贴纸' },
  'music_kit': { icon: '🎵', label: '音乐盒' },
  'music_kits': { icon: '🎵', label: '音乐盒' },
  'agent': { icon: '👤', label: '探员' },
  'agents': { icon: '👤', label: '探员' },
  'gun': { icon: '🔫', label: '枪械' },
  'guns': { icon: '🔫', label: '枪械' },
  'custom': { icon: '⚙️', label: '自定义' }
}

// 获取物品种类显示信息
function getItemTypeDisplay(itemType) {
  if (!itemType) return { icon: '❓', label: '未知' }
  
  // 如果是预定义类型
  if (ITEM_TYPE_MAP[itemType]) {
    return ITEM_TYPE_MAP[itemType]
  }
  
  // 自定义类型，使用首字母作为图标
  const firstChar = itemType.charAt(0).toUpperCase()
  return {
    icon: firstChar,
    label: itemType
  }
}

Page({
  data: {
    inventoryList: [],
    filteredInventoryList: [],
    loading: true,
    totalInventory: {
      totalItems: 0,
      totalUsdCost: 0,
      totalRmbCost: 0
    },
    selectedItem: null,
    showDetail: false,
    // 搜索相关
    searchKeyword: '',
    // 卖出弹窗相关
    showSellModal: false,
    selectedSellItem: null,
    sellQuantity: '',
    sellPrice: '',
    canSubmitSell: false,
    profitPreview: {
      show: false,
      totalSellPrice: '0.00',
      totalCost: '0.00',
      profit: '0.00',
      profitRate: '0.00'
    },
    // 筛选相关
    showFilterDropdown: false,
    selectedFilter: 'all',
    availableTypes: [],
    allItemTypes: {
      all: 0
    },
    // 排序相关
    showSortDropdown: false,
    selectedSort: 'quantity_desc',
    sortOptions: [
      { key: 'quantity_desc', label: '数量 ↓', icon: '📦' },
      { key: 'quantity_asc', label: '数量 ↑', icon: '📦' },
      { key: 'time_desc', label: '时间 ↓', icon: '🕒' },
      { key: 'time_asc', label: '时间 ↑', icon: '🕒' },
      { key: 'value_desc', label: '价值 ↓', icon: '💰' },
      { key: 'value_asc', label: '价值 ↑', icon: '💰' }
    ]
  },

  onLoad() {
    this.loadInventoryData()
  },

  onShow() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2 // 库存页面的索引
      })
    }
    
    // 检查是否需要刷新数据
    const app = getApp()
    const needsRefresh = app.getAndResetInventoryRefreshFlag()
    
    if (needsRefresh || this.data.inventoryList.length === 0) {
      console.log('库存页面需要刷新数据')
      this.loadInventoryData()
    }
  },

  // 加载库存数据
  async loadInventoryData() {
    this.setData({
      loading: true
    })

    try {
      const result = await wx.cloud.callFunction({
        name: 'getInventory',
        data: {}
      })

      if (result.result.success) {
        // 为每个物品添加翻译后的类型标签
        const processedItems = result.result.data.items.map(item => ({
          ...item,
          displayType: getItemTypeDisplay(item.item_type).label
        }))
        
        this.setData({
          inventoryList: processedItems,
          totalInventory: result.result.data.summary,
          loading: false
        })
        
        // 处理筛选数据
        this.processFilterData(processedItems)
        this.applyFilter()
      } else {
        console.error('获取库存数据失败:', result.result.error)
        wx.showToast({
          title: result.result.error || '获取数据失败',
          icon: 'error'
        })
        this.setData({
          loading: false
        })
      }
    } catch (error) {
      console.error('加载库存数据出错:', error)
      wx.showToast({
        title: '网络错误',
        icon: 'error'
      })
      this.setData({
        loading: false
      })
    }
  },

  // 显示物品详情
  showItemDetail(e) {
    const { item } = e.currentTarget.dataset
    console.log('Showing detail for item:', item)
    
    // 处理购买记录数据，计算每个记录的显示信息
    if (item.purchase_records && item.purchase_records.length > 0) {
      item.purchase_records = item.purchase_records.map(record => {
        // 计算人民币单价
        const unit_price_cny = record.rmb_cost && record.quantity > 0 
          ? (record.rmb_cost / record.quantity).toFixed(2) 
          : '0.00'
        
        // 计算剩余成本
        const remaining_cost_cny = record.remaining_quantity > 0 && record.quantity > 0
          ? ((record.rmb_cost / record.quantity) * record.remaining_quantity).toFixed(2)
          : '0.00'
        
        return {
          ...record,
          unit_price_cny: unit_price_cny,
          remaining_cost_cny: remaining_cost_cny,
          purchase_time: this.formatDate(record.purchase_time)
        }
      })
    }
    
    this.setData({
      selectedItem: item,
      showDetail: true
    })
  },

  // 格式化日期
  formatDate(dateStr) {
    if (!dateStr) return ''
    
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    return `${year}-${month}-${day}`
  },

  // 卖出特定批次
  sellSpecificRecord(e) {
    const record = e.currentTarget.dataset.record
    console.log('Selling specific record:', record)
    
    // 构造卖出物品数据
    const sellItem = {
      ...this.data.selectedItem,
      // 只允许卖出这个特定记录的数量
      remaining_quantity: record.remaining_quantity,
      // 使用这个记录的具体成本信息
      avg_cost_cny: record.unit_price_cny,
      // 指定特定的购买记录ID
      purchase_ids: [record.id]
    }
    
    this.setData({
      selectedSellItem: sellItem,
      showSellModal: true,
      showDetail: false, // 关闭详情弹窗
      sellQuantity: 1,
      sellPrice: '',
      profitPreview: { show: false }
    })
  },

  // 关闭详情弹窗
  closeDetail() {
    this.setData({
      showDetail: false,
      selectedItem: null
    })
  },

  // 快速卖出 - 显示卖出弹窗
  quickSell(e) {
    // 阻止事件冒泡
    e.stopPropagation && e.stopPropagation()
    
    const { item } = e.currentTarget.dataset
    console.log('quickSell called with item:', item)
    
    // 计算平均成本价（人民币）
    const avgCostCny = (parseFloat(item.total_rmb_cost) / parseFloat(item.remaining_quantity)).toFixed(2)
    
    // 确保详情弹窗关闭，然后设置卖出弹窗
    this.setData({
      showDetail: false,
      selectedItem: null,
      selectedSellItem: {
        ...item,
        avg_cost_cny: avgCostCny
      },
      showSellModal: true,
      sellQuantity: '',
      sellPrice: '',
      canSubmitSell: false,
      profitPreview: {
        show: false,
        totalSellPrice: '0.00',
        totalCost: '0.00',
        profit: '0.00',
        profitRate: '0.00'
      }
    })
  },

  // 去购买页面
  goToPurchase() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 下拉刷新
  async onPullDownRefresh() {
    try {
      await this.loadInventoryData()
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  // 关闭卖出弹窗
  closeSellModal() {
    this.setData({
      showSellModal: false,
      selectedSellItem: null,
      sellQuantity: '',
      sellPrice: '',
      canSubmitSell: false,
      profitPreview: {
        show: false,
        totalSellPrice: '0.00',
        totalCost: '0.00',
        profit: '0.00',
        profitRate: '0.00'
      }
    })
  },

  // 阻止事件冒泡
  stopPropagation(e) {
    e.stopPropagation && e.stopPropagation()
  },

  // 减少数量
  decreaseQuantity() {
    const newQuantity = Math.max(1, this.data.sellQuantity - 1)
    this.setData({
      sellQuantity: newQuantity
    })
    this.updateProfitPreview()
    this.checkCanSubmit()
  },

  // 增加数量
  increaseQuantity() {
    const maxQuantity = this.data.selectedSellItem.remaining_quantity
    const newQuantity = Math.min(maxQuantity, this.data.sellQuantity + 1)
    this.setData({
      sellQuantity: newQuantity
    })
    this.updateProfitPreview()
    this.checkCanSubmit()
  },

  // 数量输入
  onQuantityInput(e) {
    const value = e.detail.value
    const maxQuantity = this.data.selectedSellItem.remaining_quantity
    
    // 如果输入为空，保持空状态
    if (value === '') {
      this.setData({
        sellQuantity: ''
      })
      this.updateProfitPreview()
      this.checkCanSubmit()
      return
    }
    
    // 解析数字并限制范围
    const numValue = parseInt(value) || 0
    if (numValue <= 0) {
      this.setData({
        sellQuantity: ''
      })
    } else {
      const sellQuantity = Math.min(maxQuantity, numValue)
      this.setData({
        sellQuantity: sellQuantity
      })
    }
    
    this.updateProfitPreview()
    this.checkCanSubmit()
  },

  // 价格输入
  onPriceInput(e) {
    const value = e.detail.value
    this.setData({
      sellPrice: value
    })
    this.updateProfitPreview()
    this.checkCanSubmit()
  },



  // 更新利润预览
  updateProfitPreview() {
    const { selectedSellItem, sellQuantity, sellPrice } = this.data
    
    // 检查输入有效性
    const quantityNum = parseInt(sellQuantity) || 0
    if (!selectedSellItem || !sellPrice || sellPrice <= 0 || quantityNum <= 0) {
      this.setData({
        'profitPreview.show': false
      })
      return
    }

    const sellPriceNum = parseFloat(sellPrice)
    const totalSellPrice = sellPriceNum * quantityNum
    // 使用更精确的成本计算 - 优先使用特定批次的成本
    const avgCostCny = parseFloat(selectedSellItem.avg_cost_cny || selectedSellItem.avg_rmb_unit_price)
    const totalCost = avgCostCny * quantityNum
    const profit = totalSellPrice - totalCost
    const profitRate = totalCost > 0 ? (profit / totalCost * 100) : 0

    this.setData({
      profitPreview: {
        show: true,
        totalSellPrice: totalSellPrice.toFixed(2),
        totalCost: totalCost.toFixed(2),
        profit: profit.toFixed(2),
        profitRate: profitRate.toFixed(2)
      }
    })
  },

  // 检查是否可以提交
  checkCanSubmit() {
    const { sellQuantity, sellPrice, selectedSellItem } = this.data
    const quantityNum = parseInt(sellQuantity) || 0
    const canSubmit = quantityNum > 0 && 
                     sellPrice && 
                     parseFloat(sellPrice) > 0 && 
                     quantityNum <= selectedSellItem.remaining_quantity

    this.setData({
      canSubmitSell: canSubmit
    })
  },

  // 确认卖出
  async confirmSell() {
    if (!this.data.canSubmitSell) {
      return
    }

    const { selectedSellItem, sellQuantity, sellPrice } = this.data
    
    // 检查网络状态
    const networkType = await new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => resolve(res.networkType),
        fail: () => resolve('unknown')
      })
    })
    
    if (networkType === 'none') {
      wx.showToast({
        title: '网络连接失败，请检查网络设置',
        icon: 'error',
        duration: 3000
      })
      return
    }
    
    try {
      wx.showLoading({
        title: '提交中...'
      })

      // 需要找到对应的购买记录ID
      // 从库存数据中获取购买记录信息
      let purchaseId = null
      
      // 检查是否指定了特定的购买记录
      if (selectedSellItem.purchase_ids && selectedSellItem.purchase_ids.length > 0) {
        purchaseId = selectedSellItem.purchase_ids[0]
        console.log('使用指定的购买记录ID:', purchaseId)
      } else {
        // 如果没有purchase_ids，需要通过名称查找
        wx.hideLoading()
        wx.showToast({
          title: '无法找到购买记录',
          icon: 'error'
        })
        return
      }

      // 验证卖出数量不超过可用数量
      if (sellQuantity > selectedSellItem.remaining_quantity) {
        wx.hideLoading()
        wx.showToast({
          title: `数量超限，最多可卖 ${selectedSellItem.remaining_quantity} 个`,
          icon: 'error'
        })
        return
      }


      // 计算卖出价格（人民币）
      const sellUnitPriceCNY = parseFloat(sellPrice)

      console.log('Submitting sell data:', {
        itemId: purchaseId,
        sellUnitPriceCNY,
        sellQuantity
      })

      const res = await wx.cloud.callFunction({
        name: 'sellItem',
        data: {
          itemId: purchaseId,
          sellUnitPriceCNY: sellUnitPriceCNY,
          sellQuantity: sellQuantity
        }
      })

      if (res.result.success) {
        wx.showToast({
          title: '卖出成功',
          icon: 'success'
        })
        
        // 关闭弹窗
        this.closeSellModal()
        
        // 标记所有页面需要刷新（卖出会影响余额、库存和统计）
        const app = getApp()
        app.markAllPagesNeedsRefresh()
        
        // 重新加载库存数据
        this.loadInventoryData()
      } else {
        wx.showToast({
          title: res.result.message || '卖出失败',
          icon: 'error'
        })
      }
    } catch (error) {
      console.error('卖出物品出错:', error)
      
      // 根据错误类型显示不同的提示信息
      let errorMessage = '网络错误，请重试'
      
      if (error.errMsg) {
        if (error.errMsg.includes('cloud function')) {
          errorMessage = '云函数调用失败，请检查网络'
        } else if (error.errMsg.includes('timeout')) {
          errorMessage = '请求超时，请重试'
        } else if (error.errMsg.includes('permission')) {
          errorMessage = '权限不足，请重新登录'
        }
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'error',
        duration: 3000
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 处理筛选数据
  processFilterData(inventoryList) {
    // 统计各分类的数量
    const typeCounts = {}
    let totalCount = 0
    
    inventoryList.forEach(item => {
      const itemType = item.item_type || 'unknown'
      typeCounts[itemType] = (typeCounts[itemType] || 0) + 1
      totalCount++
    })
    
    // 构建可用的分类选项
    const availableTypes = Object.keys(typeCounts).map(type => {
      const typeDisplay = getItemTypeDisplay(type)
      return {
        type: type,
        icon: typeDisplay.icon,
        label: typeDisplay.label,
        count: typeCounts[type]
      }
    }).sort((a, b) => b.count - a.count) // 按数量降序排列
    
    this.setData({
      availableTypes,
      'allItemTypes.all': totalCount
    })
  },
  
  // 应用筛选和搜索
  applyFilter() {
    const { inventoryList, selectedFilter, searchKeyword, selectedSort } = this.data
    
    let filteredList = inventoryList
    
    // 首先按分类筛选
    if (selectedFilter !== 'all') {
      filteredList = filteredList.filter(item => {
        return (item.item_type || 'unknown') === selectedFilter
      })
    }
    
    // 然后按搜索关键词筛选
    if (searchKeyword && searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase()
      filteredList = filteredList.filter(item => {
        const itemName = (item.item_name || '').toLowerCase()
        const itemType = (item.item_type || '').toLowerCase()
        const typeDisplay = getItemTypeDisplay(item.item_type).label.toLowerCase()
        
        return itemName.includes(keyword) || 
               itemType.includes(keyword) || 
               typeDisplay.includes(keyword)
      })
    }
    
    // 最后应用排序
    filteredList = this.applySorting(filteredList, selectedSort)
    
    this.setData({
      filteredInventoryList: filteredList
    })
  },

  // 应用排序
  applySorting(list, sortType) {
    const sortedList = [...list]
    
    switch (sortType) {
      case 'quantity_desc':
        return sortedList.sort((a, b) => b.remaining_quantity - a.remaining_quantity)
      
      case 'quantity_asc':
        return sortedList.sort((a, b) => a.remaining_quantity - b.remaining_quantity)
      
      case 'time_desc':
        return sortedList.sort((a, b) => {
          const timeA = new Date(a.last_purchase_time || a.first_purchase_time)
          const timeB = new Date(b.last_purchase_time || b.first_purchase_time)
          return timeB - timeA
        })
      
      case 'time_asc':
        return sortedList.sort((a, b) => {
          const timeA = new Date(a.first_purchase_time)
          const timeB = new Date(b.first_purchase_time)
          return timeA - timeB
        })
      
      case 'value_desc':
        return sortedList.sort((a, b) => b.total_rmb_cost - a.total_rmb_cost)
      
      case 'value_asc':
        return sortedList.sort((a, b) => a.total_rmb_cost - b.total_rmb_cost)
      
      default:
        return sortedList.sort((a, b) => b.remaining_quantity - a.remaining_quantity)
    }
  },
  
  // 切换下拉筛选
  toggleFilterDropdown() {
    this.setData({
      showFilterDropdown: !this.data.showFilterDropdown
    })
  },

  // 关闭下拉筛选
  closeFilterDropdown() {
    this.setData({
      showFilterDropdown: false,
      showSortDropdown: false
    })
  },

  // 切换排序下拉菜单
  toggleSortDropdown() {
    this.setData({
      showSortDropdown: !this.data.showSortDropdown,
      showFilterDropdown: false
    })
  },

  // 选择排序方式
  selectSort(e) {
    const sortKey = e.currentTarget.dataset.sort
    this.setData({
      selectedSort: sortKey,
      showSortDropdown: false
    })
    
    this.applyFilter()
  },
  
  // 选择筛选条件
  selectFilter(e) {
    const filter = e.currentTarget.dataset.filter
    
    this.setData({
      selectedFilter: filter,
      showFilterDropdown: false
    })
    
    this.applyFilter()
  },

  // 搜索输入事件
  onSearchInput(e) {
    const searchKeyword = e.detail.value
    this.setData({
      searchKeyword
    })
    
    // 实时搜索，稍微延迟以避免频繁调用
    clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => {
      this.applyFilter()
    }, 300)
  },

  // 搜索确认事件
  onSearchConfirm(e) {
    const searchKeyword = e.detail.value
    this.setData({
      searchKeyword
    })
    this.applyFilter()
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchKeyword: ''
    })
    this.applyFilter()
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空方法，用于阻止事件冒泡
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'CS2记账 - 我的库存',
      path: '/pages/inventory/inventory'
    }
  }
})
