# CS2搬砖记账小程序

<div align="center">

🎮 **专业的CS2游戏道具交易成本管理工具**

[![微信小程序](https://img.shields.io/badge/%E5%BE%AE%E4%BF%A1-%E5%B0%8F%E7%A8%8B%E5%BA%8F-brightgreen)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![云开发](https://img.shields.io/badge/%E4%BA%91%E5%BC%80%E5%8F%91-CloudBase-blue)](https://cloud.tencent.com/product/tcb)
[![FIFO算法](https://img.shields.io/badge/%E7%AE%97%E6%B3%95-FIFO-orange)](https://github.com/MKJS11/CS2-Accounting-miniprogram)

</div>

## 📖 项目介绍

CS2搬砖记账小程序是一款专门为CS2游戏道具交易设计的精确成本管理工具。通过先进的FIFO（先进先出）算法，解决多次充值不同汇率时的成本计算难题，为玩家提供准确的盈亏分析和资金管理功能。

### ✨ 核心特性

- 🎯 **精确成本计算** - 采用FIFO算法，确保多汇率充值的成本计算准确性
- 💰 **智能余额管理** - 实时跟踪美元余额和人民币成本
- 📊 **完整交易记录** - 详细记录充值、购买、出售的全流程
- 📈 **数据统计分析** - 提供收支分析、汇率趋势等统计功能
- 🔒 **数据安全保障** - 基于微信云开发，用户数据隔离存储
- 📱 **原生小程序** - 流畅的用户体验，免安装即用

## 🛠 技术栈

| 技术 | 描述 |
|------|------|
| **前端** | 微信小程序原生开发 |
| **后端** | 微信云开发 (CloudBase) |
| **数据库** | 云数据库 MongoDB |
| **云函数** | Node.js 云函数 |
| **存储** | 云存储 |

## 🚀 功能概览

### 💳 充值管理
- 记录人民币充值金额和对应美元数量
- 自动计算并保存汇率信息
- 支持多次不同汇率的充值记录

### 🛒 购买记录
- 输入道具名称和美元价格
- 基于FIFO算法自动计算人民币成本
- 详细记录每笔购买的汇率构成

### 💼 库存管理
- 展示当前持有的所有道具
- 显示每个道具的成本和当前价值
- 支持道具出售操作

### 📊 统计分析
- 收支统计图表
- 汇率变化趋势
- 盈亏分析报告
- 月度/年度数据汇总

### 📋 交易记录
- 完整的交易历史记录
- 支持按类型筛选（充值/购买/出售）
- 关键词搜索功能
- 记录详情查看

## 🎯 核心算法 - FIFO成本计算

### 问题场景
当玩家进行多次充值，每次汇率不同时：
```
第一次：1000元 → 140美元（汇率7.14）
第二次：1000元 → 135美元（汇率7.41）
购买$200道具时如何准确计算人民币成本？
```

### FIFO解决方案
```javascript
// 先使用最早的充值记录
$140 × 7.14 = ¥999.6  // 使用第一次充值
$60 × 7.41 = ¥444.6   // 使用第二次充值
总成本 = ¥1444.2
```

## 📱 界面预览

### 主要页面
- **首页** - 余额总览和快速操作
- **充值页** - 人民币充值和汇率记录
- **购买页** - 道具购买和成本计算
- **库存页** - 道具管理和价值展示
- **记录页** - 交易历史和详情查看
- **统计页** - 数据分析和图表展示

## 🚀 快速开始

### 环境要求
- 微信开发者工具 >= 1.05.0
- 基础库版本 >= 2.2.3
- 已开通微信云开发服务

### 部署步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/MKJS11/CS2-Accounting-miniprogram.git
   cd CS2-Accounting-miniprogram
   ```

2. **配置小程序**
   - 在微信开发者工具中导入项目
   - 配置你的小程序 AppID
   - 开通云开发服务

3. **创建云环境**
   - 在云开发控制台创建环境
   - 记录环境ID，更新 `app.js` 中的环境配置

4. **部署云函数**
   - 右键点击 `cloudfunctions` 文件夹
   - 选择"上传并部署：云端安装依赖"
   - 等待所有云函数部署完成

5. **初始化数据库**
   - 首次运行时会自动提示初始化
   - 点击确认创建数据库集合

6. **开始使用**
   - 编译并预览小程序
   - 开始记录你的CS2交易！

## 📁 项目结构

```
cs2accounting/
├── cloudfunctions/          # 云函数
│   ├── addRecharge/         # 添加充值记录
│   ├── addPurchase/         # 添加购买记录
│   ├── sellItem/            # 道具出售
│   ├── getBalance/          # 获取余额信息
│   ├── getRecords/          # 获取交易记录
│   └── getStats/            # 获取统计数据
├── pages/                   # 页面文件
│   ├── index/               # 首页
│   ├── recharge/            # 充值页面
│   ├── purchase/            # 购买页面
│   ├── inventory/           # 库存页面
│   ├── records/             # 记录页面
│   └── stats/               # 统计页面
├── utils/                   # 工具函数
├── custom-tab-bar/          # 自定义导航栏
└── images/                  # 图片资源
```

## 🗄 数据库设计

### 主要集合

| 集合名 | 描述 |
|--------|------|
| `recharge_records` | 充值记录表 |
| `purchase_records` | 购买记录表 |
| `sell_records` | 出售记录表 |
| `user_balance` | 用户余额表 |
| `inventory` | 库存表 |

### 数据安全
- 用户数据完全隔离
- 云端加密存储
- 支持数据导出备份

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进项目！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

感谢所有为CS2交易社区做出贡献的玩家和开发者！

## 📞 联系方式

- **GitHub**: [MKJS11](https://github.com/MKJS11)
- **Issues**: [项目问题反馈](https://github.com/MKJS11/CS2-Accounting-miniprogram/issues)

---

<div align="center">

**如果这个项目对你有帮助，请给它一个 ⭐️ Star！**

</div>