import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, fontSizes, spacing, shadows } from '../theme/tokens';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  transparent?: boolean;
}

export function Header({ title, showBack = false, right, transparent = false }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const appName = process.env.EXPO_PUBLIC_APP_NAME ?? 'Memo Book';

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 8 },
        !transparent && styles.solid,
        !transparent && shadows.sm,
      ]}
    >
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={transparent ? colors.dsOnSurface : colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}

        <Text style={[styles.title, transparent && styles.titleDark]}>
          {title ?? appName}
        </Text>

        <View style={styles.iconBtn}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing[3],
    paddingHorizontal: spacing[4],
  },
  solid: { backgroundColor: colors.dsPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: { width: 38, alignItems: 'center' },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.lg,
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  titleDark: { color: colors.dsOnSurface },
});

