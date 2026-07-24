import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VLCPlayer } from 'react-native-vlc-media-player';
import { BleManager } from 'react-native-ble-plx';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';

// ============================================
// Firebase
// ============================================
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue } from 'firebase/database';

// ============================================
// КОНФИГУРАЦИЯ FIREBASE
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
// ИНИЦИАЛИЗАЦИЯ
// ============================================
const app = initializeApp(FIREBASE_CONFIG);
const database = getDatabase(app);
const bleManager = new BleManager();

// ============================================
// ОСНОВНОЕ ПРИЛОЖЕНИЕ
// ============================================
export default function App() {
  // ===== Состояния =====
  const [cameraIP, setCameraIP] = useState('192.168.0.100');
  const [cameraConnected, setCameraConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [devices, setDevices] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [nightVision, setNightVision] = useState(false);
  const [ledOn, setLedOn] = useState(false);
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const vlcRef = useRef(null);

  // ===== Загрузка записей из Firebase =====
  useEffect(() => {
    const recordingsRef = ref(database, 'recordings');
    const unsubscribe = onValue(recordingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        list.sort((a, b) => b.timestamp - a.timestamp);
        setRecordings(list);
      }
    });
    return () => unsubscribe();
  }, []);

  // ============================================
  // BLUETOOTH
  // ============================================
  const scanForCameras = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Нужно разрешение на геолокацию для Bluetooth');
      return;
    }

    setScanning(true);
    setDevices([]);

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log(error);
        setScanning(false);
        return;
      }
      if (device.name && (device.name.startsWith('IPCEI') || device.name.startsWith('BJ'))) {
        setDevices(prev => {
          if (prev.find(d => d.id === device.id)) return prev;
          return [...prev, { id: device.id, name: device.name }];
        });
      }
    });

    setTimeout(() => {
      bleManager.stopDeviceScan();
      setScanning(false);
    }, 15000);
  };

  // ===== Отправка Wi-Fi настроек через Bluetooth =====
  const sendWiFiConfig = async (device) => {
    if (!wifiSSID || !wifiPassword) {
      Alert.alert('Ошибка', 'Введите название Wi-Fi и пароль');
      return;
    }

    try {
      setUploading(true);
      await device.connect();
      await device.discoverAllServicesAndCharacteristics();

      const SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB';
      const CHAR_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB';

      const data = `${wifiSSID}|${wifiPassword}`;
      const bytes = [];
      for (let i = 0; i < data.length; i++) {
        bytes.push(data.charCodeAt(i));
      }

      await device.writeCharacteristicWithResponse(SERVICE_UUID, CHAR_UUID, bytes);
      await device.cancelConnection();

      Alert.alert('✅ Успех!', 'Настройки Wi-Fi отправлены. Камера подключается к сети...');
      setShowWifiModal(false);
      setSelectedDevice(null);
      setDevices([]);
      setWifiSSID('');
      setWifiPassword('');
    } catch (error) {
      Alert.alert('❌ Ошибка', error.message);
    } finally {
      setUploading(false);
    }
  };

  // ============================================
  // ПОДКЛЮЧЕНИЕ К КАМЕРЕ ПО IP
  // ============================================
  const connectCamera = () => {
    if (!cameraIP) {
      Alert.alert('Ошибка', 'Введите IP адрес камеры');
      return;
    }
    setCameraConnected(true);
    Alert.alert('✅ Подключено', `Камера ${cameraIP} подключена`);
  };

  // ============================================
  // УПРАВЛЕНИЕ КАМЕРОЙ (HTTP-команды)
  // ============================================
  const sendHttpCommand = (command) => {
    if (!cameraConnected) {
      Alert.alert('Ошибка', 'Сначала подключитесь к камере');
      return;
    }
    // Здесь будет реальный HTTP-запрос к камере
    console.log(`📤 Команда: ${command}`);
    Alert.alert('Движение', `Команда: ${command}`);
  };

  // ============================================
  // ЗАПИСЬ ВИДЕО И ЗАГРУЗКА В GOOGLE DRIVE
  // ============================================
  const startRecording = () => {
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

    try {
      // Создаём тестовый файл (заглушка)
      const testPath = `${FileSystem.documentDirectory}recording_${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(testPath, 'Тестовая запись видео');

      // Сохраняем в Firebase
      const recordingsRef = ref(database, 'recordings');
      await push(recordingsRef, {
        message: 'Запись с камеры',
        fileName: `recording_${Date.now()}.txt`,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
      });

      // Удаляем временный файл
      await FileSystem.deleteAsync(testPath);

      Alert.alert('✅ Успех!', 'Запись сохранена в Firebase');
    } catch (error) {
      Alert.alert('❌ Ошибка', error.message);
    }
  };

  // ============================================
  // ПОЛУЧЕНИЕ RTSP ССЫЛКИ
  // ============================================
  const getRTSPUrl = () => {
    return `rtsp://admin:admin@${cameraIP}:554/live`;
  };

  // ============================================
  // UI
  // ============================================
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>📹 Камера Запись</Text>
          <Text style={styles.subtitle}>Teruhal Z2</Text>
        </View>

        {/* СТАТУС */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            {cameraConnected ? '🟢 Подключена' : '🔴 Не подключена'}
          </Text>
          <Text style={styles.statusText}>IP: {cameraIP}</Text>
        </View>

        {/* BLUETOOTH СКАНЕР */}
        <TouchableOpacity style={[styles.button, styles.blueButton]} onPress={scanForCameras} disabled={scanning}>
          <Text style={styles.buttonText}>
            {scanning ? '⏳ Поиск...' : '🔍 Найти камеру по Bluetooth'}
          </Text>
        </TouchableOpacity>

        {/* СПИСОК НАЙДЕННЫХ КАМЕР */}
        {devices.length > 0 && (
          <View style={styles.deviceList}>
            <Text style={styles.deviceTitle}>Найдены камеры:</Text>
            {devices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={styles.deviceItem}
                onPress={() => {
                  setSelectedDevice(device);
                  setShowWifiModal(true);
                }}
              >
                <Text style={styles.deviceText}>📷 {device.name}</Text>
                <Text style={styles.deviceSubText}>Нажмите для настройки Wi-Fi</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* МОДАЛ НАСТРОЙКИ WI-FI */}
        <Modal visible={showWifiModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Настройка Wi-Fi</Text>
              <Text style={styles.modalSubtitle}>Камера: {selectedDevice?.name}</Text>

              <TextInput
                style={styles.input}
                placeholder="Название Wi-Fi (SSID)"
                value={wifiSSID}
                onChangeText={setWifiSSID}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Пароль от Wi-Fi"
                value={wifiPassword}
                onChangeText={setWifiPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setShowWifiModal(false)}>
                  <Text style={styles.buttonText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.connectButton]} onPress={() => sendWiFiConfig(selectedDevice)} disabled={uploading}>
                  <Text style={styles.buttonText}>{uploading ? '⏳ Отправка...' : '✅ Отправить'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ВВОД IP АДРЕСА */}
        <View style={styles.ipContainer}>
          <TextInput
            style={styles.ipInput}
            value={cameraIP}
            onChangeText={setCameraIP}
            placeholder="Введите IP камеры"
            keyboardType="numeric"
          />
          <TouchableOpacity style={[styles.button, styles.connectButton]} onPress={connectCamera}>
            <Text style={styles.buttonText}>Подключить</Text>
          </TouchableOpacity>
        </View>

        {/* ВИДЕО ПЛЕЕР */}
        <View style={styles.videoContainer}>
          {cameraConnected ? (
            <VLCPlayer
              ref={vlcRef}
              style={styles.video}
              source={{ uri: getRTSPUrl() }}
              paused={false}
              repeat={true}
              videoAspectRatio="16:9"
              onError={() => Alert.alert('⚠️ Ошибка', 'Не удалось подключиться к RTSP-потоку')}
              onPlaying={() => console.log('✅ Видео запущено')}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderText}>📺 Подключите камеру</Text>
            </View>
          )}
          {isRecording && (
            <View style={styles.recordingOverlay}>
              <Text style={styles.recordingText}>🔴 ЗАПИСЬ</Text>
            </View>
          )}
        </View>

        {/* УПРАВЛЕНИЕ PTZ */}
        <View style={styles.controls}>
          <Text style={styles.controlsTitle}>Управление камерой</Text>
          <View style={styles.ptzRow}>
            <TouchableOpacity style={[styles.ptzButton, styles.ptzUp]} onPress={() => sendHttpCommand('move_up')}>
              <Text style={styles.ptzButtonText}>▲</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.ptzRow}>
            <TouchableOpacity style={[styles.ptzButton, styles.ptzLeft]} onPress={() => sendHttpCommand('move_left')}>
              <Text style={styles.ptzButtonText}>◀</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ptzButton, styles.ptzCenter]} onPress={() => sendHttpCommand('stop')}>
              <Text style={styles.ptzButtonText}>⏹</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ptzButton, styles.ptzRight]} onPress={() => sendHttpCommand('move_right')}>
              <Text style={styles.ptzButtonText}>▶</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.ptzRow}>
            <TouchableOpacity style={[styles.ptzButton, styles.ptzDown]} onPress={() => sendHttpCommand('move_down')}>
              <Text style={styles.ptzButtonText}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* НАСТРОЙКИ: ПОДСВЕТКА И НОЧНОЙ РЕЖИМ */}
        <View style={styles.settingsRow}>
          <Text style={styles.settingsLabel}>🔦 Подсветка</Text>
          <Switch
            value={ledOn}
            onValueChange={(value) => {
              setLedOn(value);
              sendHttpCommand(value ? 'led_on' : 'led_off');
            }}
          />
          <Text style={styles.settingsLabel}>🌙 Ночной режим</Text>
          <Switch
            value={nightVision}
            onValueChange={(value) => {
              setNightVision(value);
              sendHttpCommand(value ? 'night_on' : 'night_off');
            }}
          />
        </View>

        {/* ЗАПИСЬ */}
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

        {/* СПИСОК ЗАПИСЕЙ */}
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>📋 Записи ({recordings.length})</Text>
          {recordings.length === 0 ? (
            <Text style={styles.emptyText}>Нет записей</Text>
          ) : (
            recordings.slice(0, 20).map((item) => (
              <View key={item.id} style={styles.recordingItem}>
                <Text style={styles.recordingName}>{item.message || 'Запись'}</Text>
                <Text style={styles.recordingDate}>{new Date(item.timestamp).toLocaleString()}</Text>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, paddingTop: 50, backgroundColor: '#072146', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#90CAF9', marginTop: 4 },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  statusText: { fontSize: 14, fontWeight: 'bold' },
  button: { padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 4 },
  blueButton: { backgroundColor: '#2196F3', marginHorizontal: 20 },
  connectButton: { backgroundColor: '#4CAF50', paddingHorizontal: 20 },
  cancelButton: { backgroundColor: '#9E9E9E', flex: 1, marginRight: 8 },
  recordButton: { backgroundColor: '#f44336', marginHorizontal: 20 },
  stopButton: { backgroundColor: '#9E9E9E', marginHorizontal: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  ipContainer: { flexDirection: 'row', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', alignItems: 'center' },
  ipInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginRight: 10, backgroundColor: '#fff' },
  videoContainer: { margin: 20, height: 200, backgroundColor: '#1a1a1a', borderRadius: 12, overflow: 'hidden' },
  video: { flex: 1 },
  videoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  videoPlaceholderText: { color: '#888', fontSize: 18 },
  recordingOverlay: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  recordingText: { color: '#ff0000', fontSize: 16, fontWeight: 'bold' },
  controls: { backgroundColor: '#fff', padding: 15, marginHorizontal: 20, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginBottom: 10 },
  controlsTitle: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#333' },
  ptzRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  ptzButton: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', margin: 4 },
  ptzUp: { backgroundColor: '#4CAF50' },
  ptzDown: { backgroundColor: '#f44336' },
  ptzLeft: { backgroundColor: '#2196F3' },
  ptzRight: { backgroundColor: '#FF9800' },
  ptzCenter: { backgroundColor: '#9E9E9E' },
  ptzButtonText: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: 15, backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  settingsLabel: { fontSize: 14, fontWeight: 'bold', marginHorizontal: 5 },
  recordControls: { paddingVertical: 10 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 30 },
  listTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  emptyText: { color: '#999', textAlign: 'center', marginTop: 10 },
  recordingItem: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  recordingName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  recordingDate: { fontSize: 12, color: '#666', marginTop: 4 },
  deviceList: { marginHorizontal: 20, marginVertical: 10, padding: 15, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  deviceTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  deviceItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  deviceText: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  deviceSubText: { fontSize: 12, color: '#999' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 24, borderRadius: 16, width: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', marginTop: 8 },
});
