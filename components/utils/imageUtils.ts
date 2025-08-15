export const resizeAndCompressImage = (
    file: File,
    options: { maxWidth: number; quality: number }
): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Pass through non-standard image types like SVG directly
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const { width, height } = img;
                
                let newWidth = width;
                let newHeight = height;

                if (newWidth > options.maxWidth) {
                    newWidth = options.maxWidth;
                    newHeight = newWidth / (width / height);
                }
                
                canvas.width = newWidth;
                canvas.height = newHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                // Preserve PNG format for transparency, otherwise use JPEG for better compression.
                const outputMimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                const dataUrl = canvas.toDataURL(outputMimeType, options.quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};