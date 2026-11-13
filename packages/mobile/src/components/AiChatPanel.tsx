import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import type { AiMessage } from '@/ai/service'

interface AiChatPanelProps {
  messages: AiMessage[]
  isGenerating: boolean
  onSend: (message: string) => void
  onStop: () => void
  questionTitle: string
}

export function AiChatPanel({ messages, isGenerating, onSend, onStop, questionTitle }: AiChatPanelProps) {
  const bottomRef = useRef<ScrollView>(null)

  useEffect(() => {
    bottomRef.current?.scrollToEnd({ animated: true })
  }, [messages])

  const handleSend = () => {
    onSend('Help me understand this question better')
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Assistant</Text>
        <Text style={styles.questionLabel} numberOfLines={1}>{questionTitle}</Text>
      </View>

      <ScrollView
        ref={bottomRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Ask for hints or explanations.</Text>
            <Text style={styles.emptySub}>AI is disabled in settings — enable it first.</Text>
          </View>
        )}

        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.aiBubble,
            ]}
          >
            <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : styles.aiText]}>
              {msg.content}
            </Text>
          </View>
        ))}

        {isGenerating && (
          <View style={styles.aiBubble}>
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TouchableOpacity
          style={[styles.sendButton, isGenerating ? styles.sendDisabled : null]}
          onPress={isGenerating ? onStop : handleSend}
          disabled={isGenerating}
        >
          <Text style={styles.sendText}>{isGenerating ? 'Stop' : 'Ask'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161B22',
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  headerTitle: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 14,
    fontWeight: '700',
    color: '#3FB950',
  },
  questionLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#8B949E',
    marginTop: 2,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 14,
    color: '#E6EDF3',
  },
  emptySub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#6E7681',
    marginTop: 4,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 8,
    padding: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(63, 185, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.3)',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  userText: {
    fontFamily: 'Inter-Regular',
    color: '#E6EDF3',
  },
  aiText: {
    fontFamily: 'Inter-Regular',
    color: '#E6EDF3',
  },
  typingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#3FB950',
    fontStyle: 'italic',
  },
  inputRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
    flexDirection: 'row',
    gap: 8,
  },
  sendButton: {
    flex: 1,
    backgroundColor: '#3FB950',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendText: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1117',
  },
})
