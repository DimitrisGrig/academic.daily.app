import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import LoginPage from "./LoginPage";
import MainFeed from "./pages/MainFeed";
import PrivateRoute from "./components/PrivateRoute";
import OnBoarding from "./pages/OnBoarding";
import Explore from "./pages/Explore";
import History from "./pages/History";
import Bookmarks from "./pages/Bookmarks";
import CustomFeeds from "./pages/CustomFeeds";
import JournalFollows from "./pages/JournalFollows";
import Tags from "./pages/Tags";
import Settings from "./pages/Settings";
import SourceJournals from "./pages/SourceJournals";
import JournalArticles from "./pages/JournalArticles";
import Notifications from "./pages/Notifications";
import Metrics from "./pages/Metrics";
import SearchResults from "./pages/SearchResults";
import Article from "./pages/Article";
import Documentation from "./pages/Documentation";
import Unsubscribe from "./pages/Unsubscribe";
import Admin from "./pages/Admin";
import BioArchive from "./pages/BioArchive";
import BioArchivePage from "./pages/BioArchivePage";
import Groups from "./pages/Groups";
import FindGroups from "./pages/FindGroups";
import ZoteroCallback from "./pages/ZoteroCallback";
import { logPageView } from "./lib/analytics";

function Analytics() {
  const location = useLocation();

  useEffect(() => {
    logPageView(location.pathname + location.search);
  }, [location]);

  return null;
}

function App() {
  return (
    <>
      <Router>
        <Analytics />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />

          {/* Protected Routes - User must be logged in */}
          <Route element={<PrivateRoute />}>
            <Route path="/MainFeed" element={<MainFeed />} />
            <Route path="/BioArchive" element={<BioArchive />} />
            <Route path="/BioArchiveArticle" element={<BioArchivePage />} />
            <Route path="/Article" element={<Article />} />
            <Route path="/Explore" element={<Explore />} />
            <Route path="/History" element={<History />} />
            <Route path="/CustomFeeds" element={<CustomFeeds />} />
            <Route path="/JournalFollows" element={<JournalFollows />} />
            <Route path="/Bookmarks" element={<Bookmarks />} />
            <Route path="/Tags" element={<Tags />} />
            <Route path="/SourceJournals" element={<SourceJournals />} />
            <Route path="/JournalArticles" element={<JournalArticles />} />
            <Route path="/Metrics" element={<Metrics />} />
            <Route path="/OnBoarding" element={<OnBoarding />} />
            <Route path="/Notifications" element={<Notifications />} />
            <Route path="/Settings" element={<Settings />} />
            <Route path="/Search" element={<SearchResults />} />
            <Route path="/Documentation" element={<Documentation />} />
            <Route path="/Admin" element={<Admin />} />
            <Route path="/Groups" element={<Groups />} />
            <Route path="/FindGroups" element={<FindGroups />} />
            <Route path="/ZoteroCallback" element={<ZoteroCallback />} />
          </Route>

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/MainFeed?loc=MainFeed" replace />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
