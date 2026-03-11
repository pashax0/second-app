import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';

type SnackbarOptions = {
  duration?: number;
};

type SnackbarContextValue = {
  show: (message: string, options?: SnackbarOptions) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

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

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      {visible && (
        <Animated.View
          style={{ opacity, transform: [{ translateY }] }}
          className="absolute bottom-8 left-4 right-4 bg-gray-900 rounded-xl px-4 py-3 shadow-lg"
          pointerEvents="none"
        >
          <Text className="text-white text-sm text-center">{message}</Text>
        </Animated.View>
      )}
    </SnackbarContext.Provider>
  );
}
