import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, radii, shadows, spacing } from '../theme/tokens';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

const toastConfig: Record<ToastType, { bg: string; icon: string; iconColor: string }> = {
  success: { bg: '#16a34a', icon: 'checkmark-circle', iconColor: '#fff' },
  error: { bg: colors.dsError, icon: 'alert-circle', iconColor: '#fff' },
  info: { bg: colors.dsPrimary, icon: 'information-circle', iconColor: '#fff' },
  warning: { bg: '#d97706', icon: 'warning', iconColor: '#fff' },
};

export function Toast({ message, type = 'info', visible, onHide, duration = 3000 }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(onHide);
    }
  }, [visible]);

  if (!visible) return null;

  const { bg, icon, iconColor } = toastConfig[type];

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }, shadows.lg]}>
      <Ionicons name={icon as any} size={20} color={iconColor} />
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={onHide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color={iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radii.md,
    padding: spacing[3],
    zIndex: 9999,
  },
  message: {
    flex: 1,
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.white,
  },
});

// ── useToast hook ─────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false,
  });

  const show = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
  }, []);

  const hide = useCallback(() => {
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  return { toast, show, hide };
}

