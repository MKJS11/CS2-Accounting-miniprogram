// user.js
const app = getApp()

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    canIUseNicknameComp: false,
    openid: '',
    stats: {
      totalPurchases: 0
    },
    versionInfo: {
      appVersion: '0.0.1',
      appName: 'CS2记账助手'
    }
  },

  onLoad() {
    // 检查微信版本，判断可以使用哪种登录方式
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
    
    // 检查是否支持头像昵称填写能力（基础库 2.21.2）
    if (wx.canIUse('input.type.nickname')) {
      this.setData({
        canIUseNicknameComp: true
      })
    }
    
    // 加载版本信息
    this.loadVersionInfo()
    
    // 检查是否已登录
    const isLoggedIn = app.globalData.hasLogin && app.globalData.userInfo && app.globalData.openid
    
    if (isLoggedIn) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true,
        openid: app.globalData.openid
      })
      this.loadUserStats()
    } else {
      // 自动获取openid（不需要用户授权）
      this.getOpenId()
    }
  },

  onShow() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 4
      })
    }
    
    // 每次显示页面时检查登录状态
    const isLoggedIn = app.globalData.hasLogin && app.globalData.userInfo && app.globalData.openid
    
    if (isLoggedIn && !this.data.hasUserInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true,
        openid: app.globalData.openid
      })
      this.loadUserStats()
    }
  },

  // 使用微信头像昵称填写能力（推荐）
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    const userInfo = this.data.userInfo || {}
    userInfo.avatarUrl = avatarUrl
    this.setData({
      userInfo,
      hasUserInfo: false
    })
  },

  // 获取昵称
  onNicknameInput(e) {
    const { value } = e.detail
    const userInfo = this.data.userInfo || {}
    userInfo.nickName = value
    this.setData({
      userInfo
    })
  },

  // 确认登录（新版本）
  confirmLogin() {
    const { userInfo } = this.data
    if (!userInfo || !userInfo.nickName || !userInfo.avatarUrl) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '登录中...'
    })

    // 首先获取OpenID
    this.getOpenId(() => {
      // OpenID获取成功后，保存用户信息
      app.globalData.userInfo = userInfo
      app.globalData.hasLogin = true
      
      // 保存到本地存储
      wx.setStorageSync('userInfo', userInfo)
      
      this.setData({
        hasUserInfo: true
      })
      
      // 调用云函数保存用户信息
      this.saveUserToCloud(userInfo)
      
      // 加载用户统计
      this.loadUserStats()
      
      wx.hideLoading()
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })
    })
  },

  // 使用getUserProfile获取用户信息（兼容旧版本）
  getUserProfile() {
    if (this.data.canIUseGetUserProfile) {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          wx.showLoading({
            title: '登录中...'
          })
          
          // 首先获取OpenID
          this.getOpenId(() => {
            // 保存用户信息到全局
            app.globalData.userInfo = res.userInfo
            app.globalData.hasLogin = true
            
            this.setData({
              userInfo: res.userInfo,
              hasUserInfo: true
            })
            
            // 保存到本地存储
            wx.setStorageSync('userInfo', res.userInfo)
            
            // 调用云函数保存用户信息
            this.saveUserToCloud(res.userInfo)
            
            // 加载用户统计
            this.loadUserStats()
            
            wx.hideLoading()
            wx.showToast({
              title: '登录成功',
              icon: 'success'
            })
          })
        },
        fail: () => {
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          })
        }
      })
    } else {
      // 如果不支持getUserProfile，使用头像昵称填写
      wx.showToast({
        title: '请使用上方表单登录',
        icon: 'none'
      })
    }
  },

  // 获取OpenID（静默获取，不需要用户授权）
  getOpenId(callback) {
    // 调用云函数获取openid（云函数会自动获取用户的OpenID）
    wx.cloud.callFunction({
      name: 'getUserInfo',
      success: res => {
        if (res.result && res.result.openid) {
          app.globalData.openid = res.result.openid
          this.setData({
            openid: res.result.openid
          })
          wx.setStorageSync('openid', res.result.openid)
          callback && callback()
        } else {
          console.error('获取openid失败: 返回结果无效', res)
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        console.error('获取openid失败:', err)
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
      }
    })
  },

  // 保存用户信息到云数据库
  saveUserToCloud(userInfo) {
    wx.cloud.callFunction({
      name: 'saveUserInfo',
      data: {
        userInfo: userInfo
      },
      success: res => {
        console.log('用户信息保存成功')
      },
      fail: err => {
        console.error('保存用户信息失败:', err)
      }
    })
  },

  // 加载用户统计数据
  loadUserStats() {
    wx.cloud.callFunction({
      name: 'getUserStats',
      success: res => {
        if (res.result.success) {
          this.setData({
            stats: res.result.stats
          })
        }
      },
      fail: err => {
        console.error('获取统计数据失败:', err)
      }
    })
  },

  // 加载版本信息
  loadVersionInfo() {
    const versionManager = app.getVersionManager()
    if (versionManager) {
      const versionInfo = versionManager.getVersionInfo()
      this.setData({
        versionInfo: versionInfo
      })
    }
  },



  // 导出数据
  exportData() {
    wx.showModal({
      title: '导出数据',
      content: '确定要导出所有交易记录吗？导出的CSV数据将复制到剪贴板',
      success: (res) => {
        if (res.confirm) {
          this.startExportProcess()
        }
      }
    })
  },

  // 开始导出流程
  startExportProcess(batchSize = 0, batchIndex = 0) {
    wx.showLoading({
      title: batchSize > 0 ? `导出批次 ${batchIndex + 1}...` : '检查数据量...',
    })
    
    // 调用云函数导出数据
    wx.cloud.callFunction({
      name: 'exportData',
      data: {
        batchSize: batchSize,
        batchIndex: batchIndex
      },
      success: res => {
        wx.hideLoading()
        if (res.result.success) {
          // 检查是否需要分批处理
          if (res.result.needBatch) {
            this.handleBatchExport(res.result)
          } else {
            this.handleSingleExport(res.result.data)
          }
        } else {
          wx.showToast({
            title: res.result.error || '导出失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error('调用云函数失败:', err)
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        })
      }
    })
  },

  // 处理需要分批的情况
  handleBatchExport(result) {
    const message = `检测到您有 ${result.totalRecords} 条记录，数据量较大。\n\n建议分批导出，每批 ${result.suggestedBatchSize} 条记录，共 ${result.totalBatches} 批。\n\n分批导出可避免剪贴板限制问题。`
    
    wx.showModal({
      title: '数据量较大',
      content: message,
      confirmText: '分批导出',
      cancelText: '强制导出',
      success: (res) => {
        if (res.confirm) {
          // 开始分批导出
          this.startBatchExport(result.suggestedBatchSize, result.totalBatches)
        } else {
          // 强制单次导出
          this.startExportProcess(0, 0)
        }
      }
    })
  },

  // 开始分批导出
  startBatchExport(batchSize, totalBatches) {
    this.setData({
      exportBatchSize: batchSize,
      exportTotalBatches: totalBatches,
      exportCurrentBatch: 0
    })
    
    this.exportNextBatch()
  },

  // 导出下一批
  exportNextBatch() {
    const { exportBatchSize, exportTotalBatches, exportCurrentBatch } = this.data
    
    if (exportCurrentBatch >= exportTotalBatches) {
      wx.showModal({
        title: '分批导出完成',
        content: '所有数据已导出完成！每批数据都已复制到剪贴板，您可以分别粘贴到不同的文件中。',
        showCancel: false,
        confirmText: '确定'
      })
      return
    }

    this.startExportProcess(exportBatchSize, exportCurrentBatch)
  },

  // 处理单次导出
  handleSingleExport(data) {
    console.log('导出数据成功:', data)
    
    // 检查数据大小
    const csvSizeKB = Math.round(data.csvSize / 1024)
    let sizeWarning = ''
    if (data.csvSize > 800 * 1024) {
      sizeWarning = `\n\n⚠️ 数据量较大(${csvSizeKB}KB)，可能会复制失败`
    }
    
    // 将CSV数据复制到剪贴板
    wx.setClipboardData({
      data: data.csv,
      success: () => {
        // 如果是分批导出，显示批次信息
        if (data.isBatched && data.batchInfo) {
          this.handleBatchExportSuccess(data)
        } else {
          this.handleCompleteExportSuccess(data, sizeWarning)
        }
      },
      fail: () => {
        // 剪贴板复制失败，尝试文件预览方案
        this.handleClipboardFallback(data, csvSizeKB)
      }
    })
  },

  // 处理分批导出成功
  handleBatchExportSuccess(data) {
    const batchInfo = data.batchInfo
    const csvSizeKB = Math.round(data.csvSize / 1024)
    
    const message = `第 ${batchInfo.currentBatch}/${batchInfo.totalBatches} 批导出成功！\n\n本批记录数：${batchInfo.currentRecords}\n数据大小：${csvSizeKB}KB\n\nCSV数据已复制到剪贴板`
    
    wx.showModal({
      title: '批次导出成功',
      content: message,
      confirmText: batchInfo.isLastBatch ? '完成' : '下一批',
      cancelText: '停止',
      success: (res) => {
        if (res.confirm && !batchInfo.isLastBatch) {
          // 继续下一批
          this.setData({
            exportCurrentBatch: this.data.exportCurrentBatch + 1
          })
          setTimeout(() => {
            this.exportNextBatch()
          }, 500) // 短暂延迟，让用户有时间处理当前批次
        } else {
          // 完成或停止
          const statusText = batchInfo.isLastBatch ? '全部导出完成！' : '导出已停止'
          wx.showToast({
            title: statusText,
            icon: 'success'
          })
        }
      }
    })
  },

  // 处理完整导出成功
  handleCompleteExportSuccess(data, sizeWarning) {
    const summary = data.summary
    const csvSizeKB = Math.round(data.csvSize / 1024)
    
    const summaryText = `数据导出成功！\n\n数据摘要：\n总记录数：${data.totalRecords}(${csvSizeKB}KB)\n充值记录：${data.rechargeCount}条\n购买记录：${data.purchaseCount}条\n卖出记录：${data.sellCount}条\n\n总充值金额：¥${summary['总充值金额(RMB)']}\n总购买成本：¥${summary['总购买成本(RMB)']}\n总卖出收入：¥${summary['总卖出收入(RMB)']}\n\nCSV数据已复制到剪贴板${sizeWarning}`
    
    wx.showModal({
      title: '导出成功',
      content: summaryText,
      showCancel: false,
      confirmText: '确定'
    })
  },

  // 处理剪贴板复制失败的备用方案
  handleClipboardFallback(data, csvSizeKB) {
    const message = `数据量过大(${csvSizeKB}KB)，超出剪贴板限制。\n\n请选择备用方案：`
    
    wx.showModal({
      title: '复制失败',
      content: message,
      confirmText: '文件预览',
      cancelText: '分批导出',
      success: (res) => {
        if (res.confirm) {
          // 使用文件预览方案
          this.tryFilePreview(data)
        } else {
          // 返回分批导出
          this.exportData()
        }
      }
    })
  },

  // 尝试文件预览方案
  tryFilePreview(data) {
    wx.showLoading({
      title: '生成预览文件...'
    })
    
    // 生成临时文件
    const fs = wx.getFileSystemManager()
    const fileName = `CS记账导出_${new Date().toISOString().slice(0, 10)}.csv`
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
    
    try {
      // 写入CSV数据到临时文件
      fs.writeFileSync(filePath, data.csv, 'utf8')
      
      wx.hideLoading()
      
      // 显示文件信息并尝试预览
      const csvSizeKB = Math.round(data.csvSize / 1024)
      wx.showModal({
        title: '文件已生成',
        content: `CSV文件已生成！\n文件名：${fileName}\n大小：${csvSizeKB}KB\n\n点击"预览"打开文件\n(Android用户可在预览界面保存)`,
        confirmText: '预览',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 尝试打开文档预览
            wx.openDocument({
              filePath: filePath,
              fileType: 'csv',
              success: () => {
                console.log('文件预览成功')
                wx.showToast({
                  title: 'Android用户可点击"..."保存',
                  icon: 'none',
                  duration: 3000
                })
              },
              fail: (err) => {
                console.error('文件预览失败:', err)
                // 预览失败，提供其他选项
                this.handlePreviewFailed(filePath, fileName, data)
              }
            })
          }
        }
      })
    } catch (err) {
      wx.hideLoading()
      console.error('文件生成失败:', err)
      wx.showModal({
        title: '文件生成失败',
        content: '无法生成临时文件，请尝试分批导出。',
        showCancel: false,
        confirmText: '重新导出',
        success: () => {
          this.exportData()
        }
      })
    }
  },

  // 处理预览失败的情况
  handlePreviewFailed(filePath, fileName, data) {
    wx.showModal({
      title: '预览失败',
      content: `无法预览CSV文件。\n\n备用方案：\n1. 分批导出数据\n2. 获取文件路径手动处理`,
      confirmText: '分批导出',
      cancelText: '查看路径',
      success: (res) => {
        if (res.confirm) {
          // 分批导出
          this.exportData()
        } else {
          // 显示文件路径
          wx.showModal({
            title: '文件路径',
            content: `文件已保存至：\n${filePath}\n\n文件名：${fileName}\n\n您可以尝试通过文件管理器访问`,
            showCancel: false,
            confirmText: '复制路径',
            success: () => {
              wx.setClipboardData({
                data: filePath,
                success: () => {
                  wx.showToast({
                    title: '路径已复制',
                    icon: 'success'
                  })
                }
              })
            }
          })
        }
      }
    })
  },

  // 清空数据
  clearData() {
    wx.showModal({
      title: '警告',
      content: '确定要清空所有数据吗？此操作不可恢复！',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '二次确认',
            content: '真的要清空所有数据吗？',
            confirmColor: '#ef4444',
            success: (res2) => {
              if (res2.confirm) {
                wx.showLoading({
                  title: '清空中...',
                })
                
                // 调用云函数清空数据
                wx.cloud.callFunction({
                  name: 'clearUserData',
                  success: res => {
                    wx.hideLoading()
                    if (res.result.success) {
                      wx.showToast({
                        title: '清空成功',
                        icon: 'success'
                      })
                      this.loadUserStats()
                    }
                  },
                  fail: err => {
                    wx.hideLoading()
                    wx.showToast({
                      title: '清空失败',
                      icon: 'none'
                    })
                  }
                })
              }
            }
          })
        }
      }
    })
  },

  // 检查更新
  checkUpdate() {
    const versionManager = app.getVersionManager()
    if (versionManager) {
      versionManager.manualCheckUpdate()
    } else {
      wx.showToast({
        title: '版本检查功能不可用',
        icon: 'none'
      })
    }
  },

  // 显示版本信息
  showVersionInfo() {
    const versionManager = app.getVersionManager()
    if (versionManager) {
      versionManager.showVersionInfo()
    } else {
      // 后备显示方案
      const { versionInfo } = this.data
      wx.showModal({
        title: '📱 版本信息',
        content: `应用版本：v${versionInfo.appVersion}\n\n${versionInfo.appName} - 专业的CS2搬砖记账工具\n采用FIFO算法精确计算成本和收益`,
        showCancel: false,
        confirmText: '知道了'
      })
    }
  },

  // 关于我们
  aboutUs() {
    this.showVersionInfo()
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除全局数据
          app.globalData.userInfo = null
          app.globalData.openid = null
          app.globalData.hasLogin = false
          
          // 清除本地存储
          wx.removeStorageSync('userInfo')
          wx.removeStorageSync('openid')
          
          // 更新页面状态
          this.setData({
            userInfo: null,
            hasUserInfo: false,
            openid: '',
            stats: {
              totalPurchases: 0
            }
          })
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
        }
      }
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'CS2记账 - 专业的CS2道具交易记账工具',
      path: '/pages/index/index',
      imageUrl: ''
    }
  }
})