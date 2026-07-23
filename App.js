import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';

// ============================================
// Firebase
// ============================================
import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  push,
  get,
  child,
  onValue,
} from 'firebase/database';

// ============================================
// ВАШИ ДАННЫЕ FIREBASE
// ============================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAA9wNYkBxznQZ9Bs8KRxOpof37-0joAic",
  authDomain: "cameraappstorage.firebaseapp.com",
  databaseURL: "https://cameraappstorage-default-rtdb.firebaseio.com",
  projectId: "cameraappstorage",
  storageBucket: "cameraappstorage.firebasestorage.app",
  messagingSenderId: "115528203000",
  appId: "1:115528203000:web:bdc0eb8d7bf48d6174190d"
};

// ============================================

const app = initializeApp(FIREBASE_CONFIG);
const database = getDatabase(app);

// ============================================
// ОСНОВНОЕ ПРИЛОЖЕНИЕ
// ============================================
export default function App() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  // ============================================
  // ЗАГРУЗКА ЗАПИСЕЙ ИЗ FIREBASE
  // ============================================
  useEffect(() => {
    const recordingsRef = ref(database, 'recordings');
    
    // Слушаем изменения в реальном времени
    const unsubscribe = onValue(recordingsRef, (snapshot) => {
      setLoading(false);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        list.sort((a, b) => b.timestamp - a.timestamp);
        setRecordings(list);
        console.log('✅ Записей загружено:', list.length);
      } else {
        setRecordings([]);
        console.log('📭 Записей нет');
      }
    });

    return () => unsubscribe();
  }, []);

  // ============================================
  // ТЕСТОВАЯ ЗАПИСЬ В FIREBASE
  // ============================================
  const testAddRecord = async () => {
    try {
      const recordingsRef = ref(database, 'recordings');
      await push(recordingsRef, {
        test: true,
        message: 'Тестовая запись',
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
      });
      Alert.alert('✅ Успех!', 'Тестовая запись добавлена в Firebase');
    } catch (error) {
      console.error('Ошибка:', error);
      Alert.alert('❌ Ошибка', error.message);
    }
  };

  // ============================================
  // UI
  // ============================================
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📹 Камера Запись</Text>
        <Text style={styles.subtitle}>Teruhal Z2</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* КНОПКА ТЕСТА */}
        <View style={styles.buttonContainer}>
          <Text style={styles.buttonLabel} onPress={testAddRecord}>
            ➕ Добавить тестовую запись
          </Text>
        </View>

        {/* СТАТУС */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {loading ? '⏳ Загрузка...' : `📋 Записей: ${recordings.length}`}
          </Text>
        </View>

        {/* СПИСОК ЗАПИСЕЙ */}
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>Последние записи:</Text>
          {recordings.length === 0 ? (
            <Text style={styles.emptyText}>Нет записей</Text>
          ) : (
            recordings.slice(0, 10).map((item) => (
              <View key={item.id} style={styles.recordingItem}>
                <Text style={styles.recordingText}>
                  {item.test ? '🧪 Тест' : '📹 Запись'}
                </Text>
                <Text style={styles.recordingDate}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================
// СТИЛИ
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#072146',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#90CAF9',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  buttonContainer: {
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  listContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    padding: 10,
  },
  recordingItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recordingText: {
    fontSize: 14,
    color: '#333',
  },
  recordingDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});
