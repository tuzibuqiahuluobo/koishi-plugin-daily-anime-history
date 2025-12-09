"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;
const koishi_1 = require("koishi");
const sharp_1 = __importDefault(require("sharp"));
exports.name = 'daily-anime-history';
exports.inject = ['puppeteer', 'http', 'cron']; // 【修改】显式声明依赖 cron
const logger = new koishi_1.Logger('daily-history');
exports.Config = koishi_1.Schema.object({
    scheduleType: koishi_1.Schema.union([
        koishi_1.Schema.const('preset').description('简易时间选择'),
        koishi_1.Schema.const('custom').description('自定义 Cron 表达式'),
    ]).default('preset').description('定时方式'),
    hour: koishi_1.Schema.number().min(0).max(23).default(8).description('推送小时 (0-23)'),
    minute: koishi_1.Schema.number().min(0).max(59).default(0).description('推送分钟 (0-59)'),
    cron: koishi_1.Schema.string().default('0 0 8 * * *').description('Cron 表达式 (分 时 日 月 周)'),
    targetGroups: koishi_1.Schema.array(String).description('推送的目标群组 ID'),
    outputMode: koishi_1.Schema.union([
        koishi_1.Schema.const('image').description('图片模式 (二次元背景+排版)'),
        koishi_1.Schema.const('text').description('纯文本模式'),
        koishi_1.Schema.const('url').description('文本+图片URL模式 (当图片无法发送时用此模式)'),
    ]).default('image').description('消息输出模式'),
    compressBackground: koishi_1.Schema.boolean().default(true).description('是否压缩背景图片（降低质量但可加快加载）'),
    apiUrl: koishi_1.Schema.object({
        history: koishi_1.Schema.string().default('https://v2.xxapi.cn/api/history').description('历史上的今天 API'),
        holiday: koishi_1.Schema.string().default('https://gcore.jsdelivr.net/gh/cg-zhou/holiday-calendar@main/data/CN/{year}.json').description('节假日 API'),
        image: koishi_1.Schema.string().default('https://t.alcy.cc/').description('二次元图片 API'),
    }).description('API 地址配置'),
    imageStyle: koishi_1.Schema.object({
        width: koishi_1.Schema.number().default(600).description('图片宽度'),
        height: koishi_1.Schema.number().default(800).description('图片高度'),
        overlayOpacity: koishi_1.Schema.number().min(0).max(1).step(0.1).default(0.7).description('文字背景板透明度'),
        blur: koishi_1.Schema.number().default(2).description('背景模糊半径'),
        quality: koishi_1.Schema.number().min(0).max(95).step(1).default(70).description('JPEG 压缩质量 (0-95，0为最小质量，体积最小)'),
        backgroundPosition: koishi_1.Schema.string().default('center').description('背景图位置 (center/top/bottom/left/right 或自定义 "50% 50%")'),
    }).description('图片生成样式设置'),
});
function apply(ctx, config) {
    // 生成最终的 Cron 表达式
    let finalCron;
    if (config.scheduleType === 'preset') {
        // 格式: 分 时 日 月 周
        finalCron = `0 ${config.minute} ${config.hour} * * *`;
    }
    else {
        finalCron = config.cron;
    }
    // 背景图片压缩函数（只用于 API 获取的背景图片 URL）
    const compressBackgroundImage = async (imageUrl) => {
        try {
            logger.info(`开始压缩背景图片: ${imageUrl}`);
            // 获取图片数据
            const response = await ctx.http.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response);
            logger.info(`原始背景图大小: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
            // 使用 sharp 压缩图片为 JPEG 格式
            const compressed = await (0, sharp_1.default)(buffer)
                .resize(1280, 720, { withoutEnlargement: true }) // 限制最大尺寸
                .toFormat('jpeg', { quality: config.imageStyle.quality, progressive: true })
                .toBuffer();
            const compressedSize = compressed.length;
            const ratio = ((1 - compressedSize / buffer.length) * 100).toFixed(2);
            logger.info(`背景图压缩: ${(compressedSize / 1024 / 1024).toFixed(2)}MB (压缩率: ${ratio}%)`);
            // 转换为 data URI 返回
            return `data:image/jpeg;base64,${compressed.toString('base64')}`;
        }
        catch (e) {
            logger.warn(`背景图片压缩失败，使用原始 URL`, e);
            return imageUrl; // 失败时返回原始 URL
        }
    };
    const runTask = async () => {
        if (!config.targetGroups || config.targetGroups.length === 0) {
            logger.warn('未配置推送群组，跳过任务。');
            return;
        }
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const date = today.getDate();
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${date.toString().padStart(2, '0')}`;
        // 检查配置的图片尺寸，如果太大则降低
        let finalWidth = config.imageStyle.width;
        let finalHeight = config.imageStyle.height;
        if (finalWidth > 800) {
            logger.warn(`图片宽度 ${finalWidth} 超过建议值，降低到 800`);
            finalWidth = 800;
        }
        if (finalHeight > 1000) {
            logger.warn(`图片高度 ${finalHeight} 超过建议值，降低到 1000`);
            finalHeight = 1000;
        }
        try {
            // 1. 获取数据
            let historyText = '';
            let backgroundUrl = '';
            try {
                const historyRes = await ctx.http.get(config.apiUrl.history);
                let events = [];
                // 兼容多种 API 返回格式
                if (Array.isArray(historyRes)) {
                    events = historyRes;
                }
                else if (historyRes.data && Array.isArray(historyRes.data)) {
                    events = historyRes.data;
                }
                else if (historyRes.list && Array.isArray(historyRes.list)) {
                    events = historyRes.list;
                }
                if (events.length > 0) {
                    historyText = events
                        .slice(0, 5)
                        .filter(e => e && (e.year || e.title))
                        .map((e) => `${e.year || '年份未知'}: ${e.title || e.name || '事件未知'}`)
                        .join('\n');
                }
                if (!historyText) {
                    historyText = "今日暂无历史大事件数据。";
                }
            }
            catch (e) {
                logger.error('获取历史数据失败', e);
                historyText = "获取历史数据失败，请稍后重试。";
            }
            // 获取背景图片
            try {
                const imageRes = await ctx.http.get(config.apiUrl.image);
                // 兼容多种返回格式
                if (typeof imageRes === 'string') {
                    backgroundUrl = imageRes;
                }
                else if (imageRes.url) {
                    backgroundUrl = imageRes.url;
                }
                else if (imageRes.data) {
                    backgroundUrl = imageRes.data;
                }
                else if (imageRes.pic) {
                    backgroundUrl = imageRes.pic;
                }
                else if (imageRes.image) {
                    backgroundUrl = imageRes.image;
                }
                else {
                    // 如果是对象，尝试找图片链接
                    for (const key of Object.keys(imageRes)) {
                        if (typeof imageRes[key] === 'string' &&
                            (imageRes[key].startsWith('http') || imageRes[key].includes('.'))) {
                            backgroundUrl = imageRes[key];
                            break;
                        }
                    }
                }
                if (!backgroundUrl) {
                    backgroundUrl = config.apiUrl.image;
                }
                // 【新增】如果背景图是 HTTP URL，且启用了压缩，则进行压缩
                if (config.compressBackground && backgroundUrl.startsWith('http')) {
                    logger.info(`压缩背景图片...`);
                    backgroundUrl = await compressBackgroundImage(backgroundUrl);
                }
            }
            catch (e) {
                logger.warn('获取背景图片失败，使用默认配置', e);
                backgroundUrl = config.apiUrl.image;
            }
            let holidayText = '今天是平平无奇的一天';
            try {
                const holidayUrl = config.apiUrl.holiday.replace('{year}', year.toString());
                const holidayRes = await ctx.http.get(holidayUrl);
                // 多种方式尝试获取当天节假日数据
                let todayHoliday = null;
                if (holidayRes[dateStr]) {
                    todayHoliday = holidayRes[dateStr];
                }
                else if (holidayRes.data && holidayRes.data[dateStr]) {
                    todayHoliday = holidayRes.data[dateStr];
                }
                if (todayHoliday && todayHoliday.name) {
                    const status = todayHoliday.isOffDay ? '🎉 休息日' : '💼 工作日';
                    holidayText = `${todayHoliday.name} ${status}`;
                }
                else {
                    const dayOfWeek = today.getDay();
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        holidayText = "📅 周末，好好休息！";
                    }
                    else {
                        holidayText = "💪 工作日，加油打工人！";
                    }
                }
            }
            catch (e) {
                logger.error('获取节假日数据失败', e);
            }
            // 2. 生成消息
            // 【修改】统一使用 h[] 类型，方便处理图片和文本
            let messageContent = [];
            if (config.outputMode === 'text') {
                const text = [
                    `📅 ${dateStr} 日报`,
                    `${'─'.repeat(30)}`,
                    `【节假日】`,
                    holidayText,
                    ``,
                    `【历史上的今天】`,
                    historyText || '暂无数据',
                ].join('\n');
                messageContent = [text, koishi_1.h.image(config.apiUrl.image)];
            }
            else {
                // 解析历史事件用于 HTML 渲染
                const historyItems = historyText
                    .split('\n')
                    .filter(line => line.trim().length > 0)
                    .map(line => {
                    const match = line.match(/^([^:：]+)[:：]\s*(.+)$/);
                    if (match) {
                        return { year: match[1].trim(), title: match[2].trim() };
                    }
                    return { year: '年份', title: line };
                });
                const historyHtml = historyItems
                    .map(item => `
                    <div class="history-item">
                        <span class="year">${item.year}</span>
                        <span class="title">${item.title}</span>
                    </div>`)
                    .join('');
                const html = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&display=swap');
            body { 
              width: ${finalWidth}px; 
              min-height: ${finalHeight}px; 
              font-family: 'Noto Sans SC', sans-serif; 
              color: #333; 
              position: relative; 
              overflow: hidden;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .background { 
              position: absolute; 
              top: 0; 
              left: 0; 
              right: 0; 
              bottom: 0; 
              background-image: url('${backgroundUrl}'); 
              background-size: cover; 
              background-position: ${config.imageStyle.backgroundPosition}; 
              background-repeat: no-repeat;
              filter: blur(${config.imageStyle.blur}px) brightness(0.7);
              z-index: 0;
            }
            .container { 
              position: relative; 
              padding: 40px 30px; 
              display: flex; 
              flex-direction: column; 
              justify-content: center; 
              min-height: ${config.imageStyle.height}px; 
              z-index: 1;
            }
            .card { 
              background: rgba(255, 255, 255, ${config.imageStyle.overlayOpacity}); 
              backdrop-filter: blur(10px); 
              border-radius: 20px; 
              padding: 35px; 
              box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
              border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .header { 
              text-align: center; 
              border-bottom: 3px solid #667eea; 
              padding-bottom: 20px; 
              margin-bottom: 25px; 
            }
            .date { 
              font-size: 42px; 
              font-weight: 900; 
              color: #2c3e50; 
              letter-spacing: 2px;
            }
            .holiday { 
              font-size: 22px; 
              color: #d40c3ac4; 
              margin-top: 15px; 
              font-weight: 700;
            }
            .section-title { 
              font-size: 20px; 
              font-weight: 700; 
              color: #0066ffc6; 
              margin-bottom: 15px; 
              border-left: 5px solid #31ebaaff; 
              padding-left: 15px;
            }
            .history-list { 
              max-height: 400px;
              overflow-y: auto;
            }
            .history-item { 
              display: flex; 
              margin-bottom: 12px; 
              padding: 8px;
              border-radius: 8px;
              transition: all 0.3s ease;
            }
            .history-item:hover {
              background-color: rgba(102, 126, 234, 0.1);
              transform: translateX(5px);
            }
            .year { 
              font-weight: 700; 
              min-width: 80px; 
              color: #e600ff96; 
              flex-shrink: 0;
            }
            .title {
              color: #555;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="background"></div>
          <div class="container">
            <div class="card">
              <div class="header">
                <div class="date">${year}年${month}月${date}日</div>
                <div class="holiday">${holidayText}</div>
              </div>
              <div class="content">
                <div class="section-title">📚 历史上的今天</div>
                <div class="history-list">
                  ${historyHtml || '<div class="history-item"><span>暂无历史数据</span></div>'}
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
        `;
                const page = await ctx.puppeteer.page();
                await page.setContent(html);
                await new Promise(r => setTimeout(r, 1000));
                const element = await page.$('body');
                // 【修改】增加空值检查，防止截图失败
                if (element) {
                    const buffer = await element.screenshot({ type: 'png' });
                    logger.info(`截图大小: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
                    messageContent = [koishi_1.h.image(buffer, 'image/png')];
                }
                else {
                    logger.error('无法渲染图片页面');
                    await page.close();
                    return;
                }
                await page.close();
            }
            for (const groupId of config.targetGroups) {
                try {
                    await ctx.bots[0]?.sendMessage(groupId, messageContent);
                    logger.info(`消息已发送到群组: ${groupId}`);
                }
                catch (sendError) {
                    logger.error(`发送消息到 ${groupId} 失败，尝试降级为纯文本模式`, sendError);
                    try {
                        // 降级方案：发送纯文本 + URL
                        const fallbackText = [
                            `📅 ${dateStr} 日报`,
                            `${'─'.repeat(30)}`,
                            `【节假日】`,
                            holidayText,
                            ``,
                            `【历史上的今天】`,
                            historyText || '暂无数据',
                            ``,
                            `⚠️ 图片发送失败，请查看文本信息`
                        ].join('\n');
                        await ctx.bots[0]?.sendMessage(groupId, fallbackText);
                        logger.info(`已发送降级文本消息到: ${groupId}`);
                    }
                    catch (fallbackError) {
                        logger.error(`降级方案也失败了，无法向 ${groupId} 发送消息`, fallbackError);
                    }
                }
            }
            logger.info('推送完成');
        }
        catch (error) {
            logger.error('任务执行出错', error);
        }
    };
    // 【修改】使用生成的最终 Cron 表达式
    ctx.cron(finalCron, runTask);
    logger.info(`已注册定时任务: ${finalCron}`);
    ctx.command('daily_check', '手动触发日报推送')
        .action(async () => {
        await runTask();
        return '手动推送已触发';
    });
}
