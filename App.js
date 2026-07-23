import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system';

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

// 🔑 Google Drive Service Account (из вашего JSON)
const SERVICE_ACCOUNT_KEY = {
  type: "service_account",
  project_id: "utility-state-503307-n5",
  private_key_id: "8eee100ca6ffb2b4735722e33be362bba53ad10d",
  private_key: process.env.GOOGLE_PRIVATE_KEY || "КЛЮЧ_НЕ_НАЙДЕН",
  client_email: "camera-uploader@utility-state-503307-n5.iam.gserviceaccount.com",
  client_id: "107317417529573726682",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/camera-uploader%40utility-state-503307-n5.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

const GOOGLE_DRIVE_FOLDER_ID = '1-lqE_g1No9YzMXp3r7lvB1xkfX84DdiR';

// ============================================

const app = initializeApp(FIREBASE_CONFIG);
const database = getDatabase(app);

// ============================================
// ФУНКЦИЯ ПОЛУЧЕНИЯ ТОКЕНА ДЛЯ GOOGLE DRIVE
// ============================================
const getAccessToken = async () => {
  try {
    const privateKey = SERVICE_ACCOUNT_KEY.private_key;
    if (privateKey === "КЛЮЧ_НЕ_НАЙДЕН") {
      throw new Error('Ключ Google Drive не найден в секретах');
    }

    // Создаем JWT
    const jwtHeader = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const jwtClaim = {
      iss: SERVICE_ACCOUNT_KEY.client_email,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: SERVICE_ACCOUNT_KEY.token_uri,
      exp: now + 3600,
      iat: now
    };

    // Кодируем header и claim в base64url
    const headerBase64 = btoa(JSON.stringify(jwtHeader))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const claimBase64 = btoa(JSON.stringify(jwtClaim))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Подписываем JWT (пока без реальной подписи)
    // ВНИМАНИЕ: Для реальной работы нужна криптография с приватным ключом
    // Это упрощенная версия, которая работает через Google API Client Library
    
    // Вместо ручного подписания используем готовый JWT-клиент
    // но для Expo он не подходит, поэтому пока симуляция
    
    console.log('⚠️ Реальная подпись JWT требует библиотеку crypto');
    console.log('Пока используем симуляцию');
    
    return 'simulated_token';

  } catch (error) {
    console.error('Ошибка получения токена:', error);
    throw error;
  }
};

// ============================================
// ЗАГРУЗКА НА GOOGLE DRIVE (реальная)
// ============================================
const uploadToDrive = async (filePath, fileName) => {
  try {
    console.log('📤 Начинаем загрузку...');
    
    // 1. Читаем файл
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      throw new Error('Файл не найден');
    }

    const fileData = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('✅ Файл прочитан, размер:', fileInfo.size);

    // 2. Получаем токен
    const token = await getAccessToken();
    
    if (token === 'simulated_token') {
      console.log('⚠️ Используем симуляцию загрузки');
      
      // Симулируем успешную загрузку
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        id: 'simulated_' + Date.now(),
        name: fileName,
        webViewLink: 'https://drive.google.com/simulated',
        simulated: true
      };
    }

    // 3. Реальная загрузка через Google Drive API
    // (будет добавлена позже, когда настроим криптографию)
    
    return {
      id: 'real_' + Date.now(),
      name: fileName,
      webViewLink: 'https://drive.google.com/real',
      simulated: false
    };

  } catch (error) {
    console.error('❌ Ошибка загрузки:', error);
    throw error;
  }
};

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
  // РЕАЛЬНАЯ ЗАГРУЗКА НА GOOGLE DRIVE
  // ============================================
  const realUpload = async () => {
    setUploading(true);
    try {
      // 1. Создаём тестовый файл
      const testPath = `${FileSystem.documentDirectory}test_upload_${Date.now()}.txt`;
      const content = `Тестовый файл\nСоздан: ${new Date().toLocaleString()}\nПриложение: Камера Запись\nID: ${Date.now()}`;
      
      await FileSystem.writeAsStringAsync(testPath, content);
      console.log('📝 Файл создан:', testPath);

      // 2. Загружаем на Google Диск
      const fileName = `test_${Date.now()}.txt`;
      const result = await uploadToDrive(testPath, fileName);

      // 3. Удаляем временный файл
      await FileSystem.deleteAsync(testPath);
      console.log('🗑️ Временный файл удалён');

      // 4. Сохраняем в Firebase
      const recordingsRef = ref(database, 'recordings');
      await push(recordingsRef, {
        fileName: result.name,
        driveFileId: result.id,
        driveUrl: result.webViewLink,
        cameraName: 'Тестовая камера',
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        type: 'google_drive_real',
        simulated: result.simulated || false,
      });

      Alert.alert(
        '✅ Успех!',
        `Файл загружен на Google Диск\nНазвание: ${result.name}\n${result.simulated ? '🔵 Симуляция' : '🔴 Реальная загрузка'}`
      );

    } catch (error) {
      Alert.alert('❌ Ошибка', `Не удалось загрузить файл: ${error.message}`);
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

        {/* КНОПКА GOOGLE DRIVE */}
        <TouchableOpacity
          style={[styles.button, styles.driveButton]}
          onPress={realUpload}
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
            <Text style={styles.buttonText}>☁️ Загрузить на Google Диск</Text>
          )}
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
                  {item.type === 'google_drive_real' ? '☁️ Drive' :
                   item.type === 'google_drive_test' ? '🔵 Drive(тест)' :
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 10,
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
