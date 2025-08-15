import { Gradient, GradientStop, GradientType, LinearGradient, RadialGradient, ConicGradient, RadialGradientShape } from "../../types";

// --- Color Conversion Utilities ---
export const hexToRgb = (hex: string): { r: number, g: number, b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};

export const rgbToHex = (r: number, g: number, b: number): string => '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');

export const rgbToHsv = (r: number, g: number, b: number): { h: number, s: number, v: number } => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s, v: v };
};

export const hsvToRgb = (h: number, s: number, v: number): { r: number, g: number, b: number } => {
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
};

export const parseRgba = (rgba: string): { r: number, g: number, b: number, a: number } | null => {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]), a: match[4] ? parseFloat(match[4]) : 1 };
    return null;
}

export const parseColorString = (colorStr: string): { r: number, g: number, b: number, a: number } => {
    if (!colorStr || typeof colorStr !== 'string') return { r: 0, g: 0, b: 0, a: 1 };
    
    if (isGradient(colorStr)) {
        const gradient = parseGradientString(colorStr);
        // Return the color of the first stop for gradients
        if (gradient && gradient.stops.length > 0) {
            return parseColorString(gradient.stops[0].color);
        }
    }
    
    if (colorStr.startsWith('#')) { 
        const rgb = hexToRgb(colorStr); 
        return rgb ? { ...rgb, a: 1 } : {r:0,g:0,b:0,a:1}; 
    }
    const rgba = parseRgba(colorStr);
    if(rgba) return rgba;
    
    // Fallback for named colors
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) { 
        ctx.fillStyle = colorStr; 
        const hex = ctx.fillStyle; 
        if (hex.startsWith('#')) { 
            const rgb = hexToRgb(hex); 
            return rgb ? { ...rgb, a: 1 } : {r:0,g:0,b:0,a:1}; 
        }
    }
    return { r: 0, g: 0, b: 0, a: 1 }; // Default fallback
};

// --- Gradient Utilities ---

export const isGradient = (color: string | undefined): boolean => typeof color === 'string' && /^(linear|radial|conic)-gradient/.test(color);

export const parseGradientString = (gradStr: string): Gradient | null => {
    if (!isGradient(gradStr)) return null;

    const typeMatch = gradStr.match(/^(linear|radial|conic)/);
    const type = (typeMatch?.[0] as GradientType) || 'linear';

    const stops: GradientStop[] = [];
    const stopsString = gradStr.substring(gradStr.indexOf('(') + 1, gradStr.lastIndexOf(')'));
    
    const colorStopRegex = /(rgba?\(.+?\)|#([a-fA-F0-9]{3,8})|\b[a-zA-Z]+\b)(\s+\d+\.?\d*%)?/g;
    let stopMatches;
    let lastPosition = 0;
    while((stopMatches = colorStopRegex.exec(stopsString)) !== null) {
        if (stopMatches.index > stopsString.indexOf(',')) { // ensure we are parsing stops, not params
            const color = stopMatches[1];
            let position: number | null = null;
            if (stopMatches[3]) {
                position = parseFloat(stopMatches[3].trim()) / 100;
            }
            stops.push({ id: `stop-${Date.now()}-${Math.random()}`, color, position: position as any });
        }
    }
    
    // Auto-assign positions if missing
    const unpositionedCount = stops.filter(s => s.position === null).length;
    if (unpositionedCount > 0) {
      let lastDefinedPos = stops.find(s => s.position !== null)?.position || 0;
      let nextDefinedPosIdx = stops.findIndex((s, i) => i > 0 && s.position !== null);
      for (let i = 0; i < stops.length; i++) {
        if (stops[i].position === null) {
          const start = lastDefinedPos;
          const end = nextDefinedPosIdx !== -1 ? stops[nextDefinedPosIdx].position : 1;
          const num = stops.slice(i, nextDefinedPosIdx !== -1 ? nextDefinedPosIdx : stops.length).length;
          const step = (end-start)/(num+1);
          for(let j=0; j<num; j++){
              stops[i+j].position = start + (j+1)*step;
          }
          i += num - 1;
        }
        lastDefinedPos = stops[i].position;
        nextDefinedPosIdx = stops.findIndex((s, k) => k > i && s.position !== null);
      }
    }

    const paramsStr = stopsString.substring(0, stopsString.indexOf(','));

    switch (type) {
        case 'linear':
            const angleMatch = paramsStr.match(/(\d+\.?\d*)deg/);
            return { type: 'linear', angle: angleMatch ? parseFloat(angleMatch[1]) : 180, stops };
        case 'radial':
            const shapeMatch = paramsStr.match(/(circle|ellipse)/);
            const posMatch = paramsStr.match(/at\s+(\d+\.?\d*)%\s+(\d+\.?\d*)%/);
            return { type: 'radial', shape: (shapeMatch?.[0] as RadialGradientShape) || 'ellipse', position: posMatch ? { x: parseFloat(posMatch[1]), y: parseFloat(posMatch[2]) } : { x: 50, y: 50 }, stops };
        case 'conic':
             const conicAngleMatch = paramsStr.match(/from\s+(\d+\.?\d*)deg/);
             const conicPosMatch = paramsStr.match(/at\s+(\d+\.?\d*)%\s+(\d+\.?\d*)%/);
             return { type: 'conic', angle: conicAngleMatch ? parseFloat(conicAngleMatch[1]) : 0, position: conicPosMatch ? { x: parseFloat(conicPosMatch[1]), y: parseFloat(conicPosMatch[2]) } : { x: 50, y: 50 }, stops };
        default:
            return null;
    }
}

export const toGradientString = (gradient: Gradient): string => {
    const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position);
    const stopsStr = sortedStops.map(s => `${s.color} ${s.position * 100}%`).join(', ');

    switch (gradient.type) {
        case 'linear':
            return `linear-gradient(${gradient.angle}deg, ${stopsStr})`;
        case 'radial':
            return `radial-gradient(${gradient.shape} at ${gradient.position.x}% ${gradient.position.y}%, ${stopsStr})`;
        case 'conic':
            return `conic-gradient(from ${gradient.angle}deg at ${gradient.position.x}% ${gradient.position.y}%, ${stopsStr})`;
        default:
            return '';
    }
};