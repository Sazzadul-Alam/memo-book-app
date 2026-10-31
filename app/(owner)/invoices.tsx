import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../src/components/Header';
import { colors, fontSizes, spacing } from '../../src/theme/tokens';

export default function InvoicesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Invoices" />
      <View style={styles.center}>
        <Text style={styles.placeholder}>🧾 Invoices coming in Step 4</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dsBackground },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontFamily: 'Manrope-SemiBold', fontSize: fontSizes.xl, color: colors.dsOnSurface },
});

