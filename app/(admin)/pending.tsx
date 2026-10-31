import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../src/components/Header';
import { colors, fontSizes } from '../../src/theme/tokens';

export default function AdminPendingScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Pending Subscriptions" />
      <View style={styles.center}>
        <Text style={styles.placeholder}>⏳ Pending coming in Step 5</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dsBackground },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontFamily: 'Manrope-SemiBold', fontSize: fontSizes.lg, color: colors.dsOnSurface },
});

