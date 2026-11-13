import { StyleSheet, Text, View, ScrollView, FlatList } from 'react-native'
import { IconButton } from 'react-native-paper'
import type { SqlResult } from '@logixzen/shared/sql-engine'

interface ResultTableProps {
  result: SqlResult
  onExport?: (format: 'csv' | 'json') => void
}

export function ResultTable({ result, onExport }: ResultTableProps) {
  if (result.error !== undefined) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{result.error}</Text>
      </View>
    )
  }

  if (result.isSelect && result.rows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No results</Text>
      </View>
    )
  }

  if (!result.isSelect) {
    return (
      <View style={styles.affectedContainer}>
        <Text style={styles.affectedText}>
          {result.rowsAffected} row{(result.rowsAffected !== 1 ? 's' : '')} affected
        </Text>
        <Text style={styles.timing}>{result.executionTimeMs}ms</Text>
      </View>
    )
  }

  return (
    <View style={styles.resultContainer}>
      <View style={styles.header}>
        <Text style={styles.summary}>
          {result.rows.length} row{(result.rows.length !== 1 ? 's' : '')} · {result.executionTimeMs}ms
          {result.rows.length >= 1000 && <Text style={styles.overCap}> (showing first 1000)</Text>}
        </Text>
        <View style={styles.actions}>
          <IconButton
            icon="download"
            size={16}
            onPress={() => onExport?.('csv')}
            iconColor="#8B949E"
          />
          <IconButton
            icon="code-json"
            size={16}
            onPress={() => onExport?.('json')}
            iconColor="#8B949E"
          />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.indexHeader}><Text style={styles.headerText}>#</Text></View>
            {result.columns.map((col) => (
              <View key={col} style={styles.columnHeader}>
                <Text style={styles.headerText}>{col.toUpperCase()}</Text>
              </View>
            ))}
          </View>
          <FlatList
            data={result.rows}
            keyExtractor={(_, index) => String(index)}
            renderItem={({ item, index }) => (
              <View style={styles.tableRow}>
                <View style={styles.indexCell}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                {result.columns.map((col) => (
                  <View key={col} style={styles.cell}>
                    <Text style={[styles.cellText, item[col] === null ? styles.nullText : null]}>
                      {item[col] === null ? 'NULL' : String(item[col])}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            style={styles.tableBody}
          />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  errorContainer: {
    borderWidth: 1,
    borderColor: '#F85149',
    backgroundColor: 'rgba(248, 81, 73, 0.12)',
    borderRadius: 4,
    padding: 12,
    marginVertical: 8,
  },
  errorText: { color: '#F85149', fontFamily: 'JetBrainsMono-Regular', fontSize: 12 },
  emptyContainer: {
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginVertical: 8,
  },
  emptyText: { color: '#6E7681', fontFamily: 'JetBrainsMono-Regular', fontSize: 12 },
  affectedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    padding: 12,
    marginVertical: 8,
    backgroundColor: '#161B22',
  },
  affectedText: { color: '#E6EDF3', fontFamily: 'JetBrainsMono-Regular', fontSize: 12 },
  timing: { color: '#8B949E', fontFamily: 'JetBrainsMono-Regular', fontSize: 11 },
  resultContainer: {
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    backgroundColor: '#161B22',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  summary: { color: '#8B949E', fontFamily: 'JetBrainsMono-Regular', fontSize: 11 },
  overCap: { color: '#6E7681' },
  actions: { flexDirection: 'row' },
  table: { minWidth: '100%' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1C2128',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  indexHeader: { width: 32, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: '#30363D' },
  columnHeader: { paddingHorizontal: 8, paddingVertical: 4, borderRightWidth: 1, borderRightColor: '#30363D', minWidth: 80 },
  headerText: { color: '#8B949E', fontFamily: 'JetBrainsMono-Regular', fontSize: 10, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#21262D' },
  indexCell: { width: 32, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: '#30363D', backgroundColor: '#1C2128' },
  indexText: { color: '#6E7681', fontFamily: 'JetBrainsMono-Regular', fontSize: 10 },
  cell: { paddingHorizontal: 8, paddingVertical: 4, borderRightWidth: 1, borderRightColor: '#21262D', minWidth: 80 },
  cellText: { color: '#E6EDF3', fontFamily: 'JetBrainsMono-Regular', fontSize: 11 },
  nullText: { color: '#6E7681', fontStyle: 'italic' },
  tableBody: { maxHeight: 300 },
})
