import React, { useState, useEffect } from 'react';
import { Chat } from './components/Chat';
import { PosterEditor } from './components/PosterEditor';
import { LongArticleEditor } from './components/LongArticleEditor';
import { TemplateManagerPage } from './components/TemplateManagerPage';
import { getChatResponse } from './services/chatRouterService';
import { generatePosterLayout } from './services/posterAgentService';
import { generateLongArticleLayout } from './services/longArticleAgentService';
import { upscaleImage, removeImageBackground, generateStandaloneImage } from './services/imageToolsService';
import { executeCustomTool } from './services/customToolAgentService';
import { AspectRatio, ChatMessage, Tool, ResultData, InteractionType, CustomTool, PredefinedTool, LongArticleTemplate, PosterTemplate } from './types';
import { PREDEFINED_TOOLS } from './constants';
import { Header } from './components/Header';
import { SettingsPage } from './components/SettingsPage';
import { useIndexedDBStore } from './hooks/useIndexedDBStore';
import { createPosterSnapshot } from './components/chat/results/PosterResult';

interface InteractionState {
    tool: Tool;
    awaiting: 'text' | 'aspect_ratio' | 'file' | 'long_article_details';
    customTool?: CustomTool;
    payload: {
        prompt?: string; // theme
        displayPrompt?: string;
        aspectRatio?: AspectRatio;
        content?: string;
        width?: number;
        generateIllustrations?: boolean;
        file?: string; // base64
        templateId?: string | null;
    };
    interactiveMessageId: string;
}

