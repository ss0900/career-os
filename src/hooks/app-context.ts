import { createContext, useContext } from 'react';
import type { repository } from '../data/repository';

export type AppData = Awaited<ReturnType<typeof repository.readAll>>;
export const DataContext = createContext<AppData | null>(null);
export const NoticeContext = createContext<(message: string) => void>(() => undefined);
export function useAppData() {
  const data = useContext(DataContext);
  if (!data) throw new Error('데이터를 불러오지 못했습니다.');
  return data;
}
export function useNotice() {
  return useContext(NoticeContext);
}
