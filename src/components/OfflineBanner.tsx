import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme/tokens';
import { useNetwork } from '../utils/useNetwork';

interface OfflineBannerProps {
  lastUpdated?: string;
}

export function OfflineBanner({ lastUpdated }: OfflineBannerProps) {
  const { isOnline } = useNetwork();

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline" size={16} color={colors.white} />
      <Text style={styles.text} numberOfLines={1}>
        Offline — showing saved data{lastUpdated ? ` (${lastUpdated})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#b45309', // amber/warning dark
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing[3],
    gap: 6,
  },
  text: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.white,
  },
});

