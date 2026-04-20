import React from 'react';

interface WaveLoaderProps {
  size?: number;
  className?: string;
}

export default function WaveLoader({ size = 64, className = '' }: WaveLoaderProps) {
  return (
    <div 
      className={`wave-loader-container ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="wave-loader-water"></div>
    </div>
  );
}
