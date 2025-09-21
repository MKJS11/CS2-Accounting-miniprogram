// sell.js
const app = getApp()

Page({
  data: {
    availableItems: [], // 可卖出的物品列表
    selectedItem: null, // 选中的物品
    sellPrice: '', // 卖出单价 (人民币)
    sellQuantity: 1, // 卖出数量
    canSubmit: false,
    showItemPicker: false,
    profitPreview: {
      show: false,
      totalPrice: 0,
      totalProfit: 0,
      profitRate: 0
    },

  },

  onLoad() {
    this.loadAvailableItems()
  },

  // 加载可卖出的物品
  async loadAvailableItems() {
    try {
      // 检查是否有 openid
      if (!app.globalData.openid) {
        console.log('No openid found, trying to get it...')
        await new Promise((resolve) => {
          app.getOpenId()
          // 等待一下让 openid 获取完成
          setTimeout(() => {
            resolve()
          }, 1000)
        })
        
        if (!app.globalData.openid) {
          wx.showToast({
            title: '用户信息获取失败',
            icon: 'none'
          })
          return
        }
      }

      console.log('Using openid:', app.globalData.openid)

      wx.showLoading({
        title: '加载中...'
      })

      const res = await wx.cloud.callFunction({
        name: 'getRecords',
        data: {
          type: 'available_items',
          openid: app.globalData.openid
        }
      })

      console.log('Cloud function response:', res)

      if (res.result && res.result.success) {
        // 检查返回的数据是否为数组
        const data = res.result.data
        console.log('Received data:', data, 'Type:', typeof data, 'IsArray:', Array.isArray(data))
        
        if (Array.isArray(data)) {
          console.log('Available items from cloud function:', data.length)
          console.log('Items data:', data)
          
          // 预处理数据，添加显示文本
          const processedData = data.map(item => {
            const usdPrice = item.usd_unit_price || item.usd_price || 0
            const quantity = item.quantity || 1
            const totalRmbCost = item.rmb_cost || 0
            const unitRmbCost = (totalRmbCost / quantity).toFixed(2)
            
            console.log('Processing item:', item.item_name, 'USD:', usdPrice, 'RMB Cost:', totalRmbCost, 'Unit RMB:', unitRmbCost)
            
            return {
              ...item,
              displayPrice: usdPrice,
              displayQuantity: quantity,
              unitRmbCost: unitRmbCost, // 保留用于后端计算，但不显示
              buyPriceText: `买入: $${usdPrice} × ${quantity}`
            }
          })
          
          this.setData({
            availableItems: processedData
          })
        } else {
          console.error('返回的数据不是数组格式:', data)
          wx.showToast({
            title: '数据格式错误',
            icon: 'none'
          })
        }
      } else {
        console.error('Cloud function failed:', res.result)
        wx.showToast({
          title: (res.result && res.result.message) || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载可卖出物品失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 显示物品选择器
  showItemPicker() {
    this.setData({
      showItemPicker: true
    })
  },

  // 隐藏物品选择器
  hideItemPicker() {
    this.setData({
      showItemPicker: false
    })
  },

  // 选择物品
  selectItem(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.availableItems[index]
    
    // 添加调试日志
    console.log('Selected item data:', JSON.stringify(item, null, 2))
    console.log('usd_unit_price:', item.usd_unit_price)
    console.log('usd_price:', item.usd_price)
    console.log('quantity:', item.quantity)
    
    // 确保数据完整性
    const usdPrice = item.usd_unit_price || item.usd_price || 0
    const quantity = item.quantity || 1
    const totalRmbCost = item.rmb_cost || 0
    const unitRmbCost = (totalRmbCost / quantity).toFixed(2)
    
    console.log('Select item calculation:', {
      itemName: item.item_name,
      usdPrice,
      quantity,
      totalRmbCost,
      unitRmbCost
    })
    
    const processedItem = {
      ...item,
      displayPrice: usdPrice,
      displayQuantity: quantity,
      unitRmbCost: unitRmbCost, // 保留用于后端计算，但不显示
      buyPriceText: `买入价: $${usdPrice} × ${quantity}`
    }
    
    console.log('Processed item:', processedItem)
    
    this.setData({
      selectedItem: processedItem,
      sellQuantity: 1, // 重置数量为1
      showItemPicker: false
    })
    this.checkCanSubmit()
    this.calculateProfit()
  },

  // 增加数量
  increaseQuantity() {
    if (!this.data.selectedItem) return
    const maxQuantity = this.data.selectedItem.quantity || 1
    if (this.data.sellQuantity < maxQuantity) {
      this.setData({
        sellQuantity: this.data.sellQuantity + 1
      })
      this.calculateProfit()
    }
  },

  // 减少数量
  decreaseQuantity() {
    if (this.data.sellQuantity > 1) {
      this.setData({
        sellQuantity: this.data.sellQuantity - 1
      })
      this.calculateProfit()
    }
  },

  // 数量输入
  onQuantityInput(e) {
    const value = parseInt(e.detail.value) || 1
    const maxQuantity = this.data.selectedItem ? (this.data.selectedItem.quantity || 1) : 1
    const quantity = Math.max(1, Math.min(value, maxQuantity))
    
    this.setData({
      sellQuantity: quantity
    })
    this.calculateProfit()
  },

  // 输入卖出价格
  onSellPriceInput(e) {
    let value = e.detail.value
    
    // 限制小数点后最多2位
    if (value.includes('.')) {
      const parts = value.split('.')
      if (parts[1] && parts[1].length > 2) {
        value = parts[0] + '.' + parts[1].substring(0, 2)
      }
    }
    
    this.setData({
      sellPrice: value
    })
    this.checkCanSubmit()
    this.calculateProfit()
  },

  // 计算利润预览
  calculateProfit() {
    if (!this.data.selectedItem || !this.data.sellPrice || !this.data.sellQuantity) {
      this.setData({
        'profitPreview.show': false
      })
      return
    }

    const sellUnitPrice = parseFloat(this.data.sellPrice) // 人民币单价
    const buyUnitPriceCNY = parseFloat(this.data.selectedItem.unitRmbCost) // FIFO计算的历史人民币成本
    const quantity = this.data.sellQuantity
    
    const totalSellPrice = sellUnitPrice * quantity // 总卖出价(人民币)
    const totalBuyPrice = buyUnitPriceCNY * quantity // 总买入价(人民币，FIFO历史成本)
    const totalProfit = totalSellPrice - totalBuyPrice // 总利润(人民币)
    const profitRate = totalBuyPrice > 0 ? (totalProfit / totalBuyPrice * 100) : 0

    console.log('Profit calculation:', {
      sellUnitPrice,
      buyUnitPriceCNY,
      quantity,
      totalSellPrice,
      totalBuyPrice,
      totalProfit,
      profitRate
    })

    this.setData({
      'profitPreview.show': true,
      'profitPreview.totalPrice': totalSellPrice.toFixed(2),
      'profitPreview.totalProfit': totalProfit.toFixed(2),
      'profitPreview.profitRate': profitRate.toFixed(1)
    })
  },

  // 检查是否可以提交
  checkCanSubmit() {
    const canSubmit = this.data.selectedItem && 
                     this.data.sellPrice && 
                     parseFloat(this.data.sellPrice) > 0 &&
                     this.data.sellQuantity > 0 &&
                     this.data.sellQuantity <= (this.data.selectedItem ? this.data.selectedItem.quantity : 1)
    
    this.setData({
      canSubmit: canSubmit
    })
  },

  // 提交卖出
  async submitSell() {
    if (!this.data.canSubmit) {
      return
    }

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

      const sellUnitPriceCNY = parseFloat(this.data.sellPrice)
      
      console.log('Submitting sell data:', {
        sellUnitPriceCNY,
      })

      const res = await wx.cloud.callFunction({
        name: 'sellItem',
        data: {
          itemId: this.data.selectedItem._id,
          sellUnitPriceCNY: sellUnitPriceCNY, // 同时传递人民币价格用于记录
          sellQuantity: this.data.sellQuantity,
          openid: app.globalData.openid
        }
      })

      if (res.result.success) {
        // 标记主页需要刷新
        app.markHomeNeedsRefresh()
        
        const resultData = res.result.data
        const totalSellPriceCNY = sellUnitPriceCNY * resultData.sellQuantity
        const buyUnitPriceCNY = parseFloat(this.data.selectedItem.unitRmbCost)
        const totalBuyPriceCNY = buyUnitPriceCNY * resultData.sellQuantity
        const profitCNY = totalSellPriceCNY - totalBuyPriceCNY
        
        wx.showModal({
          title: '卖出成功',
          content: `${resultData.itemName}\n卖出数量: ${resultData.sellQuantity}\n卖出单价: ¥${sellUnitPriceCNY.toFixed(2)}\n总收入: ¥${totalSellPriceCNY.toFixed(2)}\n利润: ¥${profitCNY.toFixed(2)}`,
          showCancel: false,
          confirmText: '确定'
        })

        // 标记所有页面需要刷新（卖出会影响余额、库存和统计）
        const app = getApp()
        app.markAllPagesNeedsRefresh()

        // 重置表单状态
        this.setData({
          selectedItem: null,
          sellPrice: '',
          sellQuantity: 1,
          canSubmit: false,
          'profitPreview.show': false
        })

        // 刷新可用物品列表
        this.loadAvailableItems()

        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: res.result.message || '卖出失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('卖出失败:', error)
      
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

  // 分享
  onShareAppMessage() {
    return {
      title: 'CS2记账 - 记录我的卖出',
      path: '/pages/index/index',
      imageUrl: ''
    }
  }
})
