'use client'

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Canvas, PencilBrush, Rect, Circle, Line, FabricImage } from 'fabric'

// SVG Icons as components
const UndoIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 10h11a6 6 0 0 1 0 12H7" />
        <path d="M7 6l-4 4 4 4" />
    </svg>
)

const TrashIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
)

const PencilIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
)

const FillIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
        <path d="m5 2 5 5" />
        <path d="M2 13h15" />
        <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
    </svg>
)

const RectIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
)

const CircleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
    </svg>
)

const LineIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 20L20 4" />
    </svg>
)

// Color palette - basic colors in logical order
const COLORS = [
    '#000000', '#808080', '#ffffff', // Black, Gray, White
    '#ff0000', '#ff9900', '#ffff00', // Red, Orange, Yellow
    '#00ff00', '#00ffff', '#0000ff', // Green, Cyan, Blue
    '#9900ff', '#ff00ff', '#ff66b2', // Purple, Magenta, Pink
    '#8B4513', '#ffcc99'             // Brown, Beige
]

const BRUSH_SIZES = [2, 6, 12, 20]

type DrawingTool = 'pencil' | 'fill' | 'rect' | 'circle' | 'line'

interface FabricCanvasProps {
    width: number
    height: number
    disabled?: boolean
    gameId?: number
    isDrawer?: boolean
    onCanvasChange?: (canvasJson: string) => void
    canvasData?: string // For receiving updates (JSON)
}

export interface FabricCanvasRef {
    clear: () => void
    undo: () => void
    getSaveData: () => string
    loadSaveData: (data: string) => void
}

