
import React, { useState, useCallback } from 'react';
import { Upload, File, X, Image as ImageIcon, CheckCircle, FileText, Loader2 } from 'lucide-react';

interface FileDropzoneProps {
  onFilesAdded: (files: { name: string, type: string, content: string, size: string }[]) => void;
  allowMultiple?: boolean;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFilesAdded, allowMultiple = true }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);

  const processFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    setProcessing(true);
    
    const processedFiles: any[] = [];
    
    const promises = Array.from(fileList).map(file => {
      return new Promise<void>((resolve) => {
        // Validation (Max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert(`File ${file.name} is too large (Max 10MB)`);
            resolve();
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            processedFiles.push({
              name: file.name,
              type: file.type,
              size: (file.size / 1024).toFixed(0) + ' KB',
              content: e.target.result as string // Base64
            });
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });

    await Promise.all(promises);
    if (processedFiles.length > 0) {
      onFilesAdded(processedFiles);
    }
    setProcessing(false);
  }, [onFilesAdded]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  return (
    <div 
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 group
        ${isDragOver ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 scale-[1.01]' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'}
      `}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        multiple={allowMultiple} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={handleChange}
        accept="image/*,application/pdf"
      />
      
      {processing ? (
        <div className="flex flex-col items-center justify-center py-4">
            <Loader2 size={32} className="animate-spin text-[var(--color-primary)] mb-2" />
            <p className="text-sm font-bold text-gray-500">Encrypting & Processing...</p>
        </div>
      ) : (
        <div className="pointer-events-none">
            <div className={`w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 transition-colors ${isDragOver ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400'}`}>
                <Upload size={24} />
            </div>
            <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                {isDragOver ? 'Drop files now' : 'Drag & Drop files here'}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                or click to browse (Images, PDF, X-Rays)
            </p>
            <div className="mt-4 flex justify-center gap-2">
                <span className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded font-bold">PDF</span>
                <span className="text-[10px] bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-1 rounded font-bold">JPG/PNG</span>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded font-bold">Secure</span>
            </div>
        </div>
      )}
    </div>
  );
};

export default FileDropzone;
