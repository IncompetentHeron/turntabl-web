import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { IoCamera, IoTrash, IoClose } from 'react-icons/io5';
import Cropper from 'react-easy-crop';
import { Area } from 'react-easy-crop/types';
import Avatar from './Avatar';

interface AvatarUploadProps {
  currentUrl: string | null;
  onUpload: (url: string | null) => void;
  size?: 'sm' | 'md' | 'lg';
  height?: number;
}

export default function AvatarUpload({ currentUrl, onUpload, size = 'lg', height }: AvatarUploadProps) {
  const { user } = useUser();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCropperModal, setShowCropperModal] = useState(false); // Controls the cropping modal
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset file input value when modal closes or upload completes
  useEffect(() => {
    if (!showCropperModal && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [showCropperModal]);

  const validateFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size must be less than 5MB');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('File type must be JPEG, PNG, or WebP');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError(null);
      const file = event.target.files?.[0];
      if (!file) {
        // Reset input value even if no file is selected (e.g., user cancels file dialog)
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      validateFile(file);
      
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setShowCropperModal(true); // Open the cropping modal
      setZoom(1);
      setCrop({ x: 0, y: 0 });

      // Reset input value immediately after file is selected to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      setError(error.message);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear input on error too
      }
    }
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', error => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // Set canvas size to the desired output size (e.g., 300x300 for avatar)
    canvas.width = 300;
    canvas.height = 300;

    // Draw a circular clip path
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.clip();

    // Calculate scale factors for drawing the image
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    ctx.drawImage(
      image,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg', // Output as JPEG
        0.95 // Quality
      );
    });
  };

  const handleRemoveAvatar = async () => {
    try {
      setUploading(true);
      setError(null);

      if (currentUrl) {
        const filePath = currentUrl.split('avatars/')[1];
        await supabase.storage
          .from('avatars')
          .remove([filePath]);
      }

      await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user!.id);

      onUpload(null);
      setShowCropperModal(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const uploadAvatar = async () => {
    try {
      if (!previewUrl || !croppedAreaPixels || !selectedFile || !user) return;

      setUploading(true);
      setError(null);

      const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
      const filePath = `${user.id}/avatar_${Date.now()}.jpg`; // Use timestamp for unique filename

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, {
              contentType: 'image/jpeg',
              upsert: true // Overwrite if file with same name exists (though timestamp makes it unique)
            });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user!.id);

      onUpload(publicUrl); // Notify parent component of new URL
      setShowCropperModal(false); // Close modal
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCropperCancel = () => {
    setShowCropperModal(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main Avatar Display and Upload Trigger */}
      <div className="relative group">
        <Avatar
          url={currentUrl}
          name={user?.email || ''}
          size={size}
          height={height}
          className={uploading ? 'opacity-50' : ''}
        />
        <label
          htmlFor="avatar-upload-input"
          onClick={(e) => {
            e.stopPropagation(); 
          }}
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full cursor-pointer"
          aria-label="Upload avatar"
        >
          <IoCamera className="text-2xl" />
        </label>
        <input
          ref={fileInputRef}
          id="avatar-upload-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-red-500 text-sm" role="alert">{error}</p>
      )}

      {/* Cropper Modal */}
      {showCropperModal && previewUrl && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCropperCancel();
            }
          }}
        >
          <div className="bg-surface p-6 rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Crop Image</h2>
              <button
                onClick={handleCropperCancel}
                className="text-secondary hover:text-primary"
              >
                <IoClose size={24} />
              </button>
            </div>

            <div className="relative w-full aspect-square bg-background rounded-lg overflow-hidden mb-4">
              <Cropper
                image={previewUrl}
                crop={crop}
                zoom={zoom}
                aspect={1} // Square aspect ratio
                cropShape="round" // Circular crop area
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="contain" // Ensures image fits without squishing
                classes={{
                  containerClassName: 'w-full h-full', // Cropper container fills its parent
                  cropAreaClassName: 'border-2 border-white rounded-full' // Styling for the crop area
                }}
                style={{
                  containerStyle: {
                    backgroundColor: 'transparent', // Remove black background
                  },
                  mediaStyle: {
                    // Let react-easy-crop manage this
                  }
                }}
              />
            </div>
            <p className="text-sm text-secondary text-center mb-4">
              Scroll to zoom, drag to reposition
            </p>

            <div className="flex justify-between items-center">
              {currentUrl && ( // Only show remove button if there's an existing avatar
                <button
                  onClick={handleRemoveAvatar}
                  className="btn btn-secondary flex items-center gap-2"
                  disabled={uploading}
                >
                  <IoTrash />
                  Remove
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={handleCropperCancel}
                  className="btn btn-secondary"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={uploadAvatar}
                  className="btn btn-primary"
                  disabled={uploading}
                >
                  {uploading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
