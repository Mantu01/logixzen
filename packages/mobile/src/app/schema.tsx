import { useState, useCallback } from 'react'
import { StyleSheet, View, ScrollView, TouchableOpacity, Text } from 'react-native'
import { useSchemaStore } from '@/stores/useSchemaStore'
import { usePlaygroundStore } from '@/stores/usePlaygroundStore'
import type { TableInfo } from '@logixzen/shared/sql-engine'
import { ExpoSqlEngine } from '@/sql'

const SETUP_SQL = `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER, grade TEXT, phone TEXT);
CREATE TABLE teachers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, subject TEXT, department TEXT);
CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT NOT NULL, teacher_id INTEGER, credits INTEGER);
CREATE TABLE enrollments (id INTEGER PRIMARY KEY, student_id INTEGER, course_id INTEGER, grade TEXT, semester TEXT);

INSERT INTO students VALUES (1, 'Alice', 20, 'Freshman', '555-0101');
INSERT INTO students VALUES (2, 'Bob', 21, 'Sophomore', '555-0102');
INSERT INTO students VALUES (3, 'Charlie', 22, 'Junior', NULL);
INSERT INTO students VALUES (4, 'Diana', 20, 'Freshman', '555-0104');
INSERT INTO students VALUES (5, 'Eve', 23, 'Senior', NULL);

INSERT INTO teachers VALUES (1, 'Dr. Smith', 'Math', 'Science');
INSERT INTO teachers VALUES (2, 'Prof. Johnson', 'English', 'Humanities');
INSERT INTO teachers VALUES (3, 'Dr. Williams', 'Science', 'Science');
INSERT INTO teachers VALUES (4, 'Mr. Brown', 'History', 'Liberal Arts');

INSERT INTO courses VALUES (1, 'Algebra', 1, 4);
INSERT INTO courses VALUES (2, 'Literature', 2, 3);
INSERT INTO courses VALUES (3, 'Physics', 3, 4);
INSERT INTO courses VALUES (4, 'History 101', 4, 3);
INSERT INTO courses VALUES (5, 'Calculus', 1, 4);

INSERT INTO enrollments VALUES (1, 1, 1, 'A', 'Fall 2023');
INSERT INTO enrollments VALUES (2, 2, 1, 'B', 'Fall 2023');
INSERT INTO enrollments VALUES (3, 1, 2, 'A-', 'Fall 2023');
INSERT INTO enrollments VALUES (4, 3, 3, 'B+', 'Spring 2024');
INSERT INTO enrollments VALUES (5, 4, 1, 'A', 'Fall 2023');
INSERT INTO enrollments VALUES (6, 5, 3, 'C', 'Spring 2024');
INSERT INTO enrollments VALUES (7, 2, 2, 'B+', 'Fall 2023');
INSERT INTO enrollments VALUES (8, 3, 4, 'A-', 'Spring 2024');
INSERT INTO enrollments VALUES (9, 4, 3, 'B', 'Fall 2023');
INSERT INTO enrollments VALUES (10, 5, 5, 'A', 'Spring 2024');
`

interface ColumnDetail {
  name: string
  type: string
  isPrimaryKey: boolean
  isForeignKey: boolean
}

