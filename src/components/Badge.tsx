import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../theme/tokens';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'demo';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const badgeColors: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: colors.dsSecondaryContainer, text: colors.dsPrimary },
  success: { bg: '#dcfce7', text: '#15803d' },
  warning: { bg: '#fef9c3', text: '#b45309' },
  error: { bg: colors.dsErrorContainer, text: colors.dsOnErrorContainer },
  info: { bg: '#dbeafe', text: '#1d4ed8' },
  neutral: { bg: colors.dsSurfaceContainer, text: colors.dsOnSurfaceVariant },
  demo: { bg: '#f3e8ff', text: '#7c3aed' },
};

export function Badge({ children, variant = 'neutral', style }: BadgeProps) {
  const { bg, text } = badgeColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
  },
});

