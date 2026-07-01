# EdgeOne Makers 计数工具 v1

一个类似 busuanzi 的轻量计数服务，适合博客、文档站和个人站点。

## 特性

- 兼容 busuanzi 常见 DOM ID
  - `busuanzi_value_site_pv`
  - `busuanzi_value_site_uv`
  - `busuanzi_value_page_pv`
  - `busuanzi_container_site_pv`
  - `busuanzi_container_site_uv`
  - `busuanzi_container_page_pv`
- 支持自定义 DOM ID
  - `eo_count_site_pv`
  - `eo_count_site_uv`
  - `eo_count_page_pv`
- 使用 Edge Functions
- 使用 KV Storage 存储 PV / UV
- 使用分片计数降低并发冲突
- 支持 JSON 和 JSONP
- 支持 `count.js` 和 `busuanzi.pure.mini.js`

## 目录结构

```text
edgeone-counter/
├── edge-functions/
│   ├── index.js
│   ├── count.js
│   ├── busuanzi.pure.mini.js
│   ├── shared.js
│   └── api/
│       └── count.js
├── test/
│   └── shared.test.js
└── package.json
```

## 部署前准备

1. 在 EdgeOne Makers 控制台启用 KV Storage
2. 创建一个 KV Namespace，例如：`counter`
3. 绑定到项目，变量名建议使用：`my_kv`
4. 将代码推送到 Makers 项目仓库

> KV 是最终一致性存储。对于 busuanzi 类统计足够好，但不适合强一致商业报表。

## 访问地址

部署后你会得到类似这样的地址：

- `https://busuanzi.loliko.cn/count.js`
- `https://busuanzi.loliko.cn/busuanzi.pure.mini.js`
- `https://busuanzi.loliko.cn/api/count`

## 前端接入

### 最兼容 busuanzi 的方式

```html
<script async src="https://counter.example.com/busuanzi.pure.mini.js"></script>

本站总访问量：<span id="busuanzi_value_site_pv">0</span>
本站访客数：<span id="busuanzi_value_site_uv">0</span>
本文访问量：<span id="busuanzi_value_page_pv">0</span>
```

### 自定义 ID

```html
<script async src="https://counter.example.com/count.js"></script>

本站总访问量：<span id="eo_count_site_pv">0</span>
本站访客数：<span id="eo_count_site_uv">0</span>
本文访问量：<span id="eo_count_page_pv">0</span>
```

## API

### `GET /api/count`

参数：

- `site`：站点域名
- `page`：页面 URL
- `vid`：访客 ID（脚本会自动生成）
- `callback`：JSONP 回调名
- `script`：脚本名，默认 `count.js`

返回：

```json
{
  "site_pv": 12345,
  "site_uv": 678,
  "page_pv": 90
}
```

## 计数策略

- `site_pv`：站点总访问次数，使用 16 分片计数
- `site_uv`：基于访客 ID 的粗略 UV
- `page_pv`：单页访问次数，使用 16 分片计数

## 兼容说明

### 支持的 busuanzi 选择器

| 统计项 | busuanzi ID | 自定义 ID |
|---|---|---|
| 站点 PV | `busuanzi_value_site_pv` | `eo_count_site_pv` |
| 站点 UV | `busuanzi_value_site_uv` | `eo_count_site_uv` |
| 页面 PV | `busuanzi_value_page_pv` | `eo_count_page_pv` |
| 站点 PV 容器 | `busuanzi_container_site_pv` | `eo_count_site_pv_container` |
| 站点 UV 容器 | `busuanzi_container_site_uv` | `eo_count_site_uv_container` |
| 页面 PV 容器 | `busuanzi_container_page_pv` | `eo_count_page_pv_container` |

### 访问范围建议

建议只在你自己的站点上加载脚本；`api/count` 会基于页面来源和访客信息做轻量统计。

## 本地测试

```bash
npm test
```

## 下一步可以做的增强

- 页面 PV / UV 分日统计
- 简单后台面板
- 黑名单 / 白名单
- 更完整的 Referer 过滤
