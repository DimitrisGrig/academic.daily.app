import { SignedIn, UserButton } from "@clerk/clerk-react";
import { BellOutlined, SearchOutlined } from "@ant-design/icons";
import { Badge, Button, Input } from "antd";
import { SlSettings } from "react-icons/sl";
import { useNavigate } from "react-router-dom";
import logo from "../../public/logo.jpg";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import { useState, useEffect } from "react";
import GlobalSearchModal from "./misc/GlobalSearchModal";

function TopNavigation() {
  const navigate = useNavigate();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSmallMobile, setIsSmallMobile] = useState(window.innerWidth < 400);

  // Detect if user is on Mac
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  // Handle resize for small mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsSmallMobile(window.innerWidth < 400);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+K (Windows/Linux) or Cmd+K (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault(); // Prevent default browser behavior
        setIsSearchModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Fetch unread notification count
  const { data: unreadData } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: async () => {
      const response = await axiosInstance.get("/notifications/unread-count");
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = unreadData?.unread_count || 0;

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50 w-full">
      <div className="w-full px-1 sm:px-2">
        <div className="flex items-center justify-between gap-0.5 sm:gap-1 h-12 sm:h-14">
          {/* Left Side: Logo and Search */}
          <div className="flex items-center gap-0.5 sm:gap-2 md:gap-4 flex-1 min-w-0">
            {/* Logo */}
            <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => navigate("/MainFeed?loc=MainFeed")}>
              <div className={`flex items-center justify-center rounded-xl overflow-hidden ${isSmallMobile ? "w-34 h-10 ml-0.5" : "w-40 h-12"}`}>
                <img src={logo} alt="Daily Academic Logo" className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Search Bar - Desktop Only */}
            <div className="hidden md:flex flex-1 max-w-lg">
              <Input
                placeholder="Search articles, papers, topics..."
                prefix={<SearchOutlined className="text-gray-500!" />}
                suffix={
                  <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-200 border border-gray-300 rounded">
                    <span className="">{isMac ? "⌘ + K" : "Ctrl + K"}</span>
                  </kbd>
                }
                className="w-full rounded-xl! h-10 bg-gray-100! border-gray-300! hover:border-gray-400!"
                readOnly
                onClick={() => setIsSearchModalOpen(true)}
              />
            </div>
          </div>

          {/* Search Button - Mobile Only (center position) */}
          <div className="md:hidden bg-gray-200 rounded-lg sm:rounded-xl">
            <Button
              type="text"
              icon={<SearchOutlined className={`text-gray-700! ${isSmallMobile ? "text-lg! mt-1" : "text-xl!"}`} />}
              className={`flex items-center justify-center rounded-lg! sm:rounded-xl! hover:bg-gray-300! ${isSmallMobile ? "w-9! h-9!" : "w-10! h-10!"}`}
              onClick={() => setIsSearchModalOpen(true)}
            />
          </div>

          {/* Right Side Actions */}
          <SignedIn>
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              {/* Notifications */}
              <div className="bg-gray-200 rounded-lg sm:rounded-xl">
                <Badge count={unreadCount} size="small" offset={isSmallMobile ? [-1, 1] : [-2, 2]}>
                  <Button
                    type="text"
                    icon={<BellOutlined className={`text-gray-700! hover:text-gray-600! ${isSmallMobile ? "text-lg! mt-0.5" : "text-xl!"}`} />}
                    className={`flex items-center justify-center rounded-lg! sm:rounded-xl! hover:bg-gray-300! ${isSmallMobile ? "w-9! h-9!" : "w-10! h-10!"}`}
                    onClick={() => navigate(`/Notifications`)}
                  />
                </Badge>
              </div>
              {/* END -> Notifications */}

              {/* Settings */}
              <div className="bg-gray-200 rounded-lg sm:rounded-xl">
                <Button
                  type="text"
                  icon={<SlSettings className={`text-gray-700! ${isSmallMobile ? "text-lg!  mt-1" : "text-2xl!"}`} />}
                  className={`flex items-center justify-center rounded-lg! sm:rounded-xl! hover:bg-gray-300! ${isSmallMobile ? "w-9! h-9!" : "w-10! h-10!"}`}
                  onClick={() => navigate(`/Settings`)}
                />
              </div>
              {/* END -> Settings */}

              {/* User Button */}
              <div className={isSmallMobile ? "mt-1 mr-0.5" : "mt-2"}>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: isSmallMobile ? "w-9! h-9! rounded-lg!" : "w-9! h-9! rounded-xl!",
                      userButtonPopoverCard: "shadow-lg",
                    },
                  }}
                />
              </div>
            </div>
            {/* END -> User Button */}
          </SignedIn>
        </div>
      </div>

      {/* Global Search Modal */}
      <GlobalSearchModal open={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
    </div>
  );
}

export default TopNavigation;
