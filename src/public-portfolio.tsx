import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/700.css';
import { publicPortfolioSchema, type PublicPortfolio } from './data/public-portfolio-schema';
import { PublicPortfolioView } from './components/portfolio/public-view';

export function PublicPage() {
  const [data, setData] = useState<PublicPortfolio | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${import.meta.env.BASE_URL}portfolio/portfolio.json`, {
      signal: controller.signal,
      credentials: 'omit',
    })
      .then(async (response) => {
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
          throw new Error('아직 게시된 포트폴리오가 없습니다.');
        const text = await response.text();
        if (new TextEncoder().encode(text).length > 20 * 1024 * 1024)
          throw new Error('공개 데이터 크기를 확인해 주세요.');
        let value: unknown;
        try {
          value = JSON.parse(text);
        } catch {
          throw new Error('공개 JSON 파일 형식을 확인해 주세요.');
        }
        const parsed = publicPortfolioSchema.safeParse(value);
        if (!parsed.success) throw new Error('공개 데이터 형식을 확인해 주세요.');
        setData(parsed.data);
        document.title = parsed.data.title;
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : '공개 파일을 불러오지 못했습니다.');
      });
    return () => controller.abort();
  }, []);
  return (
    <main>
      {data ? (
        <PublicPortfolioView data={data} assetBase={`${import.meta.env.BASE_URL}portfolio/`} />
      ) : (
        <div className="public-portfolio pf-hero">
          <h1>개발자 포트폴리오</h1>
          <p role="status">{error || '공개 파일을 불러오는 중입니다.'}</p>
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<PublicPage />);
