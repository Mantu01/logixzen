import { useState } from 'react'
import { StyleSheet, View, TouchableOpacity, FlatList } from 'react-native'
import { Text } from 'react-native-paper'

interface Dataset {
  id: string
  name: string
  tables: Array<{ name: string }>
}

interface DatasetSelectorProps {
  datasets: Dataset[]
  activeId: string | null
  onSelect: (id: string) => void
}

export function DatasetSelector({ datasets, activeId, onSelect }: DatasetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const activeDataset = datasets.find(d => d.id === activeId) ?? null

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.selector, isOpen && styles.selectorOpen]}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={styles.selectorLabel}>{activeDataset !== null ? activeDataset.name : 'Select Dataset'}</Text>
        <Text style={styles.selectorArrow}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.dropdown}>
          <FlatList
            data={datasets}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.option, item.id === activeId && styles.optionActive]}
                onPress={() => {
                  onSelect(item.id)
                  setIsOpen(false)
                }}
              >
                <Text style={[styles.optionText, item.id === activeId && styles.optionTextActive]}>
                  {item.name}
                </Text>
                <Text style={styles.optionTables}>{item.tables.length} tables</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 12, marginVertical: 8 },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
    backgroundColor: '#161B22',
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectorOpen: { borderColor: '#3FB950' },
  selectorLabel: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#E6EDF3' },
  selectorArrow: { fontFamily: 'JetBrainsMono-Regular', fontSize: 10, color: '#8B949E' },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: '#30363D',
    backgroundColor: '#161B22',
    borderRadius: 4,
    marginTop: 4,
    zIndex: 100,
    maxHeight: 200,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  optionActive: { backgroundColor: 'rgba(63, 185, 80, 0.12)' },
  optionText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#E6EDF3' },
  optionTextActive: { color: '#3FB950' },
  optionTables: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#6E7681' },
})
