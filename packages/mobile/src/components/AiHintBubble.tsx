import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import type { AiHintResult } from '@/ai/service'

interface AiHintBubbleProps {
  hint: AiHintResult
  confidence: number
  onRefresh?: () => void
}

export function AiHintBubble({ hint, confidence, onRefresh }: AiHintBubbleProps) {
  const sourceBadge = hint.source === 'ai'
    ? { label: 'AI', color: '#3FB950' }
    : { label: 'Static', color: '#8B949E' }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>AI Hint</Text>
        <View style={styles.meta}>
          <Text style={[styles.sourceBadge, { color: sourceBadge.color }]}>
            {sourceBadge.label}
          </Text>
          <Text style={styles.confidence}>
            {Math.round(confidence * 100)}% confidence
          </Text>
        </View>
      </View>
      <Text style={styles.text}>{hint.text}</Text>
      {onRefresh && (
        <TouchableOpacity style={styles.refresh} onPress={onRefresh}>
          <Text style={styles.refreshText}>Regenerate hint</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.3)',
    backgroundColor: 'rgba(63, 185, 80, 0.06)',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 11,
    fontWeight: '700',
    color: '#3FB950',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  sourceBadge: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 10,
    fontWeight: '600',
  },
  confidence: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 10,
    color: '#6E7681',
  },
  text: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#E6EDF3',
    lineHeight: 20,
  },
  refresh: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  refreshText: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 11,
    color: '#58A6FF',
  },
})
