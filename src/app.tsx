import { lazy, Suspense, useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronRight,
  FolderKanban,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Settings2,
  Sprout,
  Search,
  KanbanSquare,
} from 'lucide-react';
import {
  createHashRouter,
  RouterProvider,
  Outlet,
  Link,
  NavLink,
  useLocation,
} from 'react-router-dom';
import { DataProvider, ErrorBoundary, NoticeProvider } from './components/providers';
import { Button } from './components/ui/button';
const Dashboard = lazy(() =>
  import('./pages/dashboard').then((module) => ({ default: module.Dashboard })),
);
const CareerPage = lazy(() =>
  import('./pages/career').then((module) => ({ default: module.CareerPage })),
);
const ProjectsPage = lazy(() =>
  import('./pages/projects').then((module) => ({ default: module.ProjectsPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/settings').then((module) => ({ default: module.SettingsPage })),
);
const ResumesPage = lazy(() =>
  import('./pages/resumes').then((module) => ({ default: module.ResumesPage })),
);
const ResumeEditorPage = lazy(() =>
  import('./pages/resume-editor').then((module) => ({ default: module.ResumeEditorPage })),
);
const JobsPage = lazy(() => import('./pages/jobs').then((m) => ({ default: m.JobsPage })));
const JobDetailPage = lazy(() =>
  import('./pages/job-detail').then((m) => ({ default: m.JobDetailPage })),
);
const ApplicationsPage = lazy(() =>
  import('./pages/applications').then((m) => ({ default: m.ApplicationsPage })),
);
const ApplicationDetailPage = lazy(() =>
  import('./pages/application-detail').then((m) => ({ default: m.ApplicationDetailPage })),
);
const SubmissionPage = lazy(() =>
  import('./pages/submission').then((m) => ({ default: m.SubmissionPage })),
);

const navigation = [
  { to: '/', label: '대시보드', icon: LayoutDashboard },
  { to: '/career', label: '내 경력', icon: BriefcaseBusiness },
  { to: '/projects', label: '프로젝트', icon: FolderKanban },
  { to: '/resumes', label: '이력서 작성', icon: FileText },
  { to: '/jobs', label: '채용공고', icon: Search },
  { to: '/applications', label: '지원 현황', icon: KanbanSquare },
  { to: '/settings', label: '설정 및 백업', icon: Settings2 },
];

function Layout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const pageTitle =
    navigation.find(
      (item) =>
        item.to === location.pathname ||
        (item.to !== '/' && location.pathname.startsWith(item.to + '/')),
    )?.label ?? '페이지 없음';
  useEffect(() => {
    document.title = `${pageTitle} · Career OS`;
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname, pageTitle]);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        본문으로 이동
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="Career OS 홈">
          <span className="brand-mark">
            <Sprout size={24} />
          </span>
          <span>
            Career<span className="brand-os">OS</span>
            <small>나의 다음 챕터</small>
          </span>
        </Link>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav aria-label="주요 메뉴">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              end={to === '/'}
              key={to}
              to={to}
              aria-label={label}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span className="nav-label">{label}</span>
              <span className="nav-short" aria-hidden="true">
                {label.replace(' 작성', '').replace(' 및 백업', '')}
              </span>
              {to === '/' && <span className="nav-active-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="eyebrow">ONE STEP AT A TIME</span>
            <p>
              오늘의 경험이
              <br />
              내일의 가능성으로.
            </p>
            <Link to="/projects?new=1">
              경험 기록하기
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="local-label">
            <span className="status-dot" />
            로컬 워크스페이스<span>v0.3</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>내 워크스페이스</span>
            <ChevronRight size={13} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-pill">
              <LockKeyhole size={13} />
              나만의 공간
            </span>
            <span className="today">
              {new Intl.DateTimeFormat('ko-KR', {
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              }).format(new Date())}
            </span>
          </div>
        </header>
        <main ref={mainRef} id="main-content" tabIndex={-1} className="main-content">
          <DataProvider>
            <Suspense
              fallback={
                <div className="loading-state" role="status">
                  화면을 불러오는 중입니다.
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </DataProvider>
        </main>
      </div>
    </div>
  );
}

// Data router retains the same hash URLs and enables safe navigation blocking
// while a draft is waiting for its IndexedDB write.
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'career', element: <CareerPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'resumes', element: <ResumesPage /> },
      { path: 'resumes/:id', element: <ResumeEditorPage /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'jobs/:id', element: <JobDetailPage /> },
      { path: 'applications', element: <ApplicationsPage /> },
      { path: 'applications/:id', element: <ApplicationDetailPage /> },
      { path: 'applications/:id/submissions/:submissionId', element: <SubmissionPage /> },
      { path: 'settings', element: <SettingsPage /> },
      {
        path: '*',
        element: (
          <div className="panel error-state">
            <h1>페이지를 찾을 수 없어요</h1>
            <p>주소를 확인하거나 대시보드로 돌아가 주세요.</p>
            <Button asChild>
              <Link to="/">대시보드로 이동</Link>
            </Button>
          </div>
        ),
      },
    ],
  },
]);

export default function App() {
  return (
    <ErrorBoundary>
      <NoticeProvider>
        <RouterProvider router={router} />
      </NoticeProvider>
    </ErrorBoundary>
  );
}
