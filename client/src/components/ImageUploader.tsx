import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ImageUploaderProps {
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  className?: string;
}

export function ImageUploader({ onImagesChange, maxImages = 4, className = "" }: ImageUploaderProps) {
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File): Promise<string> => {
    try {
      console.log('📤 [ImageUploader] Starting upload for:', file.name, 'Type:', file.type, 'Size:', file.size);

      // 1. Get signed URL from backend
      const response = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type
        }),
      });

      if (!response.ok) {
        let details = '';
        try {
          const errBody = await response.json();
          details = errBody?.error || errBody?.message || JSON.stringify(errBody);
        } catch {
          try {
            details = await response.text();
          } catch {}
        }
        console.error('Upload URL request failed', { status: response.status, details });
        throw new Error('Failed to get upload URL');
      }

      const { url } = await response.json();
      console.log('📤 [ImageUploader] Got signed URL:', url);

      // 2. Upload file directly to Google Cloud Storage
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      console.log('📤 [ImageUploader] Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload failed:', errorText);
        throw new Error('Failed to upload image');
      }

      console.log('✅ Upload to GCS successful. Requesting download URL...');

      // 3. Get download URL for preview
      const downloadResponse = await fetch('/api/objects/download-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name
        }),
      });

      if (!downloadResponse.ok) {
        console.error('Download URL request failed:', downloadResponse.status);
        // Fall back to localhost path if download URL fails
        const serverPath = `/objects/uploads/${file.name}`;
        console.log('⚠️ Using fallback server path:', serverPath);
        return serverPath;
      }

      const { downloadUrl } = await downloadResponse.json();
      console.log('✅ Got GCS download URL:', downloadUrl);
      return downloadUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (selectedImages.length + files.length > maxImages) {
      toast({
        title: "Too many images",
        description: `You can only upload up to ${maxImages} images.`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const newImages: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast({
            title: "Invalid file type",
            description: "Please select only image files.",
            variant: "destructive",
          });
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: "Please select images smaller than 10MB.",
            variant: "destructive",
          });
          continue;
        }

        const uploadURL = await uploadImage(file);
        newImages.push(uploadURL);
      }

      const updatedImages = [...selectedImages, ...newImages];
      setSelectedImages(updatedImages);
      onImagesChange(updatedImages);

      if (newImages.length > 0) {
        toast({
          title: "Images uploaded",
          description: `${newImages.length} image(s) uploaded successfully.`,
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload one or more images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(updatedImages);
    onImagesChange(updatedImages);
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`${className}`}>
      {/* Upload Button */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={openFileSelector}
          disabled={uploading || selectedImages.length >= maxImages}
          className="text-gray-400 hover:text-white p-2"
        >
          <Camera className="w-5 h-5" />
        </Button>
        {selectedImages.length > 0 && (
          <span className="text-sm text-gray-400">
            {selectedImages.length}/{maxImages} images
          </span>
        )}
      </div>

      {/* Image Preview Grid */}
      {selectedImages.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {selectedImages.map((imageUrl, index) => (
              <div key={index} className="relative group">
                <img
                  src={imageUrl}
                  alt={`Upload ${index + 1}`}
                  className="w-16 h-16 object-cover rounded-lg bg-gray-700"
                  onError={(e) => {
                    // Fallback for broken images
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                  }}
                />
                <div className="hidden fallback-icon absolute inset-0 flex items-center justify-center bg-gray-700 rounded-lg">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {uploading && (
        <div className="text-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-sm text-gray-400 mt-1">Uploading images...</p>
        </div>
      )}

      {/* Hidden file input for gallery selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
    </div>
  );
}
