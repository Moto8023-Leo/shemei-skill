// Image Upload — drag/drop + preview + upload to Feishu product table
import { useRef } from 'react';
import { useFormStore } from '../../store/useFormStore';

export default function ImageUpload() {
  const selectedModel = useFormStore(s => s.selectedModel);
  const selectedBrand = useFormStore(s => s.selectedBrand);
  const imageFile = useFormStore(s => s.imageFile);
  const imagePreview = useFormStore(s => s.imagePreview);
  const uploading = useFormStore(s => s.uploading);
  const setImageFile = useFormStore(s => s.setImageFile);
  const uploadImage = useFormStore(s => s.uploadImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };

  const handleUpload = async () => {
    const ok = await uploadImage();
    if (ok) {
      alert('✅ Image uploaded to Feishu!');
    } else {
      alert('❌ Upload failed. Check console for details.');
    }
  };

  if (!selectedModel) return null;

  return (
    <div className="form-section">
      <label>📸 Product Image</label>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
        Brand: {selectedBrand} | Model: {selectedModel}
      </div>

      {imagePreview ? (
        <div style={{ marginBottom: 8 }}>
          <img
            src={imagePreview}
            alt="Preview"
            style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 8, border: '1px solid #ddd' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={uploading}
              style={{ flex: 1 }}
            >
              {uploading ? 'Uploading...' : '⬆ Upload to Feishu'}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setImageFile(null)}
              disabled={uploading}
            >
              ✕ Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className="image-drop-zone"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed #ccc',
            borderRadius: 8,
            padding: 24,
            textAlign: 'center',
            cursor: 'pointer',
            background: '#fafafa',
            transition: 'border-color 0.2s',
          }}
        >
          <div style={{ fontSize: 32 }}>📷</div>
          <div style={{ fontSize: 13, color: '#666' }}>
            Drag & drop or click to select image
          </div>
          <div style={{ fontSize: 11, color: '#999' }}>
            PNG / JPG / WebP, max 10MB
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleChange}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