export default function SchemaScreen() {
  const { schema, isLoading, error, loadSchema } = useSchemaStore()
  const { activeDataset } = usePlaygroundStore()
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [sampleRows, setSampleRows] = useState<Record<string, Array<Record<string, unknown>>>>({})

  const loadSchemaData = useCallback(async () => {
    try {
      const engine = new ExpoSqlEngine()
      await engine.initialize(SETUP_SQL)
      const tables = await engine.getSchema()
      await engine.close()
      loadSchema(tables)

      // Load sample rows for each table
      const samples: Record<string, Array<Record<string, unknown>>> = {}
      for (const table of tables) {
        const rows = await engine['db']!.getAllAsync(`SELECT * FROM "${table.name}" LIMIT 5`)
        samples[table.name] = rows
      }
      setSampleRows(samples)
    } catch (e) {
      loadSchema([])
    }
  }, [loadSchema])

  const toggleTable = useCallback((tableName: string) => {
    setExpandedTable((prev) => prev === tableName ? null : tableName)
  }, [])

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loading}>Loading schema...</Text>
      </View>
    )
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadSchemaData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schema Browser</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadSchemaData}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {schema === null || schema.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.info}>No schema loaded. Initialize database first.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadSchemaData}>
            <Text style={styles.retryText}>Load Schema</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.tableList}>
          {schema.map((table) => (
            <View key={table.name} style={styles.tableCard}>
              <TouchableOpacity
                style={styles.tableHeader}
                onPress={() => toggleTable(table.name)}
                activeOpacity={0.7}
              >
                <View style={styles.tableHeaderLeft}>
                  <Text style={styles.tableName}>{table.name}</Text>
                  <Text style={styles.columnCount}>{table.columns.length} columns</Text>
                </View>
                <Text style={styles.expandIcon}>{expandedTable === table.name ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {expandedTable === table.name && (
                <View style={styles.tableBody}>
                  {/* Column List */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Columns</Text>
                    {table.columns.map((col, idx) => (
                      <View key={idx} style={styles.columnRow}>
                        <View style={styles.columnInfo}>
                          <Text style={styles.columnName}>{col.name}</Text>
                          <Text style={styles.columnType}>{col.type}</Text>
                        </View>
                        <View style={styles.columnKeys}>
                          {col.primaryKey > 0 && (
                            <Text style={styles.pkBadge}>PK</Text>
                          )}
                          {col.foreignKey && (
                            <Text style={styles.fkBadge}>FK</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Sample Data */}
                  {sampleRows[table.name] && sampleRows[table.name]!.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Sample Data</Text>
                      <ScrollView horizontal style={styles.sampleScroll}>
                        <View style={styles.sampleTable}>
                          {/* Header */}
                          <View style={styles.sampleHeader}>
                            {Object.keys(sampleRows[table.name]![0]).map((col) => (
                              <Text key={col} style={styles.sampleHeaderCell}>{col}</Text>
                            ))}
                          </View>
                          {/* Rows */}
                          {sampleRows[table.name]!.map((row, rowIdx) => (
                            <View key={rowIdx} style={styles.sampleRow}>
                              {Object.values(row).map((val, colIdx) => (
                                <Text key={colIdx} style={styles.sampleCell}>
                                  {val === null ? 'NULL' : String(val)}
                                </Text>
                              ))}
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Foreign Keys */}
                  {table.columns.some((c) => c.foreignKey) && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Relationships</Text>
                      {table.columns
                        .filter((c) => c.foreignKey)
                        .map((col, idx) => (
                          <Text key={idx} style={styles.fkRow}>
                            {col.name} → {col.foreignKey?.table}.{col.foreignKey?.column}
                          </Text>
                        ))
                      }
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  title: { fontFamily: 'JetBrainsMono-Regular', fontSize: 18, color: '#E6EDF3' },
  refreshBtn: {
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  refreshText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#3FB950' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  loading: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#8B949E' },
  error: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#F85149', marginBottom: 12 },
  info: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#8B949E', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#3FB950' },
  tableList: { padding: 16 },
  tableCard: {
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    marginBottom: 12,
    backgroundColor: '#161B22',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  tableHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableName: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#3FB950', fontWeight: '600' },
  columnCount: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#8B949E' },
  expandIcon: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#8B949E' },
  tableBody: { padding: 12 },
  section: { marginBottom: 16 },
  sectionTitle: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#8B949E', textTransform: 'uppercase', marginBottom: 8 },
  columnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  columnInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  columnName: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#E6EDF3' },
  columnType: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#8B949E' },
  columnKeys: { flexDirection: 'row', gap: 4 },
  pkBadge: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 10,
    color: '#0D1117',
    backgroundColor: '#3FB950',
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  fkBadge: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 10,
    color: '#0D1117',
    backgroundColor: '#58A6FF',
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  sampleScroll: { flex: 1 },
  sampleTable: { minWidth: 200 },
  sampleHeader: { flexDirection: 'row', backgroundColor: '#30363D', paddingVertical: 6 },
  sampleHeaderCell: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#8B949E', paddingHorizontal: 8, fontWeight: '600' },
  sampleRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#30363D' },
  sampleCell: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#E6EDF3', paddingHorizontal: 8, paddingVertical: 6 },
  fkRow: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#58A6FF', paddingVertical: 4 },
})
