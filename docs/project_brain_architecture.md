# 系统架构深度剖析

## 1. 前端技术栈

-   **框架**: React 19 (使用 Hooks 和函数式组件)
-   **语言**: TypeScript (强制严格类型检查)
-   **样式**: Tailwind CSS (用于快速的、实用程序优先的 UI 开发)
-   **本地存储**: `idb` (IndexedDB 的一个轻量级封装，用于持久化用户数据)
-   **AI SDK**: `openai`
-   **构建工具**: Vite (高效的前端构建工具)
-   **CSS 处理**: PostCSS + Autoprefixer (用于现代化CSS处理)
-   **字体**: 本地托管的 Noto Sans SC 和 ZCOOL KuaiLe 字体文件

## 2. 数据持久化

我们使用 **IndexedDB** 而不是 `localStorage`，因为它为存储复杂的 JavaScript 对象（如模板）提供了更强大和高效的解决方案。

-   **`services/dbService.ts`**: 提供了与 `idb` 库交互的底层、类型安全的封装。
-   **`hooks/useIndexedDBStore.ts`**: 一个自定义的 React Hook，它抽象了从 IndexedDB 加载数据和将状态变更同步回数据库的逻辑，为组件提供了类似于 `useState` 的简单接口。

## 3. 前端组件专家模式

与后端的"专家 Agent"理念相呼应，前端也遵循了类似的"专家组件"模式。

-   **历史问题**: 最初，`ResultCard.tsx` 是一个"上帝组件"，它包含了渲染所有不同类型AI结果（海报、长图文、图片）的 `switch` 逻辑，以及所有相关的操作（导出、编辑、下载）函数。这严重违反了单一职责和开闭原则，导致组件难以维护和扩展。
-   **最终方案**: 我们将 `ResultCard.tsx` 重构为一个纯粹的"调度器"。它唯一的职责就是根据 `result.type` 来渲染对应的"专家组件"。所有具体的渲染和逻辑都被下放到了各自的专家组件中：
    -   `components/chat/results/PosterResult.tsx`
    -   `components/chat/results/LongArticleResult.tsx`
    -   `components/chat/results/ImageResult.tsx`
-   **优势**: 这种架构使得添加新的结果类型变得极其简单，只需创建一个新的专家组件并在调度器中增加一个 `case` 即可，完全无需修改任何现有组件的逻辑。

## 4. 多服务商 AI 架构：从抽象层到适配器模式的终极进化

为了实现极致的灵活性、原子化和可扩展性，我们对AI服务层进行了一次决定性的架构重构，从一个简单的**抽象层**进化到了一个真正**可插拔**的**适配器设计模式 (Adapter Pattern)**。

### 历史问题：条件分支的"坏味道"

最初的 `unifiedAIService.ts` 虽然实现了逻辑上的解耦，但其内部依赖于一个巨大的 `if/else` 逻辑块来区分不同的 `provider`。这种设计存在明显的"代码坏味道"：每当需要支持一个新的AI服务商（例如 Claude），我们就必须修改这个核心文件，增加一个新的 `else if` 分支。这违反了**开闭原则**，随着服务商的增多，文件会变得越来越臃肿，难以维护。

### 最终方案：适配器模式 (The Adapter Pattern)

新架构将AI服务层彻底重构为一个由多个独立、原子化的"适配器"组成的系统，由一个轻量级的"路由器"进行调度。

-   **`services/adapters/AIAdapter.ts` (设计合同)**:
    -   **职责**: 定义了一个 TypeScript `interface`，作为所有AI服务商适配器都必须遵守的"通用合同"。它规定了所有适配器都必须实现 `generateJSON`, `generateImage` 等标准方法。

-   **`services/adapters/openaiAdapter.ts` (专家翻译官)**:
    -   **职责**: 每个文件都是一个实现了 `AIAdapter` 接口的具体类。它们各自**完全封装**了与特定服务商SDK通信的所有细节。
    -   **例如**: `openaiAdapter` 知道如何使用 `response_format: { type: "json_object" }` 以及如何将我们的 `schema` 翻译成文本指令。

