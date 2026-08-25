import React, { useEffect, useState } from 'react';
import { getHistoricImages } from '../lib/historicChunkAttributes.js';

function ImagePreview({ images, index, onClose, onChangeIndex }) {
  const [mode, setMode] = useState('max'); // max | min
  const current = images[index];
  const total = images.length;

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onChangeIndex((index - 1 + total) % total);
      if (event.key === 'ArrowRight') onChangeIndex((index + 1) % total);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, total, onChangeIndex, onClose]);

  if (!current) return null;

  if (mode === 'min') {
    return (
      <div className="hist-image-dock" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="hist-image-dock-thumb" onClick={() => setMode('max')} title="Restore preview">
          <img src={current.src} alt={current.name} />
        </button>
        <div className="hist-image-dock-meta">
          <strong>{current.name}</strong>
          <span>{index + 1} / {total}</span>
        </div>
        <div className="hist-image-dock-actions">
          <button type="button" onClick={() => setMode('max')} title="Maximize">▢</button>
          <button type="button" onClick={onClose} title="Close">✕</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="hist-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div className="hist-image-lightbox-panel" onClick={(event) => event.stopPropagation()}>
        <div className="hist-image-lightbox-toolbar">
          <span className="hist-image-lightbox-title">
            {current.name}
            <em>{index + 1} / {total}</em>
          </span>
          <div className="hist-image-lightbox-actions">
            <button type="button" onClick={() => setMode('min')} title="Minimize">—</button>
            <button type="button" onClick={() => setMode('max')} title="Maximize">▢</button>
            <button type="button" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        <div className="hist-image-lightbox-stage">
          {total > 1 ? (
            <button
              type="button"
              className="hist-image-nav prev"
              onClick={() => onChangeIndex((index - 1 + total) % total)}
              aria-label="Previous image"
            >
              ‹
            </button>
          ) : null}
          <img src={current.src} alt={current.name} />
          {total > 1 ? (
            <button
              type="button"
              className="hist-image-nav next"
              onClick={() => onChangeIndex((index + 1) % total)}
              aria-label="Next image"
            >
              ›
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function HistoricImageGallery({ item }) {
  const images = getHistoricImages(item);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
    setPreviewOpen(false);
  }, [item?.id]);

  if (!images.length) return null;

  const total = images.length;
  const safeIndex = ((activeIndex % total) + total) % total;
  const current = images[safeIndex];

  function goPrev(event) {
    event.stopPropagation();
    setActiveIndex((currentIndex) => (currentIndex - 1 + total) % total);
  }

  function goNext(event) {
    event.stopPropagation();
    setActiveIndex((currentIndex) => (currentIndex + 1) % total);
  }

  return (
    <div className="hist-image-gallery" onClick={(event) => event.stopPropagation()}>
      <div className="hist-image-gallery-label">
        Images
        <span>{safeIndex + 1} / {total}</span>
      </div>

      <div className="hist-image-main">
        {total > 1 ? (
          <button type="button" className="hist-image-main-nav prev" onClick={goPrev} aria-label="Previous image">
            ‹
          </button>
        ) : null}

        <button
          type="button"
          className="hist-image-main-frame"
          onClick={() => setPreviewOpen(true)}
          title="Click to preview"
        >
          <img src={current.src} alt={current.name} />
          <span className="hist-image-main-caption">{current.name}</span>
        </button>

        {total > 1 ? (
          <button type="button" className="hist-image-main-nav next" onClick={goNext} aria-label="Next image">
            ›
          </button>
        ) : null}
      </div>

      {previewOpen ? (
        <ImagePreview
          images={images}
          index={safeIndex}
          onClose={() => setPreviewOpen(false)}
          onChangeIndex={setActiveIndex}
        />
      ) : null}
    </div>
  );
}
