import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import type { AiErrorDiagnosis } from '@/ai/service'

interface AiErrorDiagnosisPanelProps {
  diagnosis: AiErrorDiagnosis
  onImprove?: () => void
}

export function AiErrorDiagnosisPanel({ diagnosis, onImprove }: AiErrorDiagnosisPanelProps) {
  const sourceLabel = diagnosis.source === 'ai' ? 'AI Diagnosis' : 'Error Analysis'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{sourceLabel}</Text>
      </View>
      <Text style={styles.explanation}>{diagnosis.explanation}</Text>
      <View style={styles.suggestionBox}>
        <Text style={styles.suggestionLabel}>Suggestion</Text>
        <Text style={styles.suggestion}>{diagnosis.suggestion}</Text>
      </View>
      {onImprove && (
        <TouchableOpacity style={styles.improveBtn} onPress={onImprove}>
          <Text style={styles.improveText}>Improve my query</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#F85149',
    backgroundColor: 'rgba(248, 81, 73, 0.06)',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 11,
    fontWeight: '700',
    color: '#F85149',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  explanation: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#E6EDF3',
    lineHeight: 20,
    marginBottom: 10,
  },
  suggestionBox: {
    backgroundColor: 'rgba(88, 166, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(88, 166, 255, 0.2)',
    borderRadius: 4,
    padding: 10,
  },
  suggestionLabel: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 10,
    color: '#58A6FF',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  suggestion: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#E6EDF3',
    lineHeight: 18,
  },
  improveBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#3FB950',
    borderRadius: 4,
  },
  improveText: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 12,
    color: '#3FB950',
    fontWeight: '600',
  },
})
