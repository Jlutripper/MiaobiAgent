import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { XMarkIcon, PaintBrushIcon } from './icons';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, parseColorString, parseGradientString, toGradientString, isGradient } from './utils/colorUtils';
import { GradientStop } from '../types';


interface EyeDropper {
  new (): EyeDropper;
  open(options?: { signal: AbortSignal }): Promise<{ sRGBHex: string }>;
}
declare global {
  interface Window {
    EyeDropper: EyeDropper;
  }
}

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
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
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
const GradientSlider = ({ angle, stops, activeStopId, onAngleChange, onStopsChange, onActiveStopIdChange }: { angle: number; stops: GradientStop[]; activeStopId: string | null; onAngleChange: (a: number) => void; onStopsChange: (updater: (prevStops: GradientStop[]) => GradientStop[]) => void; onActiveStopIdChange: (id: string | null) => void; }) => {
    const sliderRef = useRef<HTMLDivElement>(null);

    const handleAddStop = useCallback((e: React.MouseEvent) => {
        if (!sliderRef.current || (e.target as HTMLElement).dataset.stop) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newStop: GradientStop = { id: `stop-${Date.now()}`, color: 'rgba(255,255,255,1)', position };

        onStopsChange(prevStops => {
             const newStops = [...prevStops, newStop].sort((a,b) => a.position - b.position);
             onActiveStopIdChange(newStop.id);
             return newStops;
        });
    }, [onStopsChange, onActiveStopIdChange]);

    const handleStopDrag = useCallback((e: React.MouseEvent, stopId: string) => {
        e.preventDefault();
        e.stopPropagation();
        onActiveStopIdChange(stopId);

        const onMouseMove = (moveE: MouseEvent) => {
            if (!sliderRef.current) return;
            const rect = sliderRef.current.getBoundingClientRect();
            const position = Math.max(0, Math.min(1, (moveE.clientX - rect.left) / rect.width));
            
            onStopsChange(prevStops => prevStops.map((s) => s.id === stopId ? { ...s, position } : s));
        };

        const onMouseUp = () => {
            onStopsChange(prevStops => [...prevStops].sort((a, b) => a.position - b.position));
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [onActiveStopIdChange, onStopsChange]);

    const handleRemoveStop = useCallback((stopIdToRemove: string) => {
        if(stops.length <= 2) return;
        onStopsChange(prevStops => {
             const stopToRemove = prevStops.find(s => s.id === stopIdToRemove);
             if (!stopToRemove) return prevStops;

             const newStops = prevStops.filter((s) => s.id !== stopIdToRemove);
             
             if (activeStopId === stopIdToRemove) {
                const currentIndex = prevStops.indexOf(stopToRemove);
                const nextActiveIndex = currentIndex > 0 ? currentIndex - 1 : 0;
                onActiveStopIdChange(newStops[nextActiveIndex]?.id || null);
             }
             
             return newStops;
        });
    }, [stops.length, activeStopId, onStopsChange, onActiveStopIdChange]);
    
    return (
        <div className="space-y-3">
             <div ref={sliderRef} onClick={handleAddStop} className="w-full h-6 rounded-md relative cursor-pointer" style={{ background: toGradientString(90, stops) }}>
                {stops.map((stop) => (
                     <div key={stop.id} data-stop="true" onMouseDown={e => handleStopDrag(e, stop.id)} onDoubleClick={() => handleRemoveStop(stop.id)} className={`absolute -top-1 w-5 h-8 rounded-sm border-2 cursor-pointer transform -translate-x-1/2 ${stop.id === activeStopId ? 'border-blue-400 z-10 scale-110' : 'border-white'}`} style={{ left: `${stop.position*100}%`, background: stop.color }}/>
                ))}
            </div>
             <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">角度</label>
                <input type="number" value={angle} onChange={e => onAngleChange(parseInt(e.target.value) % 360 || 0)} className="w-16 p-1 bg-gray-700 border border-gray-600 rounded-md text-center text-sm"/>
                {stops.length > 2 && activeStopId && <button onClick={() => handleRemoveStop(activeStopId)} className="text-xs text-red-400 ml-auto hover:text-red-300">删除色标</button>}
            </div>
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
    const [gradient, setGradient] = useState<{ angle: number; stops: GradientStop[] }>({ angle: 90, stops: [{ id: 'start', color: 'rgba(0,0,0,1)', position: 0 }, { id: 'end', color: 'rgba(255,255,255,1)', position: 1 }] });
    const [activeStopId, setActiveStopId] = useState<string | null>(null);
    const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({ opacity: 0 });
    
    const pickerRef = useRef<HTMLDivElement>(null);

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
            setActiveTab('solid');
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
            setGradient(g => {
                const newStops = g.stops.map(s => s.id === activeStopId ? { ...s, color: newColor } : s);
                onChange(toGradientString(g.angle, newStops));
                return { ...g, stops: newStops };
            });
        }
    }, [alpha, onChange, activeTab, activeStopId]);
    
    const handleAlphaChange = useCallback((newA: number) => {
        setAlpha(newA);
        const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
        const newColor = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${newA})`;
        if (activeTab === 'solid') {
            onChange(newColor);
        } else if (activeStopId) {
             setGradient(g => {
                const newStops = g.stops.map(s => s.id === activeStopId ? { ...s, color: newColor } : s);
                onChange(toGradientString(g.angle, newStops));
                return { ...g, stops: newStops };
            });
        }
    }, [hsv, onChange, activeTab, activeStopId]);

    const handleHexChange = (hex: string) => {
        const rgb = hexToRgb(hex);
        if(!rgb) return;
        handleHsvChange(rgbToHsv(rgb.r, rgb.g, rgb.b).h, rgbToHsv(rgb.r, rgb.g, rgb.b).s, rgbToHsv(rgb.r, rgb.g, rgb.b).v);
    }
    
    const handleUseEyedropper = async () => {
        if (!window.EyeDropper) { alert("您的浏览器不支持取色器功能。"); return; }
        try { const eyeDropper = new window.EyeDropper(); const result = await eyeDropper.open(); handleHexChange(result.sRGBHex); } catch (e) { console.info('Eyedropper cancelled'); }
    }

    const handleGradientStopsChange = useCallback((updater: (prevStops: GradientStop[]) => GradientStop[]) => {
        setGradient(g => {
            const newStops = updater(g.stops);
            const newGradient = { ...g, stops: newStops };
            onChange(toGradientString(newGradient.angle, newGradient.stops));
            return newGradient;
        });
    }, [onChange]);
    
    const handleGradientAngleChange = useCallback((newAngle: number) => {
        setGradient(g => {
            const newGradient = { ...g, angle: newAngle };
            onChange(toGradientString(newGradient.angle, newGradient.stops));
            return newGradient;
        });
    }, [onChange]);
    
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
                        <button onClick={() => { setActiveTab('gradient'); onChange(toGradientString(gradient.angle, gradient.stops)) }} className={`flex-1 text-sm py-1 rounded ${activeTab === 'gradient' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}>渐变</button>
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
            {activeTab === 'gradient' && allowGradient && <GradientSlider angle={gradient.angle} stops={gradient.stops} activeStopId={activeStopId} onAngleChange={handleGradientAngleChange} onStopsChange={handleGradientStopsChange} onActiveStopIdChange={setActiveStopId} />}
             <div className="flex gap-2 items-center">
                 <button onClick={handleUseEyedropper} className="p-2 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600"><PaintBrushIcon className="w-5 h-5"/></button>
                 <div className="flex-1">
                    <input type="text" value={currentHex} onChange={e => handleHexChange(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-center text-sm"/>
                 </div>
                 <div className="w-16">
                    <input type="number" min="0" max="100" value={Math.round(alpha * 100)} onChange={e => handleAlphaChange(Math.max(0, Math.min(100, Number(e.target.value)))/100)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-center text-sm"/>
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