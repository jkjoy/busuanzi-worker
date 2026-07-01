# EdgeOne Makers 计数工具 v1 部署说明

这是一个可直接部署到 **EdgeOne Makers** 的轻量计数工具，兼容 busuanzi 的常见 DOM ID。

## 1. 控制台准备

1. 打开 EdgeOne Makers 控制台
2. 创建新项目，或使用现有项目
3. 启用 **KV Storage**
4. 创建 KV Namespace，例如：`counter`
5. 将 KV Namespace 绑定到项目
   - 建议变量名：`my_kv`

## 2. 代码结构

将仓库内容放到 Makers 项目中，至少包含：

```text
edge-functions/
├── index.js
├── count.js
├── busuanzi.pure.mini.js
├── shared.js
└── api/
    └── count.js
```

建议额外保留：

```text
public/demo.html
README.md
DEPLOYMENT.md
```

## 3. 对外访问路径

部署后你会得到：

- `/count.js`
- `/busuanzi.pure.mini.js`
- `/api/count`
- `/demo.html`

## 4. 前端接入

### busuanzi 最大兼容

```html
<script async src="https://busuanzi.loliko.cn/busuanzi.pure.mini.js"></script>

本站总访问量：<span id="busuanzi_value_site_pv">0</span>
本站访客数：<span id="busuanzi_value_site_uv">0</span>
本文访问量：<span id="busuanzi_value_page_pv">0</span>
```

### 自定义 ID

```html
<script async src="https://busuanzi.loliko.cn/count.js"></script>

本站总访问量：<span id="eo_count_site_pv">0</span>
本站访客数：<span id="eo_count_site_uv">0</span>
本文访问量：<span id="eo_count_page_pv">0</span>
```

## 5. 调试建议

- 先在 `public/demo.html` 中验证展示效果
- 检查浏览器控制台是否加载了脚本
- 如果计数不增长，优先检查：
  - KV 是否绑定成功
  - 页面是否能访问 `/api/count`
  - 页面来源是否被浏览器/站点策略拦截

## 6. 重要说明

- KV 是**最终一致性**，适合轻量统计和个人站
- v1 采用 **16 分片计数** 来降低并发冲突
- 适合博客、文档站、个人主页，不适合强一致商业统计
