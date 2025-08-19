import React, { useState, useRef } from 'react';
import { TextElementData } from '../types';
import { FONT_FAMILIES } from '../constants';
import { AlignTextLeft, AlignTextCenter, AlignTextRight, AlignLeft, AlignHCenter, AlignRight, AlignTop, AlignVCenter, AlignBottom, LayersForwardIcon, LayersBackwardIcon, ArrowToFrontIcon, ArrowToBackIcon, DuplicateIcon, AlignTextJustifyIcon } from './icons';
import { RgbaColorPicker as ColorPicker } from './RgbaColorPicker';

const ColorSwatch = ({ label, value, onChange }: { label?: string, value: string, onChange: (v: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    return (
        <div>
            {label && <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>}
            <button
                ref={anchorRef}
                onClick={() => setIsOpen(true)}
                className="w-full h-10 border border-gray-600 rounded-md"
                style={{ background: value }}
            />
            {isOpen && (
                <ColorPicker
                    value={value}
                    onChange={onChange}
                    onClose={() => setIsOpen(false)}
                    anchorRef={anchorRef}
                />
            )}
        </div>
    );
};

interface TextStylePanelProps {
  element: TextElementData; // This will be undefined when multiple items are selected
  onUpdate: (id: string, updates: Partial<TextElementData>) => void;
  onDelete: () => void;
  onAlign: (hAlign: 'left' | 'center' | 'right' | null, vAlign: 'top' | 'center' | 'bottom' | null) => void;
  onLayer: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
  onDuplicate: (id: string) => void;
  selectionCount: number;
}

const CollapsibleSection = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => (
  <details className="bg-gray-700/50 rounded-lg" open={defaultOpen}>
    <summary className="font-semibold text-white p-3 cursor-pointer select-none">
      {title}
    </summary>
    <div className="p-3 border-t border-gray-600 space-y-4">
      {children}
    </div>
  </details>
);

export const TextStylePanel = ({ element, onUpdate, onDelete, onAlign, onLayer, onDuplicate, selectionCount }: TextStylePanelProps) => {
  
  const isMultiSelect = selectionCount > 1;

  const handleSafeUpdate = <K extends keyof TextElementData>(key: K, value: TextElementData[K]) => {
    if (!element) return;
    onUpdate(element.id, { [key]: value });
  };

  const handleNumberInput = (handler: (val: number) => void, rawValue: string) => {
    const num = parseInt(rawValue, 10);
    if (!isNaN(num)) {
      handler(num);
    }
  };

  const handleFloatInput = (handler: (val: number) => void, rawValue: string) => {
    const num = parseFloat(rawValue);
    if (!isNaN(num)) {
      handler(num);
    }
  };
  
    const handleShadowUpdate = (key: keyof NonNullable<TextElementData['textShadow']>, value: string | number) => {
        if (!element?.textShadow) return;
        const newShadow = { ...element.textShadow };
        if (key === 'color' && typeof value === 'string') {
            newShadow.color = value;
        } else if ((key === 'offsetX' || key === 'offsetY' || key === 'blur') && typeof value === 'number') {
            newShadow[key] = value;
        }
        onUpdate(element.id, { textShadow: newShadow });
    };
    
    const handleStrokeUpdate = (key: keyof NonNullable<TextElementData['textStroke']>, value: string | number) => {
        if (!element?.textStroke) return;
        const newStroke = { ...element.textStroke };
        if (key === 'color' && typeof value === 'string') {
            newStroke.color = value;
        } else if (key === 'width' && typeof value === 'number') {
            newStroke.width = value;
        }
        onUpdate(element.id, { textStroke: newStroke });
    };

  const toggleEffect = (effect: 'textShadow' | 'textStroke') => {
    if (!element) return;
    if (element[effect]) {
      handleSafeUpdate(effect, undefined);
    } else {
      const defaultState = effect === 'textShadow' 
        ? { offsetX: 2, offsetY: 2, blur: 4, color: 'rgba(0,0,0,0.5)' }
        : { width: 2, color: 'rgba(0,0,0,1)' };
      handleSafeUpdate(effect, defaultState as any);
    }
  };

  return (
    <div className="w-full space-y-4 text-white">
      {isMultiSelect ? (
        <div className="p-3 bg-blue-900/50 text-blue-200 rounded-lg text-center font-semibold">
          已选择 {selectionCount} 个图层
        </div>
      ) : (
        element && <div className="flex gap-2">
            <button onClick={() => onDuplicate(element.id)} className="flex-1 p-2 bg-gray-600 hover:bg-gray-500 rounded-md flex items-center justify-center gap-2" title="复制图层">
                <DuplicateIcon className="w-5 h-5"/>
            </button>
        </div>
      )}

      <CollapsibleSection title="对齐" defaultOpen>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">画布对齐</label>
          <div className="grid grid-cols-3 gap-2">
              <button onClick={() => onAlign('left', null)} className="p-2 rounded-md bg-gray-600 hover:bg-gray-500"><AlignLeft className="w-5 h-5 mx-auto" /></button>
              <button onClick={() => onAlign('center', null)} className="p-2 rounded-md bg-gray-600 hover:bg-gray-500"><AlignHCenter className="w-5 h-5 mx-auto" /></button>
              <button onClick={() => onAlign('right', null)} className="p-2 rounded-md bg-gray-600 hover:bg-gray-500"><AlignRight className="w-5 h-5 mx-auto" /></button>
              <button onClick={() => onAlign(null, 'top')} className="p-2 rounded-md bg-gray-600 hover:bg-gray-500"><AlignTop className="w-5 h-5 mx-auto" /></button>
              <button onClick={() => onAlign(null, 'center')} className="p-2 rounded-md bg-gray-600 hover:bg-gray-500"><AlignVCenter className="w-5 h-5 mx-auto" /></button>
              <button onClick={() => onAlign(null, 'bottom')} className="p-2 rounded-md bg-gray-600 hover:bg-gray-500"><AlignBottom className="w-5 h-5 mx-auto" /></button>
          </div>
        </div>
      </CollapsibleSection>

      <div className={isMultiSelect ? 'opacity-50 pointer-events-none' : ''}>
          {element && <>
            <CollapsibleSection title="文本" defaultOpen>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">文本内容</label>
                <textarea 
                  value={element.text} 
                  onChange={(e) => handleSafeUpdate('text', e.target.value)} 
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">文本对齐</label>
                <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => handleSafeUpdate('textAlign', 'left')} className={`p-2 rounded-md ${element.textAlign === 'left' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextLeft className="w-5 h-5 mx-auto" /></button>
                    <button onClick={() => handleSafeUpdate('textAlign', 'center')} className={`p-2 rounded-md ${element.textAlign === 'center' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextCenter className="w-5 h-5 mx-auto" /></button>
                    <button onClick={() => handleSafeUpdate('textAlign', 'right')} className={`p-2 rounded-md ${element.textAlign === 'right' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextRight className="w-5 h-5 mx-auto" /></button>
                    <button onClick={() => handleSafeUpdate('textAlign', 'justify')} className={`p-2 rounded-md ${element.textAlign === 'justify' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}><AlignTextJustifyIcon className="w-5 h-5 mx-auto" /></button>
                </div>
              </div>
            </CollapsibleSection>
            <CollapsibleSection title="字体">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">字体</label>
                <select value={element.fontFamily} onChange={(e) => handleSafeUpdate('fontFamily', e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white">
                  {FONT_FAMILIES.map(font => <option key={font.name} value={font.family}>{font.name}</option>)}
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-400 mb-1">字号</label>
                  <input type="number" value={element.fontSize} onChange={(e) => handleNumberInput(v => handleSafeUpdate('fontSize', v), e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-400 mb-1">字重</label>
                  <select value={element.fontWeight} onChange={(e) => handleNumberInput(v => handleSafeUpdate('fontWeight', v), e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white">
                    <option value={400}>常规</option><option value={700}>加粗</option><option value="900">特粗</option>
                  </select>
                </div>
              </div>
               <ColorSwatch label="颜色" value={element.color} onChange={v => handleSafeUpdate('color', v)} />
            </CollapsibleSection>
            <CollapsibleSection title="效果">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">不透明度</label>
                <input type="range" min="0" max="1" step="0.01" value={element.opacity} onChange={(e) => handleFloatInput(v => handleSafeUpdate('opacity', v), e.target.value)} className="w-full" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                  <input type="checkbox" checked={!!element.textShadow} onChange={() => toggleEffect('textShadow')} className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500" />
                  <span>文字阴影</span>
                </label>
                {element.textShadow && <div className="space-y-2 pl-6">
                    <div className="grid grid-cols-3 gap-2 text-xs"><span>X</span><span>Y</span><span>模糊</span></div>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" value={element.textShadow.offsetX} onChange={(e) => handleNumberInput(v => handleShadowUpdate('offsetX', v), e.target.value)} className="w-full p-1 bg-gray-600 rounded-md text-white" />
                      <input type="number" value={element.textShadow.offsetY} onChange={(e) => handleNumberInput(v => handleShadowUpdate('offsetY', v), e.target.value)} className="w-full p-1 bg-gray-600 rounded-md text-white" />
                      <input type="number" value={element.textShadow.blur} onChange={(e) => handleNumberInput(v => handleShadowUpdate('blur', v), e.target.value)} className="w-full p-1 bg-gray-600 rounded-md text-white" />
                    </div>
                    <ColorSwatch value={element.textShadow.color} onChange={v => handleShadowUpdate('color', v)} />
                </div>}
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                   <input type="checkbox" checked={!!element.textStroke} onChange={() => toggleEffect('textStroke')} className="h-4 w-4 rounded bg-gray-600 text-purple-600 focus:ring-purple-500 border-gray-500" />
                  <span>文字描边</span>
                </label>
                {element.textStroke && <div className="space-y-2 pl-6">
                    <div className="grid grid-cols-2 gap-2 text-xs"><span>宽度</span><span>颜色</span></div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={element.textStroke.width} onChange={(e) => handleNumberInput(v => handleStrokeUpdate('width', v), e.target.value)} className="w-full p-1 bg-gray-600 rounded-md text-white" />
                      <ColorSwatch value={element.textStroke.color} onChange={v => handleStrokeUpdate('color', v)} />
                    </div>
                </div>}
              </div>
            </CollapsibleSection>
            <CollapsibleSection title="图层">
               <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => onLayer(element.id, 'forward')} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md flex items-center justify-center" title="上移一层"><LayersForwardIcon className="w-5 h-5"/></button>
                  <button onClick={() => onLayer(element.id, 'backward')} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md flex items-center justify-center" title="下移一层"><LayersBackwardIcon className="w-5 h-5"/></button>
                  <button onClick={() => onLayer(element.id, 'front')} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md flex items-center justify-center" title="置于顶层"><ArrowToFrontIcon className="w-5 h-5"/></button>
                  <button onClick={() => onLayer(element.id, 'back')} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md flex items-center justify-center" title="置于底层"><ArrowToBackIcon className="w-5 h-5"/></button>
               </div>
            </CollapsibleSection>
          </>}
      </div>
      
      <button onClick={onDelete} className="w-full p-2 mt-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">
        删除 {selectionCount > 1 ? `${selectionCount} 个` : ''}图层
      </button>
    </div>
  );
};