// recharge.js
const app = getApp()

Page({
  data: {
    rmbAmount: '',
    usdAmount: '',
    exchangeRate: 0,
    canSubmit: false,
    selectedPreset: null, // 选中的预置金额
    presetAmounts: [100, 300, 500, 1000] // 预置金额选项
  },

  onLoad() {
    
  },

  // 输入人民币金额
  onRmbInput(e) {
    const value = e.detail.value
    this.setData({
      rmbAmount: value
    })
    this.calculateExchangeRate()
    this.checkCanSubmit()
  },

  // 输入美元金额
  onUsdInput(e) {
    const value = e.detail.value
    this.setData({
      usdAmount: value,
      selectedPreset: null // 手动输入时清除预置选择
    })
    this.calculateExchangeRate()
    this.checkCanSubmit()
  },

  // 选择预置金额
  selectPresetAmount(e) {
    const amount = parseInt(e.currentTarget.dataset.amount)
    this.setData({
      usdAmount: amount.toString(),
      selectedPreset: amount
    })
    this.calculateExchangeRate()
    this.checkCanSubmit()
  },



  // 计算汇率
  calculateExchangeRate() {
    const { rmbAmount, usdAmount } = this.data
    if (rmbAmount && usdAmount && parseFloat(usdAmount) > 0) {
      const rate = (parseFloat(rmbAmount) / parseFloat(usdAmount)).toFixed(4)
      this.setData({
        exchangeRate: rate
      })
    } else {
      this.setData({
        exchangeRate: 0
      })
    }
  },

  // 检查是否可以提交
  checkCanSubmit() {
    const { rmbAmount, usdAmount } = this.data
    const canSubmit = rmbAmount && usdAmount && 
                     parseFloat(rmbAmount) > 0 && 
                     parseFloat(usdAmount) > 0
    this.setData({
      canSubmit: canSubmit
    })
  },

  // 提交充值
  submitRecharge() {
    const { rmbAmount, usdAmount, remark } = this.data
    
    if (!this.data.canSubmit) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认充值',
      content: `充值 $${usdAmount} 需要 ¥${rmbAmount}`,
      success: (res) => {
        if (res.confirm) {
          this.doRecharge()
        }
      }
    })
  },

  // 执行充值
  doRecharge() {
    wx.showLoading({
      title: '充值中...',
    })

    const { rmbAmount, usdAmount, remark } = this.data

    wx.cloud.callFunction({
      name: 'addRecharge',
      data: {
        rmbAmount: parseFloat(rmbAmount),
        usdAmount: parseFloat(usdAmount),
        remark: remark
      },
      success: res => {
        wx.hideLoading()
        if (res.result.success) {
          // 标记主页需要刷新
          app.markHomeNeedsRefresh()
          
          wx.showToast({
            title: '充值成功',
            icon: 'success'
          })
          
          // 清空表单
          this.setData({
            rmbAmount: '',
            usdAmount: '',
            exchangeRate: 0,
            canSubmit: false,
            selectedPreset: null
          })
          
          // 延迟返回
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        } else {
          wx.showToast({
            title: res.result.error || '充值失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error('充值失败:', err)
        wx.showToast({
          title: '充值失败',
          icon: 'none'
        })
      }
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'CS2记账 - 记录我的充值',
      path: '/pages/index/index',
      imageUrl: ''
    }
  }
})