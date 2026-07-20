import React, { useRef, useEffect, useState } from 'react';
import { Document } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';

interface SignDocumentModalProps {
 document: Document;
 onSign: (documentId: string, signatureData: string) => void;
 onClose: () => void;
}

export const SignDocumentModal: React.FC<SignDocumentModalProps> = ({ document, onSign, onClose }) => {
 const { currentUser } = useAuth();
 const { addToast } = useUI();
 const canvasRef = useRef<HTMLCanvasElement>(null);
 const [isDrawing, setIsDrawing] = useState(false);
 const [typedName, setTypedName] = useState(currentUser?.name || '');
 const [activeTab, setActiveTab] = useState<'type' | 'draw'>('type');

 useEffect(() => {
  if (activeTab !== 'draw') return;

  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas size correctly to avoid scaling issues
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  ctx.strokeStyle = '#111827'; // Almost black
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const getPos = (e: MouseEvent | TouchEvent) => {
   const rect = canvas.getBoundingClientRect();
   if (e instanceof MouseEvent) {
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
   }
   if (e.touches[0]) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
   }
   return { x: 0, y: 0 };
  }

  const startDrawing = (e: MouseEvent | TouchEvent) => {
   e.preventDefault();
   const pos = getPos(e);
   ctx.beginPath();
   ctx.moveTo(pos.x, pos.y);
   setIsDrawing(true);
  };

  const draw = (e: MouseEvent | TouchEvent) => {
   e.preventDefault();
   if (!isDrawing) return;
   const pos = getPos(e);
   ctx.lineTo(pos.x, pos.y);
   ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  canvas.addEventListener('touchstart', startDrawing, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);

  return () => {
   canvas.removeEventListener('mousedown', startDrawing);
   canvas.removeEventListener('mousemove', draw);
   canvas.removeEventListener('mouseup', stopDrawing);
   canvas.removeEventListener('mouseleave', stopDrawing);
   canvas.removeEventListener('touchstart', startDrawing);
   canvas.removeEventListener('touchmove', draw);
   canvas.removeEventListener('touchend', stopDrawing);
  };
 }, [isDrawing, activeTab]);

 const clearCanvas = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
 };

 const isCanvasBlank = (): boolean => {
  const canvas = canvasRef.current;
  if (!canvas) return true;
  const context = canvas.getContext('2d');
  if (!context) return true;
  const pixelBuffer = new Uint32Array(context.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
  return !pixelBuffer.some(color => color !== 0);
 }

 const handleSign = () => {
  let signatureDataUrl = '';

  if (activeTab === 'type') {
   if (!typedName.trim()) {
    addToast("Please type your name to sign.", { type: 'info' });
    return;
   }
   // Create a temporary canvas to render the typed signature
   // FIX: Used `window.document.createElement` to avoid conflict with the `document` prop.
   const tempCanvas = window.document.createElement('canvas');
   tempCanvas.width = 400;
   tempCanvas.height = 150;
   const ctx = tempCanvas.getContext('2d')!;
   ctx.fillStyle = "white";
   ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
   ctx.fillStyle = "#111827";
   ctx.font = "bold 50px 'Dancing Script', cursive";
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.fillText(typedName, tempCanvas.width / 2, tempCanvas.height / 2);
   signatureDataUrl = tempCanvas.toDataURL('image/png');

  } else { // 'draw'
   const canvas = canvasRef.current;
   if (!canvas || isCanvasBlank()) {
    addToast("Please provide a signature by drawing in the box.", { type: 'info' });
    return;
   }
   signatureDataUrl = canvas.toDataURL('image/png');
  }

  onSign(document.id, signatureDataUrl);
  onClose();
 };

 return (
  <div className="space-y-4">
   <p className="text-gray-600">
    Please sign the document "<strong>{document.title}</strong>".
   </p>

   <div className="flex p-1 bg-slate-200 rounded-lg">
    <button onClick={() => setActiveTab('type')} className={`w-1/2 py-1.5 text-sm font-semibold rounded-md ${activeTab === 'type' ? 'bg-white shadow' : ''}`}>Type Signature</button>
    <button onClick={() => setActiveTab('draw')} className={`w-1/2 py-1.5 text-sm font-semibold rounded-md ${activeTab === 'draw' ? 'bg-white shadow' : ''}`}>Draw Signature</button>
   </div>

   <div className="relative border border-gray-300 rounded-lg bg-slate-50 min-h-[12rem]">
    {activeTab === 'type' ? (
     <div className="p-4 flex flex-col items-center justify-center h-48">
      <input autoComplete="off" data-lpignore="true" 
       type="text"
       value={typedName}
       onChange={(e) => setTypedName(e.target.value)}
       className="w-full text-center p-2 border-b-2 border-slate-300 bg-transparent focus:outline-none focus:border-primary-500 font-signature text-5xl"
       placeholder="Type Your Name"
      />
     </div>
    ) : (
     <>
      <canvas ref={canvasRef} className="w-full h-48 cursor-crosshair touch-none"></canvas>
      <button onClick={clearCanvas} className="absolute top-2 right-2 px-2 py-1 text-xs bg-slate-200 rounded-md">Clear</button>
     </>
    )}
   </div>

   <p className="text-xs text-gray-500">
    By clicking 'Apply Signature', you confirm that you have read and agree to be legally bound by the terms of this document.
   </p>

   <div className="pt-4 flex justify-end space-x-2">
    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors">
     Cancel
    </button>
    <button
     type="button"
     onClick={handleSign}
     className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm"
    >
     Apply Signature
    </button>
   </div>
  </div>
 );
};
