import { Link, Route, Switch, useLocation } from "wouter";
import { AlertsPage } from "./pages/Alerts";
import { CardDetailPage } from "./pages/CardDetail";
import { LeaderboardPage } from "./pages/Leaderboard";
import { UniversePage } from "./pages/Universe";

function NavLink({ href, label }: { href: string; label: string }) {
  const [location] = useLocation();
  const active = href === "/" ? location === "/" : location.startsWith(href);
  return (
    <Link href={href} className={`nav-link${active ? " active" : ""}`}>
      {label}
    </Link>
  );
}

export function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="wordmark">
          GRAIL<span>WATCH</span>
        </div>
        <div className="tagline">accumulation detector</div>
        <nav>
          <NavLink href="/" label="Leaderboard" />
          <NavLink href="/alerts" label="Alert Feed" />
          <NavLink href="/universe" label="Universe" />
        </nav>
        <div className="sidebar-footer">
          <div>signals: VEL · DRN · CMP · POP · DIV</div>
          <div>nightly scoring · quiet buys first</div>
        </div>
      </aside>
      <main className="content">
        <Switch>
          <Route path="/" component={LeaderboardPage} />
          <Route path="/cards/:id" component={CardDetailPage} />
          <Route path="/alerts" component={AlertsPage} />
          <Route path="/universe" component={UniversePage} />
          <Route>
            <div className="panel">Not found.</div>
          </Route>
        </Switch>
      </main>
    </div>
  );
}
