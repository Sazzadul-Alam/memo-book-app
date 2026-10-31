import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { colors, fontSizes, spacing } from '../../src/theme/tokens';
import { clearSession } from '../../src/utils/session';

export default function AdminProfileScreen() {
  async function handleLogout() {
    await clearSession();
    router.replace('/(auth)/login');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Profile" />
      <View style={styles.center}>
        <Text style={styles.placeholder}>👤 Admin Profile coming in Step 5</Text>
        <Button onPress={handleLogout} variant="outline" style={{ marginTop: spacing[6] }}>
          Logout
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dsBackground },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[5] },
  placeholder: { fontFamily: 'Manrope-SemiBold', fontSize: fontSizes.lg, color: colors.dsOnSurface },
});

