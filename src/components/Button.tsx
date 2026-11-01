import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fontSizes } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress: () => void;
  children?: React.ReactNode;
  title?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  onPress,
  children,
  title,
  leftIcon,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const iconColor =
    variant === 'outline' || variant === 'ghost' ? colors.dsPrimary : colors.white;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.dsPrimary : colors.white}
          size="small"
        />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? (
            <Ionicons
              name={leftIcon}
              size={size === 'sm' ? 16 : 18}
              color={iconColor}
              style={{ marginRight: 6 }}
            />
          ) : null}
          <Text style={[styles.text, styles[`${variant}Text`], styles[`${size}Text`], textStyle]}>
            {title !== undefined ? title : children}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.55 },

  // Variants
  primary: { backgroundColor: colors.dsPrimary },
  secondary: { backgroundColor: colors.dsSecondaryContainer },
  outline: {
    backgroundColor: colors.transparent,
    borderWidth: 1.5,
    borderColor: colors.dsPrimary,
  },
  ghost: { backgroundColor: colors.transparent },
  destructive: { backgroundColor: colors.destructive },

  // Sizes
  sm: { paddingVertical: 8, paddingHorizontal: 14 },
  md: { paddingVertical: 12, paddingHorizontal: 20 },
  lg: { paddingVertical: 15, paddingHorizontal: 28 },

  // Text base
  text: { fontFamily: 'Inter-Medium' },

  // Variant text colors
  primaryText: { color: colors.white },
  secondaryText: { color: colors.dsOnSecondaryContainer },
  outlineText: { color: colors.dsPrimary },
  ghostText: { color: colors.dsPrimary },
  destructiveText: { color: colors.white },

  // Size text
  smText: { fontSize: fontSizes.sm },
  mdText: { fontSize: fontSizes.base },
  lgText: { fontSize: fontSizes.md },
});

