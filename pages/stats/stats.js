// pages/stats/stats.js

// 物品种类映射
const ITEM_TYPE_MAP = {
  'weapon': { icon: '🔫', label: '武器' },
  'weapons': { icon: '🔫', label: '武器' },
  'knife': { icon: '🔪', label: '刀具' },
  'knives': { icon: '🔪', label: '刀具' },
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
    isLoading: true,
    trendTimeRange: '6', // 默认显示最近6个月
    pieChartGradient: '', // CSS饼图渐变样式
    chartConfig: {
      yAxisLabels: []
    },
    statsData: {
      totalProfitRmb: '0.00',
      completedProfitRmb: '0.00',
      completedTransactionPairs: 0,
      totalInvestment: '0.00',
      totalIncome: '0.00',
      inventoryCost: '0.00',
      inventoryItemCount: 0,
      profitRate: '0.00',
      categoryStats: [],
      monthlyTrend: []
    },
    pageReady: false,
    canvasSupported: true  // Canvas是否支持
  },

  onLoad(options) {
    console.log('统计页面加载')
    this.loadStatsData()
  },

  onReady() {
    console.log('统计页面渲染完成')
    // 页面初次渲染完成
    this.setData({
      pageReady: true
    })
  },

  onShow() {
    // 设置当前选中的tab
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3 // 统计页面是第4个tab (索引为3)
      })
    }
    
    // 检查是否需要刷新数据
    const app = getApp()
    const needsRefresh = app.getAndResetStatsRefreshFlag()
    
    if (needsRefresh || !this.data.statsData) {
      console.log('统计页面需要刷新数据')
      this.loadStatsData()
    }
  },

  onPullDownRefresh() {
    this.loadStatsData(true)
  },

  // 加载统计数据
  loadStatsData(isRefresh = false) {
    if (!isRefresh) {
      this.setData({ isLoading: true })
    }

    wx.cloud.callFunction({
      name: 'getStats',
      data: {
        trendMonths: parseInt(this.data.trendTimeRange) // 传递月数参数
      },
      success: res => {
        console.log('获取统计数据成功:', res.result)
        wx.stopPullDownRefresh()
        
        if (res.result.success) {
          this.processStatsData(res.result.data)
        } else {
          console.error('获取统计数据失败:', res.result.error)
          wx.showToast({
            title: '获取数据失败',
            icon: 'none'
          })
        }
        
        this.setData({ isLoading: false })
      },
      fail: err => {
        console.error('调用云函数失败:', err)
        wx.stopPullDownRefresh()
        this.setData({ isLoading: false })
        
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        })
      }
    })
  },

  // 处理统计数据
  processStatsData(data) {
    const {
      totalProfitCny = 0,
      completedProfitCny = 0,
      completedCostCny = 0,
      completedTransactionPairs = 0,
      totalInvestment = 0,
      totalIncome = 0,
      inventoryCostCny = 0,
      inventoryItemCount = 0,
      categoryStats = [],
      monthlyTrend = []
    } = data

    console.log('处理统计数据:', {
      totalProfitCny, completedProfitCny, completedCostCny, completedTransactionPairs
    })

    // 计算利润率 - 使用完成交易对的利润和成本
    // 只有完成的交易对才能计算真实的利润率
    let profitRate = 0
    if (completedTransactionPairs > 0 && completedCostCny > 0) {
      // 使用完成交易对的实际成本计算利润率
      profitRate = (completedProfitCny / completedCostCny) * 100
    }

    // 处理分类统计数据
    const processedCategoryStats = this.processCategoryStatsForPieChart(categoryStats)

    // 处理月度趋势数据
    const processedMonthlyTrend = this.processMonthlyTrend(monthlyTrend)

    // 更新页面数据
    this.setData({
      statsData: {
        totalProfitRmb: parseFloat(completedProfitCny).toFixed(2),
        completedProfitRmb: parseFloat(completedProfitCny).toFixed(2),
        completedTransactionPairs: completedTransactionPairs,
        totalInvestment: parseFloat(totalInvestment).toFixed(2),
        totalIncome: parseFloat(totalIncome).toFixed(2),
        inventoryCost: parseFloat(inventoryCostCny).toFixed(2),
        inventoryItemCount: inventoryItemCount,
        profitRate: profitRate.toFixed(2),
        categoryStats: processedCategoryStats,
        monthlyTrend: processedMonthlyTrend
      }
    }, () => {
      // CSS饼图会自动更新，无需手动绘制
    })
  },

  // 处理分类统计数据用于饼图显示
  processCategoryStatsForPieChart(categoryStats) {
    if (!categoryStats || categoryStats.length === 0) {
      return []
    }

    // 计算总金额用于百分比计算
    const totalAmount = categoryStats.reduce((sum, item) => {
      return sum + Math.abs(parseFloat(item.profit || 0))
    }, 0)

    // 预定义颜色数组
    const colors = [
      '#3B82F6', // 蓝色
      '#10B981', // 绿色
      '#F59E0B', // 黄色
      '#EF4444', // 红色
      '#8B5CF6', // 紫色
      '#F97316', // 橙色
      '#06B6D4', // 青色
      '#84CC16', // 柠檬绿
      '#EC4899', // 粉色
      '#6B7280'  // 灰色
    ]

    // 处理每个分类数据
    const processedData = categoryStats.map((item, index) => {
      const typeDisplay = getItemTypeDisplay(item.item_type)
      const profit = parseFloat(item.profit || 0)
      const percentage = totalAmount > 0 ? ((Math.abs(profit) / totalAmount) * 100).toFixed(1) : '0.0'
      
      return {
        ...item,
        icon: typeDisplay.icon,
        name: typeDisplay.label,
        profit: profit.toFixed(2),
        totalPurchase: parseFloat(item.totalPurchase || 0).toFixed(2),
        totalSell: parseFloat(item.totalSell || 0).toFixed(2),
        purchaseCount: item.purchaseCount || 0,
        sellCount: item.sellCount || 0,
        percentage: percentage,
        color: colors[index % colors.length]
      }
    })

    // 按绝对利润值排序，显示更重要的分类
    processedData.sort((a, b) => Math.abs(parseFloat(b.profit)) - Math.abs(parseFloat(a.profit)))

    // 计算CSS饼图的角度
    let currentAngle = 0
    const processedWithAngles = processedData.map(item => {
      const angle = (parseFloat(item.percentage) / 100) * 360
      const startAngle = currentAngle
      currentAngle += angle
      
      return {
        ...item,
        startAngle: startAngle,
        angle: angle
      }
    })

    // 更新饼图的CSS渐变
    this.updatePieChartGradient(processedWithAngles)

    return processedWithAngles
  },

  // 更新饼图CSS渐变
  updatePieChartGradient(data) {
    if (!data || data.length === 0) return

    let gradientStops = []
    let currentAngle = 0

    data.forEach(item => {
      const percentage = parseFloat(item.percentage)
      const angle = (percentage / 100) * 360
      
      gradientStops.push(`${item.color} ${currentAngle}deg ${currentAngle + angle}deg`)
      currentAngle += angle
    })

    // 创建CSS渐变字符串
    const gradientCSS = `conic-gradient(${gradientStops.join(', ')})`
    
    // 将渐变信息存储到data中，供样式使用
    this.setData({
      pieChartGradient: gradientCSS
    })
  },



  // 处理月度趋势数据
  processMonthlyTrend(monthlyData) {
    if (!monthlyData || monthlyData.length === 0) {
      this.setData({ chartConfig: { yAxisLabels: [] } })
      return []
    }

    // 计算数值范围
    const profits = monthlyData.map(item => parseFloat(item.profit || 0))
    const maxProfit = Math.max(...profits, 0)
    const minProfit = Math.min(...profits, 0)
    const range = maxProfit - minProfit
    
    // 生成Y轴刻度标签
    const yAxisLabels = this.generateYAxisLabels(minProfit, maxProfit)
    
    // 计算柱子高度
    const processedData = monthlyData.map(item => {
      const profit = parseFloat(item.profit || 0)
      let barHeight = 0
      
      if (range > 0) {
        // 将数值映射到0-100%的高度
        if (profit >= 0) {
          barHeight = (profit / maxProfit) * 50 // 正值占上半部分
        } else {
          barHeight = (Math.abs(profit) / Math.abs(minProfit)) * 50 // 负值占下半部分
        }
      }
      
      return {
        ...item,
        monthName: this.formatMonth(item.month),
        profit: profit.toFixed(2),
        barHeight: Math.max(barHeight, profit === 0 ? 0 : 5) // 非零值最小高度5%
      }
    })

    // 更新图表配置
    this.setData({ 
      chartConfig: { 
        yAxisLabels: yAxisLabels 
      } 
    })
    
    return processedData
  },

  // 生成Y轴刻度标签
  generateYAxisLabels(minValue, maxValue) {
    const labels = []
    const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue))
    
    if (absMax === 0) {
      return ['0']
    }
    
    // 计算合适的刻度间隔
    const step = this.calculateStep(absMax)
    
    // 生成刻度（从大到小）
    if (maxValue > 0) {
      for (let i = Math.ceil(maxValue / step); i >= 0; i--) {
        labels.push(this.formatAxisLabel(i * step))
      }
    }
    
    if (minValue < 0) {
      for (let i = 1; i <= Math.ceil(Math.abs(minValue) / step); i++) {
        labels.push(this.formatAxisLabel(-i * step))
      }
    }
    
    return labels
  },

  // 计算刻度步长
  calculateStep(maxValue) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)))
    const normalized = maxValue / magnitude
    
    if (normalized <= 1) return magnitude * 0.2
    if (normalized <= 2) return magnitude * 0.5
    if (normalized <= 5) return magnitude
    return magnitude * 2
  },

  // 格式化轴标签
  formatAxisLabel(value) {
    if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'k'
    }
    return value.toFixed(0)
  },

  // 格式化月份显示
  formatMonth(monthStr) {
    if (!monthStr) return ''
    
    try {
      const [year, month] = monthStr.split('-')
      const currentYear = new Date().getFullYear()
      const yearNum = parseInt(year)
      const monthNum = parseInt(month)
      
      // 如果是当前年份，只显示月份
      if (yearNum === currentYear) {
        return `${monthNum}月`
      } else {
        // 非当前年份，显示简化格式
        return `${year.slice(-2)}/${monthNum}`
      }
    } catch (error) {
      return monthStr
    }
  },

  // 格式化时间显示
  formatTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '未知时间'
    }

    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffTime / (1000 * 60))

    if (diffMinutes < 1) {
      return '刚刚'
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`
    } else if (diffHours < 24) {
      return `${diffHours}小时前`
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${year}/${month}/${day}`
    }
  },

  // 时间范围切换
  onTrendTimeRangeChange(e) {
    const range = e.currentTarget.dataset.range
    if (range !== this.data.trendTimeRange) {
      this.setData({ 
        trendTimeRange: range 
      })
      this.loadStatsData() // 重新加载数据
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'CS2记账 - 我的投资收益统计',
      path: '/pages/stats/stats',
      imageUrl: ''
    }
  }
})
