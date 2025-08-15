import { GradientStop } from "../../types";

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

export const isGradient = (color: string | undefined): boolean => typeof color === 'string' && color.startsWith('linear-gradient');

export const parseGradientString = (gradStr: string): { angle: number; stops: GradientStop[] } | null => {
    if (!isGradient(gradStr)) return null;

    const angleMatch = gradStr.match(/linear-gradient\((\d+\.?\d*)deg/);
    const angle = angleMatch ? parseFloat(angleMatch[1]) : 0;

    const stops: GradientStop[] = [];
    
    const stopsString = gradStr.substring(gradStr.indexOf(',') + 1, gradStr.lastIndexOf(')'));
    const individualStops = stopsString.match(/(rgba?\(.+?\)|\S+)\s+\d+\.?\d*%/g) || [];

    for (const stop of individualStops) {
        const parts = stop.match(/(rgba?\(.+?\)|\S+)\s+(\d+\.?\d*)%/);
        if (parts) {
            stops.push({
                id: `stop-${Date.now()}-${Math.random()}`,
                color: parts[1],
                position: parseFloat(parts[2]) / 100
            });
        }
    }
    
    if (stops.length === 0) { // Fallback for simple two-color gradients without explicit positions
        const colorMatches = gradStr.match(/(rgba?\(.+?\)|#([a-fA-F0-9]{3,8})|\b[a-zA-Z]+\b)/g);
        if (colorMatches && colorMatches.length >= 2) {
             stops.push({ id: `stop-${Date.now()}-${Math.random()}`, color: colorMatches[1], position: 0 });
             stops.push({ id: `stop-${Date.now()}-${Math.random()}`, color: colorMatches[colorMatches.length - 1], position: 1 });
        } else {
            return null;
        }
    }
    
    // Ensure first and last stops exist if they were implicit
    if (stops.length > 0 && stops[0].position !== 0) {
        stops.unshift({ id: `stop-${Date.now()}-start`, color: stops[0].color, position: 0 });
    }
     if (stops.length > 0 && stops[stops.length - 1].position !== 1) {
        stops.push({ id: `stop-${Date.now()}-end`, color: stops[stops.length - 1].color, position: 1 });
    }

    return { angle, stops: stops.sort((a,b) => a.position - b.position) };
}

export const toGradientString = (angle: number, stops: GradientStop[]): string => {
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);
    const stopsStr = sortedStops.map(s => `${s.color} ${s.position * 100}%`).join(', ');
    return `linear-gradient(${angle}deg, ${stopsStr})`;
};