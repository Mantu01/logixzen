import { useState } from 'react'
import { StyleSheet, View, TextInput, TouchableOpacity } from 'react-native'
import { Text } from 'react-native-paper'
import { ResultTable } from './ResultTable'
import type { SqlResult } from '@logixzen/shared/sql-engine'

interface Dataset {
  id: string
  name: string
  tables: Array<{ name: string }>
}

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  onRun: () => Promise<void>
  isRunning: boolean
  result: SqlResult | null
  dataset?: Dataset | null
  onDatasetSelect?: (id: string) => void
}

export function SqlEditor({ value, onChange, onRun, isRunning, result, dataset, onDatasetSelect }: SqlEditorProps) {
  const [isFocused, setIsFocused] = useState(false)
  const currentDataset = dataset

  return (
    <View style={styles.container}>
      <View style={[styles.toolbar, isFocused && styles.toolbarFocused]}>
        {currentDataset != null && onDatasetSelect !== undefined && (
          <TouchableOpacity style={styles.datasetChip} onPress={() => onDatasetSelect(currentDataset.id)}>
            <Text style={styles.datasetChipText}>{currentDataset.name}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.spacer} />
        <TouchableOpacity
          style={[styles.runButton, isRunning || value.trim().length === 0 ? styles.buttonDisabled : null]}
          onPress={onRun}
          disabled={isRunning || value.trim().length === 0}
        >
          <Text style={styles.buttonLabel}>{isRunning ? 'Running...' : 'Run'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearButton} onPress={() => onChange('')}>
          <Text style={styles.clearLabel}>Clear</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.editorWrapper, isFocused && styles.editorFocused]}>
        <Text style={styles.label}>SQL</Text>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline
          placeholder="SELECT * FROM students;"
          placeholderTextColor="#6E7681"
          textAlignVertical="top"
          returnKeyType="send"
          onSubmitEditing={onRun}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
      </View>
      {result !== null && <ResultTable result={result} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: '#30363D', borderRadius: 4, overflow: 'hidden' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    backgroundColor: '#161B22',
  },
  toolbarFocused: { borderBottomColor: '#3FB950' },
  datasetChip: {
    backgroundColor: '#1C2128',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  datasetChipText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#8B949E' },
  spacer: { flex: 1 },
  runButton: {
    backgroundColor: '#3FB950',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 2,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  clearButton: {
    borderWidth: 1,
    borderColor: '#30363D',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 2,
    alignItems: 'center',
  },
  buttonLabel: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#0D1117', fontWeight: '600' },
  clearLabel: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#8B949E' },
  editorWrapper: {
    padding: 12,
    backgroundColor: '#0D1117',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  editorFocused: { backgroundColor: '#161B22' },
  label: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 10,
    color: '#8B949E',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  textInput: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 14,
    color: '#E6EDF3',
    lineHeight: 20,
    minHeight: 100,
  },
})
