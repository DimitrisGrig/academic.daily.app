import { useAuth, useUser } from "@clerk/clerk-react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Drawer, Button } from "antd";
import { useState, useEffect } from "react";
import { MenuOutlined } from "@ant-design/icons";
import TopNavigation from "./TopNavigation";
import Sidebar from "./sidebar/Sidebar";
import Loading from "./misc/Loading";
import WhatsNewModal from "./misc/WhatsNewModal";
import MaintenancePage from "./MaintenancePage";
import { isBlockedUser } from "../lib/blockedUsers";

const PrivateRoute = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { Header, Sider, Content } = Layout;

  // Check if current route is Settings
  const isSettingsPage = location.pathname === "/Settings";

  // After Clerk redirects back to the app, check if we need to go somewhere specific
  useEffect(() => {
    if (isSignedIn) {
      const savedRedirect = sessionStorage.getItem("redirectAfterLogin");
      if (savedRedirect) {
        sessionStorage.removeItem("redirectAfterLogin");
        navigate(savedRedirect, { replace: true });
      }
    }
  }, [isSignedIn, navigate]);

  // Detect mobile viewport
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Show loading state while Clerk is initializing
  if (!isLoaded) {
    return <Loading />;
  }

  // Redirect to login if not signed in, preserving the intended destination
  if (!isSignedIn) {
    const destination = location.pathname + location.search;
    if (destination && destination !== "/login") {
      sessionStorage.setItem("redirectAfterLogin", destination);
    }
    return <Navigate to="/login" replace />;
  }

  // Show maintenance page for blocked users — no content, no API calls
  if (isBlockedUser(user?.id)) {
    return <MaintenancePage />;
  }

  // Render child routes if authenticated
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* What's New modal – shows once per new announcement */}
      <WhatsNewModal />

      {/* Header - Full Width */}
      <Header className="bg-white px-0 flex items-center w-full" style={{ padding: 0 }}>
        {/* Hamburger Menu Button (Mobile Only) */}
        {isMobile && !isSettingsPage && (
          <Button type="text" icon={<MenuOutlined className="text-xl!" />} onClick={() => setDrawerOpen(true)} className="ml-4 mr-2" />
        )}
        <TopNavigation />
      </Header>

      {/* Main Layout with Sidebar and Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar - Hidden on mobile and Settings page */}
        {!isMobile && !isSettingsPage && (
          <Sider
            width={300}
            collapsible
            collapsed={collapsed}
            onCollapse={value => setCollapsed(value)}
            className="bg-white overflow-auto"
            trigger={null}
          >
            <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
          </Sider>
        )}

        {/* Mobile Drawer - Only on mobile */}
        {isMobile && !isSettingsPage && (
          <Drawer
            placement="left"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            width={300}
            styles={{ body: { padding: 0 } }}
            closeIcon={null}
          >
            <Sidebar collapsed={false} onToggleCollapse={() => setDrawerOpen(false)} />
          </Drawer>
        )}

        {/* Content - Full width on mobile */}
        <Content className="flex-1 p-2 sm:p-4 md:p-6 bg-gray-100 overflow-auto">
          <Outlet />
        </Content>
      </div>
    </div>
  );
};

export default PrivateRoute;
