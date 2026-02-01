import { useEffect, useRef, useState } from 'preact/hooks';

interface SplitPaneOptions {
  initialPercent?: number;
  minPercent?: number;
  maxPercent?: number;
}

export const useSplitPane = (options: SplitPaneOptions = {}) => {
  const {
    initialPercent = 50,
    minPercent = 20,
    maxPercent = 80
  } = options;

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(initialPercent);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !splitContainerRef.current) return;
      const containerRect = splitContainerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - containerRect.top;
      const newPercentage = ((containerRect.height - relativeY) / containerRect.height) * 100;
      setPanelHeight(Math.max(minPercent, Math.min(maxPercent, newPercentage)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, minPercent, maxPercent]);

  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  return { splitContainerRef, panelHeight, startResize };
};