function App() {
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [interaction, setInteraction] = useState<InteractionState | null>(null);
    const [editingPoster, setEditingPoster] = useState<ResultData | null>(null);
    const [editingArticle, setEditingArticle] = useState<ResultData | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [customTools, setCustomTools] = useIndexedDBStore<CustomTool>('ai-assistant-custom-tools', []);
    const [longArticleTemplates, setLongArticleTemplates] = useIndexedDBStore<LongArticleTemplate>('ai-assistant-long-article-templates', []);
    const [posterTemplates, setPosterTemplates] = useIndexedDBStore<PosterTemplate>('ai-assistant-poster-templates', []);
    const [isAppReady, setIsAppReady] = useState(false);

    const startNewChat = () => {
        setChatHistory([]);
        addMessage({ role: 'assistant', content: '您好！我是您的 AI 创意助手。我可以帮您“设计海报”、“生成长图文”、“生成图片”，或者进行“图片处理”。请问有什么可以帮您？' });
        setInteraction(null);
    };
    
    useEffect(() => {
        // This effect ensures the initial message is only set once all stores are loaded.
        if (!isAppReady) {
            startNewChat();
            setIsAppReady(true);
        }
    }, [customTools, longArticleTemplates, posterTemplates, isAppReady]);

    const addMessage = (message: Omit<ChatMessage, 'id'>) => {
        const id = `${message.role}-${Date.now()}-${Math.random()}`;
        setChatHistory(prev => [...prev, { ...message, id }]);
        return id;
    };

    const updateMessage = (id: string, updates: Partial<Omit<ChatMessage, 'id'>>) => {
        setChatHistory(prev => prev.map(msg => msg.id === id ? { ...msg, ...updates } : msg));
    };
    
    const executeInteraction = async (interactionToExecute: InteractionState) => {
        const { tool, customTool, payload, interactiveMessageId } = interactionToExecute;
        
        updateMessage(interactiveMessageId, {
            isThinking: true,
            interactionType: undefined,
        });
        
        setIsThinking(true);

        try {
            const prompt = payload.prompt || 'random';
            const displayPrompt = payload.displayPrompt || prompt;
            
            if (tool === 'poster') {
                const posterData = await generatePosterLayout(
                    prompt,
                    payload.content,
                    payload.aspectRatio!,
                    payload.templateId,
                    posterTemplates
                );
    
                let previewImageUrl = '';
                try {
                    previewImageUrl = await createPosterSnapshot(posterData, { scale: 1 });
                } catch (error) {
                    console.error("Failed to create poster snapshot:", error);
                }
                
                const finalResult: ResultData = { 
                    type: 'poster', 
                    ...posterData, 
                    prompt: displayPrompt, 
                    previewImageUrl 
                };
                
                updateMessage(interactiveMessageId, { 
                    content: "您的海报已生成！您可以直接下载，或点击编辑进行调整。", 
                    result: finalResult, 
                    isThinking: false 
                });
            } else if (tool === 'generator') {
                const imageUrl = await generateStandaloneImage(prompt, payload.aspectRatio!);
                updateMessage(interactiveMessageId, { content: "图片已生成！", result: { type: 'image', imageUrl }, isThinking: false });
            } else if (tool === 'long_article') {
                const articleData = await generateLongArticleLayout(
                    prompt, 
                    payload.content!, 
                    payload.width!, 
                    payload.generateIllustrations!, 
                    payload.templateId!,
                    longArticleTemplates
                );
                updateMessage(interactiveMessageId, { content: "您的长图文已生成！您可以点击编辑进行调整，或直接下载。", result: { type: 'long_article', ...articleData }, isThinking: false });
            } else if (tool === 'upscaler' || tool === 'remover') {
                 const func = tool === 'upscaler' ? upscaleImage : removeImageBackground;
                 const resultUrl = await func(payload.file!);
                 const resultMessage = tool === 'upscaler' ? '您的图片已成功提升画质！' : '已成功为您移除背景！';
                 updateMessage(interactiveMessageId, { content: resultMessage, result: { type: 'image', imageUrl: resultUrl }, isThinking: false });
            } else if (customTool) {
                const imageUrl = await executeCustomTool(customTool, payload.prompt, payload.file);
                updateMessage(interactiveMessageId, { content: `“${customTool.name}”已完成！`, result: { type: 'image', imageUrl }, isThinking: false });
            }
        } catch (error) {
            const err = error instanceof Error ? error.message : '生成失败，请重试。';
            updateMessage(interactiveMessageId, { content: `抱歉，出错了: ${err}`, isThinking: false });
        } finally {
            setIsThinking(false);
        }
    };
    
    const processMessage = async (message: string) => {
        const thinkingMessageId = addMessage({ role: 'assistant', content: '', isThinking: true });
        setIsThinking(true);

        try {
            const route = await getChatResponse(message, customTools, longArticleTemplates, posterTemplates);
            const predefinedTools: PredefinedTool[] = ['poster', 'generator', 'upscaler', 'remover', 'chat', 'long_article'];
            const isPredefined = predefinedTools.includes(route.tool as PredefinedTool);
            const customTool = isPredefined ? undefined : customTools.find(t => t.id === route.tool);

            let content = route.reply;
            let interactionType: InteractionType | undefined;
            let newInteractionState: Omit<InteractionState, 'interactiveMessageId'> | null = null;
            let awaiting: InteractionState['awaiting'] | undefined;
            const initialContent = route.initialContent;
            
            const basePayload = { prompt: route.prompt, displayPrompt: route.displayPrompt, templateId: route.templateId };

            if (isPredefined) {
                 switch (route.tool) {
                    case 'poster':
                    case 'generator':
                        if (route.prompt) {
                            interactionType = 'aspect_ratio_selector';
                            awaiting = 'aspect_ratio';
                        } else {
                            content = route.reply || `好的，我们来${route.tool === 'poster' ? '设计海报' : '生成图片'}。您想要什么主题？`;
                            awaiting = 'text';
                        }
                        newInteractionState = { tool: route.tool, payload: { ...basePayload, content: initialContent }, awaiting: awaiting! };
                        break;
                    case 'long_article':
                        if (route.prompt) {
                            interactionType = 'long_article_details_input';
                             awaiting = 'long_article_details';
                        } else {
                            content = route.reply || `好的，我们来生成长图文。您想要什么主题？`;
                            awaiting = 'text';
                        }
                        newInteractionState = { tool: route.tool, payload: { ...basePayload, content: initialContent }, awaiting: awaiting! };
                        break;
                    case 'upscaler':
                    case 'remover':
                        interactionType = 'file_upload';
                        awaiting = 'file';
                        if (!content) {
                            content = route.reply || `好的，请上传您需要${route.tool === 'upscaler' ? '提升画质' : '移除背景'}的图片。`;
                        }
                        newInteractionState = { tool: route.tool, payload: {}, awaiting: awaiting! };
                        break;
                    case 'chat':
                    default:
                        updateMessage(thinkingMessageId, { content, isThinking: false });
                        return;
                }
            } else if (customTool) {
                let complete = false;
                if (customTool.requiresText && !route.prompt) {
                    content = content || `好的，我们来执行“${customTool.name}”。请输入您想要的文本内容。`;
                    awaiting = 'text';
                } else if (customTool.requiresImage) {
                    interactionType = 'file_upload';
                    awaiting = 'file';
                    content = content || (route.prompt ? `收到主题：“${route.displayPrompt}”。\n现在请上传图片。` : `好的，请上传图片以使用“${customTool.name}”。`);
                } else {
                    complete = true;
                }
                newInteractionState = { tool: customTool.id, customTool, payload: { ...basePayload, content: initialContent }, awaiting: awaiting! };
                
                if (complete) {
                    await executeInteraction({ ...newInteractionState, interactiveMessageId: thinkingMessageId });
                    return;
                }
            }
            
            if (newInteractionState) {
                updateMessage(thinkingMessageId, { content, interactionType, isThinking: false, initialContent });
                setInteraction({ ...newInteractionState, interactiveMessageId: thinkingMessageId });
            } else {
                updateMessage(thinkingMessageId, { content: content || '我好像走神了，可以再说一遍吗？', isThinking: false });
            }

        } catch (error) {
            const err = error instanceof Error ? error.message : '发生未知错误';
            updateMessage(thinkingMessageId, { content: `抱歉，出错了: ${err}`, isThinking: false });
        } finally {
            setIsThinking(false);
        }
    };

    const handleTextFollowup = async (message: string, currentInteraction: InteractionState) => {
        let newPayload = { ...currentInteraction.payload, prompt: message, displayPrompt: message, content: message };
        let newContent = `收到主题: “${message}”。`;
        let nextInteractionType: InteractionType | undefined;
        let nextAwaiting: InteractionState['awaiting'] | undefined;
        let complete = false;

        if (currentInteraction.tool === 'poster' || currentInteraction.tool === 'generator') {
            newContent += '\n请选择您想要的图片比例。';
            nextInteractionType = 'aspect_ratio_selector';
            nextAwaiting = 'aspect_ratio';
        } else if (currentInteraction.tool === 'long_article') {
            newContent += '\n现在，请提供您的长图文内容、想要的宽度以及是否需要AI为您生成插图。如果内容留空，我会为您创作。';
            nextInteractionType = 'long_article_details_input';
            nextAwaiting = 'long_article_details';
        } else if (currentInteraction.customTool) {
            if (currentInteraction.customTool.requiresImage) {
                 newContent += '\n现在请上传图片。';
                 nextInteractionType = 'file_upload';
                 nextAwaiting = 'file';
            } else {
                complete = true;
            }
        }
        
        const newInteraction = { ...currentInteraction, payload: newPayload, awaiting: nextAwaiting! };

        if (complete) {
            setInteraction(null);
            await executeInteraction(newInteraction);
        } else {
            updateMessage(currentInteraction.interactiveMessageId, {
                content: newContent,
                interactionType: nextInteractionType
            });
            setInteraction(newInteraction);
        }
    };
    
    const handleUserSubmit = async (message: string) => {
        if (isThinking) return;
        addMessage({ role: 'user', content: message });
        
        const currentInteraction = interaction;
        
        if (currentInteraction && currentInteraction.awaiting !== 'text') {
            const toolName = currentInteraction.customTool?.name || PREDEFINED_TOOLS.find(t=>t.id === currentInteraction.tool)?.name || '当前';
            updateMessage(currentInteraction.interactiveMessageId, { interactionType: undefined, content: `好的，已取消“${toolName}”操作。` });
            setInteraction(null);
            await processMessage(message);
            return;
        }

        if (currentInteraction && currentInteraction.awaiting === 'text') {
            await handleTextFollowup(message, currentInteraction);
        } else {
            await processMessage(message);
        }
    };
    
    const handleFileSubmit = async (fileData: string) => {
        if (!interaction || interaction.awaiting !== 'file') return;
        const interactionToExecute = { ...interaction, payload: { ...interaction.payload, file: fileData } };
        setInteraction(null);
        await executeInteraction(interactionToExecute);
    };
    
    const handleAspectRatioSelect = async (aspectRatio: AspectRatio) => {
        if (!interaction || interaction.awaiting !== 'aspect_ratio') return;
        const interactionToExecute = { ...interaction, payload: { ...interaction.payload, aspectRatio } };
        setInteraction(null);
        await executeInteraction(interactionToExecute);
    };

    const handleLongArticleDetailsSubmit = async (content: string, width: number, generateIllustrations: boolean) => {
        if (!interaction || interaction.awaiting !== 'long_article_details') return;
        const interactionToExecute = { ...interaction, payload: { ...interaction.payload, content, width, generateIllustrations } };
        setInteraction(null);
        await executeInteraction(interactionToExecute);
    };

    const handleEditPoster = (posterData: ResultData) => {
        if (posterData.type !== 'poster') return;
        setEditingPoster(posterData);
    };

    const handleEditArticle = (articleData: ResultData) => {
        if (articleData.type !== 'long_article') return;
        setEditingArticle(articleData);
    };

    return (
        <div className="h-screen w-full bg-transparent font-sans flex flex-col">
             <Header onSettingsClick={() => setShowSettings(true)} onNewChatClick={startNewChat} onTemplateManagerClick={() => setShowTemplateManager(true)} />
            
            <div className="flex-grow min-h-0">
                <Chat 
                    messages={chatHistory}
                    onSendMessage={handleUserSubmit}
                    isThinking={isThinking}
                    isTextInputDisabled={isThinking || !isAppReady}
                    onEditPoster={handleEditPoster}
                    onEditArticle={handleEditArticle}
                    onAspectRatioSelect={handleAspectRatioSelect}
                    onLongArticleDetailsSubmit={handleLongArticleDetailsSubmit}
                    onFileUpload={handleFileSubmit}
                />
            </div>
            
            {editingPoster && editingPoster.type === 'poster' && (
                <div className="absolute inset-0 z-20 bg-gray-900">
                    <PosterEditor 
                        key={editingPoster.templateId || 'no-template-poster'}
                        initialData={editingPoster}
                        templates={posterTemplates}
                        onExit={() => setEditingPoster(null)}
                    />
                </div>
            )}

            {editingArticle && editingArticle.type === 'long_article' && (
                <div className="absolute inset-0 z-20 bg-gray-900">
                    <LongArticleEditor 
                        key={editingArticle.templateId || 'no-template-article'}
                        initialData={editingArticle}
                        templates={longArticleTemplates}
                        onExit={() => setEditingArticle(null)}
                    />
                </div>
            )}

            {showSettings && (
                 <div className="absolute inset-0 z-30">
                    <SettingsPage 
                        customTools={customTools}
                        setCustomTools={setCustomTools}
                        onClose={() => setShowSettings(false)} 
                    />
                 </div>
            )}

            {showTemplateManager && (
                 <div className="absolute inset-0 z-30">
                    <TemplateManagerPage 
                        longArticleTemplates={longArticleTemplates}
                        setLongArticleTemplates={setLongArticleTemplates}
                        posterTemplates={posterTemplates}
                        setPosterTemplates={setPosterTemplates}
                        onClose={() => setShowTemplateManager(false)} 
                    />
                 </div>
            )}
        </div>
    );
};

export default App;
