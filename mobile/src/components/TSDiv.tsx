import React, { useMemo, useEffect } from 'react'
import { StyleProp, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { unifiedBridge } from '@relay/shared'

function parseClassName(className?: string) {
    if (!className || typeof className !== 'string') return []
    return className.trim().split(/\s+/).filter(Boolean)
}

export function useThemedStyles(tag: string, className?: string) {
    const classes = useMemo(() => parseClassName(className), [className])

    useEffect(() => {
        try {
            unifiedBridge.registerUsage(tag, { className })
        } catch (e) {
            console.warn('[TSDiv] registerUsage failed', e)
        }
    }, [tag, className])

    const style = classes.length ? (unifiedBridge.getRnStyles(tag, classes) as StyleProp<any>) : undefined
    return { style }
}

type ThemedElementProps = {
    component: React.ComponentType<any>
    tag?: string
    className?: string
    style?: StyleProp<any>
    children?: React.ReactNode
} & Record<string, any>

export const ThemedElement = React.forwardRef<any, ThemedElementProps>(
    ({ component: Component, tag = 'div', className, style, children, ...rest }, ref) => {
        const { style: themedStyle } = useThemedStyles(tag, className)
        const mergedStyle = themedStyle ? [themedStyle, style] : style
        return (
            <Component ref={ref} style={mergedStyle} {...rest}>
                {children}
            </Component>
        )
    },
)

export function resolveThemedStyle(tag: string, className?: string) {
    const classes = parseClassName(className)
    try {
        unifiedBridge.registerUsage(tag, { className })
    } catch (e) {
        // ignore
    }
    return classes.length ? (unifiedBridge.getRnStyles(tag, classes) as StyleProp<any>) : undefined
}

const overflowClassRegex = /\boverflow(?:-[xy])?-[a-z0-9-]+\b/i
const buttonComponent = TouchableOpacity ?? View
const tagComponentMap: Record<string, React.ComponentType<any>> = {
    span: Text,
    button: buttonComponent,
    main: SafeAreaView,
    'safe-area': SafeAreaView,
    'safe-area-view': SafeAreaView,
    scroll: ScrollView,
}

type TSDivProps = {
    component?: React.ComponentType<any>
    tag?: string
    className?: string
    style?: StyleProp<any>
    children?: React.ReactNode
} & Record<string, any>

function hasOverflowClass(className?: string) {
    return Boolean(className && overflowClassRegex.test(className))
}

function prefersScrollView(rest: Record<string, any>, className?: string) {
    if (hasOverflowClass(className)) return true
    const scrollProps = [
        'horizontal',
        'contentContainerStyle',
        'showsHorizontalScrollIndicator',
        'showsVerticalScrollIndicator',
        'onScroll',
        'refreshControl',
        'nestedScrollEnabled',
        'scrollEnabled',
    ]
    return scrollProps.some((prop) => Object.prototype.hasOwnProperty.call(rest, prop))
}

export const TSDiv = React.forwardRef<any, TSDivProps>(
    ({ component, tag = 'div', className, style, children, ...rest }, ref) => {
        const normalizedTag = tag?.toLowerCase?.() ?? 'div'
        const ResolvedComponent =
            component ||
            tagComponentMap[normalizedTag] ||
            (prefersScrollView(rest, className) ? ScrollView : View)

        return (
            <ThemedElement component={ResolvedComponent} tag={tag} className={className} style={style} ref={ref} {...rest}>
                {children}
            </ThemedElement>
        )
    },
)
