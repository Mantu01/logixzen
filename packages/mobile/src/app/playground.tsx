import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Button, Text } from 'react-native-paper'
import { SqlEditor } from '@/components/SqlEditor'
import { ResultTable } from '@/components/ResultTable'
import { DatasetSelector } from '@/components/DatasetSelector'
import { usePlaygroundStore } from '@/stores/usePlaygroundStore'

const DEMO_DATASETS = [
  {
    id: 'school',
    name: 'School Management',
    tables: [
      { name: 'students' },
      { name: 'teachers' },
      { name: 'courses' },
      { name: 'enrollments' },
    ],
  },
]

export default function PlaygroundScreen() {
  const {
    activeDataset,
    sql,
    results,
    error,
    isRunning,
    setSql,
    runQuery,
    reset,
    setActiveDataset,
  } = usePlaygroundStore()

  const [showHistory, setShowHistory] = useState(false)

  const handleRun = useCallback(async () => {
    await runQuery()
  }, [runQuery])

  const handleReset = useCallback(() => {
    reset()
  }, [reset])

  const handleExport = useCallback(async (_format: 'csv' | 'json') => {
    // Export logic placeholder
  }, [])

  const handleLoadSnippet = useCallback(
    (snippetSql: string) => {
      setSql(snippetSql)
    },
    [setSql]
  )

  const activeDatasetDef =
    activeDataset !== null
      ? DEMO_DATASETS.find((d) => d.id === activeDataset)
      : null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Playground</Text>
        <View style={styles.headerActions}>
          <Button
            mode="outlined"
            onPress={handleReset}
            icon="reload"
            style={styles.resetButton}
          >
            Reset
          </Button>
        </View>
      </View>

      <DatasetSelector
        datasets={DEMO_DATASETS}
        activeId={activeDataset}
        onSelect={setActiveDataset}
      />

      <ScrollView style={styles.editorArea} contentContainerStyle={{ paddingBottom: 16 }}>
        <SqlEditor
          value={sql}
          onChange={setSql}
          onRun={handleRun}
          isRunning={isRunning}
          result={results[0] ?? null}
          dataset={activeDatasetDef}
          onDatasetSelect={setActiveDataset}
        />
      </ScrollView>

      {error !== null && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView style={styles.resultsArea}>
        {results.map((result, index) => (
          <ResultTable
            key={index}
            result={result}
            onExport={handleExport}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={() => setShowHistory(!showHistory)}
          icon="history"
          style={styles.footerButton}
        >
          History
        </Button>
        <Button
          mode="contained"
          onPress={() => handleLoadSnippet('SELECT * FROM students LIMIT 10;')}
          icon="lightbulb-on"
          buttonColor="#D29922"
          style={styles.footerButton}
        >
          Example
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  title: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 16,
    fontWeight: '600',
    color: '#E6EDF3',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  resetButton: { borderWidth: 1, borderColor: '#30363D' },
  editorArea: { flex: 1 },
  resultsArea: { flex: 1, padding: 8 },
  errorBar: {
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F85149',
    backgroundColor: 'rgba(248, 81, 73, 0.12)',
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { color: '#F85149', fontFamily: 'JetBrainsMono-Regular', fontSize: 12 },
  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  footerButton: { flex: 1, borderWidth: 1, borderColor: '#30363D' },
})
