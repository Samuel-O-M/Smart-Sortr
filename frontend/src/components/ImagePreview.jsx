import React, { useRef, useState, useEffect } from 'react';

export default function ImagePreview({ image }) {
  const containerRef = useRef(null);
  const [squareSize, setSquareSize] = useState(0);
  const [squareColor, setSquareColor] = useState('#D0D0D0');


  const updateSquareSize = () => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth >= clientHeight) {
        // If width >= height, use 80% of the height
        setSquareSize(clientHeight * 0.8);
      } else {
        // If height > width, use 80% of the width
        setSquareSize(clientWidth * 0.8);
      }
    }
  };

  useEffect(() => {
    updateSquareSize();
    window.addEventListener('resize', updateSquareSize);
    return () => {
      window.removeEventListener('resize', updateSquareSize);
    };
  }, []);

  useEffect(() => {
    if (image) {
      setSquareColor('#F0F0F0');
    } else {
      setSquareColor('#D0D0D0');
    }
  }, [image]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex items-center justify-center bg-[#F0F0F0]"
    >
      <div
        style={{
          width: squareSize,
          height: squareSize,
          backgroundColor: squareColor,
        }}
      >
        {image ? (
          <img
            src={`data:${image.mime_type};base64,${image.image_data}`}
            alt={image.image_name}
            className="object-contain w-full h-full"
          />
        ) : (
          <p className="h-full w-full flex items-center justify-center text-xl text-[#303030]">No image</p>
        )}
      </div>
    </div>
  );
}
