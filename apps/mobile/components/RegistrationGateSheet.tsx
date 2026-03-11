import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

type RegistrationGateSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function RegistrationGateSheet({ visible, onClose }: RegistrationGateSheetProps) {
  const translateY = useRef(new Animated.Value(400)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 400, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, overlayOpacity]);

  if (!visible) return null;

  const handleSignUp = () => {
    onClose();
    router.push('/(auth)/sign-up');
  };

  const handleSignIn = () => {
    onClose();
    router.push('/(auth)/sign-in');
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dark overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: overlayOpacity, backgroundColor: 'rgba(0,0,0,0.75)' }]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <View style={styles.sheetContainer} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Text style={styles.closeBtnText}>×</Text>
          </Pressable>

          <Text style={styles.title}>Добавляй без ограничений</Text>
          <Text style={styles.body}>
            Как гость можно держать только 1 вещь в корзине.{'\n'}
            Зарегистрируйся — и бери сколько хочешь, бесплатно.
          </Text>

          <Pressable style={styles.primaryBtn} onPress={handleSignUp}>
            <Text style={styles.primaryBtnText}>Создать аккаунт</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={handleSignIn}>
            <Text style={styles.secondaryBtnText}>Уже есть аккаунт</Text>
          </Pressable>

          <Pressable style={styles.dismissBtn} onPress={onClose}>
            <Text style={styles.dismissBtnText}>пока нет, спасибо</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 48,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 24,
    color: '#9ca3af',
    lineHeight: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  secondaryBtnText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 15,
  },
  dismissBtn: {
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
