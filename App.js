import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { BleManager } from 'react-native-ble-plx';
import * as Location from 'expo-location';

// ============================================
// Firebase
// ============================================
import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  child,
  query,
  orderByChild,
  equalTo,
  onValue,
} from 'firebase/database';

// ============================================
// Google Drive
// ============================================
import { google } from 'googleapis';

// ============================================
// ВАШИ ДАННЫЕ (БЕЗ КЛЮЧЕЙ!)
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

const CAMERA_CONFIG = {
  ip: '192.168.1.100',
  port: 554,
  username: 'admin',
  password: 'admin',
};
// ============================================

const app = initializeApp(FIREBASE_CONFIG);
const database = getDatabase(app);

const bleManager = new BleManager();

// ============================================
// ОСНОВНОЕ ПРИЛОЖЕНИЕ
// ============================================
export default function App() {
  const [loading, setLoading] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [cameraConnected, setCameraConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraIP, setCameraIP] = useState(CAMERA_CONFIG.ip);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showWiFiSetup, setShowWiFiSetup] = useState(false);

  // ============================================
  // 1. ЗАГРУЗКА ЗАПИСЕЙ ИЗ FIREBASE
  // ============================================
  useEffect(() => {
    loadRecordings();

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

  const loadRecordings = async () => {
    try {
      const dbRef = ref(database);
      const snapshot = await get(child(dbRef, 'recordings'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        list.sort((a, b) => b.timestamp - a.timestamp);
        setRecordings(list);
      }
    } catch (error) {
      console.error('Ошибка загрузки записей:', error);
    }
  };

  // ============================================
  // 2. Bluetooth: СКАНИРОВАНИЕ
  // ============================================
  const scanForCameras = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Нужно разрешение на геолокацию для сканирования Bluetooth');
      return;
    }

    setScanning(true);
    setDevices([]);

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Ошибка сканирования:', error);
        setScanning(false);
        return;
      }

      if (device.name && (device.name.startsWith('IPCEI') || device.name.startsWith('BJ'))) {
        console.log('Найдена камера:', device.name);
        setDevices(prev => {
          if (prev.find(d => d.id === device.id)) return prev;
          return [...prev, { id: device.id, name: device.name, device }];
        });
      }
    });

    setTimeout(() => {
      bleManager.stopDeviceScan();
      setScanning(false);
      if (devices.length === 0) {
        Alert.alert('Не найдено', 'Камеры не найдены. Убедитесь, что камера включена.');
      }
    }, 10000);
  };

  // ============================================
  // 3. Bluetooth: ОТПРАВКА WI-FI
  // ============================================
  const connectAndSetupWiFi = async (device) => {
    setLoading(true);
    try {
      await device.connect();
      await device.discoverAllServicesAndCharacteristics();

      const SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB';
      const CHAR_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB';

      const services = await device.services();
      const targetService = services.find(s => s.uuid === SERVICE_UUID);
      
      if (!targetService) {
        Alert.alert('Ошибка', 'Не удалось найти сервис настройки Wi-Fi на камере');
        await device.cancelConnection();
        setLoading(false);
        return;
      }

      // Кодируем данные (без TextEncoder)
      const data = `${wifiSSID}|${wifiPassword}`;
      const bytes = [];
      for (let i = 0; i < data.length; i++) {
        bytes.push(data.charCodeAt(i));
      }

      await device.writeCharacteristicWithResponse(
        SERVICE_UUID,
        CHAR_UUID,
        bytes
      );

      Alert.alert('✅ Успех!', `Настройки Wi-Fi отправлены на ${device.name}`);
      
      await device.cancelConnection();
      setShowWiFiSetup(false);
      setSelectedDevice(null);
      setWifiSSID('');
      setWifiPassword('');
      setDevices([]);

      Alert.alert('📌 Подсказка', 'После подключения камеры к Wi-Fi найдите её IP-адрес в роутере.');

    } catch (error) {
      console.error('Ошибка настройки:', error);
      Alert.alert('❌ Ошибка', `Не удалось настроить камеру: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // 4. ПОДКЛЮЧЕНИЕ К КАМЕРЕ
  // ============================================
  const connectCamera = () => {
    setCameraConnected(true);
    Alert.alert('✅ Подключено', `Камера ${cameraIP} подключена`);
  };

  // ============================================
  // 5. УПРАВЛЕНИЕ КАМЕРОЙ
  // ============================================
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
    setIsZooming(true);
    if (type === 'in') {
      setZoomLevel(Math.min(zoomLevel + 0.5, 5));
    } else {
      setZoomLevel(Math.max(zoomLevel - 0.5, 1));
    }
    setTimeout(() => setIsZooming(false), 500);
  };

  // ============================================
  // 6. ЗАПИСЬ
  // ============================================
  const startRecording = async () => {
    if (!cameraConnected) {
      Alert.alert('Ошибка', 'Сначала подключитесь к камере');
      return;
    }
    setIsRecording(true);
    Alert.alert('🔴 Запись начата');
  };

  const stopRecording = async () => {
    setIsRecording(false);
    Alert.alert('⏹️ Запись остановлена');

    const videoPath = `${FileSystem.documentDirectory}recording_${Date.now()}.mp4`;

    try {
      await FileSystem.writeAsStringAsync(videoPath, 'Test video data', {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await uploadToDrive(videoPath, 'Уличная Z2');
      await FileSystem.deleteAsync(videoPath);

      Alert.alert('✅ Видео сохранено и загружено на Google Диск');
    } catch (error) {
      Alert.alert('❌ Ошибка', error.message);
    }
  };

  // ============================================
  // 7. ЗАГРУЗКА НА GOOGLE DRIVE
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
  // 8. ОТКРЫТЬ ВИДЕО
  // ============================================
  const openVideo = (url) => {
    Alert.alert('🔗 Видео на Google Диске', url);
  };

  // ============================================
  // 9. UI
  // ============================================
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>📹 Камера Запись</Text>
          <Text style={styles.subtitle}>Teruhal Z2</Text>
        </View>

        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            {cameraConnected ? '🟢 Подключена' : '🔴 Не подключена'}
          </Text>
          <Text style={styles.statusText}>
            Зум: {zoomLevel.toFixed(1)}x
          </Text>
        </View>

        {/* BLUETOOTH НАСТРОЙКА */}
        <View style={styles.wifiSetupContainer}>
          <TouchableOpacity
            style={[styles.button, styles.scanButton]}
            onPress={scanForCameras}
            disabled={scanning}
          >
            <Text style={styles.buttonText}>
              {scanning ? '🔍 Поиск камер...' : '🔍 Найти камеру по Bluetooth'}
            </Text>
          </TouchableOpacity>

          {devices.length > 0 && (
            <View style={styles.deviceList}>
              <Text style={styles.deviceListTitle}>Найденные камеры:</Text>
              {devices.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.deviceItem}
                  onPress={() => {
                    setSelectedDevice(item);
                    setShowWiFiSetup(true);
                  }}
                >
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceId}>{item.id}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* МОДАЛ WI-FI */}
        <Modal visible={showWiFiSetup} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Настройка Wi-Fi</Text>
              <Text style={styles.modalSubtitle}>
                Камера: {selectedDevice?.name || 'Неизвестная'}
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Название Wi-Fi (SSID)"
                value={wifiSSID}
                onChangeText={setWifiSSID}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Пароль от Wi-Fi"
                value={wifiPassword}
                onChangeText={setWifiPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowWiFiSetup(false);
                    setSelectedDevice(null);
                  }}
                >
                  <Text style={styles.buttonText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={() => {
                    if (!wifiSSID || !wifiPassword) {
                      Alert.alert('Ошибка', 'Введите название Wi-Fi и пароль');
                      return;
                    }
                    connectAndSetupWiFi(selectedDevice.device);
                  }}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>
                    {loading ? '⏳ Отправка...' : '✅ Отправить'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ВВОД IP */}
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

        {/* ВИДЕО ПЛЕЙСХОЛДЕР */}
        <View style={styles.videoPlaceholder}>
          <Text style={styles.videoPlaceholderText}>
            {cameraConnected ? '📺 Видео с камеры' : 'Подключите камеру'}
          </Text>
          {isRecording && <Text style={styles.recordingIndicator}>🔴 ЗАПИСЬ</Text>}
        </View>

        {/* PTZ */}
        <View style={styles.controls}>
          <View style={styles.ptzRow}>
            <TouchableOpacity style={[styles.ptzButton, styles.ptzUp]} onPress={() => moveCamera('вверх')}>
              <Text style={styles.ptzButtonText}>▲</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.ptzRow}>
            <TouchableOpacity style={[styles.ptzButton, styles.ptzLeft]} onPress={() => moveCamera('влево')}>
              <Text style={styles.ptzButtonText}>◀</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ptzButton, styles.ptzCenter]} onPress={() => moveCamera('стоп')}>
              <Text style={styles.ptzButtonText}>⏹</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ptzButton, styles.ptzRight]} onPress={() => moveCamera('вправо')}>
              <Text style={styles.ptzButtonText}>▶</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.ptzRow}>
            <TouchableOpacity style={[styles.ptzButton, styles.ptzDown]} onPress={() => moveCamera('вниз')}>
              <Text style={styles.ptzButtonText}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ZOOM */}
        <View style={styles.zoomControls}>
          <TouchableOpacity style={[styles.button, styles.zoomOutButton]} onPress={() => zoomCamera('out')}>
            <Text style={styles.buttonText}>➖ Зум</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLevel}>{zoomLevel.toFixed(1)}x</Text>
          <TouchableOpacity style={[styles.button, styles.zoomInButton]} onPress={() => zoomCamera('in')}>
            <Text style={styles.buttonText}>Зум ➕</Text>
          </TouchableOpacity>
        </View>

        {/* RECORD */}
        <View style={styles.recordControls}>
          {!isRecording ? (
            <TouchableOpacity style={[styles.button, styles.recordButton]} onPress={startRecording}>
              <Text style={styles.buttonText}>🔴 Начать запись</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopRecording}>
              <Text style={styles.buttonText}>⏹️ Остановить запись</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* LIST */}
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>📋 Записи ({recordings.length})</Text>
          {recordings.length === 0 ? (
            <Text style={styles.emptyText}>Нет записей</Text>
          ) : (
            recordings.slice(0, 10).map((item) => (
              <TouchableOpacity key={item.id} style={styles.recordingItem} onPress={() => openVideo(item.driveUrl)}>
                <Text style={styles.recordingName}>{item.cameraName}</Text>
                <Text style={styles.recordingDate}>{new Date(item.timestamp).toLocaleString()}</Text>
                <Text style={styles.recordingFile}>{item.fileName}</Text>
              </TouchableOpacity>
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
  wifiSetupContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scanButton: {
    backgroundColor: '#9C27B0',
  },
  deviceList: {
    marginTop: 10,
  },
  deviceListTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  deviceItem: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginTop: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
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
  videoPlaceholder: {
    height: 200,
    backgroundColor: '#1a1a1a',
    margin: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    color: '#888',
    fontSize: 18,
  },
  recordingIndicator: {
    color: '#ff0000',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
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
  ptzUp: { backgroundColor: '#4CAF50' },
  ptzDown: { backgroundColor: '#f44336' },
  ptzLeft: { backgroundColor: '#2196F3' },
  ptzRight: { backgroundColor: '#FF9800' },
  ptzCenter: { backgroundColor: '#9E9E9E' },
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
  recordButton: { backgroundColor: '#f44336' },
  stopButton: { backgroundColor: '#9E9E9E' },
  zoomInButton: { backgroundColor: '#4CAF50', flex: 1 },
  zoomOutButton: { backgroundColor: '#FF9800', flex: 1 },
  cancelButton: { backgroundColor: '#9E9E9E', flex: 1, marginRight: 8 },
  saveButton: { backgroundColor: '#4CAF50', flex: 1, marginLeft: 8 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '85%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 8,
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
