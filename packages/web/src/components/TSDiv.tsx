import React, { useContext, useEffect } from 'react'
import { Image } from 'react-native'
import { unifiedBridge, styleManager } from '@clevertree/relay-client-shared'

type DivProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
    tag?: string
}

type HierNode = { tag: string; classes?: string[] }
const HierContext = React.createContext<HierNode[]>([])

export const TSDiv: React.FC<DivProps> = ({ children, tag='div', ...props }) => {
  const parentHierarchy = useContext(HierContext)
  const classStr = (props.className as string) || (props as any).class || ''
  const classes = typeof classStr === 'string' && classStr.trim().length
    ? classStr.split(/\s+/).map(s => s.trim()).filter(Boolean)
    : []
  const current: HierNode = { tag, classes }
  const hier = React.useMemo(() => [...parentHierarchy, current], [parentHierarchy, tag, classStr])
  // Register usage only for wrapped elements
  useEffect(() => {
    try {
      unifiedBridge.registerUsage(tag, props as any, hier)
      styleManager.requestRender()
    } catch (e) {
      // no-op
    }
    // We only care when the identifying props that affect classes change
  }, [props.className, tag])

  // Special handling for img tags - wrap with RN Image while maintaining themed-styler
  if (tag === 'img') {
    const { src, alt, ...restProps } = props as any
    return React.createElement(
      HierContext.Provider,
      { value: hier },
      React.createElement(Image, {
        source: typeof src === 'string' ? { uri: src } : src,
        accessibilityLabel: alt,
        ...restProps,
      })
    )
  }

  return React.createElement(
    tag,
    props,
    React.createElement(HierContext.Provider, { value: hier }, children)
  )
}
