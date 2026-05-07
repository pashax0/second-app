import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

type SnackbarOptions = {
  duration?: number;
};

type SnackbarContextValue = {
  show: (message: string, options?: SnackbarOptions) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

// Module-level handle so non-React code (e.g. TanStack Query cache callbacks)
// can show snackbars. SnackbarProvider registers its show fn on mount.
let activeShow: SnackbarContextValue['show'] | null = null;

export const toast = {
  show(message: string, options?: SnackbarOptions) {
    if (activeShow) activeShow(message, options);
    else if (__DEV__) console.warn('[snackbar] no active provider, dropped:', message);
  },
};

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used inside SnackbarProvider');
  return ctx;
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [opacity, translateY]);

  const show = useCallback(
    (msg: string, options?: SnackbarOptions) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);

      setMessage(msg);
      setVisible(true);
      opacity.setValue(0);
      translateY.setValue(20);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      hideTimer.current = setTimeout(hide, options?.duration ?? 3500);
    },
    [opacity, translateY, hide]
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    activeShow = show;
    return () => {
      if (activeShow === show) activeShow = null;
    };
  }, [show]);

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      {visible && (
        <Animated.View
          style={[styles.container, { opacity, transform: [{ translateY }] }]}
          pointerEvents="none"
        >
          <Text className="text-white text-sm text-center">{message}</Text>
        </Animated.View>
      )}
    </SnackbarContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    // Shadow (iOS) / elevation (Android)
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
