import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
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
// Google Drive
// ============================================
import { google } from 'googleapis';

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

// 🔑 Google Drive Service Account
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
  // ЗАГРУЗКА НА GOOGLE DRIVE
  // ============================================
  const uploadToDrive = async (videoPath, cameraName) => {
    try {
      if (SERVICE_ACCOUNT_KEY.private_key === "КЛЮЧ_НЕ_НАЙДЕН") {
        throw new Error('Ключ Google Drive не найден. Добавьте секрет GOOGLE_PRIVATE_KEY');
      }

      const auth = new google.auth.JWT({
        email: SERVICE_ACCOUNT_KEY.client_email,
        key: SERVICE_ACCOUNT_KEY.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      const drive = google.drive({ version: 'v3', auth });

      const fileInfo = await FileSystem.getInfoAsync(videoPath);
      if (!fileInfo.exists) {
        throw new Error('Файл не найден');
      }

      const fileData = await FileSystem.readAsStringAsync(videoPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const date = new Date();
      const fileName =
        `${cameraName}_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}.txt`;

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [GOOGLE_DRIVE_FOLDER_ID],
          description: `Тестовый файл от ${date.toLocaleString()}`,
        },
        media: {
          mimeType: 'text/plain',
          body: Buffer.from(fileData, 'base64'),
        },
        fields: 'id, webViewLink, name',
      });

      const recordingsRef = ref(database, 'recordings');
      await push(recordingsRef, {
        fileName: response.data.name,
        driveFileId: response.data.id,
        driveUrl: response.data.webViewLink,
        cameraName: cameraName,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        type: 'google_drive_test',
      });

      return response.data;

    } catch (error) {
      console.error('❌ Ошибка загрузки:', error);
      throw error;
    }
  };

  // ============================================
  // ТЕСТОВАЯ ЗАГРУЗКА
  // ============================================
  const testUpload = async () => {
    setUploading(true);
    try {
      const testPath = `${FileSystem.documentDirectory}test_upload.txt`;
      await FileSystem.writeAsStringAsync(
        testPath,
        `Тестовый файл\nСоздан: ${new Date().toLocaleString()}\nПриложение: Камера Запись`
      );

      const result = await uploadToDrive(testPath, 'Тестовая камера');
      await FileSystem.deleteAsync(testPath);

      Alert.alert(
        '✅ Успех!',
        `Файл загружен на Google Диск\nНазвание: ${result.name}`
      );

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
        <TouchableOpacity
          style={[styles.button, styles.firebaseButton]}
          onPress={async () => {
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
          }}
        >
          <Text style={styles.buttonText}>📝 Добавить в Firebase</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.driveButton]}
          onPress={testUpload}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>
            {uploading ? '⏳ Загрузка...' : '☁️ Загрузить на Google Диск'}
          </Text>
        </TouchableOpacity>

        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {loading ? '⏳ Загрузка...' : `📋 Записей: ${recordings.length}`}
          </Text>
        </View>

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
});