-   **`services/aiClient.ts` (中央控制面板 & 适配器注册表)**:
    -   **职责**: 其角色被提升了。它不仅是**模型配置中心**（通过 `AI_MODELS` 对象），现在还是**适配器注册表**。它负责实例化所有可用的适配器 (`new GeminiAdapter()`, `new OpenAIAdapter()`) 并将它们存储在一个全局可访问的映射中。

-   **`services/unifiedAIService.ts` (轻量级路由器)**:
    -   **职责**: 这个文件被极大地简化了。它现在是一个**纯粹的路由器**，不再包含任何 `if/else` 服务商逻辑。
    -   **工作流程**: 当一个Agent调用它时，它会：
        1.  根据任务类型，从 `aiClient.ts` 的 `AI_MODELS` 中查找 `provider`。
        2.  使用 `provider` 名称，从 `aiClient.ts` 的适配器注册表中获取对应的**适配器实例**。
        3.  调用该适配器的相应方法，将任务完全委托出去。

### 新架构的巨大优势

-   **真正的可插拔性**: 要支持一个新的AI服务商（如 Claude），我们现在**只需**在 `adapters` 目录下创建一个新的 `claudeAdapter.ts` 文件，实现 `AIAdapter` 接口，然后在 `aiClient.ts` 中注册它即可。**`unifiedAIService.ts` 的核心逻辑再也无需被修改**。
-   **高内聚，低耦合**: 与OpenAI相关的代码只存在于`openaiAdapter.ts`中。这使得代码库极其清晰、原子化，并且易于维护和独立测试。
-   **极致的灵活性**: 开发者现在可以通过修改**唯一的配置文件** `aiClient.ts` 来为任何任务精确地指派任何已注册的AI服务商，实现了前所未有的控制力。

## 5. MCP服务集成：专业工具的无缝接入

为了提供真正专业级的功能（如背景移除、图像处理等），我们集成了 **Model Context Protocol (MCP)** 支持，实现与本地专业服务的无缝对接。

-   **架构设计**: 
    -   **MCPAdapter**: 专门的适配器，实现与MCP服务的标准化通信
    -   **统一接口**: 通过 `unifiedAIService.callMCPService()` 提供统一的调用入口
    -   **配置驱动**: 支持环境变量配置，便于不同环境的部署和切换

-   **背景移除服务重构**:
    -   **移除AI假抠图**: 彻底废除了之前的"AI重新生成"伪背景移除方案
    -   **真正专业处理**: 通过MCP调用真正的背景移除算法（AI模型、传统算法或混合方案）
    -   **高级选项支持**: 支持边缘平滑、透明度保留、质量控制等专业功能
    -   **批量处理**: 提供批量背景移除功能，支持进度回调和错误处理

-   **可扩展架构**:
    -   **工具无关**: MCP适配器可以轻松扩展支持更多工具（图像超分辨率、色彩校正等）
    -   **服务发现**: 自动检测和配置可用的MCP服务
    -   **故障恢复**: 提供清晰的错误信息和配置指导

-

## 6. 如何扩展应用

该应用程序为轻松扩展而设计。

### 6.1. 添加一个新的预定义工具

1.  **定义工具类型**: 在 `types.ts` 中，将新工具的 ID 添加到 `PredefinedTool` 类型。
2.  **注册工具**: 在 `constants.ts` 中，将新工具的条目添加到 `PREDEFINED_TOOLS` 数组。这会使其自动被 `chatRouterService` 识别。
3.  **实现 Agent 服务**: 创建一个新的 `services/newToolAgentService.ts` 文件。在该文件中，为你的工具创建一个 `async` 函数，该函数接受必要的参数，并使用专门为该任务设计的 Prompt 和 Schema 调用 `unifiedAIService`。
4.  **在编排器中路由**: 在 `App.tsx` 的 `executeInteraction` 函数中，为你的新工具 ID 在 `if/else` 语句中添加一个分支，并调用你在新服务文件中创建的函数。
5.  **渲染结果**: 在 `components/chat/ResultCard.tsx` 中添加逻辑来渲染新工具的输出。
6.  **遵循AI-First原则**: 确保新工具符合我们的三大核心宗旨，为AI协作而优化设计。
