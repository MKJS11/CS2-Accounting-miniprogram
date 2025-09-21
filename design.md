# CS2搬砖记账小程序设计文档

## 项目概述

技术栈：微信小程序 + 云开发
云环境ID：cloud1-0gwn1jxkbe170719
主要功能：CS2游戏道具交易的精确成本核算和记账管理

## 核心需求

1. 提供准确的余额成本计算
2. 记录充值和购买的完整流程
3. 解决多次充值汇率不同的成本计算问题
4. 采用FIFO（先进先出）算法确保成本准确性

## 数据库设计

### 1. 充值记录表 (recharge_records)

```json
{
  _id: ObjectId,
  user_id: String,           // 用户ID
  recharge_time: Date,       // 充值时间
  rmb_amount: Number,        // 人民币金额
  usd_amount: Number,        // 美元金额  
  exchange_rate: Number,     // 汇率 (rmb/usd)
  remaining_usd: Number,     // 剩余美元
  create_time: Date          // 创建时间
}
```

### 2. 购买记录表 (purchase_records)

```json
{
  _id: ObjectId,
  user_id: String,           // 用户ID
  item_name: String,         // 物品名称
  usd_price: Number,         // 美元价格
  rmb_cost: Number,          // 人民币成本
  purchase_time: Date,       // 购买时间
  recharge_details: [{       // 使用的充值记录详情
    recharge_id: ObjectId,   // 充值记录ID
    used_usd: Number,        // 使用的美元数量
    exchange_rate: Number    // 该笔充值的汇率
  }],
  create_time: Date          // 创建时间
}
```

### 3. 用户余额表 (user_balance)

```json
{
  _id: ObjectId,
  user_id: String,           // 用户ID
  total_usd_balance: Number, // 总美元余额
  total_rmb_cost: Number,    // 总人民币成本
  avg_exchange_rate: Number, // 平均汇率
  update_time: Date          // 更新时间
}
```

## 核心算法：FIFO汇率计算

### 问题场景
用户多次充值，每次汇率不同：
- 第一次：1000元 → 140美元（汇率7.14）
- 第二次：1000元 → 135美元（汇率7.41）
- 购买$200物品时如何计算准确的人民币成本？

### 解决方案：FIFO算法

```javascript
// 购买物品时的成本计算函数
async function calculatePurchaseCost(userId, usdPrice) {
  // 1. 获取用户所有有余额的充值记录（按时间排序）
  const recharges = await db.collection('recharge_records')
    .where({
      user_id: userId,
      remaining_usd: db.command.gt(0)
    })
    .orderBy('recharge_time', 'asc')
    .get();

  let remainingToPay = usdPrice;
  let totalRmbCost = 0;
  const usedRecharges = [];

  // 2. FIFO消耗充值记录
  for (let recharge of recharges.data) {
    if (remainingToPay <= 0) break;
    
    const useAmount = Math.min(remainingToPay, recharge.remaining_usd);
    const rmbCost = useAmount * recharge.exchange_rate;
    
    totalRmbCost += rmbCost;
    remainingToPay -= useAmount;
    
    usedRecharges.push({
      recharge_id: recharge._id,
      used_usd: useAmount,
      exchange_rate: recharge.exchange_rate
    });
    
    // 更新充值记录余额
    await db.collection('recharge_records').doc(recharge._id).update({
      data: {
        remaining_usd: recharge.remaining_usd - useAmount
      }
    });
  }

  return {
    total_rmb_cost: totalRmbCost,
    used_recharges: usedRecharges,
    success: remainingToPay <= 0
  };
}
```

### 算法优势
- 确保成本计算的准确性和一致性
- 支持跨多笔充值的购买
- 清晰的资金流向追踪
- 便于后期的盈亏分析

## 页面结构设计

### 1. 首页 (pages/index) - 余额总览
**功能：**
- 显示总美元余额
- 显示总人民币成本
- 显示平均汇率
- 快速操作按钮：充值、购买、查看记录

**关键数据：**
```javascript
data: {
  totalUsdBalance: 0,      // 总美元余额
  totalRmbCost: 0,         // 总人民币成本
  avgExchangeRate: 0,      // 平均汇率
  recentTransactions: []   // 最近交易记录
}
```

