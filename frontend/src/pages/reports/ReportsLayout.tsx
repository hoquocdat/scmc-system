import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { REPORT_DEFINITIONS, REPORT_GROUPS, reportPath } from '@/components/reports/report-registry';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { ReportPage } from './ReportPage';
import { ReportsOverviewPage } from './ReportsOverviewPage';

/**
 * Reports area under /reports/*: a report list on the left (a Select on
 * small screens) and the selected report on the right.
 */
export function ReportsLayout() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const groups = REPORT_GROUPS.filter((g) => !user?.role || g.roles.includes(user.role));

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="lg:w-60 lg:shrink-0">
        <div className="lg:hidden">
          <Select value={location.pathname} onValueChange={(v) => navigate(v)}>
            <SelectTrigger aria-label="Chọn báo cáo"><SelectValue placeholder="Chọn báo cáo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="/reports">Tổng quan</SelectItem>
              {groups.map((g) => (
                <SelectGroup key={g.id}>
                  {REPORT_DEFINITIONS.filter((d) => d.group === g.id).map((d) => (
                    <SelectItem key={d.key} value={reportPath(d)}>{g.label} · {d.title}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="hidden lg:block lg:h-[calc(100vh-8rem)]">
          <nav className="space-y-4 pr-3">
            <NavLink to="/reports" end className={({ isActive }) => linkClass(isActive)}>Tổng quan</NavLink>
            {groups.map((g) => (
              <div key={g.id}>
                <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
                <div className="space-y-0.5">
                  {REPORT_DEFINITIONS.filter((d) => d.group === g.id).map((d) => (
                    <NavLink key={d.key} to={reportPath(d)} className={({ isActive }) => linkClass(isActive)}>
                      {d.title}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      <div className="min-w-0 flex-1">
        <Routes>
          <Route index element={<ReportsOverviewPage />} />
          <Route path=":group/:slug" element={<ReportPage />} />
          <Route path="*" element={<ReportsOverviewPage />} />
        </Routes>
      </div>
    </div>
  );
}

const linkClass = (active: boolean) =>
  cn(
    'block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
    active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground',
  );
