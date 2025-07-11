import { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { IoCamera, IoTrash } from 'react-icons/io5';
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
  const [showCropper, setShowCropper] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<HTMLDivElement>(null);

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
      if (!file) return;

      validateFile(file);
      
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      
      // Get image dimensions before setting preview URL
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
        setPreviewUrl(objectUrl);
        setShowCropper(true);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
      };
      img.src = objectUrl;
    } catch (error: any) {
      setError(error.message);
    }
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(1, Math.min(3, prev + (e.deltaY > 0 ? -0.1 : 0.1))));
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

    canvas.width = 300;
    canvas.height = 300;

    ctx.beginPath();
    ctx.arc(150, 150, 150, 0, Math.PI * 2);
    ctx.clip();

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
      300,
      300
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
        'image/jpeg',
        0.95
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
      setShowCropper(false);
      setPreviewUrl(null);
      setSelectedFile(null);
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

      // Create cropped version
      const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
      const filePath = `${user.id}/avatar_${Math.random()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with URL
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      onUpload(publicUrl);
      setShowCropper(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
      <div className="relative group">
        <Avatar
          url={currentUrl}
          name={user?.email || ''}
          size={size}
          height={height}
          className={uploading ? 'opacity-50' : ''}
        />
        {!showCropper && (
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"
            aria-label="Upload avatar"
          >
            <IoCamera className="text-2xl" />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {error && (
        <p className="text-red-500 text-sm" role="alert">{error}</p>
      )}

      {showCropper && previewUrl && (
        <div className="w-full space-y-4">
          <div 
            ref={cropperRef}
            className="relative h-[300px]"
            onWheel={handleWheel as any}
          >
            <Cropper
              image={previewUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
              cropSize={{ width: 250, height: 250 }}
              classes={{
                containerClassName: 'rounded-lg overflow-hidden',
                cropAreaClassName: 'border-2 border-white rounded-full'
              }}
              style={{
                containerStyle: {
                  width: '100%',
                  height: '300px',
                  backgroundColor: '#260B2C'
                },
                mediaStyle: {
                  width: imageDimensions.width,
                  height: imageDimensions.height
                }
              }}
            />
          </div>
          <p className="text-sm text-secondary text-center">
            Scroll to zoom, drag to reposition
          </p>
          <div className="flex justify-between">
            {currentUrl && (
              <button
                onClick={handleRemoveAvatar}
                className="btn btn-secondary flex items-center gap-2"
                disabled={uploading}
              >
                <IoTrash />
                Remove
              </button>
            )}
            <div className="space-x-2 ml-auto">
              <button
                onClick={() => {
                  setShowCropper(false);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
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
      )}
    </div>
  );
}