### 2. 充值页面 (pages/recharge)
**功能：**
- 输入人民币金额
- 输入对应美元金额
- 自动计算并显示汇率
- 提交充值记录

**表单字段：**
- 人民币金额 (必填)
- 美元金额 (必填)
- 备注 (可选)

### 3. 购买页面 (pages/purchase)
**功能：**
- 输入物品名称
- 输入美元价格
- 实时显示预计人民币成本
- 提交购买记录

**实时计算：**
用户输入美元价格后，立即调用FIFO算法显示预计成本

### 4. 记录页面 (pages/records)
**功能：**
- 充值记录列表（时间倒序）
- 购买记录列表（时间倒序）
- 支持按类型筛选
- 支持关键词搜索

**列表项信息：**
- 充值记录：时间、金额、汇率、余额状态
- 购买记录：时间、物品、价格、成本、盈亏

### 5. 统计页面 (pages/statistics)
**功能：**
- 收支统计图表
- 汇率变化趋势
- 月度/年度汇总
- 盈亏分析报告

## 用户流程图

```
用户启动小程序
    ↓
查看余额总览（首页）
    ↓
选择操作
    ├── 充值 → 填写充值信息 → 提交 → 更新余额
    ├── 购买 → 填写购买信息 → 显示成本 → 确认购买 → FIFO计算 → 更新记录
    └── 查看 → 选择记录类型 → 查看详细信息
```

## 开发计划

### 阶段一：基础功能（优先级：高）
1. **环境配置**
   - 配置微信云开发环境
   - 初始化数据库集合
   - 配置云函数

2. **核心页面开发**
   - 改造首页为余额总览
   - 开发充值功能页面
   - 开发购买功能页面
   - 实现FIFO算法

3. **基础记录功能**
   - 充值记录列表
   - 购买记录列表
   - 基础的查看和删除功能

### 阶段二：完善功能（优先级：中）
4. **记录页面增强**
   - 添加筛选功能
   - 添加搜索功能
   - 记录详情页面

5. **统计分析**
   - 基础统计图表
   - 汇率趋势分析
   - 收支报表

6. **用户体验优化**
   - 界面美化
   - 交互优化
   - 加载状态处理
   - 错误提示完善

### 阶段三：高级功能（优先级：低）
7. **数据管理**
   - 数据导出功能
   - 数据备份
   - 数据清理

8. **扩展功能**
   - 预算管理
   - 价格预警
   - 多账户支持
   - 分享功能

## 技术实现要点

### 1. 云函数设计
```
cloudfunctions/
├── addRecharge/     # 添加充值记录
├── addPurchase/     # 添加购买记录（含FIFO计算）
├── getBalance/      # 获取用户余额信息
├── getRecords/      # 获取交易记录
└── getStatistics/   # 获取统计数据
```

### 2. 数据精度处理
- 金额计算使用4位小数精度
- 避免JavaScript浮点数精度问题
- 统一使用Math.round()处理显示

### 3. 错误处理
- 余额不足提示
- 网络异常处理
- 数据校验
- 用户友好的错误信息

### 4. 性能优化
- 分页加载记录
- 缓存用户余额信息
- 优化数据库查询
- 图片懒加载

## 安全考虑

1. **用户身份验证**
   - 使用微信登录
   - 数据权限隔离

2. **数据校验**
   - 前端输入校验
   - 云函数参数校验
   - 金额范围限制

3. **操作日志**
   - 记录关键操作
   - 异常行为监控

## 测试计划

### 功能测试
- 充值流程测试
- 购买流程测试
- FIFO算法准确性测试
- 数据统计准确性测试

### 边界测试
- 余额不足场景
- 极大金额处理
- 网络异常处理
- 并发操作测试

### 用户体验测试
- 界面响应速度
- 操作流程顺畅性
- 错误提示友好性

## 部署说明

1. 配置小程序AppID
2. 开通云开发服务
3. 创建云环境：cloud1-0gwn1jxkbe170719
4. 上传云函数
5. 初始化数据库集合
6. 配置数据库权限
7. 提交审核发布

---

**文档版本：** v1.0
**创建时间：** 2025-09-01
**更新时间：** 2025-09-01