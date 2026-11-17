import { db, type CareerDatabase } from './db';
import {
  portfolioSchema,
  portfolioContentSchema,
  imageSchema,
  type PortfolioContent,
} from './portfolio-schema';
import { recordMeta } from './interview';
import { assertRevision } from './interview-repository';
import { createPortfolio, publicData, publicationWarnings, imageExtension } from './portfolio';
import { zipFiles } from '../lib/files';

export async function cleanImage(file: File): Promise<Blob> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 3 * 1024 * 1024 ||
    !file.size
  )
    throw new Error('PNG·JPEG·WebP 이미지(3MB 이하)를 선택해 주세요.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('손상되었거나 지원하지 않는 이미지입니다.');
  }
  try {
    if (bitmap.width * bitmap.height > 16000000)
      throw new Error('이미지는 1,600만 픽셀 이하여야 합니다.');
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('이미지 변환에 실패했습니다.'))),
        file.type,
        0.9,
      ),
    );
    if (blob.size > 3 * 1024 * 1024)
      throw new Error('변환 후 이미지가 3MB를 초과합니다. 크기를 줄여 주세요.');
    return blob; // Re-encoding removes original EXIF/embedded metadata.
  } finally {
    bitmap.close();
  }
}
export function createPortfolioRepository(database: CareerDatabase) {
  return {
    async create(resumeId = '') {
      return database.transaction(
        'rw',
        [
          database.portfolios,
          database.profiles,
          database.projects,
          database.careers,
          database.resumes,
        ],
        async () => {
          const resume = resumeId ? await database.resumes.get(resumeId) : undefined;
          if (resumeId && !resume) throw new Error('이력서가 없습니다.');
          const content = createPortfolio(
            await database.profiles.get('profile'),
            await database.careers.toArray(),
            await database.projects.toArray(),
            resume?.content,
          );
          const portfolio = portfolioSchema.parse({
            ...recordMeta(),
            revision: 1,
            content,
            publications: [],
          });
          await database.portfolios.add(portfolio);
          return portfolio;
        },
      );
    },
    async save(id: string, content: PortfolioContent, revision: number) {
      const parsed = portfolioContentSchema.parse(content);
      return database.transaction('rw', database.portfolios, async () => {
        const previous = await database.portfolios.get(id);
        assertRevision(previous, revision);
        const next = portfolioSchema.parse({
          ...previous,
          content: parsed,
          revision: revision + 1,
          updatedAt: new Date().toISOString(),
        });
        await database.portfolios.put(next);
        return next;
      });
    },
    async addImage(portfolioId: string, file: File) {
      const blob = await cleanImage(file);
      const item = imageSchema.parse({
        id: crypto.randomUUID(),
        name: file.name.slice(0, 300),
        mime: blob.type,
        bytes: blob.size,
        alt: '',
        caption: '',
        approved: false,
      });
      await database.transaction('rw', database.portfolios, database.portfolioAssets, async () => {
        if (!(await database.portfolios.get(portfolioId)))
          throw new Error('포트폴리오가 삭제되었습니다.');
        const assets = await database.portfolioAssets
          .where('portfolioId')
          .equals(portfolioId)
          .toArray();
        if (assets.reduce((sum, a) => sum + a.blob.size, 0) + blob.size > 30 * 1024 * 1024)
          throw new Error('포트폴리오 이미지 보관 한도는 30MB입니다.');
        await database.portfolioAssets.add({ id: item.id, portfolioId, blob });
      });
      return item;
    },
    async imageArchive(portfolioId: string) {
      const assets = await database.portfolioAssets
        .where('portfolioId')
        .equals(portfolioId)
        .toArray();
      return zipFiles(
        assets.map((a) => ({
          name: `images/${a.id}.${imageExtension(a.blob.type)}`,
          blob: a.blob,
        })),
      );
    },
    async publish(id: string, revision: number, approvedJson: string) {
      // Complete validation and file assembly before recording the explicit approval.
      const portfolio = await database.portfolios.get(id);
      assertRevision(portfolio, revision);
      const warnings = publicationWarnings(portfolio!.content);
      if (warnings.length) throw new Error(warnings.join(' '));
      const data = publicData(portfolio!.content);
      if (JSON.stringify(data) !== approvedJson)
        throw new Error('공개 내용이 변경되었습니다. 전체 내용을 다시 확인해 주세요.');
      const files = [
        {
          name: 'portfolio/portfolio.json',
          blob: new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        },
      ];
      for (const p of data.projects)
        for (const image of p.images) {
          const asset = await database.portfolioAssets.get(image.path.split('/')[1].split('.')[0]);
          if (!asset || asset.portfolioId !== id)
            throw new Error(
              '공개 이미지 파일이 없습니다. 백업 복원 후에는 이미지를 다시 연결해 주세요.',
            );
          files.push({ name: `portfolio/${image.path}`, blob: asset.blob });
        }
      const zip = await zipFiles(files);
      await database.transaction('rw', database.portfolios, async () => {
        const current = await database.portfolios.get(id);
        assertRevision(current, revision);
        await database.portfolios.put(
          portfolioSchema.parse({
            ...current,
            revision: revision + 1,
            updatedAt: new Date().toISOString(),
            publications: [
              ...current!.publications,
              { id: crypto.randomUUID(), createdAt: new Date().toISOString(), revision, data },
            ],
          }),
        );
      });
      return zip;
    },
    async delete(id: string) {
      await database.transaction('rw', database.portfolios, database.portfolioAssets, async () => {
        await database.portfolioAssets.where('portfolioId').equals(id).delete();
        await database.portfolios.delete(id);
      });
    },
  };
}
export const portfolioRepository = createPortfolioRepository(db);
