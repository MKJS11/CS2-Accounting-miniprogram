// logs.js
const util = require('../../utils/util.js')

Page({
  data: {
    logs: []
  },
  onLoad() {
    this.setData({
      logs: (wx.getStorageSync('logs') || []).map(log => {
        return {
          date: util.formatTime(new Date(log)),
          timeStamp: log
        }
      })
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'CS2记账 - 应用日志',
      path: '/pages/index/index',
      imageUrl: ''
    }
  }
})
