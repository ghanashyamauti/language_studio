import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, Move } from 'lucide-react';

export default function ImageCropperModal({
  isOpen,
  onClose,
  imageFile,
  cropWidth = 200,
  cropHeight = 200,
  isRound = false,
  onSave
}) {
  const [imgSrc, setImgSrc] = useState('');
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Load image file as data URL
  useEffect(() => {
    if (!imageFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  if (!isOpen || !imgSrc) return null;

  // Container dimensions
  const containerWidth = 320;
  const containerHeight = 320;

  // Crop frame offset inside container
  const cropX = (containerWidth - cropWidth) / 2;
  const cropY = (containerHeight - cropHeight) / 2;

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y
    };
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.current.x,
      y: e.touches[0].clientY - dragStart.current.y
    });
  };

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');

    // Get image's current display scale factor
    const rect = img.getBoundingClientRect();
    const currentDisplayWidth = rect.width;
    const currentDisplayHeight = rect.height;

    // Scale ratio between natural and displayed size
    const scaleX = img.naturalWidth / currentDisplayWidth;
    const scaleY = img.naturalHeight / currentDisplayHeight;

    // Image coordinates relative to container (including offset and drag position)
    const imgX = (containerWidth - img.width) / 2 + position.x;
    const imgY = (containerHeight - img.height) / 2 + position.y;

    // Calculate source crop area on natural image
    // Note: rect.left/top includes transform scaling, so we compute based on standard positions
    // Displayed offset of crop frame from image top-left
    const dx = cropX - imgX;
    const dy = cropY - imgY;

    // Account for zoom transform about center
    // Rect width/height is zoomed, but image.width/height is original display size
    const zoomOffsetW = (currentDisplayWidth - img.width) / 2;
    const zoomOffsetH = (currentDisplayHeight - img.height) / 2;

    // Crop box top-left relative to actual zoomed image bounds
    const relativeCropX = dx - zoomOffsetW;
    const relativeCropY = dy - zoomOffsetH;

    // Map crop box back to original natural image dimensions
    const sourceX = relativeCropX * scaleX;
    const sourceY = relativeCropY * scaleY;
    const sourceWidth = cropWidth * scaleX;
    const sourceHeight = cropHeight * scaleY;

    // Fill background with white (for transparency compatibility in JPEGs)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cropWidth, cropHeight);

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    // Force jpeg compression at 0.85 quality for ultra-fast uploads
    canvas.toBlob((blob) => {
      if (blob) {
        // Change file extension to .jpg
        const originalName = imageFile.name || 'image.png';
        const cleanName = originalName.replace(/\.[^/.]+$/, "") + ".jpg";
        const croppedFile = new File([blob], cleanName, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        onSave(croppedFile);
      }
    }, 'image/jpeg', 0.85);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Crop & Position Image</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center gap-6">
          {/* Crop Container */}
          <div
            ref={containerRef}
            className="w-[320px] h-[320px] bg-slate-900 overflow-hidden relative select-none rounded-xl border border-slate-800"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            {/* Image */}
            <img
              ref={imgRef}
              src={imgSrc}
              alt="Crop preview"
              className="absolute pointer-events-none origin-center"
              style={{
                width: 'auto',
                height: '100%',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                cursor: isDragging ? 'grabbing' : 'grab',
                maxWidth: 'none',
                maxHeight: 'none',
                margin: 0,
              }}
            />

            {/* Mouse Grabbing Overlay (captures mouse drag events) */}
            <div
              className="absolute inset-0 cursor-move z-10"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            />

            {/* Crop Overlay Mask */}
            <div className="absolute inset-0 pointer-events-none z-20 flex flex-col">
              {/* Top mask */}
              <div className="bg-black/55 w-full flex-1" />
              <div className="flex w-full" style={{ height: cropHeight }}>
                {/* Left mask */}
                <div className="bg-black/55" style={{ width: cropX }} />
                {/* Crop Box Border */}
                <div
                  className={`border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] relative`}
                  style={{
                    width: cropWidth,
                    height: cropHeight,
                    borderRadius: isRound ? '50%' : '8px'
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-white/30">
                    <Move size={24} />
                  </div>
                </div>
                {/* Right mask */}
                <div className="bg-black/55" style={{ width: cropX }} />
              </div>
              {/* Bottom mask */}
              <div className="bg-black/55 w-full flex-1" />
            </div>
          </div>

          {/* Controls */}
          <div className="w-full space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1"><ZoomOut size={14} /> Zoom Out</span>
              <span className="flex items-center gap-1">Zoom In <ZoomIn size={14} /></span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="4"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <p className="text-center text-xs text-slate-400">
              Drag image inside frame to position. Use slider to zoom.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            Crop & Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
