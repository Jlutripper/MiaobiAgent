import { AspectRatio, PredefinedTool } from "./types";

export const FONT_FAMILIES = [
    { name: '快乐体', family: "'ZCOOL KuaiLe', cursive" },
    { name: '思源黑体', family: "'Noto Sans SC', sans-serif" },
    { name: '系统默认', family: "sans-serif" },
];

export const DEFAULT_FONT = FONT_FAMILIES[1].family; // Noto Sans SC

interface AspectRatioOption {
    value: AspectRatio;
    label: string;
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
    { value: '1:1', label: '方形 (1:1)' },
    { value: '16:9', label: '宽屏 (16:9)' },
    { value: '9:16', label: '竖屏 (9:16)' },
    { value: '4:3', label: '标准 (4:3)' },
    { value: '3:4', label: '高 (3:4)' },
];

interface PredefinedToolInfo {
    id: PredefinedTool;
    name: string;
    description: string;
}

export const PREDEFINED_TOOLS: PredefinedToolInfo[] = [
    { id: 'poster', name: '海报设计', description: '结合图片和文字，设计一张精美的海报。' },
    { id: 'long_article', name: '长图文生成', description: '根据主题和内容，生成一张适合社交媒体垂直滚动的营销长图文。可使用预设模板或自动生成。' },
    { id: 'generator', name: '图片生成', description: '根据您的文本描述，生成一张图片。' },
    { id: 'upscaler', name: '画质提升', description: '上传一张图片，提升其清晰度和分辨率。' },
    { id: 'remover', name: '背景移除', description: '上传一张图片，自动移除其背景。' },
    { id: 'chat', name: '自由聊天', description: '进行开放式对话或获取帮助。' },
];

export const TEMPLATE_TEXT_ROLES = [
    { id: 'title', name: '主标题' },
    { id: 'subtitle', name: '副标题' },
    { id: 'body', name: '正文' },
    { id: 'description', name: '描述' },
    { id: 'footnote', name: '脚注' },
    { id: 'promo-tag', name: '促销标签' },
    { id: 'event-date', name: '活动日期' },
    { id: 'location', name: '地点' },
    { id: 'price', name: '价格' },
    { id: 'contact-info', name: '联系方式' },
    { id: 'call-to-action', name: '行动号召' },
    { id: 'game-rules', name: '游戏规则' },
    { id: 'other', name: '其他 (自定义)' },
];

export const COMMON_POSTER_SIZES = [
    { name: '社交媒体帖子', width: 1080, height: 1080 },
    { name: '社交媒体故事', width: 1080, height: 1920 },
    { name: '横向海报 (A4)', width: 1240, height: 874 },
    { name: '纵向海报 (A4)', width: 874, height: 1240 },
    { name: '网站横幅', width: 1920, height: 1080 },
];