const FabricCanvas = forwardRef<FabricCanvasRef, FabricCanvasProps>(({ width, height, disabled = false, isDrawer = true, onCanvasChange, canvasData }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fabricRef = useRef<Canvas | null>(null)
    const historyRef = useRef<string[]>([])
    const historyIndexRef = useRef<number>(-1)

    const [brushColor, setBrushColor] = useState('#000000')
    const [brushSize, setBrushSize] = useState(6)
    const [tool, setTool] = useState<DrawingTool>('pencil')
    const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
    const currentShapeRef = useRef<Rect | Circle | Line | null>(null)
    const isLoadingRef = useRef(false)  // Flag to prevent history save during load/undo

    // Save current canvas state to history - defined early so it can be used in init
    const saveToHistory = useCallback(() => {
        if (!fabricRef.current) return
        if (isLoadingRef.current) return  // Don't save during load/undo
        const json = JSON.stringify(fabricRef.current.toJSON())
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
        historyRef.current.push(json)
        historyIndexRef.current = historyRef.current.length - 1
        console.log('[CANVAS] History saved, index:', historyIndexRef.current, 'length:', historyRef.current.length)
    }, [])

    // Initialize Fabric canvas
    useEffect(() => {
        if (!canvasRef.current) return

        const canvas = new Canvas(canvasRef.current, {
            width,
            height,
            backgroundColor: '#ffffff',
            isDrawingMode: true,
            selection: false
        })

        const brush = new PencilBrush(canvas)
        brush.color = brushColor
        brush.width = brushSize
        canvas.freeDrawingBrush = brush

        fabricRef.current = canvas

        // Save initial state
        saveToHistory()

        return () => {
            canvas.dispose()
        }
    }, [width, height])

    // Update brush when color/size changes
    useEffect(() => {
        if (!fabricRef.current) return
        const brush = fabricRef.current.freeDrawingBrush
        if (brush) {
            brush.color = brushColor
            brush.width = brushSize
        }
    }, [brushColor, brushSize])

    // Update drawing mode based on tool
    useEffect(() => {
        if (!fabricRef.current) return
        const canvas = fabricRef.current

        // Pencil mode uses Fabric's drawing mode
        canvas.isDrawingMode = tool === 'pencil' && !disabled

        // Disable selection for all tools (we don't want to move objects)
        canvas.selection = false

        // Make all existing objects non-selectable and non-interactive
        canvas.forEachObject((obj) => {
            obj.selectable = false
            obj.evented = false
        })

        canvas.renderAll()
    }, [tool, disabled])

    // Save to history and broadcast after each path is created (free drawing only)
    // Shapes are handled separately in handleMouseUp
    useEffect(() => {
        if (!fabricRef.current) return

        const handlePathCreated = () => {
            if (isLoadingRef.current) return  // Ignore events during load/undo
            saveToHistory()
            // Broadcast canvas state as JSON when something changes
            if (isDrawer && onCanvasChange && fabricRef.current) {
                const json = JSON.stringify(fabricRef.current.toJSON())
                onCanvasChange(json)
            }
        }

        fabricRef.current.on('path:created', handlePathCreated)

        return () => {
            if (fabricRef.current) {
                fabricRef.current.off('path:created', handlePathCreated)
            }
        }
    }, [isDrawer, onCanvasChange, saveToHistory])

    // Load received canvas data (for host viewing drawer's work)
    useEffect(() => {
        if (!fabricRef.current || !canvasData || isDrawer) return

        try {
            isLoadingRef.current = true
            fabricRef.current.loadFromJSON(canvasData).then(() => {
                isLoadingRef.current = false
                fabricRef.current?.renderAll()
            }).catch(() => {
                isLoadingRef.current = false
            })
        } catch (error) {
            isLoadingRef.current = false
            console.error('Error loading canvas data:', error)
        }
    }, [canvasData, isDrawer])

    // Handle shape drawing - use ref for drawing state to avoid dependency issues
    const isDrawingRef = useRef(false)

    useEffect(() => {
        if (!fabricRef.current) return
        // Only attach handlers for shape tools
        if (tool === 'pencil' || tool === 'fill') return

        const canvas = fabricRef.current

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleMouseDown = (opt: any) => {
            if (disabled) return
            const pointer = opt.scenePoint || opt.pointer
            if (!pointer) return

            isDrawingRef.current = true
            shapeStartRef.current = { x: pointer.x, y: pointer.y }

            if (tool === 'rect') {
                const rect = new Rect({
                    left: pointer.x,
                    top: pointer.y,
                    width: 0,
                    height: 0,
                    fill: 'transparent',
                    stroke: brushColor,
                    strokeWidth: brushSize,
                    selectable: false,
                    evented: false,
                    originX: 'left',
                    originY: 'top'
                })
                canvas.add(rect)
                currentShapeRef.current = rect
            } else if (tool === 'circle') {
                const circle = new Circle({
                    left: pointer.x,
                    top: pointer.y,
                    radius: 0,
                    fill: 'transparent',
                    stroke: brushColor,
                    strokeWidth: brushSize,
                    selectable: false,
                    evented: false,
                    originX: 'center',
                    originY: 'center'
                })
                canvas.add(circle)
                currentShapeRef.current = circle
            } else if (tool === 'line') {
                const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                    stroke: brushColor,
                    strokeWidth: brushSize,
                    selectable: false,
                    evented: false
                })
                canvas.add(line)
                currentShapeRef.current = line
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleMouseMove = (opt: any) => {
            if (!isDrawingRef.current || !shapeStartRef.current || !currentShapeRef.current) return
            const pointer = opt.scenePoint || opt.pointer
            if (!pointer) return

            const startX = shapeStartRef.current.x
            const startY = shapeStartRef.current.y
            const currentX = pointer.x
            const currentY = pointer.y

            if (currentShapeRef.current instanceof Rect) {
                // Rectangle anchored at start corner, width/height change based on direction
                const w = currentX - startX
                const h = currentY - startY
                currentShapeRef.current.set({
                    width: Math.abs(w),
                    height: Math.abs(h),
                    flipX: w < 0,
                    flipY: h < 0
                })
            } else if (currentShapeRef.current instanceof Circle) {
                // Circle anchored at start point (center), radius = distance to mouse
                const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2))
                currentShapeRef.current.set({
                    radius,
                    left: startX,
                    top: startY
                })
            } else if (currentShapeRef.current instanceof Line) {
                currentShapeRef.current.set({ x2: currentX, y2: currentY })
            }

            canvas.renderAll()
        }

        const handleMouseUp = () => {
            if (isDrawingRef.current && currentShapeRef.current) {
                saveToHistory()
                // Broadcast shape placement to host
                if (isDrawer && onCanvasChange && fabricRef.current) {
                    const json = JSON.stringify(fabricRef.current.toJSON())
                    onCanvasChange(json)
                }
            }
            isDrawingRef.current = false
            shapeStartRef.current = null
            currentShapeRef.current = null
        }

        canvas.on('mouse:down', handleMouseDown)
        canvas.on('mouse:move', handleMouseMove)
        canvas.on('mouse:up', handleMouseUp)

        return () => {
            canvas.off('mouse:down', handleMouseDown)
            canvas.off('mouse:move', handleMouseMove)
            canvas.off('mouse:up', handleMouseUp)
        }
    }, [tool, brushColor, brushSize, disabled, isDrawer, onCanvasChange, saveToHistory])

    // Flood fill implementation - applies directly to canvas context
    const floodFill = useCallback((x: number, y: number) => {
        if (!fabricRef.current) return

        const canvas = fabricRef.current

        // First render all objects to get current canvas state
        canvas.renderAll()

        // Get the lower canvas (the actual drawing surface)
        const lowerCanvas = canvas.getElement() as HTMLCanvasElement
        const ctx = lowerCanvas.getContext('2d')
        if (!ctx) return

        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        const targetColor = getPixelColor(data, x, y, width)
        const fillColor = hexToRgb(brushColor)

        if (!fillColor || colorsMatch(targetColor, fillColor)) return

        // Stack-based flood fill
        const stack: [number, number][] = [[x, y]]
        const visited = new Set<string>()

        while (stack.length > 0) {
            const [cx, cy] = stack.pop()!
            const key = `${cx},${cy}`

            if (visited.has(key) || cx < 0 || cx >= width || cy < 0 || cy >= height) continue
            visited.add(key)

            const currentColor = getPixelColor(data, cx, cy, width)
            // Higher tolerance (64) to handle anti-aliased edges
            if (!colorsMatch(currentColor, targetColor, 64)) continue

            setPixelColor(data, cx, cy, width, fillColor)

            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
        }

        // Apply the filled pixels back to canvas
        ctx.putImageData(imageData, 0, 0)

        // Now we need to flatten the canvas by converting to image
        // First clear fabric objects but keep background
        const objects = canvas.getObjects()
        objects.forEach(obj => canvas.remove(obj))

        // Convert current canvas to a data URL (not blob) so it can be shared with host
        const dataUrl = lowerCanvas.toDataURL('image/png')
        FabricImage.fromURL(dataUrl).then((img) => {
            img.set({
                left: 0,
                top: 0,
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false
            })
            canvas.add(img)
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]) // Reset any viewport transform
            canvas.renderAll()
            saveToHistory()

            // Manually broadcast since object:added may not trigger properly for this
            if (isDrawer && onCanvasChange && fabricRef.current) {
                const json = JSON.stringify(fabricRef.current.toJSON())
                onCanvasChange(json)
            }
        })
    }, [brushColor, width, height, isDrawer, onCanvasChange, saveToHistory])

    // Handle fill tool click
    useEffect(() => {
        if (!fabricRef.current || tool !== 'fill') return

        const canvas = fabricRef.current

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleClick = (opt: any) => {
            if (disabled) return
            const pointer = opt.scenePoint || opt.pointer
            if (!pointer) return
            floodFill(Math.floor(pointer.x), Math.floor(pointer.y))
        }

        canvas.on('mouse:down', handleClick)

        return () => {
            canvas.off('mouse:down', handleClick)
        }
    }, [tool, floodFill, disabled])

    // saveToHistory is now defined at the top of the component

    const undo = useCallback(() => {
        console.log('[CANVAS UNDO] Called, index:', historyIndexRef.current, 'history length:', historyRef.current.length)
        if (!fabricRef.current) {
            console.log('[CANVAS UNDO] No fabric ref')
            return
        }
        if (historyIndexRef.current <= 0) {
            console.log('[CANVAS UNDO] Already at beginning of history')
            return
        }

        const currentObjects = fabricRef.current.getObjects().length
        console.log('[CANVAS UNDO] Current canvas has', currentObjects, 'objects')

        historyIndexRef.current--
        const prevState = historyRef.current[historyIndexRef.current]
        const prevParsed = JSON.parse(prevState)
        console.log('[CANVAS UNDO] Loading state at index:', historyIndexRef.current, 'with', prevParsed.objects?.length || 0, 'objects')

        isLoadingRef.current = true  // Prevent saveToHistory during load

        // Clear canvas first before loading
        fabricRef.current.clear()

        fabricRef.current.loadFromJSON(prevState).then(() => {
            isLoadingRef.current = false
            fabricRef.current?.renderAll()
            const newObjects = fabricRef.current?.getObjects().length || 0
            console.log('[CANVAS UNDO] State loaded successfully, now has', newObjects, 'objects')
            // Broadcast the undo change
            if (isDrawer && onCanvasChange && fabricRef.current) {
                const json = JSON.stringify(fabricRef.current.toJSON())
                onCanvasChange(json)
            }
        }).catch(err => {
            isLoadingRef.current = false
            console.error('[CANVAS UNDO] Error loading state:', err)
        })
    }, [isDrawer, onCanvasChange])

    const clear = useCallback(() => {
        if (!fabricRef.current) return
        fabricRef.current.clear()
        fabricRef.current.backgroundColor = '#ffffff'
        fabricRef.current.renderAll()
        saveToHistory()
        // Broadcast the clear
        if (isDrawer && onCanvasChange && fabricRef.current) {
            const json = JSON.stringify(fabricRef.current.toJSON())
            onCanvasChange(json)
        }
    }, [isDrawer, onCanvasChange])

    useImperativeHandle(ref, () => ({
        clear,
        undo,
        getSaveData: () => JSON.stringify(fabricRef.current?.toJSON() || {}),
        loadSaveData: (data: string) => {
            if (fabricRef.current) {
                fabricRef.current.loadFromJSON(data).then(() => {
                    fabricRef.current?.renderAll()
                })
            }
        }
    }))

    const toolButtonStyle = (isActive: boolean) => ({
        padding: '6px',
        borderRadius: '6px',
        background: isActive ? '#e0e0e0' : '#f5f5f5',
        border: isActive ? '2px solid #666' : '1px solid #ccc',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            {/* Canvas area */}
            <div style={{ flex: 1, position: 'relative', background: '#fff', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
                <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
            </div>

            {/* Toolbar - horizontal at bottom */}
            {!disabled && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    background: 'linear-gradient(to bottom, #f8f8f8, #eeeeee)',
                    padding: '12px 16px',
                    borderRadius: '0 0 12px 12px',
                    borderTop: '1px solid #ddd',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    {/* Tools section */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button onClick={() => setTool('pencil')} style={toolButtonStyle(tool === 'pencil')} title="Crayon">
                            <PencilIcon />
                        </button>
                        <button onClick={() => setTool('fill')} style={toolButtonStyle(tool === 'fill')} title="Remplissage">
                            <FillIcon />
                        </button>
                        <button onClick={() => setTool('rect')} style={toolButtonStyle(tool === 'rect')} title="Rectangle">
                            <RectIcon />
                        </button>
                        <button onClick={() => setTool('circle')} style={toolButtonStyle(tool === 'circle')} title="Cercle">
                            <CircleIcon />
                        </button>
                        <button onClick={() => setTool('line')} style={toolButtonStyle(tool === 'line')} title="Ligne">
                            <LineIcon />
                        </button>
                    </div>

                    <div style={{ width: '1px', height: '28px', background: '#ccc' }} />

                    {/* Colors section */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => setBrushColor(color)}
                                style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '4px',
                                    background: color,
                                    border: brushColor === color ? '2px solid #000' : '1px solid #999',
                                    cursor: 'pointer',
                                    boxShadow: color === '#ffffff' ? 'inset 0 0 0 1px #ccc' : 'none'
                                }}
                            />
                        ))}
                        <input
                            type="color"
                            value={brushColor}
                            onChange={e => setBrushColor(e.target.value)}
                            style={{
                                width: '20px',
                                height: '20px',
                                padding: 0,
                                border: '1px solid #999',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                            title="Couleur personnalisee"
                        />
                    </div>

                    <div style={{ width: '1px', height: '28px', background: '#ccc' }} />

                    {/* Brush sizes */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {BRUSH_SIZES.map(size => (
                            <button
                                key={size}
                                onClick={() => setBrushSize(size)}
                                style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: brushSize === size ? '#e0e0e0' : '#fff',
                                    border: brushSize === size ? '2px solid #666' : '1px solid #ccc',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title={`${size}px`}
                            >
                                <div style={{
                                    width: Math.min(size, 14),
                                    height: Math.min(size, 14),
                                    borderRadius: '50%',
                                    background: '#000'
                                }} />
                            </button>
                        ))}
                    </div>

                    <div style={{ width: '1px', height: '28px', background: '#ccc' }} />

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                            onClick={undo}
                            style={{ ...toolButtonStyle(false), background: '#fff' }}
                            title="Annuler (Ctrl+Z)"
                        >
                            <UndoIcon />
                        </button>
                        <button
                            onClick={clear}
                            style={{ ...toolButtonStyle(false), background: '#ff6b6b', color: 'white', border: 'none' }}
                            title="Effacer tout"
                        >
                            <TrashIcon />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
})

FabricCanvas.displayName = 'FabricCanvas'

// Helper functions for flood fill
function getPixelColor(data: Uint8ClampedArray, x: number, y: number, width: number): [number, number, number, number] {
    const index = (y * width + x) * 4
    return [data[index], data[index + 1], data[index + 2], data[index + 3]]
}

function setPixelColor(data: Uint8ClampedArray, x: number, y: number, width: number, color: [number, number, number]) {
    const index = (y * width + x) * 4
    data[index] = color[0]
    data[index + 1] = color[1]
    data[index + 2] = color[2]
    data[index + 3] = 255
}

function colorsMatch(c1: [number, number, number, number], c2: [number, number, number] | [number, number, number, number], tolerance = 0): boolean {
    return Math.abs(c1[0] - c2[0]) <= tolerance &&
        Math.abs(c1[1] - c2[1]) <= tolerance &&
        Math.abs(c1[2] - c2[2]) <= tolerance
}

function hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null
}

export default FabricCanvas
