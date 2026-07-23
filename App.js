import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';

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
// ВАШИ ДАННЫЕ
// ============================================

// 🔑 Firebase
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
  const videoRef = useRef(null);
  
  // Состояния для камеры
  const [cameraIP, setCameraIP] = useState('192.168.1.100');
  const [cameraConnected, setCameraConnected] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isRecording, setIsRecording] = useState(false);

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
  // СИМУЛЯЦИЯ ЗАГРУЗКИ НА GOOGLE DRIVE
  // ============================================
  const simulateUpload = async () => {
    setUploading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
  // УПРАВЛЕНИЕ КАМЕРОЙ
  // ============================================
  const connectCamera = () => {
    if (!cameraIP) {
      Alert.alert('Ошибка', 'Введите IP адрес камеры');
      return;
    }
    setCameraConnected(true);
    Alert.alert('✅ Подключено', `Камера ${cameraIP} подключена`);
  };

  const moveCamera = (direction) => {
    if (!cameraConnected) {
      Alert.alert('Ошибка', 'Сначала подключитесь к камере');
      return;
    }
    Alert.alert('Движение', `Камера движется ${direction}`);
  };

  const zoomCamera = (type) => {
    if (!cameraConnected) {
      Alert.alert('Ошибка', 'Сначала подключитесь к камере');
      return;
    }
    if (type === 'in') {
      setZoomLevel(Math.min(zoomLevel + 0.5, 5));
    } else {
      setZoomLevel(Math.max(zoomLevel - 0.5, 1));
    }
  };

  const startRecording = () => {
    if (!cameraConnected) {
      Alert.alert('Ошибка', 'Сначала подключитесь к камере');
      return;
    }
    setIsRecording(true);
    Alert.alert('🔴 Запись начата');
  };

  const stopRecording = () => {
    setIsRecording(false);
    Alert.alert('⏹️ Запись остановлена');
  };

  // ============================================
  // RTSP URL
  // ============================================
  const getRTSPUrl = () => {
    // Формат RTSP для камер Teruhal Z2
    // rtsp://[IP]:554/live
    // или rtsp://[логин]:[пароль]@[IP]:554/live
    return `rtsp://admin:admin@${cameraIP}:554/live`;
  };

  // ============================================
  // UI
  // ============================================
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>📹 Камера Запись</Text>
          <Text style={styles.subtitle}>Teruhal Z2</Text>
        </View>

        {/* СТАТУС КАМЕРЫ */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            {cameraConnected ? '🟢 Подключена' : '🔴 Не подключена'}
          </Text>
          <Text style={styles.statusText}>
            Зум: {zoomLevel.toFixed(1)}x
          </Text>
        </View>

        {/* ВВОД IP АДРЕСА */}
        <View style={styles.ipContainer}>
          <TextInput
            style={styles.ipInput}
            value={cameraIP}
            onChangeText={setCameraIP}
            placeholder="Введите IP камеры"
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[styles.button, styles.connectButton]}
            onPress={connectCamera}
          >
            <Text style={styles.buttonText}>Подключить</Text>
          </TouchableOpacity>
        </View>

        {/* ВИДЕО ПЛЕЕР */}
        <View style={styles.videoContainer}>
          {cameraConnected ? (
            <Video
              ref={videoRef}
              style={styles.video}
              source={{ uri: getRTSPUrl() }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              onError={(error) => {
                console.log('Ошибка видео:', error);
                Alert.alert('⚠️ Ошибка', 'Не удалось подключиться к RTSP-потоку. Проверьте IP и пароль.');
              }}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderText}>
                📺 Подключите камеру
              </Text>
            </View>
          )}
          {isRecording && (
            <View style={styles.recordingOverlay}>
              <Text style={styles.recordingIndicator}>🔴 ЗАПИСЬ</Text>
            </View>
          )}
        </View>

        {/* УПРАВЛЕНИЕ PTZ */}
        <View style={styles.controls}>
          <Text style={styles.controlsTitle}>Управление камерой</Text>
          
          <View style={styles.ptzRow}>
            <TouchableOpacity
              style={[styles.ptzButton, styles.ptzUp]}
              onPress={() => moveCamera('вверх')}
            >
              <Text style={styles.ptzButtonText}>▲</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.ptzRow}>
            <TouchableOpacity
              style={[styles.ptzButton, styles.ptzLeft]}
              onPress={() => moveCamera('влево')}
            >
              <Text style={styles.ptzButtonText}>◀</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ptzButton, styles.ptzCenter]}
              onPress={() => moveCamera('стоп')}
            >
              <Text style={styles.ptzButtonText}>⏹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ptzButton, styles.ptzRight]}
              onPress={() => moveCamera('вправо')}
            >
              <Text style={styles.ptzButtonText}>▶</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.ptzRow}>
            <TouchableOpacity
              style={[styles.ptzButton, styles.ptzDown]}
              onPress={() => moveCamera('вниз')}
            >
              <Text style={styles.ptzButtonText}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* УПРАВЛЕНИЕ ЗУМОМ */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.button, styles.zoomOutButton]}
            onPress={() => zoomCamera('out')}
          >
            <Text style={styles.buttonText}>➖ Зум</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLevel}>{zoomLevel.toFixed(1)}x</Text>
          <TouchableOpacity
            style={[styles.button, styles.zoomInButton]}
            onPress={() => zoomCamera('in')}
          >
            <Text style={styles.buttonText}>Зум ➕</Text>
          </TouchableOpacity>
        </View>

        {/* ЗАПИСЬ */}
        <View style={styles.recordControls}>
          {!isRecording ? (
            <TouchableOpacity
              style={[styles.button, styles.recordButton]}
              onPress={startRecording}
            >
              <Text style={styles.buttonText}>🔴 Начать запись</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={stopRecording}
            >
              <Text style={styles.buttonText}>⏹️ Остановить запись</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* СТАРЫЕ КНОПКИ (Firebase + Drive) */}
        <View style={styles.oldButtons}>
          <TouchableOpacity
            style={[styles.button, styles.firebaseButton]}
            onPress={addTestRecord}
          >
            <Text style={styles.buttonText}>📝 Добавить в Firebase</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.driveButton]}
            onPress={simulateUpload}
            disabled={uploading}
          >
            {uploading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" />
                <Text style={[styles.buttonText, styles.loadingText]}>
                  ⏳ Загрузка...
                </Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>☁️ Симуляция загрузки</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* СПИСОК ЗАПИСЕЙ */}
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>📋 Записи ({recordings.length})</Text>
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
    </SafeAreaView>
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
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  ipContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  ipInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  videoContainer: {
    margin: 20,
    height: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  video: {
    flex: 1,
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    color: '#888',
    fontSize: 18,
  },
  recordingOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  recordingIndicator: {
    color: '#ff0000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controls: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 10,
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  ptzRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ptzButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  ptzUp: {
    backgroundColor: '#4CAF50',
  },
  ptzDown: {
    backgroundColor: '#f44336',
  },
  ptzLeft: {
    backgroundColor: '#2196F3',
  },
  ptzRight: {
    backgroundColor: '#FF9800',
  },
  ptzCenter: {
    backgroundColor: '#9E9E9E',
  },
  ptzButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 10,
  },
  zoomLevel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 20,
    minWidth: 50,
    textAlign: 'center',
  },
  recordControls: {
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  button: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 4,
  },
  connectButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
  },
  recordButton: {
    backgroundColor: '#f44336',
  },
  stopButton: {
    backgroundColor: '#9E9E9E',
  },
  zoomInButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
  },
  zoomOutButton: {
    backgroundColor: '#FF9800',
    flex: 1,
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 10,
  },
  oldButtons: {
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
  recordingItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
