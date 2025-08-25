# AI-First 开发纪律与内网适配

## 1. AI-First 开发纪律与最佳实践

### 1.1. 神圣不可违背的开发原则

#### 🎯 Agent-First 重构清单 (强制执行)
**理念**: 每当一个开发者要修改一个被 AI 依赖的组件时，他们必须遵循一个严格的清单。

**清单步骤**:
1. **识别消费者**: "我要修改 `EditableImageSection.tsx`。哪些 AI Agent 会消费它生成的数据结构？" 
   → 答案：`visualDeconstructorService` 和 `posterAgentService`。

2. **更新生产者 (Agent)**: "我必须立刻去这两个服务里，检查并更新它们的 System Prompt 和 Schema，以匹配我的新改动。"

3. **更新文档**: "我必须更新 `PROJECT_BRAIN.md` 中关于图片组件的部分。"

4. **验证AI理解**: "我必须测试相关AI Agent，确保它们能正确理解和使用新的数据结构。"

#### 📖 PROJECT_BRAIN.md 的核心地位 (神圣法则)
**规则**: 任何对核心组件或类型的重大修改，其 Pull Request 都必须包含对 `PROJECT_BRAIN.md` 相应部分的更新。这份文档是我们对 AI 和对未来开发者沟通的"API 文档"，必须保持最新。

#### 🔄 Design with AI, Design for AI, AI-First 原则检查
**每次代码变更前的自检清单**:
- ✅ **Design with AI**: 这个改动是否提升了AI的创作能力？
- ✅ **Design for AI**: 这个改动是否让AI更容易理解和操作？
- ✅ **AI-First**: 这个改动是否优先考虑了AI的扩展性？

### 1.2. 架构进化路径

我们的最终目标是实现**"AI掌控编辑器"**的完整生态，当前架构已经为此奠定了95%的基础。剩余的5%进化路径：

1. **AI操作指令系统**: 让AI能生成精确的编辑器操作指令
2. **AI视觉反馈循环**: 让AI能"看到"编辑结果并持续优化
3. **对话式编辑界面**: "帮我把标题移到右上角"式的自然语言编辑
4. **AI设计师助手**: 真正的AI设计合作伙伴，而非工具

## 2. 内网环境适配与结构优化

随着项目在不同环境中的部署需求增加，我们对系统架构进行了全面的内网化改造和结构优化，以支持在无外部网络连接的环境中完全运行。

### 2.1. 内网环境适配：外部依赖的彻底本地化

#### 2.1.1. 历史问题与挑战

-   **外部资源依赖**: 
    -   **字体资源**: 项目最初完全依赖 Google Fonts CDN 提供的 Noto Sans SC 和 ZCOOL KuaiLe 字体。
    -   **CSS 框架**: 通过 CDN 加载 Tailwind CSS (`https://cdn.tailwindcss.com`)，这在无外网环境中无法访问。
    -   **字体声明**: CSS 中的 `@font-face` 规则指向外部 CDN 地址。

-   **业务需求**: 
    -   应用需要部署在公司内部网络环境中，这些环境通常被防火墙隔离，无法访问外部资源。
    -   保持设计一致性，即使在内网环境中也需要相同的字体和样式表现。

#### 2.1.2. 内网化改造方案

我们采用了全面的内网化改造策略，确保所有外部依赖都被替换为本地资源：

1.  **字体本地化**:
    -   **资源迁移**: 将所有必要的字体文件 (`.ttf`) 下载并存储在 `/public/assets/fonts/` 目录下。
    -   **CSS 重构**: 创建本地字体 CSS 文件 (`fonts.css`)，使用相对路径引用本地字体文件。
    -   **一致性保障**: 确保所有字体权重 (400, 700, 900) 都有对应的本地文件，保持与原设计完全一致。

