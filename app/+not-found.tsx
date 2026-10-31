import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { colors, fontSizes, spacing } from '../src/theme/tokens';
import { Button } from '../src/components/Button';

export default function NotFoundScreen() {
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Route Not Found</Text>
      <Text style={styles.subtitle}>Attempted route: {pathname}</Text>
      <Button onPress={() => router.replace('/(auth)/login')} style={{ marginTop: spacing[4] }}>
        Go to Login
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
    backgroundColor: colors.dsBackground,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes['2xl'],
    color: colors.dsOnBackground,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.sm,
    color: colors.dsOutline,
    textAlign: 'center',
  },
});
