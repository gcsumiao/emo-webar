import React from 'react';
import { asset } from '../lib/assetUrl.js';

export function Mascot3D({ size = 220, state = 'idle', animate = 'bob', style = {}, shadow = true }) {
  const src = {
    small: asset('/assets/mascot/m_small.png'),
    idle: asset('/assets/mascot/m_idle.png'),
    mid: asset('/assets/mascot/m_mid.png'),
    sprout: asset('/assets/mascot/m_sprout.png'),
  }[state] || asset('/assets/mascot/m_sprout.png');

  return (
    <div
      className={animate === 'bob' ? 'mascot-bob' : ''}
      style={{ width: size, height: size, position: 'relative', display: 'inline-block', ...style }}
    >
      <img
        src={src}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          filter: shadow ? 'drop-shadow(0 16px 18px rgba(229,109,137,0.28))' : 'none',
        }}
      />
    </div>
  );
}
