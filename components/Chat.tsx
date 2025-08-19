import React, { useRef, useEffect } from 'react';
import { ChatMessage, ResultData, AspectRatio } from '../types';
import { ResultCard } from './chat/ResultCard';
import { AspectRatioSelector, FileUpload, LongArticleDetailsInput } from './chat/InputCards';
import { ThinkingAnimation } from './chat/ThinkingAnimation';

interface ChatProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    isThinking: boolean;
    isTextInputDisabled: boolean;
    onEditPoster: (posterData: ResultData) => void;
    onEditArticle: (articleData: ResultData) => void;
    onAspectRatioSelect: (aspectRatio: AspectRatio) => void;
    onLongArticleDetailsSubmit: (content: string, width: number, generateIllustrations: boolean) => void;
    onFileUpload: (base64Image: string) => void;
}

export const Chat = ({ 
    messages, 
    onSendMessage, 
    isThinking, 
    isTextInputDisabled, 
    onEditPoster, 
    onEditArticle,
    onAspectRatioSelect, 
    onLongArticleDetailsSubmit,
    onFileUpload 
}: ChatProps) => {
    const [input, setInput] = React.useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        setTimeout(scrollToBottom, 100);
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isTextInputDisabled) {
            onSendMessage(input);
            setInput('');
        }
    };

    return (
        <div className="flex flex-col h-full bg-transparent text-white">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex items-start gap-3 animate-pop-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex-shrink-0"></div>}
                        
                        {msg.isThinking ? (
                             <div className="max-w-lg lg:max-w-xl xl:max-w-2xl px-4 py-3 rounded-2xl bg-gray-700 rounded-bl-none">
                                <ThinkingAnimation />
                            </div>
                        ) : (
                            <div className={`max-w-lg lg:max-w-xl xl:max-w-2xl px-4 py-3 rounded-2xl flex flex-col gap-3 ${msg.role === 'user' ? 'bg-blue-600 rounded-br-none' : 'bg-gray-700 rounded-bl-none'}`}>
                                { msg.content && <div className="text-sm md:text-base leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div> }
                                {msg.interactionType === 'aspect_ratio_selector' && <AspectRatioSelector onSelect={onAspectRatioSelect} />}
                                {msg.interactionType === 'long_article_details_input' && <LongArticleDetailsInput onSubmit={onLongArticleDetailsSubmit} initialContent={msg.initialContent} />}
                                {msg.interactionType === 'file_upload' && <FileUpload onUpload={onFileUpload} />}
                                {msg.result && <ResultCard result={msg.result} onEditPoster={onEditPoster} onEditArticle={onEditArticle} />}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-gray-800/50 border-t border-gray-700 backdrop-blur-sm">
                <form onSubmit={handleSubmit} className="flex items-center gap-4 max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isTextInputDisabled ? "AI 正在处理中..." : "和 AI 聊聊您的想法..."}
                        className="flex-1 w-full p-3 bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 placeholder-gray-400"
                        disabled={isTextInputDisabled}
                    />
                    <button
                        type="submit"
                        disabled={isTextInputDisabled || !input.trim()}
                        className="px-6 py-3 w-28 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg shadow-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                    >
                        {isThinking ? '...' : '发送'}
                    </button>
                </form>
            </div>
        </div>
    );
};