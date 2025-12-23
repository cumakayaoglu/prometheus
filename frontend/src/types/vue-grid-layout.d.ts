declare module 'vue3-grid-layout' {
  import { DefineComponent } from 'vue'

  export const GridLayout: DefineComponent<{
    layout: any[]
    colNum: number
    rowHeight: number
    isDraggable?: boolean
    isResizable?: boolean
    isMirrored?: boolean
    verticalCompact?: boolean
    margin?: [number, number]
    useCssTransforms?: boolean
    responsive?: boolean
    breakpoints?: { [key: string]: number }
    cols?: { [key: string]: number }
    // Vue 3 v-model desteği için
    'onUpdate:layout'?: (layout: any[]) => void
  }>

  export const GridItem: DefineComponent<{
    x: number
    y: number
    w: number
    h: number
    i: string | number
    minH?: number
    minW?: number
    maxH?: number
    maxW?: number
    isDraggable?: boolean
    isResizable?: boolean
    static?: boolean
    dragIgnoreFrom?: string
    dragAllowFrom?: string
    preserveAspectRatio?: boolean
  }>
}