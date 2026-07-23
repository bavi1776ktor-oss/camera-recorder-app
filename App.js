import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>📹 Камера Запись</Text>
      <Text style={styles.subtitle}>Приложение для камеры Teruhal Z2</Text>
      <Text style={styles.info}>В разработке...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#072146',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#90CAF9',
  },
  info: {
    marginTop: 20,
    fontSize: 14,
    color: '#888',
  },
});
