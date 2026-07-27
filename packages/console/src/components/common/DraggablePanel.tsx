import React, { useState, useRef, useCallback, useEffect } from 'react';

interface DraggablePanelProps {
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  onClose?: () => void;
  className?: string;
}

const DraggablePanel: React.FC<DraggablePanelProps> = ({
  title,
  children,
  defaultPosition = { x: 100, y: 100 },
  onClose,
  className = '',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [width, setWidth] = useState(680);
  const [height, setHeight] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.draggable-panel__resize')) return;
    if ((e.target as HTMLElement).closest('button, input, select, summary, details')) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  }, [position]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: width,
      h: height,
    };
  }, [width, height]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      }
      if (isResizing) {
        setWidth(Math.max(400, resizeStart.current.w + (e.clientX - resizeStart.current.x)));
        setHeight(Math.max(280, resizeStart.current.h + (e.clientY - resizeStart.current.y)));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing]);

  return (
    <div
      ref={panelRef}
      className={`draggable-panel ${className}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <div className="draggable-panel__handle" onMouseDown={handleMouseDown}>
        <span className="draggable-panel__title">{title}</span>
        {onClose && (
          <button className="draggable-panel__close" onClick={onClose}>&times;</button>
        )}
      </div>
      <div className="draggable-panel__body">
        {children}
      </div>
      <div className="draggable-panel__resize" onMouseDown={handleResizeStart} />
    </div>
  );
};

export default DraggablePanel;
