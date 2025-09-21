// utils/version.js - 版本管理工具
const VERSION_CONFIG = {
  currentVersion: '0.0.1',
  minBaseLibVersion: '2.2.3', // 最低支持的基础库版本
  appName: 'CS2记账助手'
}

/**
 * 版本更新管理器
 */
class VersionManager {
  constructor() {
    this.updateManager = null
    this.version = VERSION_CONFIG.currentVersion
    this.init()
  }

  // 初始化版本管理器
  init() {
    // 检查基础库版本
    this.checkBaseLibVersion()
    
    // 初始化更新管理器
    if (wx.getUpdateManager) {
      this.updateManager = wx.getUpdateManager()
      this.bindUpdateEvents()
    } else {
      console.warn('当前微信版本过低，无法使用自动更新功能')
    }
  }

  // 检查基础库版本
  checkBaseLibVersion() {
    const systemInfo = wx.getSystemInfoSync()
    const SDKVersion = systemInfo.SDKVersion
    
    if (this.compareVersion(SDKVersion, VERSION_CONFIG.minBaseLibVersion) < 0) {
      wx.showModal({
        title: '版本过低',
        content: `当前微信版本过低，建议升级到最新版本微信后重试。\n当前版本：${SDKVersion}\n最低要求：${VERSION_CONFIG.minBaseLibVersion}`,
        showCancel: false,
        confirmText: '知道了'
      })
    }
  }

  // 版本号比较函数
  compareVersion(v1, v2) {
    const v1nums = v1.split('.').map(Number)
    const v2nums = v2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(v1nums.length, v2nums.length); i++) {
      const num1 = v1nums[i] || 0
      const num2 = v2nums[i] || 0
      
      if (num1 > num2) return 1
      if (num1 < num2) return -1
    }
    return 0
  }

  // 绑定更新事件
  bindUpdateEvents() {
    if (!this.updateManager) return

    // 检查更新结果
    this.updateManager.onCheckForUpdate((res) => {
      console.log('🔍 版本检查结果:', res)
      
      if (res.hasUpdate) {
        console.log('🎉 发现新版本')
        this.showUpdateFoundTip()
      } else {
        console.log('✅ 已是最新版本')
      }
    })

    // 新版本下载完成
    this.updateManager.onUpdateReady(() => {
      console.log('📦 新版本下载完成')
      this.showUpdateReadyDialog()
    })

    // 新版本下载失败
    this.updateManager.onUpdateFailed(() => {
      console.log('❌ 新版本下载失败')
      this.showUpdateFailedDialog()
    })
  }

  // 显示发现新版本提示
  showUpdateFoundTip() {
    wx.showToast({
      title: '发现新版本',
      icon: 'none',
      duration: 2000
    })
  }

  // 显示更新准备就绪对话框
  showUpdateReadyDialog() {
    wx.showModal({
      title: '🎉 新版本准备就绪',
      content: '新版本已下载完成，包含功能优化和问题修复，建议立即更新获得更好体验！',
      confirmText: '立即更新',
      cancelText: '稍后再说',
      confirmColor: '#07C160',
      success: (res) => {
        if (res.confirm) {
          this.applyUpdate()
        } else {
          this.setUpdateReminder()
        }
      }
    })
  }

  // 显示更新失败对话框
  showUpdateFailedDialog() {
    wx.showModal({
      title: '更新失败',
      content: '新版本下载失败，可能是网络问题。\n\n💡 解决方案：\n• 检查网络连接\n• 稍后重新打开小程序\n• 在WiFi环境下尝试',
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#FF6B6B'
    })
  }

  // 应用更新
  applyUpdate() {
    wx.showLoading({
      title: '正在更新...',
      mask: true
    })

    try {
      // 应用更新并重启
      this.updateManager.applyUpdate()
    } catch (error) {
      wx.hideLoading()
      console.error('应用更新失败:', error)
      wx.showToast({
        title: '更新失败，请重试',
        icon: 'error'
      })
    }
  }

  // 设置更新提醒
  setUpdateReminder() {
    wx.setStorageSync('pendingUpdate', {
      timestamp: Date.now(),
      reminded: false
    })
    
    wx.showToast({
      title: '稍后会再次提醒',
      icon: 'none',
      duration: 2000
    })
  }

  // 检查是否有待处理的更新提醒
  checkPendingUpdate() {
    const pendingUpdate = wx.getStorageSync('pendingUpdate')
    
    if (pendingUpdate && !pendingUpdate.reminded) {
      const timeDiff = Date.now() - pendingUpdate.timestamp
      // 如果超过30分钟，再次提醒
      if (timeDiff > 30 * 60 * 1000) {
        setTimeout(() => {
          this.showDelayedUpdateDialog()
        }, 3000) // 3秒后提醒
      }
    }
  }

  // 显示延迟更新对话框
  showDelayedUpdateDialog() {
    wx.showModal({
      title: '💡 更新提醒',
      content: '您有一个新版本等待更新，现在更新可获得更好的使用体验',
      confirmText: '立即更新',
      cancelText: '忽略',
      confirmColor: '#07C160',
      success: (res) => {
        if (res.confirm) {
          this.applyUpdate()
        }
        // 标记为已提醒，避免重复提醒
        wx.setStorageSync('pendingUpdate', {
          ...wx.getStorageSync('pendingUpdate'),
          reminded: true
        })
      }
    })
  }

  // 手动检查更新
  manualCheckUpdate() {
    if (!this.updateManager) {
      wx.showToast({
        title: '当前版本不支持检查更新',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '检查更新中...'
    })

    // 模拟检查过程
    setTimeout(() => {
      wx.hideLoading()
      
      // 这里实际上微信会自动触发onCheckForUpdate
      // 我们只需要给用户一个反馈
      wx.showToast({
        title: '检查完成',
        icon: 'success'
      })
    }, 1500)
  }

  // 获取当前版本信息
  getVersionInfo() {
    const accountInfo = wx.getAccountInfoSync()
    const systemInfo = wx.getSystemInfoSync()
    
    return {
      appVersion: this.version,
      appName: VERSION_CONFIG.appName,
      miniProgramVersion: accountInfo.miniProgram.version,
      baseLibVersion: systemInfo.SDKVersion,
      wechatVersion: systemInfo.version,
      updateTime: '2024年1月15日'
    }
  }

  // 显示版本信息
  showVersionInfo() {
    const versionInfo = this.getVersionInfo()
    
    const content = `应用版本：v${versionInfo.appVersion}
小程序版本：${versionInfo.miniProgramVersion}
基础库版本：${versionInfo.baseLibVersion}
微信版本：${versionInfo.wechatVersion}

更新时间：${versionInfo.updateTime}

${VERSION_CONFIG.appName} - 专业的CS2搬砖记账工具
采用FIFO算法精确计算成本和收益`

    wx.showModal({
      title: '📱 版本信息',
      content: content,
      showCancel: false,
      confirmText: '知道了'
    })
  }
}

// 导出版本配置和管理器
module.exports = {
  VERSION_CONFIG,
  VersionManager
}
