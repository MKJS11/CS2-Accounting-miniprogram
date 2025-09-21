// 初始化sell_records集合的数据结构
// 这个文件用于文档说明，实际的集合会在第一次插入数据时自动创建

const sellRecordsSchema = {
  // 集合名称: sell_records
  fields: {
    _id: {
      type: 'string',
      description: '记录ID，自动生成'
    },
    user_id: {
      type: 'string',
      description: '用户OpenID',
      required: true,
      index: true
    },
    purchase_id: {
      type: 'string',
      description: '对应的购买记录ID',
      required: true,
      index: true
    },
    item_name: {
      type: 'string',
      description: '物品名称',
      required: true
    },
    item_type: {
      type: 'string',
      description: '物品类型',
      default: '普通'
    },
    purchase_price: {
      type: 'number',
      description: '购买价格（美元）',
      required: true
    },
    sell_price: {
      type: 'number',
      description: '卖出价格（美元）',
      required: true
    },
    profit: {
      type: 'number',
      description: '利润（美元）',
      required: true
    },
    sell_time: {
      type: 'date',
      description: '卖出时间',
      required: true,
      index: true
    },
    platform: {
      type: 'string',
      description: '卖出平台',
      default: '市场交易'
    },
    condition: {
      type: 'string',
      description: '物品品质',
      default: '普通'
    },
    notes: {
      type: 'string',
      description: '备注',
      default: ''
    },
    create_time: {
      type: 'date',
      description: '记录创建时间',
      required: true
    }
  },
  
  // 索引建议
  indexes: [
    { fields: { user_id: 1 } },
    { fields: { purchase_id: 1 } },
    { fields: { user_id: 1, sell_time: -1 } },
    { fields: { user_id: 1, purchase_id: 1 }, unique: true }
  ]
}

// 数据示例
const sampleSellRecord = {
  user_id: 'user_openid_example',
  purchase_id: 'purchase_record_id',
  item_name: 'AK-47 | 红线',
  item_type: '步枪',
  purchase_price: 35.50,
  sell_price: 42.00,
  profit: 6.50,
  sell_time: new Date(),
  platform: '市场交易',
  condition: '久经沙场',
  notes: '快速出售',
  create_time: new Date()
}

module.exports = {
  schema: sellRecordsSchema,
  sample: sampleSellRecord
}
