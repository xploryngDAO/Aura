import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScreenshotNode, ClusterNode, GraphEdge } from '../types/aura';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Props {
  screenshots: ScreenshotNode[];
  clusters: ClusterNode[];
  edges: GraphEdge[];
  searchQuery: string;
  selectedNodeId: string | null;
  onSelectNode: (node: ScreenshotNode | ClusterNode | null) => void;
  densityFilter: 'all' | 'high_confidence' | 'clusters_only';
  onDensityFilterChange: (mode: 'all' | 'high_confidence' | 'clusters_only') => void;
}

export type ModalityFilter = 'all' | 'notes' | 'voice' | 'screenshots';

export const CognitiveGraphCanvas: React.FC<Props> = ({
  screenshots,
  clusters,
  edges,
  searchQuery,
  selectedNodeId,
  onSelectNode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport transformation
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const [scaleDisplay, setScaleDisplay] = useState(1);
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('all');

  // Inertia and interaction state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const draggedNodeRef = useRef<any>(null);
  const pulsePhaseRef = useRef(0);
  const [hoveredNode, setHoveredNode] = useState<{
    node: ScreenshotNode | ClusterNode;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Loaded images cache for thumbnails
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Filter items based on modality filter
  const visibleScreenshots = screenshots.filter((s) => {
    if (s.isArchived) return false;
    if (modalityFilter === 'screenshots') {
      return !s.itemType || s.itemType === 'screenshot';
    }
    if (modalityFilter === 'notes') {
      return s.itemType === 'text_note';
    }
    if (modalityFilter === 'voice') {
      return s.itemType === 'voice_audio';
    }
    return true;
  });

  const visibleClusters = clusters;

  const matchesSearch = useCallback(
    (item: ScreenshotNode | ClusterNode) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      if ('filename' in item) {
        return (
          item.filename.toLowerCase().includes(q) ||
          item.sourceApp.toLowerCase().includes(q) ||
          (item.ocrText && item.ocrText.toLowerCase().includes(q)) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
        );
      } else {
        return (
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
    },
    [searchQuery]
  );

  // Center on selected node smoothly
  useEffect(() => {
    if (!selectedNodeId || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    let targetX = 0;
    let targetY = 0;
    let found = false;

    const cluster = clusters.find((c) => c.id === selectedNodeId);
    if (cluster && cluster.x !== undefined && cluster.y !== undefined) {
      targetX = cluster.x;
      targetY = cluster.y;
      found = true;
    } else {
      const scr = screenshots.find((s) => s.id === selectedNodeId);
      if (scr && scr.x !== undefined && scr.y !== undefined) {
        targetX = scr.x;
        targetY = scr.y;
        found = true;
      }
    }

    if (found) {
      const currentScale = transformRef.current.scale;
      transformRef.current.x = rect.width / 2 - targetX * currentScale;
      transformRef.current.y = rect.height / 2 - targetY * currentScale;
    }
  }, [selectedNodeId, clusters, screenshots]);

  // Main Render Loop (60 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      pulsePhaseRef.current += 0.02;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Deep, pure obsidian background with minimal ambient lighting
      ctx.fillStyle = '#06090F';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Subtle, quiet grid
      const { x: tx, y: ty, scale } = transformRef.current;
      const gridSize = 48 * scale;
      const offsetX = ((tx % gridSize) + gridSize) % gridSize;
      const offsetY = ((ty % gridSize) + gridSize) % gridSize;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      for (let x = offsetX; x < rect.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
      }
      for (let y = offsetY; y < rect.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
      }
      ctx.stroke();

      // Viewport transform
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);

      // Node coordinates lookup map
      const posMap = new Map<string, { x: number; y: number }>();
      visibleClusters.forEach((c) => {
        if (c.x !== undefined && c.y !== undefined) posMap.set(c.id, { x: c.x, y: c.y });
      });
      visibleScreenshots.forEach((s) => {
        if (s.x !== undefined && s.y !== undefined) posMap.set(s.id, { x: s.x, y: s.y });
      });

      // 1. Draw Clean Organic Curves (Synapses)
      edges.forEach((edge) => {
        const p1 = posMap.get(edge.source);
        const p2 = posMap.get(edge.target);
        if (!p1 || !p2) return;

        const isDeep = edge.type === 'deep_link';
        const isConnectedToSelected =
          selectedNodeId === edge.source || selectedNodeId === edge.target;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const normalX = -dy / (dist || 1);
        const normalY = dx / (dist || 1);
        const curvature = isDeep ? Math.min(dist * 0.12, 30) : Math.min(dist * 0.06, 14);
        const ctrlX = midX + normalX * curvature;
        const ctrlY = midY + normalY * curvature;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, p2.x, p2.y);

        if (isDeep) {
          // Subtle dashed line for inferred deep links
          ctx.setLineDash([5, 5]);
          ctx.lineDashOffset = -pulsePhaseRef.current * 6;
          ctx.strokeStyle = isConnectedToSelected
            ? 'rgba(129, 140, 248, 0.7)'
            : 'rgba(129, 140, 248, 0.25)';
          ctx.lineWidth = isConnectedToSelected ? 1.5 : 1;
          ctx.stroke();
        } else {
          // Calm factual edge
          ctx.strokeStyle = isConnectedToSelected
            ? 'rgba(56, 189, 248, 0.6)'
            : 'rgba(255, 255, 255, 0.06)';
          ctx.lineWidth = isConnectedToSelected ? 1.5 : 0.8;
          ctx.stroke();
        }

        ctx.restore();
      });

      // 2. Draw Cluster Hubs (Minimalist Typographic Syntheses)
      visibleClusters.forEach((cluster) => {
        if (cluster.x === undefined || cluster.y === undefined) return;
        const cx = cluster.x;
        const cy = cluster.y;
        const isSelected = selectedNodeId === cluster.id;
        const isMatch = matchesSearch(cluster);
        const alpha = isMatch ? 1 : 0.2;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Clean subtle glow
        const coreRadius = 24;
        const auraGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 40);
        auraGrad.addColorStop(0, isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)');
        auraGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI * 2);
        ctx.fill();

        // Core Hub Circle
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#0B0F19';
        ctx.fill();

        ctx.strokeStyle = isSelected
          ? '#38bdf8'
          : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Inner dot indicator
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#38bdf8' : '#94a3b8';
        ctx.fill();

        // Cluster Title (Clean, elegant)
        ctx.fillStyle = isSelected ? '#ffffff' : '#e2e8f0';
        ctx.font = '500 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cluster.name, cx, cy + coreRadius + 14);

        // Quiet unboxed count
        ctx.fillStyle = '#64748b';
        ctx.font = '400 9px Inter, sans-serif';
        ctx.fillText(`${cluster.screenshotCount} itens`, cx, cy + coreRadius + 26);

        ctx.restore();
      });

      // 3. Draw Multi-Modal Knowledge Nodes (Clean Minimal Cards)
      visibleScreenshots.forEach((node) => {
        if (node.x === undefined || node.y === undefined) return;
        const nx = node.x;
        const ny = node.y;
        const isSelected = selectedNodeId === node.id;
        const isMatch = matchesSearch(node);
        const alpha = isMatch ? 1 : 0.15;

        const w = 48;
        const h = 48;
        const rx = nx - w / 2;
        const ry = ny - h / 2;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Card Container
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 10);
        ctx.fillStyle = node.itemType === 'voice_audio'
          ? '#0D111E'
          : node.itemType === 'text_note'
          ? '#0B101D'
          : '#0A0E18';
        ctx.fill();

        // Specific Clean Content by Modality
        if (node.itemType === 'voice_audio') {
          // Minimal Audio waveform
          ctx.save();
          const waveCenterX = nx;
          const waveCenterY = ny - 2;
          const barHeights = [6, 14, 18, 10, 6];
          const barWidth = 2.5;
          const spacing = 3.5;
          const startX = waveCenterX - ((5 * (barWidth + spacing) - spacing) / 2);

          for (let i = 0; i < 5; i++) {
            const bh = barHeights[i];
            const bx = startX + i * (barWidth + spacing);
            const by = waveCenterY - bh / 2;
            ctx.fillStyle = isSelected ? '#818cf8' : '#6366f1';
            ctx.beginPath();
            ctx.roundRect(bx, by, barWidth, bh, 1);
            ctx.fill();
          }

          // Duration indicator
          ctx.fillStyle = '#94a3b8';
          ctx.font = '500 8px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${node.audioDuration || 14}s`, nx, ry + h - 6);
          ctx.restore();
        } else if (node.itemType === 'text_note') {
          // Minimal Note lines
          ctx.save();
          ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.8)' : 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.roundRect(rx + 10, ry + 12, 12, 1.5, 0.75);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.beginPath();
          ctx.roundRect(rx + 10, ry + 18, 28, 1.5, 0.75);
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(rx + 10, ry + 24, 22, 1.5, 0.75);
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(rx + 10, ry + 30, 16, 1.5, 0.75);
          ctx.fill();
          ctx.restore();
        } else {
          // Screenshot Thumbnail
          if (node.thumbnailUrl || node.imageUrl) {
            const url = node.thumbnailUrl || node.imageUrl;
            let img = imageCacheRef.current.get(url);
            if (!img) {
              img = new Image();
              img.src = url;
              imageCacheRef.current.set(url, img);
            }
            if (img.complete && img.naturalWidth !== 0) {
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(rx + 2, ry + 2, w - 4, h - 4, 8);
              ctx.clip();
              ctx.drawImage(img, rx + 2, ry + 2, w - 4, h - 4);
              ctx.restore();
            }
          }
        }

        // Clean hairline border
        ctx.strokeStyle = isSelected
          ? '#38bdf8'
          : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = isSelected ? 1.5 : 0.8;
        ctx.stroke();

        // Quiet label beneath
        const labelText =
          node.itemType === 'voice_audio'
            ? 'Voz'
            : node.itemType === 'text_note'
            ? 'Nota'
            : node.sourceApp || 'Captura';

        ctx.font = '400 9px Inter, sans-serif';
        ctx.fillStyle = isSelected ? '#38bdf8' : '#64748b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, nx, ry + h + 10);

        // Minimal indicator dot if reminder
        if (node.isReminder) {
          ctx.beginPath();
          ctx.arc(rx + w - 4, ry + 4, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#f59e0b';
          ctx.fill();
        }

        // Minimal indicator dot if LGPD
        if (node.lgpdMasked) {
          ctx.beginPath();
          ctx.arc(rx + 4, ry + 4, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#10b981';
          ctx.fill();
        }

        ctx.restore();
      });

      ctx.restore(); // Restore world
      ctx.restore(); // Restore dpr

      // Kinetic damping
      if (!isDraggingRef.current) {
        transformRef.current.x += velocityRef.current.vx;
        transformRef.current.y += velocityRef.current.vy;
        velocityRef.current.vx *= 0.9;
        velocityRef.current.vy *= 0.9;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    visibleScreenshots,
    visibleClusters,
    edges,
    selectedNodeId,
    matchesSearch,
    modalityFilter,
  ]);

  const screenToWorld = (sx: number, sy: number) => {
    const { x, y, scale } = transformRef.current;
    return {
      x: (sx - x) / scale,
      y: (sy - y) / scale,
    };
  };

  const findNodeAt = (wx: number, wy: number): ScreenshotNode | ClusterNode | null => {
    for (const s of visibleScreenshots) {
      if (s.x === undefined || s.y === undefined) continue;
      const dx = wx - s.x;
      const dy = wy - s.y;
      if (Math.abs(dx) <= 24 && Math.abs(dy) <= 24) return s;
    }
    for (const c of visibleClusters) {
      if (c.x === undefined || c.y === undefined) continue;
      const dist = Math.hypot(wx - c.x, wy - c.y);
      if (dist <= 30) return c;
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);

    isDraggingRef.current = true;
    dragStartRef.current = { x: sx, y: sy };
    velocityRef.current = { vx: 0, vy: 0 };

    const hit = findNodeAt(world.x, world.y);
    draggedNodeRef.current = hit || null;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = sx - dragStartRef.current.x;
      const dy = sy - dragStartRef.current.y;

      if (draggedNodeRef.current) {
        const currentScale = transformRef.current.scale;
        draggedNodeRef.current.x = (draggedNodeRef.current.x || 0) + dx / currentScale;
        draggedNodeRef.current.y = (draggedNodeRef.current.y || 0) + dy / currentScale;
      } else {
        transformRef.current.x += dx;
        transformRef.current.y += dy;
        velocityRef.current = { vx: dx * 0.4, vy: dy * 0.4 };
      }

      dragStartRef.current = { x: sx, y: sy };
      setHoveredNode(null);
    } else {
      const world = screenToWorld(sx, sy);
      const hit = findNodeAt(world.x, world.y);
      if (hit) {
        setHoveredNode({ node: hit, screenX: sx, screenY: sy });
      } else {
        setHoveredNode(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);

      const hit = findNodeAt(world.x, world.y);
      if (hit) {
        onSelectNode(hit);
      }
    }

    isDraggingRef.current = false;
    draggedNodeRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const current = transformRef.current;
    const newScale = Math.min(Math.max(current.scale * zoomFactor, 0.35), 3.0);

    current.x = sx - (sx - current.x) * (newScale / current.scale);
    current.y = sy - (sy - current.y) * (newScale / current.scale);
    current.scale = newScale;
    setScaleDisplay(newScale);
  };

  const handleZoom = (factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const current = transformRef.current;
    const newScale = Math.min(Math.max(current.scale * factor, 0.35), 3.0);

    current.x = cx - (cx - current.x) * (newScale / current.scale);
    current.y = cy - (cy - current.y) * (newScale / current.scale);
    current.scale = newScale;
    setScaleDisplay(newScale);
  };

  const resetView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    transformRef.current = {
      x: rect.width / 2 - 350,
      y: rect.height / 2 - 280,
      scale: 1,
    };
    setScaleDisplay(1);
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none touch-none bg-[#06090F]">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Minimal Top Segmented Filter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center p-1 bg-[#090D18]/80 backdrop-blur-xl border border-white/[0.06] rounded-xl shadow-lg">
        <button
          onClick={() => setModalityFilter('all')}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            modalityFilter === 'all'
              ? 'bg-white/[0.1] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tudo
        </button>

        <button
          onClick={() => setModalityFilter('notes')}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            modalityFilter === 'notes'
              ? 'bg-white/[0.1] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Notas
        </button>

        <button
          onClick={() => setModalityFilter('voice')}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            modalityFilter === 'voice'
              ? 'bg-white/[0.1] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Áudios
        </button>

        <button
          onClick={() => setModalityFilter('screenshots')}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            modalityFilter === 'screenshots'
              ? 'bg-white/[0.1] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Imagens
        </button>
      </div>

      {/* Compact Hover Tooltip */}
      {hoveredNode && !isDraggingRef.current && (
        <div
          className="absolute z-30 pointer-events-none p-3 rounded-xl bg-[#090D18]/90 backdrop-blur-xl border border-white/[0.08] shadow-xl space-y-1 max-w-xs"
          style={{
            left: Math.min(hoveredNode.screenX + 12, window.innerWidth - 260),
            top: Math.min(hoveredNode.screenY + 12, window.innerHeight - 140),
          }}
        >
          <div className="text-[10px] text-slate-500 font-mono">
            {'itemType' in hoveredNode.node
              ? hoveredNode.node.itemType === 'voice_audio'
                ? 'Áudio de Voz'
                : hoveredNode.node.itemType === 'text_note'
                ? 'Nota de Texto'
                : hoveredNode.node.sourceApp
              : 'Cluster Temático'}
          </div>

          <h5 className="text-xs font-semibold text-white truncate">
            {'filename' in hoveredNode.node ? hoveredNode.node.filename : hoveredNode.node.name}
          </h5>

          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
            {'visualContext' in hoveredNode.node
              ? hoveredNode.node.visualContext?.summary
              : hoveredNode.node.description}
          </p>
        </div>
      )}

      {/* Quiet Minimal Zoom Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 p-1 bg-[#090D18]/80 backdrop-blur-xl border border-white/[0.06] rounded-xl text-slate-400">
        <button
          onClick={() => handleZoom(0.85)}
          className="p-1.5 rounded-lg hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Diminuir zoom"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetView}
          className="px-2 py-1 text-[10px] font-mono hover:text-white transition-colors"
          title="Redefinir visualização"
        >
          {Math.round(scaleDisplay * 100)}%
        </button>
        <button
          onClick={() => handleZoom(1.15)}
          className="p-1.5 rounded-lg hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Aumentar zoom"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
