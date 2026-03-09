import { useWindowDimensions } from 'react-native';

const GAP = 1;

function colsForWidth(width: number): number {
  if (width < 500) return 2;   // телефоны
  if (width < 750) return 3;   // большие телефоны / мини-планшеты
  if (width < 1100) return 4;  // планшеты / десктоп
  if (width < 1600) return 5;  // широкий десктоп
  return 6;
}

export function usePhotoGrid() {
  const { width } = useWindowDimensions();
  const cols = colsForWidth(width);
  // No Math.floor — RN handles sub-pixel values; floor causes 1-2px gap at row end
  const cellSize = (width - GAP * (cols - 1)) / cols;
  return { cols, cellSize, gap: GAP };
}
