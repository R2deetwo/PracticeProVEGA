
import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import { HeaderConfiguration } from '../../types';
import { UploadIcon, TrashIcon, CheckIcon, ZoomInIcon, ZoomOutIcon, ArrowPathIcon as RefreshCcwIcon } from '../../constants';

interface HeaderDesignerProps {
    config: HeaderConfiguration;
    onChange: (newConfig: HeaderConfiguration) => void;
    onClose: () => void;
}

type SelectedElement = 'logo' | 'firmName' | 'address' | null;

export const HeaderDesigner: React.FC<HeaderDesignerProps> = ({ config, onChange, onClose }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localConfig, setLocalConfig] = useState<HeaderConfiguration>(config);
    const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
    const [zoom, setZoom] = useState(1.0);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Initial Defaults if not present (Migration)
    useEffect(() => {
        let needsUpdate = false;
        const newConfig = { ...localConfig };

        // Default positions if missing (center-ish)
        if (newConfig.firmName && newConfig.firmName.x === undefined) {
            newConfig.firmName = { ...newConfig.firmName, x: 400, y: 50, width: 300, alignment: 'custom' };
            needsUpdate = true;
        }
        if (newConfig.address && newConfig.address.x === undefined) {
            newConfig.address = { ...newConfig.address, x: 400, y: 100, width: 300, alignment: 'custom' };
            needsUpdate = true;
        }
        if (newConfig.logo && newConfig.logo.x === undefined) {
            newConfig.logo = { ...newConfig.logo, x: 100, y: 60, position: 'custom' };
            needsUpdate = true;
        }

        if (needsUpdate) {
            setLocalConfig(newConfig);
        }
    }, []);

    const handleUpdate = (updates: Partial<HeaderConfiguration>) => {
        const newConfig = { ...localConfig, ...updates };
        setLocalConfig(newConfig);
        onChange(newConfig);
    };

    const handleNestedUpdate = (
        section: 'firmName' | 'address' | 'logo',
        updates: any
    ) => {
        const newConfig = {
            ...localConfig,
            [section]: { ...localConfig[section as keyof HeaderConfiguration] as any, ...updates }
        };
        setLocalConfig(newConfig);
        onChange(newConfig);
    };

    // --- Drag & Resize Logic ---
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const initialResize = useRef({ w: 0, h: 0, x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent, element: SelectedElement) => {
        if (!element) return;
        e.stopPropagation();
        setSelectedElement(element);
        setIsDragging(true);

        const clientX = e.clientX;
        const clientY = e.clientY;

        // Calculate offset from the element's top-left
        const currentItem = localConfig[element as keyof HeaderConfiguration] as any;
        if (currentItem && canvasRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect();
            // The item's visual position is relative to canvas
            // We need to store where we grabbed it relative to its own origin
            // Actually, easier: store the difference between mouse and current X/Y

            // Current Item Scaled Position? No, we store raw X/Y.
            // Canvas is zoomed.

            dragOffset.current = {
                x: clientX - (currentItem.x || 0) * zoom, // Correct logic requires unprojecting.. keeping simple for now
                y: clientY - (currentItem.y || 0) * zoom
            };
        }
    };

    const handleResizeStart = (e: React.MouseEvent, element: SelectedElement) => {
        e.stopPropagation();
        setSelectedElement(element);
        setIsResizing(true);
        const currentItem = localConfig[element as keyof HeaderConfiguration] as any;
        initialResize.current = {
            w: currentItem.width || (element === 'logo' ? (currentItem.height || 60) : 200), // Approximate for logo aspect if needed
            h: currentItem.height || (currentItem.fontSize || 16),
            x: e.clientX,
            y: e.clientY
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging && !isResizing) return;
            if (!selectedElement || !canvasRef.current) return;

            const canvasRect = canvasRef.current.getBoundingClientRect();

            if (isDragging) {
                // Determine new X/Y relative to canvas
                // Mouse Client Pos - Canvas Left - Drag Offset (local to element optional)
                // Let's simplify: New Pos = (Mouse - CanvasPos) / Zoom
                // We need to maintain the "grab point".

                // Better approach:
                // Delta Movement = (Current Mouse - Prev Mouse) / Zoom
                // But we don't track prev mouse easily in useEffect without ref.
                // Let's use the offset derived in MouseDown.

                // Actually, let's use a simpler "delta" approach if we store the start mouse pos.
                // But I stored offset = Client - (ItemPos * Zoom).
                // So ItemPos * Zoom = Client - Offset => ItemPos = (Client - Offset) / Zoom.

                // But "Offset" depends on Canvas position staying same.
                // Let's recalculate:
                // On MouseDown: OffsetX = e.clientX - (canvasRect.left + item.x * zoom)

                // Let's refine handleMouseDown first, but here implies I need a better ref.
                // Re-calculating:

                // New X = (e.clientX - canvasRect.left - dragOffset.current.x) / zoom
                // Wait, dragOffset in MouseDown (below) needs to be: e.clientX - (canvas.left + item.x * zoom)
            }
        };

        // Implementing Global Listener Logic manually inside the component for simplicity
        // But better to use the 'onMouseMove' of the container or window.
        // We'll attach to window.
    }, [isDragging, isResizing, selectedElement, zoom]);


    // --- Optimized Drag Handlers ---
    const handleDragMove = (e: React.MouseEvent) => {
        if (!isDragging || !selectedElement || !canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();

        // We need to capture the offset correctly in MouseDown.
        // Let's just do: Delta X = movementX / zoom.
        // But movementX is per event.

        // Let's stick to absolute calculation.
        // X = (e.clientX - canvasRect.left - dragOffset.current.x) / zoom

        let newX = (e.clientX - canvasRect.left) / zoom - dragOffset.current.x;
        let newY = (e.clientY - canvasRect.top) / zoom - dragOffset.current.y;

        // Snap to grid / bounds? (Optional)
        newX = Math.round(newX);
        newY = Math.round(newY);

        handleNestedUpdate(selectedElement as any, { x: newX, y: newY });
    };

    const handleResizeMove = (e: React.MouseEvent) => {
        if (!isResizing || !selectedElement) return;

        // Delta
        const deltaX = (e.clientX - initialResize.current.x) / zoom;
        const deltaY = (e.clientY - initialResize.current.y) / zoom; // height?

        if (selectedElement === 'logo') {
            // Constrained aspect ratio usually desired, but let's just scale height for now as that's the main prop
            // Logo config usually tracks 'height'. Width is auto.
            // If user drags corner, we change height.
            const newHeight = Math.max(20, initialResize.current.h + deltaY); // or deltaX if dragging right?
            // Let's assume diagonal drag implies sizing.
            const scale = Math.max(deltaX, deltaY);
            // Simplified: just track height for logo
            handleNestedUpdate('logo', { height: Math.max(20, initialResize.current.h + scale) });
        } else {
            // Text Elements: Resize = Width change? Font Size Change?
            // Usually text box resize = width chang, font size explicit.
            // But user said "increase and decrease size of things".
            // Let's make the corner drag change Font Size for text? Or just Width?
            // Let's do Width. Font size via sidebar is more precise.

            // Actually, for "Design Canvas", corner drag often changes Font Size for text blocks if it's "scale".
            // Let's stick to Width for wrapping, and Sidebar for Font Size.
            // UNLESS user holds Shift?

            // Let's make it change Width.
            const newWidth = Math.max(50, initialResize.current.w + deltaX);
            handleNestedUpdate(selectedElement as any, { width: newWidth });
        }
    };

    const onWindowMouseMove = (e: any) => {
        if (isDragging) handleDragMove(e);
        if (isResizing) handleResizeMove(e);
    };

    const onWindowMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    // Attach/Detach global listeners
    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', onWindowMouseMove);
            window.addEventListener('mouseup', onWindowMouseUp);
        } else {
            window.removeEventListener('mousemove', onWindowMouseMove);
            window.removeEventListener('mouseup', onWindowMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onWindowMouseMove);
            window.removeEventListener('mouseup', onWindowMouseUp);
        };
    }, [isDragging, isResizing]);

    // Enhanced MouseDown to capture offset
    const onMouseDownItem = (e: React.MouseEvent, element: SelectedElement) => {
        e.stopPropagation();
        if (!canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        const item = localConfig[element as keyof HeaderConfiguration] as any;
        const itemX = item?.x || 0;
        const itemY = item?.y || 0;

        // Offset = (MousePos relative to Canvas) - (Item Pos)
        // MousePosRel = (e.clientX - rect.left) / zoom
        const mouseXRel = (e.clientX - canvasRect.left) / zoom;
        const mouseYRel = (e.clientY - canvasRect.top) / zoom;

        dragOffset.current = {
            x: mouseXRel - itemX,
            y: mouseYRel - itemY
        };

        setSelectedElement(element);
        setIsDragging(true);
    };

    const onMouseDownResize = (e: React.MouseEvent, element: SelectedElement) => {
        e.stopPropagation();
        initialResize.current = {
            x: e.clientX,
            y: e.clientY,
            w: (localConfig[element as keyof HeaderConfiguration] as any)?.width || 100, // default
            h: (localConfig[element as keyof HeaderConfiguration] as any)?.height || 60, // default logo
        };
        setSelectedElement(element);
        setIsResizing(true);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                handleNestedUpdate('logo', {
                    url: reader.result as string,
                    position: 'custom',
                    x: localConfig.logo?.x || 50,
                    y: localConfig.logo?.y || 50,
                    height: localConfig.logo?.height || 80
                });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-fade-in cursor-default"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="w-full h-full max-w-[95vw] max-h-[95vh] flex rounded-2xl overflow-hidden shadow-2xl border border-zinc-700 bg-[#1e1e1e]"
                onClick={(e) => e.stopPropagation()}
            >

                {/* 1. Sidebar - Controls */}
                <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col z-20">
                    <div className="p-4 border-b border-zinc-800">
                        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                            <span className="bg-primary-600 w-2 h-6 rounded-full"></span>
                            Header Designer
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">

                        {!selectedElement ? (
                            <div className="space-y-6">
                                <div className="text-center py-8 text-zinc-500 space-y-4 border-b border-zinc-800 pb-8">
                                    <div className="w-16 h-16 bg-zinc-800 rounded-full mx-auto flex items-center justify-center">
                                        <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                    </div>
                                    <p className="text-sm">Click an element on the canvas to customize it.</p>
                                </div>

                                {!localConfig.logo && (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full py-4 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center gap-2 text-zinc-400 hover:text-white hover:border-primary-500 hover:bg-zinc-800 transition-all group"
                                    >
                                        <UploadIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-bold uppercase">Add Firm Logo</span>
                                        <input autoComplete="off" data-lpignore="true"  type="file" ref={fileInputRef} hidden onChange={handleLogoUpload} accept="image/*" />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="animate-fade-in space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase text-primary-400">
                                        Editing: {selectedElement === 'logo' ? 'Firm Logo' : (selectedElement === 'firmName' ? 'Firm Name' : 'Address')}
                                    </span>
                                    {selectedElement === 'logo' && (
                                        <button onClick={() => handleUpdate({ logo: undefined })} className="text-red-400 hover:text-red-300 p-1"><TrashIcon className="w-4 h-4" /></button>
                                    )}
                                </div>

                                {selectedElement === 'logo' && localConfig.logo && (
                                    <div className="space-y-4">
                                        <div onClick={() => fileInputRef.current?.click()} className="h-32 bg-zinc-800 rounded-lg border-2 border-dashed border-zinc-700 hover:border-primary-500 cursor-pointer flex items-center justify-center relative group overflow-hidden">
                                            <img src={localConfig.logo.url} className="h-full object-contain p-2" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center"><span className="text-xs text-white font-bold">Replace</span></div>
                                        </div>
                                        <input autoComplete="off" data-lpignore="true"  type="file" ref={fileInputRef} hidden onChange={handleLogoUpload} accept="image/*" />

                                        <div>
                                            <label className="text-2xs uppercase font-bold text-zinc-500">Size (Height)</label>
                                            <input autoComplete="off" data-lpignore="true"  type="range" min="20" max="200" value={localConfig.logo.height} onChange={(e) => handleNestedUpdate('logo', { height: parseInt(e.target.value) })} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary-500 mt-2" />
                                        </div>
                                    </div>
                                )}

                                {(selectedElement === 'firmName' || selectedElement === 'address') && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-2xs uppercase font-bold text-zinc-500 mb-1 block">Content</label>
                                            {selectedElement === 'address' ? (
                                                <textarea
                                                    value={localConfig.address.text}
                                                    onChange={(e) => handleNestedUpdate('address', { text: e.target.value })}
                                                    className="w-full bg-zinc-800 border-zinc-700 rounded p-2 text-sm text-white h-24"
                                                />
                                            ) : (
                                                <input autoComplete="off" data-lpignore="true" 
                                                    type="text"
                                                    value={localConfig.firmName.text}
                                                    onChange={(e) => handleNestedUpdate('firmName', { text: e.target.value })}
                                                    className="w-full bg-zinc-800 border-zinc-700 rounded p-2 text-sm text-white"
                                                />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-2xs uppercase font-bold text-zinc-500">Font Size</label>
                                                <input autoComplete="off" data-lpignore="true" 
                                                    type="number"
                                                    value={selectedElement === 'firmName' ? localConfig.firmName.fontSize : localConfig.address.fontSize}
                                                    onChange={(e) => handleNestedUpdate(selectedElement, { fontSize: parseInt(e.target.value) })}
                                                    className="w-full bg-zinc-800 border-zinc-700 rounded p-2 text-sm text-white mt-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-2xs uppercase font-bold text-zinc-500">Color</label>
                                                <div className="h-[38px] mt-1 bg-zinc-800 rounded border border-zinc-700 px-1 py-1">
                                                    <input autoComplete="off" data-lpignore="true" 
                                                        type="color"
                                                        value={localConfig.firmName.color} // Address usually shares color or is gray
                                                        onChange={(e) => handleNestedUpdate('firmName', { color: e.target.value })}
                                                        disabled={selectedElement === 'address' && false}
                                                        className="w-full h-full bg-transparent cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {selectedElement === 'firmName' && (
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input autoComplete="off" data-lpignore="true" 
                                                    type="checkbox"
                                                    checked={localConfig.firmName.fontWeight === 'bold'}
                                                    onChange={(e) => handleNestedUpdate('firmName', { fontWeight: e.target.checked ? 'bold' : 'normal' })}
                                                    className="rounded bg-zinc-700 border-zinc-600 text-primary-600 focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-zinc-300">Bold Font</span>
                                            </label>
                                        )}

                                        <div>
                                            <label className="text-2xs uppercase font-bold text-zinc-500">Alignment</label>
                                            <div className="flex bg-zinc-800 p-1 rounded mt-1">
                                                {['left', 'center', 'right'].map((align) => (
                                                    <button
                                                        key={align}
                                                        onClick={() => handleNestedUpdate(selectedElement, { alignment: align as any })} // Keep alignment logic for internal text align
                                                        className={`flex-1 py-1 text-xs rounded uppercase ${((selectedElement === 'firmName' ? localConfig.firmName.alignment : localConfig.address.alignment) === align) ? 'bg-zinc-600 text-white' : 'text-zinc-500'}`}
                                                    >
                                                        {align}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-2xs text-zinc-600 mt-1">Controls text alignment within the box.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* General Settings - Always Visible */}
                        <div className="mt-auto pt-6 border-t border-zinc-800">
                            <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-lg hover:bg-zinc-800/50 transition-colors">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${localConfig.showOnAllPages ? 'bg-green-500 border-green-500' : 'border-zinc-600'}`}>
                                    {localConfig.showOnAllPages && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <input autoComplete="off" data-lpignore="true" 
                                    type="checkbox"
                                    checked={localConfig.showOnAllPages}
                                    onChange={(e) => handleUpdate({ showOnAllPages: e.target.checked })}
                                    className="hidden"
                                />
                                <span className="text-sm font-medium text-zinc-300">Show on all pages</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* 2. Main Canvas Area */}
                <div className="flex-1 bg-[#121212] relative overflow-hidden flex flex-col">
                    {/* Toolbar */}
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-zinc-800/90 backdrop-blur border border-zinc-700 rounded-full px-4 py-2 flex items-center gap-4 shadow-xl z-30">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 hover:text-white text-zinc-400"><ZoomOutIcon className="w-4 h-4" /></button>
                            <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} className="p-1 hover:text-white text-zinc-400"><ZoomInIcon className="w-4 h-4" /></button>
                        </div>
                        <div className="w-px h-4 bg-zinc-700"></div>
                        <button onClick={() => {
                            // Reset Layout
                            handleUpdate({
                                logo: localConfig.logo ? { ...localConfig.logo, x: 50, y: 50 } : undefined,
                                firmName: { ...localConfig.firmName, x: 250, y: 50, width: 400 },
                                address: { ...localConfig.address, x: 250, y: 100, width: 400 }
                            });
                        }} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
                            <RefreshCcwIcon className="w-3 h-3" /> Reset Layout
                        </button>
                    </div>

                    {/* Canvas Container */}
                    <div className="flex-1 overflow-auto p-10 flex items-start justify-center cursor-grab active:cursor-grabbing"
                        onMouseDown={(e) => {
                            // Panning logic could go here, for now just deselect
                            if (e.target === e.currentTarget) setSelectedElement(null);
                        }}
                    >
                        <div
                            ref={canvasRef}
                            className="bg-white shadow-2xl relative transition-transform duration-75 ease-out origin-top-left"
                            style={{
                                width: '210mm', // A4 Width
                                height: '297mm', // A4 Height (though we only care about top part usually)
                                transform: `scale(${zoom})`,
                                minHeight: '1000px', // Visual placeholder
                                backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
                                backgroundSize: '20px 20px'
                            }}
                        >
                            {/* Visual Header Boundary Guide */}
                            <div className="absolute top-0 left-0 right-0 border-b border-blue-400/30 border-dashed pointer-events-none" style={{ height: '150px' }}>
                                <span className="absolute bottom-1 right-2 text-2xs text-blue-400/50">Fold Line (Approx)</span>
                            </div>

                            {/* --- Draggable Elements --- */}

                            {/* 1. Logo */}
                            {localConfig.logo && (
                                <div
                                    className={`absolute group cursor-move select-none ${selectedElement === 'logo' ? 'ring-2 ring-primary-500 z-50' : 'hover:ring-1 hover:ring-primary-300 z-10'}`}
                                    style={{
                                        left: localConfig.logo.x || 50,
                                        top: localConfig.logo.y || 50,
                                        height: localConfig.logo.height,
                                        width: 'auto' // Logo width auto based on height
                                    }}
                                    onMouseDown={(e) => onMouseDownItem(e, 'logo')}
                                >
                                    <img src={localConfig.logo.url} className="h-full w-auto pointer-events-none" />
                                    {selectedElement === 'logo' && (
                                        <div
                                            className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary-500 rounded-full cursor-se-resize shadow-md hover:scale-125 transition-transform"
                                            onMouseDown={(e) => onMouseDownResize(e, 'logo')}
                                        />
                                    )}
                                </div>
                            )}

                            {/* 2. Firm Name */}
                            <div
                                className={`absolute group cursor-move select-none flex items-center ${selectedElement === 'firmName' ? 'ring-2 ring-primary-500 z-40 bg-blue-50/10' : 'hover:ring-1 hover:ring-primary-300 z-20 hover:bg-slate-50/50'}`}
                                style={{
                                    left: localConfig.firmName.x || 250,
                                    top: localConfig.firmName.y || 50,
                                    width: localConfig.firmName.width || 400,
                                    // Height is auto based on content
                                }}
                                onMouseDown={(e) => onMouseDownItem(e, 'firmName')}
                            >
                                <div
                                    className="w-full break-words pointer-events-none"
                                    style={{
                                        fontSize: `${localConfig.firmName.fontSize}px`,
                                        fontWeight: localConfig.firmName.fontWeight,
                                        color: localConfig.firmName.color,
                                        textAlign: localConfig.firmName.alignment as any
                                    }}
                                >
                                    {localConfig.firmName.text || "Firm Name"}
                                </div>
                                {selectedElement === 'firmName' && (
                                    <>
                                        {/* Width Handles */}
                                        <div className="absolute top-0 bottom-0 -right-1 w-1.5 cursor-ew-resize hover:bg-primary-400 opacity-0 hover:opacity-100 transition-opacity" onMouseDown={(e) => onMouseDownResize(e, 'firmName')} />
                                        <div className="absolute top-0 bottom-0 -left-1 w-1.5 cursor-ew-resize hover:bg-primary-400 opacity-0 hover:opacity-100 transition-opacity" /> {/* Simplified: right resize only for MVP */}
                                        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-primary-500 cursor-se-resize rounded-sm shadow border border-white" onMouseDown={(e) => onMouseDownResize(e, 'firmName')} />
                                    </>
                                )}
                            </div>

                            {/* 3. Address */}
                            <div
                                className={`absolute group cursor-move select-none ${selectedElement === 'address' ? 'ring-2 ring-primary-500 z-30 bg-blue-50/10' : 'hover:ring-1 hover:ring-primary-300 z-10 hover:bg-slate-50/50'}`}
                                style={{
                                    left: localConfig.address.x || 250,
                                    top: localConfig.address.y || 100,
                                    width: localConfig.address.width || 400,
                                }}
                                onMouseDown={(e) => onMouseDownItem(e, 'address')}
                            >
                                <div
                                    className="w-full whitespace-pre-line pointer-events-none"
                                    style={{
                                        fontSize: `${localConfig.address.fontSize}px`,
                                        color: localConfig.firmName.color, // Inherit color for now implies theme consistency
                                        opacity: 0.85,
                                        textAlign: localConfig.address.alignment as any
                                    }}
                                >
                                    {localConfig.address.text || "Firm Address"}
                                </div>
                                {selectedElement === 'address' && (
                                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-primary-500 cursor-se-resize rounded-sm shadow border border-white" onMouseDown={(e) => onMouseDownResize(e, 'address')} />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="h-16 bg-[#1e1e1e] border-t border-zinc-700 flex items-center justify-between px-8 z-20">
                        <div className="text-xs text-zinc-500">
                            <strong>Tip:</strong> Drag elements to position. Drag corners to resize.
                        </div>
                        <div className="flex gap-4">
                            <button onClick={onClose} className="px-6 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                                Cancel
                            </button>
                            <button onClick={onClose} className="px-8 py-2 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-500 shadow-lg hover:shadow-green-500/20 transition-all">
                                Save Header
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
