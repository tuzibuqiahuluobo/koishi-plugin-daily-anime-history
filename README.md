# koishi-plugin-daily-anime-history

[![npm](https://img.shields.io/npm/v/koishi-plugin-daily-anime-history)](https://www.npmjs.com/package/koishi-plugin-daily-anime-history)
[![license](https://img.shields.io/github/license/tuzibuqiahuluobo/koishi-plugin-daily-anime-history)](LICENSE)

一个为 Koishi 机器人框架设计的插件，提供**每日历史事件**、**节假日信息**和**二次元背景图**的定时推送功能。支持多种输出模式和灵活的时间调度配置。

## 功能特性

- 📅 **历史上的今天** - 从 API 获取今日历史重要事件
- 🎉 **节假日信息** - 显示当日是否为节假日、休息日等信息
- 🎨 **二次元背景** - 集成美观的动漫风格背景图片
- 📸 **多种输出模式**
  - `image` 模式：生成带样式的 HTML 卡片截图（Puppeteer 渲染）
  - `text` 模式：纯文本输出
  - `url` 模式：文本 + 图片 URL（当图片无法发送时用此模式）
- ⏰ **灵活的定时配置**
  - 预设模式：简单的小时/分钟选择
  - 自定义模式：完整 Cron 表达式支持
- 🎛️ **丰富的样式配置**
  - 自定义图片宽高
  - 调整文字背景透明度
  - 模糊半径控制
  - JPEG 压缩质量（0-95）
  - 背景图位置调整

## 安装

```bash
npm install koishi-plugin-daily-anime-history
```

或在 Koishi 插件市场中搜索 `daily-anime-history` 安装。

## 配置

### 基本配置

```yaml
plugins:
  daily-anime-history:
    # 定时方式：preset（预设）或 custom（自定义）
    scheduleType: preset
    
    # 推送小时（0-23）
    hour: 8
    
    # 推送分钟（0-59）
    minute: 0
    
    # 自定义 Cron 表达式（当 scheduleType=custom 时生效）
    # cron: '0 0 8 * * *'  # 每天 8:00 推送
    
    # 推送的目标群组 ID
    targetGroups:
      - '群组ID1'
      - '群组ID2'
    
    # 输出模式：image | text | url
    outputMode: image
    
    # 是否压缩背景图片
    compressBackground: true
    
    # API 地址配置
    apiUrl:
      history: https://v2.xxapi.cn/api/history
      holiday: https://gcore.jsdelivr.net/gh/cg-zhou/holiday-calendar@main/data/CN/{year}.json
      image: https://t.alcy.cc/
    
    # 图片样式配置
    imageStyle:
      width: 600                  # 图片宽度（px）
      height: 800                 # 图片高度（px）
      overlayOpacity: 0.7         # 文字背景板透明度（0-1）
      blur: 2                     # 背景模糊半径（px）
      quality: 70                 # JPEG 压缩质量（0-95）
      backgroundPosition: center  # 背景位置（center/top/bottom/left/right）
```

### 定时配置说明

#### 预设模式（scheduleType: preset）
最简单的配置方式，只需设置 `hour` 和 `minute`：
```yaml
scheduleType: preset
hour: 8          # 每天 8 点
minute: 30       # 30 分
```
插件会自动生成 Cron 表达式：`0 30 8 * * *`

#### 自定义模式（scheduleType: custom）
使用完整 Cron 表达式进行高级定时：
```yaml
scheduleType: custom
# Cron 格式：分 时 日 月 周
cron: '0 0 8 * * *'       # 每天 8:00
cron: '0 0 8 * * 1-5'     # 工作日 8:00
cron: '0 0 8 1 * *'       # 每月1号 8:00
cron: '0 0 8 * 1 *'       # 每周一 8:00
```

## 使用

### 自动推送
根据配置的时间，插件会自动推送每日报告到指定群组。

### 手动触发
使用以下命令手动触发推送：
```
daily_check
```

## 输出效果

### Image 模式
生成精美的 HTML 卡片截图，包含：
- 紫色渐变背景
- 模糊处理的二次元背景图
- 半透明白色内容卡片
- 格式化的历史事件列表
- 节假日信息显示

### Text 模式
纯文本格式，简洁高效：
```
【12月9日 历史上的今天】
1989: 美国入侵巴拿马
2001: 北约空袭南斯拉夫
2005: 深圳地铁开通

节日信息：今天是平平无奇的一天
```

## API 要求

插件依赖以下服务（可自定义替换）：

| API | 用途 | 返回格式 |
|-----|------|---------|
| history | 历史事件 | 数组或 `{data: []}`、`{list: []}` |
| holiday | 节假日信息 | `{YYYY-MM-DD: {name, isOffDay}}` |
| image | 背景图片 | URL 字符串或对象中的图片链接 |

## 依赖

- `koishi` ^4.18.0 - 机器人框架
- `koishi-plugin-puppeteer` ^3.9.0 - HTML 渲染
- `koishi-plugin-cron` ^3.0.0 - 定时任务
- `sharp` ^0.33.0 - 图片处理

## 文件结构

```
src/
  index.ts          # 插件主文件（448 行）
tsconfig.json       # TypeScript 配置
package.json        # 项目配置
.github/
  copilot-instructions.md  # AI 代理指导文档
```

## 配置详解

### imageStyle 配置

| 参数 | 类型 | 范围 | 说明 |
|------|------|------|------|
| width | number | - | 图片宽度（推荐 600-800px） |
| height | number | - | 图片高度（推荐 800-1000px） |
| overlayOpacity | number | 0-1 | 内容卡片透明度（0=完全透明, 1=完全不透明） |
| blur | number | 0-10+ | 背景模糊强度（单位：像素） |
| quality | number | 0-95 | JPEG 压缩质量（低值 = 小文件但质量差） |
| backgroundPosition | string | - | CSS 背景位置（center/top/bottom/left/right 或百分比） |

### 压缩配置

启用 `compressBackground: true` 时，仅对 API 背景图进行压缩：
- 最大分辨率：1280x720px
- 格式：JPEG（可通过 `quality` 调整）
- 输出：Base64 Data URI
- 减少文件体积同时保持视觉质量

## 常见问题

### Q: 图片无法发送？
A: 尝试以下方案：
1. 启用 `compressBackground: true` 减小文件大小
2. 降低 `quality` 值（如 50-60）
3. 缩小 `width` 和 `height`
4. 改用 `text` 或 `url` 模式

### Q: 如何更换 API？
A: 修改 `apiUrl` 配置中的对应 URL，确保返回格式兼容即可。

### Q: 支持多个群组推送吗？
A: 支持，`targetGroups` 接收数组，可配置多个群组 ID。

### Q: 如何自定义背景位置？
A: 使用 CSS `background-position` 值，如：
- `"50% 30%"` - 自定义位置
- `"center top"` - 上方居中
- `"right bottom"` - 右下角

## 版本历史

### v2.1.2
- 添加背景图位置配置 `backgroundPosition`

### v2.1.1
- 扩大 JPEG 质量范围至 0-95，允许最小化压缩

### v2.1.0
- 修复背景图片压缩功能
- 优化图片传输

### v2.0.3
- 发布到 npm 市场
- 完善 Koishi 元数据

## 致谢

- 感谢 [Koishi](https://koishi.js.org/) 提供的强大框架
- 感谢各 API 服务提供商

## 许可证

MIT

## 作者

tuzibuqiahuluobo

---

如有问题或建议，欢迎提交 [Issue](https://github.com/tuzibuqiahuluobo/koishi-plugin-daily-anime-history/issues) 或 [Pull Request](https://github.com/tuzibuqiahuluobo/koishi-plugin-daily-anime-history/pulls)。
