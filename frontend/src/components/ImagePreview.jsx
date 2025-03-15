import React from 'react';

export default function ImagePreview({ image }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-100">
      {/* 1:1 container for the image */}
      <div className="bg-gray-300 flex items-center justify-center" style={{ width: '300px', height: '300px' }}>
        {image ? (
          <img
            src={`data:${image.mime_type};base64,${image.image_data}`}
            alt={image.image_name}
            className="object-contain w-full h-full"
          />
        ) : (
          <p className="text-gray-600">No image</p>
        )}
      </div>
    </div>
  );
}
