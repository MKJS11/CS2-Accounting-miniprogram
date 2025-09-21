// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#667eea",
    list: [
      {
        pagePath: "/pages/index/index",
        icon: "🏠",
        text: "首页"
      },
      {
        pagePath: "/pages/records/records",
        icon: "📊",
        text: "记录"
      },
      {
        pagePath: "/pages/inventory/inventory",
        icon: "📦",
        text: "库存"
      },
      {
        pagePath: "/pages/stats/stats",
        icon: "📈",
        text: "统计"
      },
      {
        pagePath: "/pages/user/user",
        icon: "👤",
        text: "我的"
      }
    ]
  },
  attached() {
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      wx.switchTab({
        url
      })
    }
  }
})