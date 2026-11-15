import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function splitTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function dateLabel(value: string | undefined): string {
  return value
    ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(
        new Date(value),
      )
    : '기록 없음';
}

export function period(start: string, end: string, current: boolean): string {
  return `${start.replace('-', '.')} — ${current ? '현재' : end.replace('-', '.')}`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'QuotaExceededError')
    return '브라우저 저장 공간이 부족합니다. 백업 후 저장 공간을 확인해 주세요.';
  if (
    error instanceof Error &&
    ['InvalidStateError', 'SecurityError', 'OpenFailedError', 'UnknownError'].includes(error.name)
  )
    return '브라우저 저장소에 접근할 수 없습니다. 일반 창에서 열거나 브라우저 설정을 확인해 주세요.';
  return error instanceof Error && error.name === 'Error'
    ? error.message
    : '저장소 작업에 실패했습니다. 데이터를 유지한 채 다시 시도해 주세요.';
}
