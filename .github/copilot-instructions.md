# Copilot Instructions: daily-anime-history

## Project Overview

This is a **Koishi bot plugin** that provides daily scheduled reports with:
- **Historical events** (via external API)
- **Holiday/festival information** (via calendar API)
- **Anime-style visual rendering** (optional HTML-to-image conversion)

Built as a TypeScript library targeting CommonJS/ES2020 with strict type checking.

## Architecture & Key Concepts

### Plugin Structure
- **Entry point**: `src/index.ts` exports a single `apply(ctx, config)` function
- **Service injection**: Explicitly declare dependencies in `inject = ['puppeteer', 'http', 'cron']`
  - `puppeteer`: HTML-to-image rendering
  - `http`: API calls (history, holiday, image data)
  - `cron`: Scheduled task execution
- **Configuration schema**: Uses `Config` interface + `Schema.object()` for validation

### Message Generation Pipeline
1. **Fetch data**: Call external APIs for historical events and holiday info
2. **Format content**: Build text or HTML based on `config.outputMode`
   - `'text'`: Simple formatted string + anime image
   - `'image'`: Rendered HTML card with background blur, overlay, and styled content
3. **Render & Send**: Use puppeteer for image generation, then broadcast via `ctx.bots[0].sendMessage(groupId, messageContent)`

### Important Patterns

#### Error Handling
- Wrap API calls in try-catch, log errors, return fallback text (e.g., "获取历史数据失败")
- Always null-check puppeteer page elements before screenshot: `if (element) { ... }`

#### Message Formatting
- Use `h[]` array type for mixed content (text + images)
- Image payload: `h.image(buffer, 'image/png')` for binary, `h.image(url)` for URLs

#### Config Structure (See Config schema)
```typescript
{
  scheduleType: 'preset' | 'custom',    // 'preset': 简易小时分钟选择, 'custom': Cron表达式
  hour: 8,                              // 当 scheduleType='preset' 时生效 (0-23)
  minute: 0,                            // 当 scheduleType='preset' 时生效 (0-59)
  cron: '0 0 8 * * *',                 // 当 scheduleType='custom' 时生效
  targetGroups: ['group_id_1', ...],    // Group IDs to broadcast to
  outputMode: 'image' | 'text',         // Render style
  apiUrl: { history, holiday, image },  // API endpoints
  imageStyle: { width, height, overlayOpacity, blur } // HTML style params
}
```

**定时配置说明：**
- `scheduleType='preset'`: 用户只需设置 `hour` 和 `minute`，插件自动生成 Cron 表达式 `0 minute hour * * *`
- `scheduleType='custom'`: 用户可直接输入完整 Cron 表达式进行高级定时（如特定日期、周几等）

## Build & Development

```powershell
npm run build      # TypeScript → CommonJS (outputs to lib/)
npm run prepublishOnly # Build before package publish
```

- **TypeScript config** (`tsconfig.json`): Strict mode enabled, ES2020 target
- **Output**: CommonJS in `lib/` with declaration files (`.d.ts`)

## Common Tasks

### Adding a New API Data Source
1. Add URL to `config.apiUrl` (extend Config interface)
2. Call `ctx.http.get()` in `runTask`, wrap in try-catch
3. Parse response and append to `historyText` or similar variable

### Modifying Image Style
- Update `config.imageStyle` schema (width, height, overlayOpacity, blur)
- Adjust CSS template strings in HTML generation section
- Puppeteer will re-render with new dimensions automatically

### Testing Scheduled Execution
- Use the `daily_check` command (defined at end of `apply()`) to manually trigger `runTask()`
- Check logger output: `new Logger('daily-history')`

## Key Dependencies

- **koishi ^4.18.0**: Bot framework (peer dependency)
- **koishi-plugin-cron ^3.0.0**: Cron scheduling service
- **koishi-plugin-puppeteer ^3.9.0**: HTML rendering service
