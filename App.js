import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAA9wNYkBxznQZ9Bs8KRxOpof37-0joAic",
  authDomain: "cameraappstorage.firebaseapp.com",
  databaseURL: "https://cameraappstorage-default-rtdb.firebaseio.com",
  projectId: "cameraappstorage",
  storageBucket: "cameraappstorage.firebasestorage.app",
  messagingSenderId: "115528203000",
  appId: "1:115528203000:web:bdc0eb8d7bf48d6174190d"
};

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
  const [loading, setLoading] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [cameraIP, setCameraIP] = useState('192.168.1.100');

  // ============================================
  // ЗАГРУЗКА ЗАПИСЕЙ
  // ============================================
  useEffect(() => {
    const recordingsRef = ref(database, 'recordings');
    const unsubscribe = onValue(recordingsRef, (snapshot) => {
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
        throw new Error('Ключ Google Drive не найден.');
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
        `${cameraName}_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}.mp4`;

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [GOOGLE_DRIVE_FOLDER_ID],
          description: `Запись с камеры ${cameraName} от ${date.toLocaleString()}`,
        },
        media: {
          mimeType: 'video/mp4',
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
    setLoading(true);
    try {
      const videoPath = `${FileSystem.documentDirectory}test_video.txt`;
      await FileSystem.writeAsStringAsync(videoPath, 'Test video data');

      await uploadToDrive(videoPath, 'Тестовая камера');
      await FileSystem.deleteAsync(videoPath);

      Alert.alert('✅ Успех!', 'Файл загружен на Google Диск');
    } catch (error) {
      Alert.alert('❌ Ошибка', error.message);
    } finally {
      setLoading(false);
    }
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

        {/* IP АДРЕС */}
        <View style={styles.ipContainer}>
          <TextInput
            style={styles.ipInput}
            value={cameraIP}
            onChangeText={setCameraIP}
            placeholder="Введите IP камеры"
            keyboardType="numeric"
          />
        </View>

        {/* ТЕСТОВАЯ ЗАГРУЗКА */}
        <TouchableOpacity
          style={[styles.button, styles.uploadButton]}
          onPress={testUpload}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? '⏳ Загрузка...' : '📤 Тестовая загрузка на Google Диск'}
          </Text>
        </TouchableOpacity>

        {/* СПИСОК ЗАПИСЕЙ */}
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>📋 Записи ({recordings.length})</Text>
          {recordings.length === 0 ? (
            <Text style={styles.emptyText}>Нет записей</Text>
          ) : (
            recordings.slice(0, 10).map((item) => (
              <View key={item.id} style={styles.recordingItem}>
                <Text style={styles.recordingName}>{item.cameraName}</Text>
                <Text style={styles.recordingDate}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
                <Text style={styles.recordingFile}>{item.fileName}</Text>
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
    backgroundColor: '#fff',
  },
  button: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    margin: 20,
    marginBottom: 10,
  },
  uploadButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  recordingName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  recordingDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  recordingFile: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
