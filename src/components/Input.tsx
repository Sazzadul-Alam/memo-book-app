import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  containerStyle,
  leftIcon,
  isPassword = false,
  ...rest
}: InputProps) {
  const [show, setShow] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, error ? styles.inputError : styles.inputNormal]}>
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <TextInput
          style={[styles.input, leftIcon ? { paddingLeft: 0 } : null]}
          placeholderTextColor={colors.dsOutline}
          secureTextEntry={isPassword && !show}
          autoCapitalize="none"
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setShow(!show)} style={styles.eye}>
            <Ionicons
              name={show ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={colors.dsOutline}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing[3] },
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurfaceVariant,
    marginBottom: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1.5,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: spacing[3],
  },
  inputNormal: { borderColor: colors.dsOutlineVariant },
  inputError: { borderColor: colors.dsError },
  leftIcon: { marginRight: spacing[2] },
  input: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.base,
    color: colors.dsOnSurface,
    paddingVertical: 12,
  },
  eye: { padding: 4 },
  error: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsError,
    marginTop: 4,
  },
});

