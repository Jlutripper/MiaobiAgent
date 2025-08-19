import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { produce } from 'immer';
import { XMarkIcon, PaintBrushIcon } from './icons';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, parseColorString, parseGradientString, toGradientString, isGradient } from './utils/colorUtils';
import { Gradient, GradientStop, GradientType, LinearGradient } from '../types';
import { useNumericInput } from '../hooks/useNumericInput';


interface EyeDropper {
  new (): EyeDropper;
  open(options?: { signal: AbortSignal }): Promise<{ sRGBHex: string }>;
}
declare global {
  interface Window {
    EyeDropper: EyeDropper;
  }
}

const defaultLinearGradient: LinearGradient = { type: 'linear', angle: 90, stops: [{ id: 'start', color: 'rgba(0,0,0,1)', position: 0 }, { id: 'end', color: 'rgba(255,255,255,1)', position: 1 }]};

// --- Sub-components for Picker ---
const SaturationValuePicker = ({ hue, saturation, value, onChange }: { hue: number; saturation: number; value: number; onChange: (s: number, v: number) => void; }) => {
    const pickerRef = useRef<HTMLDivElement>(null);
    const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!pickerRef.current) return;
        const rect = pickerRef.current.getBoundingClientRect();
        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
        onChange(Math.max(0, Math.min(1, x / rect.width)), Math.max(0, Math.min(1, 1 - y / rect.height)));
    }, [onChange]);
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        handleMove(e.nativeEvent);
        const onMouseMove = (moveE: MouseEvent) => handleMove(moveE);
        const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [handleMove]);
    return (
        <div ref={pickerRef} className="w-full h-40 relative cursor-pointer rounded-t-md overflow-hidden" style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }} onMouseDown={handleMouseDown}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, white, transparent)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, black, transparent)' }} />
            <div className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none" style={{ left: `${saturation * 100}%`, top: `${(1 - value) * 100}%` }} />
        </div>
    );
};
const HueSlider = ({ hue, onChange }: { hue: number; onChange: (h: number) => void; }) => (
    <div className="w-full h-3 rounded-full relative cursor-pointer" style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}>
        <input type="range" min="0" max="360" value={hue} onChange={e => onChange(Number(e.target.value))} className="absolute opacity-0 inset-0 w-full h-full cursor-pointer" />
    </div>
);
const AlphaSlider = ({ colorRgb, alpha, onChange }: { colorRgb: {r: number, g: number, b: number}, alpha: number; onChange: (a: number) => void; }) => {
    const checkerboard = "url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill-opacity=%22.1%22%3E%3Cpath d=%22M0 0h8v8H0zM8 8h8v8H8z%22/%3E%3C/svg%3E')";
    return (
        <div className="w-full h-3 rounded-full relative cursor-pointer" style={{ backgroundImage: checkerboard }}>
            <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(to right, rgba(${colorRgb.r},${colorRgb.g},${colorRgb.b}, 0), rgb(${colorRgb.r},${colorRgb.g},${colorRgb.b}))` }} />
            <input type="range" min="0" max="1" step="0.01" value={alpha} onChange={e => onChange(Number(e.target.value))} className="absolute opacity-0 inset-0 w-full h-full cursor-pointer" />
        </div>
    );
};
const GradientSlider = ({ gradient, activeStopId, onGradientChange, onActiveStopIdChange }: { gradient: Gradient, activeStopId: string | null; onGradientChange: (g: Gradient) => void; onActiveStopIdChange: (id: string | null) => void; }) => {
    const sliderRef = useRef<HTMLDivElement>(null);

    const handleAddStop = useCallback((e: React.MouseEvent) => {
        if (!sliderRef.current || (e.target as HTMLElement).dataset.stop) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newStop: GradientStop = { id: `stop-${Date.now()}`, color: 'rgba(255,255,255,1)', position };
        
        const newStops = [...gradient.stops, newStop].sort((a,b) => a.position - b.position);
        onGradientChange({ ...gradient, stops: newStops });
        onActiveStopIdChange(newStop.id);

    }, [gradient, onGradientChange, onActiveStopIdChange]);

    const handleStopDrag = useCallback((e: React.MouseEvent, stopId: string) => {
        e.preventDefault();
        e.stopPropagation();
        onActiveStopIdChange(stopId);

        const onMouseMove = (moveE: MouseEvent) => {
            if (!sliderRef.current) return;
            const rect = sliderRef.current.getBoundingClientRect();
            const position = Math.max(0, Math.min(1, (moveE.clientX - rect.left) / rect.width));
            
            onGradientChange({ ...gradient, stops: gradient.stops.map((s) => s.id === stopId ? { ...s, position } : s)});
        };

        const onMouseUp = () => {
            onGradientChange({ ...gradient, stops: [...gradient.stops].sort((a,b) => a.position - b.position)});
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [gradient, onActiveStopIdChange, onGradientChange]);

    const handleRemoveStop = useCallback((stopIdToRemove: string) => {
        if(gradient.stops.length <= 2) return;
        
        const stopToRemove = gradient.stops.find(s => s.id === stopIdToRemove);
        if (!stopToRemove) return;

        const newStops = gradient.stops.filter((s) => s.id !== stopIdToRemove);
        
        if (activeStopId === stopIdToRemove) {
           const currentIndex = gradient.stops.indexOf(stopToRemove);
           const nextActiveIndex = currentIndex > 0 ? currentIndex - 1 : 0;
           onActiveStopIdChange(newStops[nextActiveIndex]?.id || null);
        }
        
        onGradientChange({ ...gradient, stops: newStops });

    }, [gradient, activeStopId, onGradientChange, onActiveStopIdChange]);
    
    return (
        <div className="space-y-3">
             <div ref={sliderRef} onClick={handleAddStop} className="w-full h-6 rounded-md relative cursor-pointer" style={{ background: toGradientString({ ...gradient, type: 'linear', angle: 90 }) }}>
                {gradient.stops.map((stop) => (
                     <div key={stop.id} data-stop="true" onMouseDown={e => handleStopDrag(e, stop.id)} onDoubleClick={() => handleRemoveStop(stop.id)} className={`absolute -top-1 w-5 h-8 rounded-sm border-2 cursor-pointer transform -translate-x-1/2 ${stop.id === activeStopId ? 'border-blue-400 z-10 scale-110' : 'border-white'}`} style={{ left: `${stop.position*100}%`, background: stop.color }}/>
                ))}
            </div>
            {gradient.stops.length > 2 && activeStopId && <button onClick={() => handleRemoveStop(activeStopId)} className="text-xs text-red-400 ml-auto hover:text-red-300">删除色标</button>}
        </div>
    );
};

// --- Main Picker Component ---
export const RgbaColorPicker = ({ value, onChange, onClose, anchorRef, allowGradient = true }: { value: string; onChange: (v: string) => void; onClose: () => void; anchorRef: React.RefObject<HTMLElement>; allowGradient?: boolean; }) => {
    const isInitialValueGradient = allowGradient && isGradient(value);
    const [activeTab, setActiveTab] = useState<'solid' | 'gradient'>(isInitialValueGradient ? 'gradient' : 'solid');
    
    // Solid color state
    const [hsv, setHsv] = useState({ h: 0, s: 1, v: 1 });
    const [alpha, setAlpha] = useState(1);
    
    // Gradient state
    const [gradient, setGradient] = useState<Gradient>(defaultLinearGradient);
    const [activeStopId, setActiveStopId] = useState<string | null>(null);
    const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({ opacity: 0 });
    
    const pickerRef = useRef<HTMLDivElement>(null);
    
    const alphaInputProps = useNumericInput(Math.round(alpha * 100), (val) => handleAlphaChange(Math.max(0, Math.min(100, val)) / 100));
    const angleInputProps = useNumericInput(gradient.type === 'linear' ? gradient.angle : 0, (val) => handleGradientChange({ ...gradient, type: 'linear', angle: val % 360 }));

     useEffect(() => {
        if (!allowGradient && activeTab === 'gradient') {
            setActiveTab('solid');
        }
    }, [allowGradient, activeTab]);

    useEffect(() => {
        if (allowGradient && isGradient(value)) {
            const grad = parseGradientString(value);
            if (grad) {
                setGradient(grad);
                setActiveTab('gradient');
                
                const currentActiveStop = grad.stops.find(s => s.id === activeStopId);
                const activeStopToUse = currentActiveStop || grad.stops[0];
                
                if (activeStopToUse) {
                    setActiveStopId(activeStopToUse.id);
                    const activeStopColor = parseColorString(activeStopToUse.color);
                    setHsv(rgbToHsv(activeStopColor.r, activeStopColor.g, activeStopColor.b));
                    setAlpha(activeStopColor.a);
                }
            }
        } else {
            const solidColor = parseColorString(value);
            setHsv(rgbToHsv(solidColor.r, solidColor.g, solidColor.b));
            setAlpha(solidColor.a);
            if (activeTab === 'gradient') setActiveTab('solid');
        }
    }, [value, allowGradient]);
    
    useEffect(() => {
        if(activeTab === 'gradient'){
            const activeStop = gradient.stops.find(s => s.id === activeStopId);
            if (activeStop) {
                const activeStopColor = parseColorString(activeStop.color);
                setHsv(rgbToHsv(activeStopColor.r, activeStopColor.g, activeStopColor.b));
                setAlpha(activeStopColor.a);
            } else if (gradient.stops.length > 0) {
                setActiveStopId(gradient.stops[0].id);
            }
        }
    }, [activeStopId, activeTab, gradient.stops]);


    const handleHsvChange = useCallback((newH: number, newS: number, newV: number) => {
        setHsv({ h: newH, s: newS, v: newV });
        const { r, g, b } = hsvToRgb(newH, newS, newV);
        const newColor = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
        if (activeTab === 'solid') {
            onChange(newColor);
        } else if (activeStopId) {
            const newGradient = produce(gradient, draft => {
                const stop = draft.stops.find(s => s.id === activeStopId);
                if (stop) stop.color = newColor;
            });
            setGradient(newGradient);
            onChange(toGradientString(newGradient));
        }
    }, [alpha, onChange, activeTab, activeStopId, gradient]);
    
    const handleAlphaChange = useCallback((newA: number) => {
        setAlpha(newA);
        const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
        const newColor = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${newA})`;
        if (activeTab === 'solid') {
            onChange(newColor);
        } else if (activeStopId) {
            const newGradient = produce(gradient, draft => {
                const stop = draft.stops.find(s => s.id === activeStopId);
                if (stop) stop.color = newColor;
            });
            setGradient(newGradient);
            onChange(toGradientString(newGradient));
        }
    }, [hsv, onChange, activeTab, activeStopId, gradient]);

    const handleHexChange = (hex: string) => {
        const rgb = hexToRgb(hex);
        if(!rgb) return;
        handleHsvChange(rgbToHsv(rgb.r, rgb.g, rgb.b).h, rgbToHsv(rgb.r, rgb.g, rgb.b).s, rgbToHsv(rgb.r, rgb.g, rgb.b).v);
    }
    
    const handleUseEyedropper = async () => {
        if (!window.EyeDropper) { alert("您的浏览器不支持取色器功能。"); return; }
        try { const eyeDropper = new window.EyeDropper(); const result = await eyeDropper.open(); handleHexChange(result.sRGBHex); } catch (e) { console.info('Eyedropper cancelled'); }
    }
    
    const handleGradientChange = useCallback((newGradient: Gradient) => {
        setGradient(newGradient);
        onChange(toGradientString(newGradient));
    }, [onChange]);
    
    const handleGradientTypeChange = (type: GradientType) => {
        let newGradient: Gradient;
        switch (type) {
            case 'radial':
                newGradient = { type: 'radial', shape: 'ellipse', position: {x: 50, y: 50}, stops: gradient.stops };
                break;
            case 'conic':
                newGradient = { type: 'conic', angle: 0, position: {x: 50, y: 50}, stops: gradient.stops };
                break;
            case 'linear':
            default:
                 newGradient = { type: 'linear', angle: 90, stops: gradient.stops };
                 break;
        }
        handleGradientChange(newGradient);
    }
    
    useLayoutEffect(() => {
        if (anchorRef.current && pickerRef.current) {
            const anchorRect = anchorRef.current.getBoundingClientRect();
            const pickerRect = pickerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const margin = 8; // Small margin from the anchor

            let top: string | undefined, bottom: string | undefined = 'auto';

            if (anchorRect.bottom + pickerRect.height + margin > viewportHeight) {
                // Not enough space below, position above
                bottom = `${viewportHeight - anchorRect.top + margin}px`;
            } else {
                // Enough space below, position below
                top = `${anchorRect.bottom + margin}px`;
            }

            setPositionStyle({
                position: 'fixed',
                top,
                bottom,
                left: `${anchorRect.left}px`,
                zIndex: 50,
                opacity: 1,
            });
        }
    }, [anchorRef]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node) && !anchorRef.current?.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, anchorRef]);
    
    const { r: currentR, g: currentG, b: currentB } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const currentHex = rgbToHex(currentR, currentG, currentB);
    const swatches = ['#D0021B', '#F5A623', '#F8E71C', '#8B572A', '#7ED321', '#4A90E2', '#50E3C2', '#B8E986', '#000000', '#4A4A4A', '#9B9B9B', '#FFFFFF'];

    return (
        <div ref={pickerRef} style={positionStyle} className="w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-3 flex flex-col gap-3 text-white transition-opacity duration-150">
            <div className="flex justify-between items-center">
                <div className="bg-gray-700 p-0.5 rounded-md flex w-full">
                    <button onClick={() => { setActiveTab('solid'); onChange(`rgba(${Math.round(currentR)},${Math.round(currentG)},${Math.round(currentB)},${alpha})`) }} className={`flex-1 text-sm py-1 rounded ${activeTab === 'solid' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}>纯色</button>
                    {allowGradient && (
                        <button onClick={() => { setActiveTab('gradient'); onChange(toGradientString(gradient)) }} className={`flex-1 text-sm py-1 rounded ${activeTab === 'gradient' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}>渐变</button>
                    )}
                </div>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700 ml-2"><XMarkIcon className="w-5 h-5"/></button>
            </div>
             <div className="space-y-3">
                 <SaturationValuePicker hue={hsv.h} saturation={hsv.s} value={hsv.v} onChange={(s, v) => handleHsvChange(hsv.h, s, v)} />
                 <div className="space-y-3 px-1">
                     <HueSlider hue={hsv.h} onChange={h => handleHsvChange(h, hsv.s, hsv.v)} />
                     <AlphaSlider colorRgb={{r:currentR, g:currentG, b:currentB}} alpha={alpha} onChange={handleAlphaChange} />
                 </div>
             </div>
            {activeTab === 'gradient' && allowGradient && (
                <div className="space-y-3">
                    <div className="bg-gray-700/50 p-0.5 rounded-md flex w-full text-xs">
                        <button onClick={() => handleGradientTypeChange('linear')} className={`flex-1 py-1 rounded ${gradient.type === 'linear' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}>线性</button>
                        <button onClick={() => handleGradientTypeChange('radial')} className={`flex-1 py-1 rounded ${gradient.type === 'radial' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}>径向</button>
                        <button onClick={() => handleGradientTypeChange('conic')} className={`flex-1 py-1 rounded ${gradient.type === 'conic' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}>圆锥</button>
                    </div>
                    {gradient.type === 'linear' && (
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">角度</label>
                            <input type="number" {...angleInputProps} className="w-16 p-1 bg-gray-700 border border-gray-600 rounded-md text-center text-sm"/>
                        </div>
                    )}
                     {gradient.type === 'radial' && (
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">形状</label>
                            <select value={gradient.shape} onChange={e => handleGradientChange({...gradient, shape: e.target.value as any})} className="flex-1 p-1 bg-gray-700 border border-gray-600 rounded-md text-sm"><option value="ellipse">椭圆</option><option value="circle">圆形</option></select>
                        </div>
                    )}
                    <GradientSlider gradient={gradient} activeStopId={activeStopId} onGradientChange={handleGradientChange} onActiveStopIdChange={setActiveStopId} />
                </div>
            )}
             <div className="flex gap-2 items-center">
                 <button onClick={handleUseEyedropper} className="p-2 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600"><PaintBrushIcon className="w-5 h-5"/></button>
                 <div className="flex-1">
                    <input type="text" value={currentHex} onChange={e => handleHexChange(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-center text-sm"/>
                 </div>
                 <div className="w-16">
                    <input type="number" min="0" max="100" {...alphaInputProps} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-center text-sm"/>
                 </div>
             </div>
             <div>
                <label className="text-sm text-gray-400 mb-1">文档颜色</label>
                <div className="grid grid-cols-6 gap-2">
                    {swatches.map(swatch => <button key={swatch} onClick={()=>handleHexChange(swatch)} className="w-full h-6 rounded border border-gray-600" style={{background: swatch}}/>)}
                </div>
             </div>
        </div>
    );
};