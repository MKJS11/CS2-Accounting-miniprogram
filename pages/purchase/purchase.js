// purchase.js
const app = getApp()

Page({
  data: {
    itemName: '',
    usdPrice: '',
    quantity: '', // 默认数量为空，用户可以自由输入
    totalPrice: '', // 总价
    itemType: 'gun', // 默认选择枪械
    canSubmit: false,
    costPreview: {
      show: false,
      rmbCost: 0,
      insufficient: false,
      details: []
    },
    // 物品种类选项
    itemTypes: [
      { value: 'gun', label: '枪械', icon: '🔫' },
      { value: 'gloves', label: '手套', icon: '🧤' },
      { value: 'knife', label: '匕首', icon: '🔪' },
      { value: 'agent', label: '探员', icon: '👤' },
      { value: 'sticker', label: '贴纸', icon: '🏷️' },
      { value: 'case', label: '箱子', icon: '📦' },
      { value: 'custom', label: '自定义', icon: '⚙️' }
    ],
    selectedItemType: { value: 'gun', label: '枪械', icon: '🔫' }, // 当前选中的种类
    customTypeInput: '', // 自定义类型输入
    showCustomInput: false // 是否显示自定义输入框
  },

  onLoad() {
    
  },

  onHide() {
    // 清理定时器
    if (this.calculateTimer) {
      clearTimeout(this.calculateTimer)
      this.calculateTimer = null
    }
  },

  onUnload() {
    // 清理定时器
    if (this.calculateTimer) {
      clearTimeout(this.calculateTimer)
      this.calculateTimer = null
    }
  },

  // 输入物品名称
  onItemNameInput(e) {
    this.setData({
      itemName: e.detail.value
    })
    this.checkCanSubmit()
  },

  // 输入数量
  onQuantityInput(e) {
    const inputValue = e.detail.value
    console.log('数量输入原始值:', inputValue)
    
    // 如果输入为空，保持空状态，不强制设为1
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      this.setData({
        quantity: ''
      })
      this.calculateTotalPrice()
      this.checkCanSubmit()
      return
    }
    
    // 解析数值，确保大于0
    const value = parseInt(inputValue)
    if (isNaN(value) || value <= 0) {
      this.setData({
        quantity: ''
      })
    } else {
      this.setData({
        quantity: value
      })
    }
    
    console.log('数量最终值:', this.data.quantity)
    this.calculateTotalPrice()
    this.checkCanSubmit()
  },

  // 输入美元价格
  onUsdPriceInput(e) {
    const value = e.detail.value
    this.setData({
      usdPrice: value
    })
    this.calculateTotalPrice()
    this.checkCanSubmit()
  },

  // 计算总价
  calculateTotalPrice() {
    const { quantity, usdPrice } = this.data
    const unitPrice = parseFloat(usdPrice) || 0
    const quantityNum = parseInt(quantity) || 0
    const totalPrice = (unitPrice * quantityNum).toFixed(2)
    
    console.log('计算总价:', {
      quantity,
      usdPrice,
      unitPrice,
      quantityNum,
      totalPrice
    })
    
    this.setData({
      totalPrice: totalPrice
    })
    
    // 延迟计算成本，避免频繁调用
    if (this.calculateTimer) {
      clearTimeout(this.calculateTimer)
    }
    
    if (unitPrice > 0 && quantityNum > 0) {
      // 重置余额不足状态，允许用户重新输入
      this.setData({
        'costPreview.insufficient': false
      })
      
      this.calculateTimer = setTimeout(() => {
        this.calculateCost(parseFloat(totalPrice))
      }, 500)
    } else {
      this.setData({
        'costPreview.show': false,
        'costPreview.insufficient': false
      })
    }
  },



  // 选择物品种类
  onItemTypeChange(e) {
    const selectedIndex = parseInt(e.detail.value)
    const selectedTypeItem = this.data.itemTypes[selectedIndex]
    this.setData({
      itemType: selectedTypeItem.value,
      selectedItemType: selectedTypeItem,
      showCustomInput: selectedTypeItem.value === 'custom',
      customTypeInput: selectedTypeItem.value === 'custom' ? this.data.customTypeInput : ''
    })
    this.checkCanSubmit()
  },

  // 输入自定义类型
  onCustomTypeInput(e) {
    this.setData({
      customTypeInput: e.detail.value
    })
    this.checkCanSubmit()
  },

  // 预计算成本（模拟计算，实际应该调用云函数）
  calculateCost(usdPrice) {
    // 这里应该调用云函数获取准确的成本计算
    // 现在先用模拟数据
    wx.cloud.callFunction({
      name: 'getBalance',
      success: res => {
        if (res.result.success) {
          const balance = res.result.balance
          const totalCostRmb = usdPrice * balance.avg_exchange_rate
          
          if (balance.total_usd_balance >= usdPrice) {
            this.setData({
              'costPreview.show': true,
              'costPreview.rmbCost': totalCostRmb.toFixed(2),
              'costPreview.exchangeRate': balance.avg_exchange_rate.toFixed(4),
              'costPreview.insufficient': false
            }, () => {
              // 在状态更新后重新检查按钮状态
              this.checkCanSubmit()
            })
          } else {
            this.setData({
              'costPreview.show': true,
              'costPreview.insufficient': true,
              'costPreview.rmbCost': totalCostRmb.toFixed(2),
              'costPreview.exchangeRate': balance.avg_exchange_rate.toFixed(4)
            }, () => {
              // 在状态更新后重新检查按钮状态
              this.checkCanSubmit()
            })
          }
        }
      },
      fail: err => {
        console.error('获取余额失败:', err)
        // 网络错误时不禁用按钮，让用户可以尝试购买
        this.setData({
          'costPreview.show': false,
          'costPreview.insufficient': false
        }, () => {
          this.checkCanSubmit()
        })
      }
    })
  },

  // 检查是否可以提交
  checkCanSubmit() {
    const { itemName, usdPrice, quantity, itemType, customTypeInput, costPreview } = this.data
    
    // 检查基本字段
    const quantityNum = parseInt(quantity) || 0
    let canSubmit = itemName && usdPrice && parseFloat(usdPrice) > 0 && quantityNum > 0 && !costPreview.insufficient
    
    // 如果选择了自定义类型，必须填写自定义输入
    if (itemType === 'custom') {
      canSubmit = canSubmit && customTypeInput && customTypeInput.trim().length > 0
    }
    
    this.setData({
      canSubmit: canSubmit
    })
  },

  // 提交购买
  submitPurchase() {
    const { itemName, quantity, totalPrice } = this.data
    
    if (!this.data.canSubmit) {
      if (this.data.costPreview.insufficient) {
        wx.showToast({
          title: '余额不足，请先充值',
          icon: 'none'
        })
      } else {
        wx.showToast({
          title: '请填写完整信息',
          icon: 'none'
        })
      }
      return
    }

    // 直接执行购买，不需要确认
    this.doPurchase()
  },

  // 执行购买
  doPurchase() {
    wx.showLoading({
      title: '购买中...',
    })

    const { itemName, usdPrice, quantity, totalPrice, itemType, customTypeInput } = this.data

    console.log('准备提交购买:', {
      itemName,
      usdPrice,
      quantity,
      totalPrice,
      itemType,
      customTypeInput
    })

    // 确定最终的物品类型
    const finalItemType = itemType === 'custom' ? customTypeInput.trim() : itemType

    wx.cloud.callFunction({
      name: 'addPurchase',
      data: {
        itemName: itemName,
        usdPrice: parseFloat(usdPrice),
        quantity: quantity,
        totalPrice: parseFloat(totalPrice),

        itemType: finalItemType
      },
      success: res => {
        wx.hideLoading()
        if (res.result.success) {
          // 标记主页需要刷新
          app.markHomeNeedsRefresh()
          
          // 直接清空表单并返回，不显示成功提示
          this.setData({
            itemName: '',
            usdPrice: '',
            quantity: '', // 重置为空，让用户自由输入
            totalPrice: '',
            itemType: 'gun', // 重置为默认值
            selectedItemType: { value: 'gun', label: '枪械', icon: '🔫' }, // 重置选中的类型
            customTypeInput: '',
            showCustomInput: false,
            canSubmit: false,
            'costPreview.show': false
          })
          
          // 返回上一页
          wx.navigateBack()
        } else {
          wx.showToast({
            title: res.result.error || '购买失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error('购买失败:', err)
        wx.showToast({
          title: '购买失败',
          icon: 'none'
        })
      }
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'CS2记账 - 记录我的购买',
      path: '/pages/index/index',
      imageUrl: ''
    }
  }
})