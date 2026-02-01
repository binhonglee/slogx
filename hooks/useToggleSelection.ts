import { useState } from 'preact/hooks';

export const useToggleSelection = <T extends { id: string }>() => {
  const [selected, setSelected] = useState<T | null>(null);

  const toggle = (item: T) => {
    setSelected(prev => (prev?.id === item.id ? null : item));
  };

  return { selected, setSelected, toggle };
};
