import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';

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
  const [uploading, setUploading] = useState(false);

  // ============================================
  // ЗАГРУЗКА ЗАПИСЕЙ ИЗ FIREBASE
  // ============================================
  useEffect(() => {
    const recordingsRef = ref(database, 'recordings');
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
      } else {
        setRecordings([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // ============================================
  // ДОБАВЛЕНИЕ ТЕСТОВОЙ ЗАПИСИ
  // ============================================
  const addTestRecord = async () => {
    try {
      const recordingsRef = ref(database, 'recordings');
      await push(recordingsRef, {
        test: true,
        message: 'Тестовая запись',
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
      });
      Alert.alert('✅ Успех!', 'Запись добавлена в Firebase');
    } catch (error) {
      Alert.alert('❌ Ошибка', error.message);
    }
  };

  // ============================================
  // СИМУЛЯЦИЯ ЗАГРУЗКИ (без файлов)
  // ============================================
  const simulateUpload = async () => {
    setUploading(true);
    try {
      // Имитация загрузки
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Сохраняем в Firebase
      const recordingsRef = ref(database, 'recordings');
      await push(recordingsRef, {
        fileName: `simulated_${Date.now()}.txt`,
        driveFileId: 'simulated_id',
        driveUrl: 'https://drive.google.com/simulated',
        cameraName: 'Тестовая камера',
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        type: 'google_drive_test',
        simulated: true,
      });
      
      Alert.alert('✅ Успех!', 'Симуляция загрузки завершена');
      
    } catch (error) {
      Alert.alert('❌ Ошибка', error.message);
    } finally {
      setUploading(false);
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
        {/* КНОПКА FIREBASE */}
        <TouchableOpacity
          style={[styles.button, styles.firebaseButton]}
          onPress={addTestRecord}
        >
          <Text style={styles.buttonText}>📝 Добавить в Firebase</Text>
        </TouchableOpacity>

        {/* КНОПКА СИМУЛЯЦИИ */}
        <TouchableOpacity
          style={[styles.button, styles.driveButton]}
          onPress={simulateUpload}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>
            {uploading ? '⏳ Загрузка...' : '☁️ Симуляция загрузки'}
          </Text>
        </TouchableOpacity>

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
                  {item.type === 'google_drive_test' ? '☁️ Drive' :
                   item.test ? '🧪 Тест' : '📹 Запись'}
                </Text>
                <Text style={styles.recordingSubText}>
                  {item.fileName || item.message || 'Без имени'}
                </Text>
                <Text style={styles.recordingDate}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
                {item.simulated && (
                  <Text style={styles.simulatedBadge}>🔵 Симуляция</Text>
                )}
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
  button: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  firebaseButton: {
    backgroundColor: '#FF6D00',
  },
  driveButton: {
    backgroundColor: '#4285F4',
  },
  buttonText: {
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
    fontWeight: 'bold',
    color: '#333',
  },
  recordingSubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  recordingDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  simulatedBadge: {
    fontSize: 10,
    color: '#4285F4',
    marginTop: 2,
    fontWeight: 'bold',
  },
});
