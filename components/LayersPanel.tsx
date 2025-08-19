import React, { useState, useMemo } from 'react';
import { produce } from 'https://esm.sh/immer@10.1.1';
import { PosterTemplate, LayoutBox, ArticleSection, DecorationElement } from '../types';
import { AddTextIcon, PhotoIcon, LayoutIcon, SparklesIcon, TrashIcon, EyeIcon, EyeSlashIcon, LockClosedIcon, LockOpenIcon, ChevronDownIcon, ChevronRightIcon, DuplicateIcon } from './icons';

const NEW_DECORATION_PLACEHOLDER = `data:image/svg+xml;base64,${btoa(`<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#d1d5db" rx="10"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#6b7280" text-anchor="middle" dy=".3em">Decoration</text></svg>`)}`;

interface LayerItemProps {
    item: ArticleSection | DecorationElement;
    level: number;
    path: string[];
    selectedPath: string[];
    onSelect: (path: string[]) => void;
    onToggleVisibility: (path: string[]) => void;
    onToggleLock: (path: string[]) => void;
    onToggleExpand: (path: string[]) => void;
    expandedPaths: string[];
}

const LayerItem = ({ item, level, path, selectedPath, onSelect, onToggleVisibility, onToggleLock, onToggleExpand, expandedPaths }: LayerItemProps) => {
    const isSelected = JSON.stringify(path) === JSON.stringify(selectedPath);
    const isExpanded = expandedPaths.includes(JSON.stringify(path));

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(path);
    };

    const handleToggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.type === 'layout_box') {
            onToggleExpand(path);
        }
    }

    const Icon = item.type === 'layout_box' ? LayoutIcon 
               : item.type === 'text' ? AddTextIcon 
               : item.type === 'image' ? PhotoIcon 
               : SparklesIcon;

    return (
        <div>
            <div
                onClick={handleSelect}
                className={`flex items-center justify-between w-full text-left p-2 rounded text-sm group ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-600'}`}
                style={{ paddingLeft: `${0.5 + level * 1}rem` }}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {item.type === 'layout_box' ? (
                        <button onClick={handleToggleExpand} className="flex-shrink-0">
                            {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                        </button>
                    ) : <div className="w-4 h-4 flex-shrink-0" /> }

                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.role || item.type}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); onToggleLock(path); }} className="opacity-50 group-hover:opacity-100" title={item.isLocked ? "解锁" : "锁定"}>
                        {item.isLocked ? <LockClosedIcon className="w-4 h-4 text-yellow-400" /> : <LockOpenIcon className="w-4 h-4" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(path); }} className="opacity-50 group-hover:opacity-100" title={item.isVisible === false ? "显示" : "隐藏"}>
                        {item.isVisible === false ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>
            {item.type === 'layout_box' && isExpanded && (
                <div className="border-l border-gray-700 ml-2">
                    {item.sections.map((section) => (
                        <LayerItem
                            key={section.id}
                            item={section}
                            level={level + 1}
                            path={[...path, section.id]}
                            selectedPath={selectedPath}
                            onSelect={onSelect}
                            onToggleVisibility={onToggleVisibility}
                            onToggleLock={onToggleLock}
                            onToggleExpand={onToggleExpand}
                            expandedPaths={expandedPaths}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const findElementInDraft = (draft: PosterTemplate, path: string[]): { parent: LayoutBox | PosterTemplate | null, element: ArticleSection | DecorationElement | null } => {
    if (!path || path.length === 0) return { parent: null, element: null };
    
    let parent: LayoutBox | PosterTemplate | null = draft;
    let element: ArticleSection | DecorationElement | null = null;
    let currentLevel: (ArticleSection | DecorationElement)[] = [...draft.layoutBoxes, ...(draft.decorations || [])];

    for (let i = 0; i < path.length; i++) {
        const id = path[i];
        const found = currentLevel.find(item => item.id === id);

        if (!found) return { parent: null, element: null };
        
        element = found;

        if (i < path.length - 1) { // If not the last item, it must be a container to traverse deeper
            if (found.type === 'layout_box') {
                parent = found;
                currentLevel = found.sections;
            } else {
                // Invalid path, tried to traverse into a non-container
                return { parent: null, element: null };
            }
        }
    }
    return { parent, element };
};

const deepCloneWithNewIds = (element: ArticleSection | DecorationElement): ArticleSection | DecorationElement => {
    const newElement = JSON.parse(JSON.stringify(element));
    
    const assignNewIds = (el: any) => {
        el.id = `${el.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        if (el.type === 'layout_box' && el.sections) {
            el.sections.forEach(assignNewIds);
        }
    };
    
    assignNewIds(newElement);
    return newElement;
};

const getAllContainerPaths = (template: PosterTemplate): string[] => {
    const paths: string[] = [];
    const traverse = (boxes: LayoutBox[], currentPath: string[]) => {
        boxes.forEach(box => {
            const path = [...currentPath, box.id];
            paths.push(JSON.stringify(path));
            if (box.sections) {
                traverse(box.sections.filter(s => s.type === 'layout_box') as LayoutBox[], path);
            }
        });
    };
    traverse(template.layoutBoxes, []);
    return paths;
};

export const LayersPanel = ({ template, selectedPath, onSelect, onUpdate }: {
    template: PosterTemplate;
    selectedPath: string[];
    onSelect: (path: string[]) => void;
    onUpdate: (updater: (draft: PosterTemplate) => void) => void;
}) => {
    const [expandedPaths, setExpandedPaths] = useState<string[]>([]);
    const allItems = [...template.layoutBoxes, ...(template.decorations || [])];

    const selectedElement = useMemo(() => {
        if (!selectedPath || selectedPath.length === 0) return null;
        const { element } = findElementInDraft(template, selectedPath);
        return element;
    }, [selectedPath, template]);

    const isLayoutBoxSelected = selectedElement?.type === 'layout_box';

    const handleDelete = () => {
        if (selectedPath.length === 0) return;
        onUpdate(draft => {
            const pathWithoutTarget = selectedPath.slice(0, -1);
            const targetId = selectedPath[selectedPath.length - 1];

            const { parent } = findElementInDraft(draft, selectedPath);
            if (!parent) return;

            if ('layoutBoxes' in parent) { // It's the root PosterTemplate
                parent.layoutBoxes = parent.layoutBoxes.filter(i => i.id !== targetId);
                parent.decorations = (parent.decorations || []).filter(i => i.id !== targetId);
            } else if ('sections' in parent) { // It's a LayoutBox
                parent.sections = parent.sections.filter(i => i.id !== targetId);
            }
        });
        onSelect([]);
    };

    const handleDuplicate = () => {
        if (!selectedElement) return;
        onUpdate(draft => {
            const { parent, element } = findElementInDraft(draft, selectedPath);
            if (!parent || !element) return;
            
            const newElement = deepCloneWithNewIds(element);
            
            if ('layoutBoxes' in parent) { // Root level
                if (newElement.type === 'decoration') {
                    parent.decorations.push(newElement as DecorationElement);
                } else {
                    const originalIndex = parent.layoutBoxes.findIndex(i => i.id === element.id);
                    parent.layoutBoxes.splice(originalIndex + 1, 0, newElement as LayoutBox);
                }
            } else if ('sections' in parent) { // Nested level
                 const originalIndex = parent.sections.findIndex(i => i.id === element.id);
                 parent.sections.splice(originalIndex + 1, 0, newElement as ArticleSection);
            }
             onSelect(selectedPath.slice(0, -1).concat(newElement.id));
        });
    }

    const handleAdd = (type: 'layout_box' | 'text' | 'image' | 'decoration') => {
        onUpdate(draft => {
            const maxZ = Math.max(0, ...draft.layoutBoxes.map(b => b.zIndex || 0), ...(draft.decorations || []).map(d => d.zIndex || 0));
            const newId = `${type}-${Date.now()}`;
            let newElement: any;

            if (type === 'layout_box') {
                newElement = { 
                    id: newId, 
                    type, 
                    role: '新布局框', 
                    constraints: { top: '20px', left: '20px', width: '200px', height: '150px' }, 
                    backgroundColor: 'rgba(255,255,255,0.1)', 
                    sections: [], 
                    zIndex: maxZ + 1, 
                    borderRadius: 10, 
                    paddingTop: 10, 
                    paddingRight: 10, 
                    paddingBottom: 10, 
                    paddingLeft: 10, 
                    layoutMode: 'flex',
                    flexDirection: 'column', 
                    gap: 10 
                };
            } else if (type === 'decoration') {
                newElement = { id: newId, type, role: '新装饰', imageUrl: NEW_DECORATION_PLACEHOLDER, position: { xPercent: 10, yPx: 10 }, sizePercent: { width: 30 }, angle: 0, zIndex: maxZ + 1, scope: 'page' };
            } else if (type === 'text') {
                newElement = { id: newId, type, role: '新文本', content: [{ text: '新文本区块', style: {} }], style: { fontFamily: 'sans-serif', fontSize: 48, fontWeight: 700, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2, letterSpacing: 0 } };
            } else { // image
                newElement = { id: newId, type, role: '新图片', imageUrl: '', prompt: 'A new image', objectFit: 'cover', flexGrow: 1, flexShrink: 1 };
            }
            
            Object.assign(newElement, { isVisible: true, isLocked: false });
            
            const { element: selectedContainer } = findElementInDraft(draft, selectedPath);

            if (type === 'decoration') {
                if (!draft.decorations) draft.decorations = [];
                draft.decorations.push(newElement);
                onSelect([newId]);
                return;
            }

            if (selectedContainer && selectedContainer.type === 'layout_box') {
                selectedContainer.sections.push(newElement);
                onSelect([...selectedPath, newId]);
            } else if (type === 'layout_box') { 
                 draft.layoutBoxes.push(newElement);
                 onSelect([newId]);
            }
        });
    };

    const handleToggleProperty = (path: string[], prop: 'isVisible' | 'isLocked') => {
        onUpdate(draft => {
            const { element } = findElementInDraft(draft, path);
            if (element) {
                (element as any)[prop] = !(element as any)[prop];
            }
        });
    }

    const handleToggleExpand = (path: string[]) => {
        const pathStr = JSON.stringify(path);
        setExpandedPaths(prev => prev.includes(pathStr) ? prev.filter(p => p !== pathStr) : [...prev, pathStr]);
    }
    
    const handleExpandAll = () => {
        setExpandedPaths(getAllContainerPaths(template));
    }
    const handleCollapseAll = () => {
        setExpandedPaths([]);
    }

    return (
        <div className="h-full flex flex-col gap-2">
            <h3 className="font-bold text-lg mb-2 p-2">图层与工具</h3>
             <div className="flex-shrink-0 grid grid-cols-5 gap-2 px-2">
                <button onClick={() => handleAdd('layout_box')} className="flex items-center justify-center gap-1 p-2 bg-gray-600 rounded hover:bg-gray-500" title="添加布局框"><LayoutIcon className="w-5 h-5"/></button>
                <button onClick={() => handleAdd('decoration')} className="flex items-center justify-center gap-1 p-2 bg-gray-600 rounded hover:bg-gray-500" title="添加装饰"><SparklesIcon className="w-5 h-5"/></button>
                <button onClick={() => handleAdd('text')} disabled={!isLayoutBoxSelected} className="flex items-center justify-center gap-1 p-2 bg-gray-600 rounded hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed" title="添加文本 (需先选择布局框)"><AddTextIcon className="w-5 h-5"/></button>
                <button onClick={() => handleAdd('image')} disabled={!isLayoutBoxSelected} className="flex items-center justify-center gap-1 p-2 bg-gray-600 rounded hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed" title="添加图片 (需先选择布局框)"><PhotoIcon className="w-5 h-5"/></button>
                <button onClick={handleDuplicate} disabled={selectedPath.length === 0} className="flex items-center justify-center gap-1 p-2 bg-gray-600 rounded hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed" title="复制图层"><DuplicateIcon className="w-5 h-5"/></button>
            </div>
             <div className="flex-shrink-0 flex items-center justify-between px-2 pt-2">
                <div className="flex gap-2">
                    <button onClick={handleExpandAll} className="text-xs text-gray-400 hover:text-white">全部展开</button>
                    <button onClick={handleCollapseAll} className="text-xs text-gray-400 hover:text-white">全部折叠</button>
                </div>
                <button onClick={handleDelete} disabled={selectedPath.length === 0} className="p-1 bg-red-800/50 rounded hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed" title="删除所选"><TrashIcon className="w-4 h-4"/></button>
            </div>
            <div className="flex-grow min-h-0 overflow-y-auto space-y-1 pr-2 -mr-2 mt-2">
                {allItems.sort((a,b) => (b.zIndex || 0) - (a.zIndex || 0)).map((item) => (
                    <LayerItem
                        key={item.id}
                        item={item}
                        level={0}
                        path={[item.id]}
                        selectedPath={selectedPath}
                        onSelect={onSelect}
                        onToggleLock={(path) => handleToggleProperty(path, 'isLocked')}
                        onToggleVisibility={(path) => handleToggleProperty(path, 'isVisible')}
                        onToggleExpand={handleToggleExpand}
                        expandedPaths={expandedPaths}
                    />
                ))}
            </div>
        </div>
    );
};