2.  **Tailwind CSS 本地化**:
    -   **构建流程优化**: 使用 npm 安装 Tailwind CSS、PostCSS 和 Autoprefixer 作为本地开发依赖。
    -   **配置文件创建**: 生成 `tailwind.config.js` 和 `postcss.config.js` 配置文件，以支持本地构建。
    -   **构建脚本添加**: 在 `package.json` 中添加 `build:css` 脚本，在每次构建前自动生成优化后的 CSS。

3.  **HTML 结构更新**:
    -   **移除外部引用**: 删除所有指向外部 CDN 的 `<link>` 和 `<script>` 标签。
    -   **添加本地资源**: 更新 HTML 以引用本地托管的字体和 CSS 文件。
    -   **结构优化**: 简化 HTML 结构，提高加载性能。

#### 2.1.3. 技术实现示例

```html
<!-- 旧版 index.html (依赖外部资源) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&family=ZCOOL+KuaiLe&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>

<!-- 新版 index.html (完全本地化) -->
<link rel="stylesheet" href="/assets/fonts/fonts.css">
<link rel="stylesheet" href="/assets/css/main.css">
```

```css
/* 本地化字体定义 (fonts.css) */
@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('./noto-sans-sc-400.ttf') format('truetype');
}

@font-face {
  font-family: 'ZCOOL KuaiLe';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('./zcool-kuaile-400.ttf') format('truetype');
}
```

```javascript
// tailwind.config.js 配置
export default {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./index.tsx",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', 'sans-serif'],
        cursive: ['"ZCOOL KuaiLe"', 'cursive'],
      }
    },
  },
  plugins: [],
}
```

### 2.2. 项目结构优化：标准化与可维护性提升

随着内网化改造，我们同时对整个项目结构进行了全面优化，使其更符合现代前端项目的最佳实践。

#### 2.2.1. 结构优化核心目标

-   **标准化目录结构**: 建立符合行业标准的目录组织方式，提高新开发者的上手效率。
-   **关注点分离**: 明确划分代码、样式和资源文件的职责，避免混淆。
-   **构建流程优化**: 简化并规范化构建流程，确保一致的输出结果。
-   **冗余文件清理**: 移除不再使用的临时文件和重复配置。

#### 2.2.2. 具体优化措施

1.  **CSS 文件整合与重组**:
    -   创建专门的 `src/styles` 目录，集中管理所有样式源文件。
    -   将样式逻辑分离为主样式文件 (`main.css`) 和自定义样式 (`custom.css`)。
    -   构建后的 CSS 统一放置在 `public/assets/css` 目录，遵循资源管理最佳实践。

2.  **资源目录标准化**:
    -   在 `public/assets` 下创建清晰的子目录结构：`css`、`fonts` 等。
    -   确保所有资源文件都有明确的归属和组织逻辑。
    -   统一资源引用路径，提高可维护性。

3.  **构建配置优化**:
    -   更新 `package.json` 中的构建脚本，包含新的 CSS 构建流程。
    -   优化 Tailwind 配置，确保精确匹配项目所需的内容。
    -   简化 Vite 配置，提高构建性能。

4.  **冗余清理**:
    -   移除根目录中的临时 CSS 文件。
    -   删除不再使用的 CDN 引用和配置。
    -   合并重复的样式定义，减少代码量。

#### 2.2.3. 最终成果与收益

这次结构优化带来了显著的改进：

-   **部署灵活性**: 项目现在可以无缝部署在任何环境中，无论是否有外部网络连接。
-   **加载性能提升**: 本地资源加载减少了网络请求，提高了应用启动速度。
-   **维护性提高**: 标准化的目录结构和清晰的关注点分离，大幅降低了维护难度。
-   **一致的视觉体验**: 确保在任何环境中都能获得完全相同的字体和样式表现。
-   **构建可靠性**: 改进的构建流程减少了环境差异带来的问题，提高了部署成功率。

这次内网化改造和结构优化是对项目架构的重要补充，进一步体现了我们对不同部署环境的适应性和对代码质量的追求。它为项目的长期维护和未来扩展奠定了更加坚实的基础。
