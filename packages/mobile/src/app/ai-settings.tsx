import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Spacing } from '@/constants/theme'
import { useAiStore } from '@/ai/store'
import { DEFAULT_AI_CONFIG } from '@/ai/config'

interface AiSettingsScreenProps {
  onDismiss: () => void
}

export function AiSettingsScreen({ onDismiss }: AiSettingsScreenProps) {
  const insets = useSafeAreaInsets()
  const { config, saveConfig, toggleEnabled } = useAiStore()
  const [apiKey, setApiKey] = useState(config.apiKey ?? '')
  const [baseUrl, setBaseUrl] = useState(config.baseUrl ?? '')
  const [saving, setSaving] = useState(false)

  const handleToggle = useCallback(async (enabled: boolean) => {
    await toggleEnabled(enabled)
  }, [toggleEnabled])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await saveConfig({
        ...config,
        apiKey: apiKey.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
      })
      Alert.alert('Settings Saved', 'AI configuration updated successfully.')
      onDismiss()
    } catch {
      Alert.alert('Save Failed', 'Could not save AI settings.')
    } finally {
      setSaving(false)
    }
  }, [config, apiKey, baseUrl, saveConfig, onDismiss])

  const handleReset = useCallback(() => {
    setApiKey('')
    setBaseUrl('')
    saveConfig(DEFAULT_AI_CONFIG)
    Alert.alert('Reset', 'AI settings have been reset to defaults.')
  }, [saveConfig])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
    >
      <Text style={styles.title}>AI Settings</Text>
      <Text style={styles.subtitle}>Configure AI-powered hints and diagnostics</Text>

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Enable AI Features</Text>
            <Text style={styles.switchDesc}>Get AI-generated hints and error diagnosis</Text>
          </View>
          <Switch
            value={config.enabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#30363D', true: 'rgba(63, 185, 80, 0.3)' }}
            thumbColor={config.enabled ? '#3FB950' : '#8B949E'}
          />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Provider Configuration</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Base URL</Text>
          <TextInput
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://api.example.com"
            placeholderTextColor="#6E7681"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>API Key (optional)</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk-..."
            placeholderTextColor="#6E7681"
            autoCapitalize="none"
            secureTextEntry
          />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What AI Can Do</Text>
        {[
          { title: 'Smart Hints', desc: 'Context-aware hints based on your answer' },
          { title: 'Error Diagnosis', desc: 'Explain why your query failed' },
          { title: 'Query Improvement', desc: 'Suggestions to fix and optimize SQL' },
          { title: 'Conversational Help', desc: 'Ask questions about SQL concepts' },
        ].map(item => (
          <View key={item.title} style={styles.featureRow}>
            <Text style={styles.featureTitle}>{item.title}</Text>
            <Text style={styles.featureDesc}>{item.desc}</Text>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      <TouchableOpacity
        style={[styles.saveBtn, saving ? styles.btnDisabled : null]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
        <Text style={styles.resetText}>Reset to Defaults</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
        <Text style={styles.closeText}>Close</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  title: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 22,
    fontWeight: '700',
    color: '#E6EDF3',
    marginBottom: Spacing.half,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#8B949E',
    marginBottom: Spacing.three,
  },
  section: { marginBottom: Spacing.three },
  divider: { height: 1, backgroundColor: '#30363D', marginVertical: Spacing.three },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  switchInfo: { flex: 1, marginRight: Spacing.two },
  switchLabel: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 15,
    color: '#E6EDF3',
    fontWeight: '600',
  },
  switchDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8B949E',
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 13,
    color: '#3FB950',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  field: { marginBottom: Spacing.two },
  fieldLabel: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 12,
    color: '#8B949E',
    marginBottom: Spacing.half,
  },
  input: {
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    backgroundColor: '#161B22',
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 13,
    color: '#E6EDF3',
  },
  featureRow: {
    paddingVertical: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  featureTitle: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 13,
    color: '#E6EDF3',
    fontWeight: '600',
  },
  featureDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8B949E',
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: '#3FB950',
    borderRadius: 6,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  btnDisabled: { opacity: 0.5 },
  saveText: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 15,
    fontWeight: '600',
    color: '#0D1117',
  },
  resetBtn: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  resetText: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 13,
    color: '#F85149',
  },
  closeBtn: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  closeText: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 14,
    color: '#8B949E',
  },
})
