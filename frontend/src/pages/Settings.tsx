import { useState, useEffect } from "react";
import { Card, Avatar, Button, Switch, Divider, Typography, Drawer, Tag, Spin, List, Empty, Input, message, Select, Popconfirm } from "antd";
import {
  UserOutlined,
  BellOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  LineChartOutlined,
  LikeOutlined,
  CommentOutlined,
  MenuOutlined,
  FireOutlined,
  ArrowLeftOutlined,
  HistoryOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { useUser, UserProfile } from "@clerk/clerk-react";
import axiosInstance from "../lib/axios";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeftLong, FaBug, FaPuzzlePiece } from "react-icons/fa6";
import { IoHomeOutline, IoMailOutline } from "react-icons/io5";
import { SiWine, SiZotero } from "react-icons/si";
import { FaBook } from "react-icons/fa";
import { getZoteroStatus, initZoteroAuth, disconnectZotero } from "../lib/exportToZotero";

const { Title, Text } = Typography;

type SettingsCategory = "profile" | "account" | "notifications" | "reference-managers" | "feed-settings" | "support";

type ProfileSubSection = "reading-overview" | "activity";

function Settings() {
  const { user } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("profile");
  const [profileSubSection, setProfileSubSection] = useState<ProfileSubSection>("reading-overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Initialize from URL params on mount
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const subParam = searchParams.get("sub");

    if (tabParam) {
      const validTabs: SettingsCategory[] = ["profile", "account", "notifications", "reference-managers", "feed-settings", "support"];
      if (validTabs.includes(tabParam as SettingsCategory)) {
        setActiveCategory(tabParam as SettingsCategory);
      }
    }

    if (subParam && tabParam === "profile") {
      const validSubSections: ProfileSubSection[] = ["reading-overview", "activity"];
      if (validSubSections.includes(subParam as ProfileSubSection)) {
        setProfileSubSection(subParam as ProfileSubSection);
      }
    }
  }, [searchParams]);

  // Update URL when category changes
  useEffect(() => {
    const newParams = new URLSearchParams();
    newParams.set("tab", activeCategory);

    if (activeCategory === "profile") {
      newParams.set("sub", profileSubSection);
    }

    setSearchParams(newParams, { replace: true });
  }, [activeCategory, profileSubSection, setSearchParams]);

  // Interest prompt states
  const [interestsPrompt, setInterestsPrompt] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Google Scholar profile states
  const [scholarUrl, setScholarUrl] = useState("");

  // Reading overview year state
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Fetch user's current interest prompt
  const { data: userTagsData } = useQuery({
    queryKey: ["userTags"],
    queryFn: async () => {
      const response = await axiosInstance.get("/settings/user-tags");
      return response.data;
    },
  });

  // Fetch interest prompts history
  const { data: interestHistoryData } = useQuery({
    queryKey: ["interestHistory"],
    queryFn: async () => {
      const response = await axiosInstance.get("/settings/interest-history");
      return response.data;
    },
    enabled: activeCategory === "feed-settings",
  });

  // Initialize prompt from current tags
  useEffect(() => {
    if (userTagsData?.tags?.length > 0) {
      // The tags array now contains a single prompt string
      setInterestsPrompt(userTagsData.tags.join(", "));
    }
  }, [userTagsData?.tags]);

  // Fetch feed preferences (upvote-based recommendations toggle)
  const { data: feedPreferences } = useQuery({
    queryKey: ["feedPreferences"],
    queryFn: async () => {
      const response = await axiosInstance.get("/settings/feed-preferences");
      return response.data;
    },
    enabled: activeCategory === "feed-settings",
  });

  // Mutation to update feed preferences
  const feedPreferencesMutation = useMutation({
    mutationFn: async (payload: { upvote_based_recommendations: boolean }) => {
      const response = await axiosInstance.post("/settings/feed-preferences", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedPreferences"] });
      queryClient.invalidateQueries({ queryKey: ["mainFeed"] });
      message.success("Feed preference updated");
    },
    onError: () => {
      message.error("Failed to update preference");
    },
  });

  // Fetch reading overview data
  const { data: readingOverview, isLoading: isLoadingOverview } = useQuery({
    queryKey: ["readingOverview", selectedYear],
    queryFn: async () => {
      const response = await axiosInstance.get("/settings/reading-overview", {
        params: { year: selectedYear },
      });
      return response.data;
    },
  });

  // Fetch activity data
  const { data: activityData, isLoading: isLoadingActivity } = useQuery({
    queryKey: ["userActivity"],
    queryFn: async () => {
      const response = await axiosInstance.get("/settings/activity");
      return response.data;
    },
  });

  // ── Email digest subscription ──────────────────────────────────────────
  const { data: digestSubData, isLoading: isLoadingDigestSub } = useQuery({
    queryKey: ["digestSubscription"],
    queryFn: async () => {
      const response = await axiosInstance.get("/mail-digests/subscription");
      return response.data as { subscribed: boolean };
    },
  });

  const digestSubMutation = useMutation({
    mutationFn: async (subscribed: boolean) => {
      const response = await axiosInstance.post(`/mail-digests/subscription?subscribed=${subscribed}`);
      return response.data;
    },
    onSuccess: (_data, subscribed) => {
      queryClient.setQueryData(["digestSubscription"], { subscribed });
      message.success(subscribed ? "Weekly digest emails enabled." : "Weekly digest emails disabled.");
    },
    onError: () => {
      message.error("Failed to update digest preference. Please try again.");
    },
  });

  // ── Zotero integration ───────────────────────────────────────────────
  const { data: zoteroStatus, isLoading: isLoadingZotero } = useQuery({
    queryKey: ["zoteroStatus"],
    queryFn: () => getZoteroStatus(),
    enabled: activeCategory === "reference-managers",
  });

  const zoteroConnectMutation = useMutation({
    mutationFn: async () => {
      const authorizeUrl = await initZoteroAuth();
      window.location.href = authorizeUrl;
    },
    onError: () => {
      message.error("Failed to start Zotero authorization. Please try again.");
    },
  });

  const zoteroDisconnectMutation = useMutation({
    mutationFn: () => disconnectZotero(),
    onSuccess: () => {
      queryClient.setQueryData(["zoteroStatus"], false);
      message.success("Zotero disconnected successfully.");
    },
    onError: () => {
      message.error("Failed to disconnect Zotero. Please try again.");
    },
  });

  // ── Google Scholar profile ───────────────────────────────────────────
  const { data: scholarProfileData } = useQuery({
    queryKey: ["scholarProfile"],
    queryFn: async () => {
      const response = await axiosInstance.get("/settings/scholar-profile");
      return response.data as { google_scholar_url: string | null };
    },
    enabled: activeCategory === "account",
  });

  useEffect(() => {
    if (scholarProfileData?.google_scholar_url !== undefined) {
      setScholarUrl(scholarProfileData.google_scholar_url ?? "");
    }
  }, [scholarProfileData]);

  const scholarProfileMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await axiosInstance.post("/settings/scholar-profile", {
        google_scholar_url: url || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scholarProfile"] });
      message.success("Google Scholar profile saved.");
    },
    onError: () => {
      message.error("Failed to save Google Scholar profile. Please check the URL.");
    },
  });

  const menuItems = [
    {
      key: "profile" as SettingsCategory,
      icon: <UserOutlined />,
      label: "Profile",
      hasSubSections: true,
    },
    {
      key: "account" as SettingsCategory,
      icon: <UserOutlined />,
      label: "Account",
      hasSubSections: false,
    },
    {
      key: "feed-settings" as SettingsCategory,
      icon: <SettingOutlined />,
      label: "Main Feed Settings",
      hasSubSections: false,
    },
    {
      key: "notifications" as SettingsCategory,
      icon: <BellOutlined />,
      label: "Notifications",
      hasSubSections: false,
    },
    {
      key: "reference-managers" as SettingsCategory,
      icon: <FaBook />,
      label: "Reference Managers",
      hasSubSections: false,
    },

    {
      key: "support" as SettingsCategory,
      icon: <QuestionCircleOutlined />,
      label: "Support",
      hasSubSections: false,
    },
  ];

  const renderProfileContent = () => {
    if (profileSubSection === "reading-overview") {
      // Generate year options from registration year to current year
      const currentYear = new Date().getFullYear();
      const registrationYear = readingOverview?.registration_year || currentYear;
      const yearOptions = [];
      for (let year = currentYear; year >= registrationYear; year--) {
        yearOptions.push({ label: year.toString(), value: year });
      }

      // Generate heatmap data for the selected year
      const generateHeatmapData = () => {
        const startDate = new Date(selectedYear, 0, 1); // January 1st of selected year
        const endDate = new Date(selectedYear, 11, 31); // Always December 31st - show full year

        const weeks: Array<Array<{ date: Date; count: number }>> = [];
        let currentWeek: Array<{ date: Date; count: number }> = [];

        const currentDate = new Date(startDate);

        // Pad to start on Sunday
        const startDay = currentDate.getDay();
        for (let i = startDay; i > 0; i--) {
          const paddingDate = new Date(currentDate);
          paddingDate.setDate(paddingDate.getDate() - i);
          currentWeek.push({ date: paddingDate, count: 0 });
        }

        // Generate all days for the entire year (like GitHub)
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split("T")[0];
          const count = readingOverview?.daily_activity?.[dateStr] || 0;

          currentWeek.push({
            date: new Date(currentDate),
            count,
          });

          // If Saturday (end of week), start new week
          if (currentDate.getDay() === 6) {
            weeks.push([...currentWeek]);
            currentWeek = [];
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Add remaining days
        if (currentWeek.length > 0) {
          weeks.push(currentWeek);
        }

        return weeks;
      };

      const getIntensityColor = (count: number) => {
        if (count === 0) return "bg-gray-100!";
        if (count <= 2) return "bg-indigo-200!";
        if (count <= 4) return "bg-indigo-400!";
        if (count <= 6) return "bg-indigo-600!";
        return "bg-indigo-700!";
      };

      const heatmapData = generateHeatmapData();

      return (
        <div className="space-y-4 sm:space-y-6">
          <div>
            <Title level={3} className="text-xl! sm:text-2xl!">
              Reading Overview
            </Title>
            <Text type="secondary" className="text-sm! sm:text-base!">
              Track your reading habits and insights
            </Text>
          </div>

          {isLoadingOverview ? (
            <div className="text-center py-12">
              <Spin size="large" />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <Card className="bg-linear-to-br! from-blue-50! to-white!">
                  <div className="flex items-center justify-between">
                    <div>
                      <Text type="secondary" className="text-xs! sm:text-sm!">
                        Total Reads
                      </Text>
                      <Title level={2} className="mb-0! mt-1! text-2xl! sm:text-3xl!">
                        {readingOverview?.total_reads || 0}
                      </Title>
                    </div>
                    <LineChartOutlined className="text-3xl! sm:text-4xl! text-blue-500!" />
                  </div>
                </Card>

                <Card className="bg-linear-to-br! from-purple-50! to-white!">
                  <div className="flex items-center justify-between">
                    <div>
                      <Text type="secondary" className="text-xs! sm:text-sm!">
                        Posts Read in Last Month
                      </Text>
                      <Title level={2} className="mb-0! mt-1! text-2xl! sm:text-3xl!">
                        {readingOverview?.posts_last_month || 0}
                      </Title>
                    </div>
                    <LineChartOutlined className="text-3xl! sm:text-4xl! text-purple-500!" />
                  </div>
                </Card>

                <Card className="bg-linear-to-br! from-green-50! to-white!">
                  <div className="flex items-center justify-between">
                    <div>
                      <Text type="secondary" className="text-xs! sm:text-sm!">
                        Longest reading streak (days)
                      </Text>
                      <Title level={2} className="mb-0! mt-1! text-2xl! sm:text-3xl!">
                        {readingOverview?.total_reading_days || 0}
                      </Title>
                    </div>
                    <LineChartOutlined className="text-3xl! sm:text-4xl! text-green-500!" />
                  </div>
                </Card>
              </div>

              {/* Year Heatmap */}
              <Card
                title={
                  <div className="flex! items-center! justify-between! flex-wrap! gap-2!">
                    <span className="text-base! sm:text-lg!">Reading Activity</span>
                    <Select value={selectedYear} onChange={setSelectedYear} options={yearOptions} className="w-20! rounded-lg! py-1!" size="small" />
                  </div>
                }
                className="mt-4! sm:mt-6!"
              >
                <div className="py-2 sm:py-4 px-1 sm:px-2 overflow-x-auto">
                  {/* Month labels */}
                  <div className="flex mb-2 text-xs text-gray-600 ml-8 sm:ml-12 min-w-max">
                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, idx) => {
                      // Calculate approximate width for each month (52 weeks / 12 months ≈ 4.3 weeks per month)
                      const weeksPerMonth = Math.floor(heatmapData.length / 12);
                      const shouldShow = idx === 0 || idx % 1 === 0;
                      return (
                        <div key={month} style={{ width: `${weeksPerMonth * (window.innerWidth < 640 ? 12 : 16)}px` }} className="text-left">
                          {shouldShow ? month : ""}
                        </div>
                      );
                    })}
                  </div>

                  {/* Heatmap grid */}
                  <div className="flex gap-0.5 sm:gap-1 min-w-max">
                    {/* Day labels */}
                    <div
                      className="flex flex-col gap-0.5 sm:gap-1 text-xs text-gray-600 pr-1 sm:pr-2 justify-around -mt-2 sm:-mt-3"
                      style={{ height: window.innerWidth < 640 ? "84px" : "112px" }}
                    >
                      <div>Mon</div>

                      <div>Wed</div>

                      <div>Fri</div>

                      <div>Sun</div>
                    </div>

                    {/* Weeks - scaled to fit */}
                    <div className="flex gap-0.5 flex-1">
                      {heatmapData.map((week, weekIdx) => (
                        <div key={weekIdx} className="flex flex-col gap-0.5 flex-1 min-w-[10px] sm:min-w-[14px]">
                          {Array.from({ length: 7 }).map((_, dayIdx) => {
                            const day = week[dayIdx];
                            return (
                              <div
                                key={dayIdx}
                                className={`w-full h-2.5 sm:h-3 rounded-sm ${day ? getIntensityColor(day.count) : "bg-transparent"}`}
                                title={day ? `${day.date.toLocaleDateString()}: ${day.count} reads` : ""}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-end gap-1 sm:gap-2 mt-3 sm:mt-4 text-xs text-gray-600">
                    <span>Less</span>
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-sm bg-gray-100!"></div>
                      <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-sm bg-indigo-200!"></div>
                      <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-sm bg-indigo-400!"></div>
                      <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-sm bg-indigo-600!"></div>
                      <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-sm bg-indigo-700!"></div>
                    </div>
                    <span>More</span>
                  </div>
                </div>
              </Card>

              {/* Top Tags */}
              <Card
                title={
                  <span className="flex! items-center! gap-2! text-base! sm:text-lg! font-semibold!">
                    <FireOutlined className="text-orange-500!" />
                    Top Tags Read
                  </span>
                }
                className="mt-4! sm:mt-6! shadow-md!"
              >
                <div className="text-xs! text-gray-500! mb-3!">Your most read topics</div>
                {readingOverview?.top_tags && readingOverview.top_tags.length > 0 ? (
                  <div className="space-y-2 sm:space-y-3">
                    {readingOverview.top_tags.map((tagData: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <span className="text-sm! sm:text-lg! font-bold! text-gray-400! w-5 sm:w-6! shrink-0!">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium! text-gray-900! text-sm! sm:text-base! truncate">{tagData.tag}</div>
                          </div>
                        </div>
                        <Tag color="orange" className="ml-2! shrink-0! text-xs! sm:text-sm!">
                          {tagData.count}
                        </Tag>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="No reading data available yet" className="py-6!" />
                )}
              </Card>

              {/* Trending Tags by Reading Days */}
              <Card
                title={
                  <span className="flex! items-center! gap-2! text-base! sm:text-lg! font-semibold!">
                    <LineChartOutlined className="text-indigo-500!" />
                    Top Tags by Reading Days
                  </span>
                }
                className="mt-4! sm:mt-6! shadow-md!"
              >
                <div className="text-xs! text-gray-500! mb-3!">
                  {selectedYear === new Date().getFullYear()
                    ? "Trending topics: last 30 days vs previous 30 days"
                    : `Trending topics: last 60 days of ${selectedYear}`}
                </div>
                {readingOverview?.trending_tags && readingOverview.trending_tags.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {readingOverview.trending_tags.map((tagData: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 sm:p-3 bg-linear-to-r from-indigo-50 to-white rounded-lg hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold! text-gray-900! text-sm! sm:text-base! truncate">{tagData.tag}</div>
                            <div className="text-xs! text-gray-500! mt-0.5 sm:mt-1">{tagData.count} reads</div>
                          </div>
                        </div>
                        {tagData.is_new ? (
                          <Tag color="blue" className="ml-2! shrink-0! font-semibold! text-xs! sm:text-sm!">
                            New
                          </Tag>
                        ) : (
                          <Tag color={tagData.change >= 0 ? "green" : "red"} className="ml-2! shrink-0! font-semibold! text-xs! sm:text-sm!">
                            {tagData.change >= 0 ? "+" : ""}
                            {tagData.change}%
                          </Tag>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="Not enough data to show trends yet" className="py-6!" />
                )}
              </Card>
            </>
          )}
        </div>
      );
    }

    if (profileSubSection === "activity") {
      return (
        <div className="space-y-4 sm:space-y-6">
          <div>
            <Title level={3} className="text-xl! sm:text-2xl!">
              Activity
            </Title>
            <Text type="secondary" className="text-sm! sm:text-base!">
              Your interactions and engagement
            </Text>
          </div>

          {isLoadingActivity ? (
            <div className="text-center py-12">
              <Spin size="large" />
            </div>
          ) : (
            <>
              {/* Upvoted Articles */}
              <Card
                title={
                  <div className="flex! items-center! gap-2! text-sm! sm:text-base!">
                    <LikeOutlined className="text-green-500! text-base! sm:text-lg!" />
                    <span>Upvoted Articles ({activityData?.upvoted_articles?.length || 0})</span>
                  </div>
                }
              >
                {activityData?.upvoted_articles && activityData.upvoted_articles.length > 0 ? (
                  <List
                    dataSource={activityData.upvoted_articles}
                    renderItem={(article: any) => (
                      <List.Item
                        key={article.article_id}
                        className="cursor-pointer! hover:bg-gray-50! transition-colors! rounded-lg! p-2! sm:p-3!"
                        onClick={() => navigate(`/MainFeed?article=${article.article_id}`)}
                      >
                        <div className="w-full">
                          <Text strong className="text-sm! sm:text-base! block text-blue-600! hover:text-blue-700! line-clamp-2!">
                            {article.title}
                          </Text>
                          <Text type="secondary" className="text-xs! sm:text-sm! block mt-1">
                            {article.journal} • {new Date(article.upvoted_at).toLocaleDateString()}
                          </Text>
                        </div>
                      </List.Item>
                    )}
                    pagination={{
                      pageSize: 5,
                      size: "small",
                      simple: window.innerWidth < 640,
                    }}
                  />
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <Text type="secondary" className="text-sm! sm:text-base!">
                      No upvoted articles yet
                    </Text>
                  </div>
                )}
              </Card>

              {/* Comments */}
              <Card
                title={
                  <div className="flex! items-center! gap-2! text-sm! sm:text-base!">
                    <CommentOutlined className="text-indigo-500! text-base! sm:text-lg!" />
                    <span>Comments on Articles ({activityData?.comments?.length || 0})</span>
                  </div>
                }
              >
                {activityData?.comments && activityData.comments.length > 0 ? (
                  <List
                    dataSource={activityData.comments}
                    renderItem={(comment: any) => (
                      <List.Item
                        key={comment.comment_id}
                        className="cursor-pointer! hover:bg-gray-50! transition-colors! rounded-lg! p-2! sm:p-3!"
                        onClick={() => navigate(`/MainFeed?article=${comment.article_id}`)}
                      >
                        <div className="w-full">
                          <Text strong className="text-sm! sm:text-base! block text-blue-600! hover:text-blue-700! line-clamp-2!">
                            {comment.article_title}
                          </Text>
                          <Text className="text-xs! sm:text-sm! block mt-1 text-gray-700! line-clamp-3!">"{comment.comment_text}"</Text>
                          <Text type="secondary" className="text-xs! sm:text-sm! block mt-1">
                            {comment.article_journal} • {new Date(comment.created_at).toLocaleDateString()}
                          </Text>
                        </div>
                      </List.Item>
                    )}
                    pagination={{
                      pageSize: 5,
                      size: "small",
                      simple: window.innerWidth < 640,
                    }}
                  />
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <Text type="secondary" className="text-sm! sm:text-base!">
                      No comments yet
                    </Text>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      );
    }

    return null;
  };

  const renderAccountContent = () => {
    return (
      <>
        <div className="space-y-4 sm:space-y-6">
          <div>
            <Title level={3} className="text-xl! sm:text-2xl!">
              Account
            </Title>
            <Text type="secondary" className="text-sm! sm:text-base!">
              Manage your account settings
            </Text>
          </div>

          {/* Google Scholar Profile */}
          <Card title="Google Scholar Profile" className="shadow-md!">
            <p className="text-gray-600 mb-4 text-sm">
              Add your <span className="font-semibold!">Google Scholar</span> profile link. You will receive better recommendations based on your
              publications.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://scholar.google.com/citations?user=..."
                value={scholarUrl}
                onChange={e => setScholarUrl(e.target.value)}
                allowClear
                className="flex-1"
              />
              <Button type="primary" loading={scholarProfileMutation.isPending} onClick={() => scholarProfileMutation.mutate(scholarUrl)}>
                Save
              </Button>
            </div>
            {/* {scholarUrl && (
              <div className="mt-3">
                <a href={scholarUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all">
                  {scholarUrl}
                </a>
              </div>
            )} */}
          </Card>

          <Card>
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
              <Avatar size={80} src={user?.imageUrl} icon={<UserOutlined />} className="mb-4! border-4! border-blue-100!" />
              <Title level={4} className="mb-1! text-lg! sm:text-xl!">
                {user?.fullName || "User"}
              </Title>
              <Text type="secondary" className="mb-6! text-sm! sm:text-base!">
                {user?.primaryEmailAddress?.emailAddress}
              </Text>

              <Button type="primary" size="large" icon={<SettingOutlined />} onClick={() => setShowUserProfile(true)} className="mb-4! px-6!">
                Manage Account
              </Button>

              <Text type="secondary" className="text-xs! sm:text-sm! text-center! max-w-md">
                Update your profile information, security settings, and connected accounts
              </Text>
            </div>
          </Card>
        </div>

        {/* Clerk UserProfile - opens as modal */}
        {showUserProfile && (
          <div className="fixed inset-0 z-9999! flex items-center justify-center bg-black/50" onClick={() => setShowUserProfile(false)}>
            <div className="relative max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => setShowUserProfile(false)}
                className="absolute! -top-12! left-0! bg-white! hover:bg-gray-100! z-10!"
                size="large"
              >
                Close
              </Button>
              <div className="bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <UserProfile
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      card: "shadow-none border-0",
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderNotificationsContent = () => {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <Title level={3} className="text-xl! sm:text-2xl!">
            Notifications
          </Title>
          <Text type="secondary" className="text-sm! sm:text-base!">
            Configure your notification preferences
          </Text>
        </div>

        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 sm:py-3 gap-4">
              <div className="flex-1">
                <Text strong className="text-sm! sm:text-base!">
                  Weekly Research Digest
                </Text>
                <br />
                <Text type="secondary" className="text-xs! sm:text-sm!">
                  Receive a weekly email with 5 highly relevant papers you haven&apos;t read yet
                </Text>
              </div>
              <Switch
                checked={digestSubData?.subscribed ?? true}
                loading={isLoadingDigestSub || digestSubMutation.isPending}
                onChange={checked => digestSubMutation.mutate(checked)}
              />
            </div>
            <Divider className="my-2!" />
            <div className="flex items-center justify-between py-2 sm:py-3 gap-4">
              <div className="flex-1">
                <Text strong className="text-sm! sm:text-base!">
                  Updates Notifications
                </Text>
                <br />
                <Text type="secondary" className="text-xs! sm:text-sm!">
                  Get notified about important updates
                </Text>
              </div>
              <Switch />
            </div>
            <Divider className="my-2!" />
            <div className="flex items-center justify-between py-2 sm:py-3 gap-4">
              <div className="flex-1">
                <Text strong className="text-sm! sm:text-base!">
                  Comments
                </Text>
                <br />
                <Text type="secondary" className="text-xs! sm:text-sm!">
                  Notify when someone replies to your comment
                </Text>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderFeedSettingsContent = () => {
    const handleSavePrompt = async () => {
      const trimmed = interestsPrompt.trim();
      if (!trimmed) {
        message.warning("Please describe your research interests");
        return;
      }
      if (trimmed.length < 20) {
        message.warning("Please write a bit more so we can find relevant papers for you");
        return;
      }

      setIsSavingPrompt(true);
      try {
        await axiosInstance.post("/settings/update-user-tags", {
          tags: [trimmed],
        });
        message.success("Your feed preferences have been updated!");
        queryClient.invalidateQueries({ queryKey: ["userTags"] });
        queryClient.invalidateQueries({ queryKey: ["interestHistory"] });
        queryClient.invalidateQueries({ queryKey: ["mainFeed"] });
      } catch (error: any) {
        console.error("Error updating interests:", error);
        message.error(error?.response?.data?.detail || "Failed to update interests");
      } finally {
        setIsSavingPrompt(false);
      }
    };

    const handleResetInterests = async () => {
      try {
        await axiosInstance.post("/settings/reset-feed-settings");
        setInterestsPrompt("");
        queryClient.invalidateQueries({ queryKey: ["userTags"] });
        queryClient.invalidateQueries({ queryKey: ["interestHistory"] });
        queryClient.invalidateQueries({ queryKey: ["mainFeed"] });
        message.success("Feed settings have been reset!");
      } catch (error: any) {
        console.error("Error resetting interests:", error);
        message.error(error?.response?.data?.detail || "Failed to reset feed settings");
      }
    };

    const handleRestorePrompt = (prompt: string) => {
      setInterestsPrompt(prompt);
      message.info("Prompt restored — click Save to apply");
    };

    const history = interestHistoryData?.history || [];

    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <Title level={3} className="text-xl! sm:text-2xl!">
            Feed Settings
          </Title>
          <Text type="secondary" className="text-sm! sm:text-base!">
            Customize your main feed experience and interests
          </Text>
        </div>

        {/* Upvote-Based Recommendations Toggle */}
        <Card className="mt-4! mb-4! border! border-gray-300!">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <LikeOutlined className="text-lg! text-blue-600!" />
                <Text strong className="text-sm! sm:text-base!">
                  Learn from my upvotes
                </Text>
              </div>
              <Text type="secondary" className="text-xs! sm:text-sm!">
                When enabled, your feed vector is adjusted daily to also reflect the articles you've upvoted, giving you more personalized
                recommendations over time.
              </Text>
            </div>
            <div className="self-start sm:self-auto">
              <Switch
                checked={feedPreferences?.upvote_based_recommendations ?? true}
                loading={feedPreferencesMutation.isPending}
                onChange={checked => {
                  feedPreferencesMutation.mutate({ upvote_based_recommendations: checked });
                }}
              />
            </div>
          </div>
        </Card>

        {/* Interest Prompt Section */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <EditOutlined className="text-blue-600!" />
              Describe your research interests
            </span>
          }
          className="mb-4! border! border-gray-300!"
        >
          <p className="text-gray-400! mb-4! -mt-3! text-sm!">
            Describe your research interests, topics, and methods in your own words. The more detail you provide, the better we can personalize your
            paper feed.
          </p>

          <Input.TextArea
            value={interestsPrompt}
            onChange={e => setInterestsPrompt(e.target.value)}
            placeholder="Describe your research interests, topics you follow, methods you use..."
            autoSize={{ minRows: 5, maxRows: 12 }}
            maxLength={2000}
            showCount
            className="text-base! rounded-xl! mb-3!"
          />

          {/* Inline feedback */}
          <div className="text-sm mb-4">
            {interestsPrompt.trim().length === 0 ? (
              <span className="text-gray-400">Write a few sentences about your interests</span>
            ) : interestsPrompt.trim().length < 20 ? (
              <span className="text-amber-500">Keep going — a bit more detail helps</span>
            ) : (
              <span className="text-green-600">Looks good!</span>
            )}
          </div>

          {/* Save / Reset */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <Popconfirm
              title="Reset feed settings"
              description="Are you sure you want to reset all feed settings? This clears your interests."
              onConfirm={handleResetInterests}
              okText="Yes"
              cancelText="No"
            >
              <Button size="large">Reset</Button>
            </Popconfirm>
            <Button type="primary" size="large" loading={isSavingPrompt} onClick={handleSavePrompt} disabled={interestsPrompt.trim().length < 20}>
              Save Changes
            </Button>
          </div>
        </Card>

        {/* Prompt History */}
        {history.length > 0 && (
          <Card
            title={
              <span className="flex items-center gap-2! text-gray-700!">
                <HistoryOutlined className="text-sm! text-blue-600! sm:text-base!" />
                Recent Interest Prompts
              </span>
            }
            className="border! border-gray-300!"
          >
            <p className="text-gray-500 text-xs mb-4">
              Your last {history.length} saved prompt{history.length !== 1 ? "s" : ""}. Click to restore.
            </p>
            <div className="space-y-3">
              {history.map((entry: { prompt: string; saved_at: string }, idx: number) => (
                <div
                  key={idx}
                  className="p-3 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-colors group"
                  onClick={() => handleRestorePrompt(entry.prompt)}
                >
                  <p className="text-sm text-gray-700 group-hover:text-gray-900 line-clamp-2">{entry.prompt}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-400">
                      {new Date(entry.saved_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">Click to restore</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  const renderReferenceManagersContent = () => {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <Title level={3} className="text-xl! sm:text-2xl!">
            Reference Managers
          </Title>
          <Text type="secondary" className="text-sm! sm:text-base!">
            Connect your reference management tools to export articles directly from your feed
          </Text>
        </div>

        {/* Zotero Integration Card */}
        <Card className="shadow-md!">
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-red-50">
                <SiZotero className="text-2xl! text-red-700!" />
              </div>
              <div className="flex-1">
                <Text strong className="text-base! sm:text-lg! block!">
                  Zotero
                </Text>
                <Text type="secondary" className="text-xs! sm:text-sm!">
                  Open-source reference manager for collecting and organizing research
                </Text>
              </div>
              {/* Status Badge */}
              {!isLoadingZotero && (
                <Tag color={zoteroStatus ? "success" : "default"} className="m-0!">
                  {zoteroStatus ? "Connected" : "Not Connected"}
                </Tag>
              )}
            </div>

            <Divider className="my-0!" />

            {/* Connection Status & Actions */}
            {isLoadingZotero ? (
              <div className="flex items-center justify-center py-6">
                <Spin size="default" />
                <Text type="secondary" className="ml-3! text-sm!">
                  Checking connection status...
                </Text>
              </div>
            ) : zoteroStatus ? (
              <>
                {/* Connected State */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5 text-green-600 text-lg">✓</div>
                    <div className="flex-1">
                      <Text strong className="text-sm! sm:text-base! text-green-800! block!">
                        Your Zotero account is connected
                      </Text>
                      <Text className="text-xs! sm:text-sm! text-green-700!">
                        You can export articles to your Zotero library directly from the article cards in your feed.
                      </Text>
                    </div>
                  </div>
                </div>

                {/* How to Use */}
                <Card className="bg-gray-50! border-gray-200!">
                  <Text strong className="text-sm! block! mb-2!">
                    How to export articles
                  </Text>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Text className="text-gray-400! font-mono! text-xs! mt-0.5!">1.</Text>
                      <Text className="text-xs! sm:text-sm! text-gray-600!">Find an article you want to save in your main feed</Text>
                    </div>
                    <div className="flex items-start gap-2">
                      <Text className="text-gray-400! font-mono! text-xs! mt-0.5!">2.</Text>
                      <Text className="text-xs! sm:text-sm! text-gray-600!">Click the Zotero export button on the article card</Text>
                    </div>
                    <div className="flex items-start gap-2">
                      <Text className="text-gray-400! font-mono! text-xs! mt-0.5!">3.</Text>
                      <Text className="text-xs! sm:text-sm! text-gray-600!">
                        The article (with metadata, DOI, authors, MeSH terms) will be added to your Zotero library
                      </Text>
                    </div>
                  </div>
                </Card>

                {/* Disconnect Button */}
                <div className="flex justify-end pt-2">
                  <Button danger onClick={() => zoteroDisconnectMutation.mutate()} loading={zoteroDisconnectMutation.isPending}>
                    Disconnect Zotero
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Disconnected State */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col gap-3">
                    <Text className="text-sm! text-gray-700!">
                      Connect your Zotero account to export articles directly from your daily Academic feed into your Zotero library with full
                      metadata including DOI, authors, journal, and MeSH terms.
                    </Text>
                    <div className="flex flex-wrap gap-2">
                      <Tag>One-click export</Tag>
                      <Tag>Full metadata</Tag>
                      <Tag>DOI &amp; PMID included</Tag>
                      <Tag>MeSH terms as tags</Tag>
                    </div>
                  </div>
                </div>

                {/* Connect Button */}
                <div className="flex justify-end pt-2">
                  <Button
                    type="primary"
                    size="large"
                    icon={<SiZotero />}
                    onClick={() => zoteroConnectMutation.mutate()}
                    loading={zoteroConnectMutation.isPending}
                  >
                    Connect Zotero
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Future integrations hint */}
        <Card className="border-dashed! border-gray-300! bg-gray-50!">
          <div className="flex items-center gap-3 text-gray-400">
            <FaBook className="text-xl!" />
            <div>
              <Text type="secondary" className="text-sm! block!">
                More reference managers coming soon
              </Text>
              <Text type="secondary" className="text-xs!">
                Mendeley, EndNote, and others are on our roadmap
              </Text>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderSupportContent = () => {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <Title level={3} className="text-xl! sm:text-2xl!">
            Support
          </Title>
          <Text type="secondary" className="text-sm! sm:text-base!">
            How can we make daily Academic better?
          </Text>
        </div>

        <Card className="bg-blue-50 border-blue-200">
          <div className="flex flex-col gap-2">
            <Text strong className="text-sm! sm:text-base!">
              <div className="flex items-center gap-2">
                <IoMailOutline className="text-blue-600! text-2xl!" />
                Need help? Contact us:
              </div>
            </Text>
            <a
              href="mailto:support@daily-academic.com"
              className="text-blue-600 hover:text-blue-800 text-sm! sm:text-base! font-medium flex items-center gap-2 ml-8"
            >
              support@daily-academic.com
            </a>
            <Text type="secondary" className="text-xs! sm:text-sm!">
              We typically respond within 24 hours
            </Text>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <Card hoverable className="hover:cursor-auto!">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1">
                <Text strong className="text-sm! sm:text-base!">
                  <div className="flex">
                    <FaPuzzlePiece className="mr-3! mt-0! text-3xl! text-lime-600!" />
                    Feature Request
                  </div>
                </Text>
                <br />
                <Text type="secondary" className="text-xs! sm:text-sm!">
                  Suggest new features for Daily Academic
                </Text>
              </div>
              <Button
                type="primary"
                className="w-full! sm:w-auto!"
                onClick={() => window.open("https://github.com/DimitrisGrig/academic.daily.app/issues/new?template=feature_request.md", "_blank")}
              >
                Submit
              </Button>
            </div>
          </Card>

          <Card hoverable className="hover:cursor-auto!">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1">
                <Text strong className="text-sm! sm:text-base!">
                  <div className="flex">
                    <FaBug className="mr-3! mt-0! text-3xl! text-slate-600!" />
                    Report a Bug
                  </div>
                </Text>
                <br />
                <Text type="secondary" className="text-xs! sm:text-sm!">
                  Let us know about any issues you encounter
                </Text>
              </div>
              <Button
                type="primary"
                className="w-full! sm:w-auto!"
                onClick={() => window.open("https://github.com/DimitrisGrig/academic.daily.app/issues/new?template=bug_report.md", "_blank")}
              >
                Report
              </Button>
            </div>
          </Card>

          <Card hoverable className="hover:cursor-auto!">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1">
                <Text strong className="text-sm! sm:text-base!">
                  <div className="flex">
                    <SiWine className="mt-0! text-2xl! text-rose-800! transform scale-x-[-1]" />
                    <SiWine className="mr-3! mt-0! text-2xl! text-rose-800!" />
                    General Feedback
                  </div>
                </Text>
                <br />
                <Text type="secondary" className="text-xs! sm:text-sm!">
                  Share your thoughts and suggestions
                </Text>
              </div>
              <Button
                type="primary"
                className="w-full! sm:w-auto!"
                onClick={() => window.open("https://github.com/DimitrisGrig/academic.daily.app/issues/new?template=general_feedback.md", "_blank")}
              >
                Send
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeCategory) {
      case "profile":
        return renderProfileContent();
      case "account":
        return renderAccountContent();
      case "notifications":
        return renderNotificationsContent();
      case "feed-settings":
        return renderFeedSettingsContent();
      case "reference-managers":
        return renderReferenceManagersContent();
      case "support":
        return renderSupportContent();
      default:
        return null;
    }
  };

  const handleMenuItemClick = (key: SettingsCategory) => {
    setActiveCategory(key);
    if (key === "profile") {
      setProfileSubSection("reading-overview");
    }
    setMobileMenuOpen(false); // Close drawer on mobile
  };

  const renderMenuItems = () => (
    <>
      {/* User Info */}
      <div className="flex flex-col items-center mb-6 pb-6 border-b border-gray-200">
        <Avatar size={64} icon={<UserOutlined />} className="mb-3!" />
        <Text strong className="text-lg!">
          {user?.fullName || "User Name"}
        </Text>
        <Text type="secondary" className="text-sm! text-center! px-2!">
          {user?.primaryEmailAddress?.emailAddress}
        </Text>
      </div>

      {/* Menu Items */}
      <div className="space-y-1">
        {menuItems.map(item => (
          <div key={item.key}>
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                activeCategory === item.key ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100"
              }`}
              onClick={() => handleMenuItemClick(item.key)}
            >
              <span className="text-lg!">{item.icon}</span>
              <Text className={activeCategory === item.key ? "font-semibold!" : ""}>{item.label}</Text>
            </div>

            {/* Sub-sections for Profile */}
            {item.key === "profile" && activeCategory === "profile" && (
              <div className="ml-4 mt-1 space-y-1">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                    profileSubSection === "reading-overview" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                  }`}
                  onClick={e => {
                    e.stopPropagation();
                    setProfileSubSection("reading-overview");
                    setMobileMenuOpen(false);
                  }}
                >
                  <LineChartOutlined />
                  <Text>Reading Overview</Text>
                </div>
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                    profileSubSection === "activity" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                  }`}
                  onClick={e => {
                    e.stopPropagation();
                    setProfileSubSection("activity");
                    setMobileMenuOpen(false);
                  }}
                >
                  <LikeOutlined />
                  <Text>Activity</Text>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      {/* Mobile Header */}
      <div className="lg:hidden top-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/MainFeed")} size="large" />
            <Button icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} size="large" />
            <Title level={4} className="mb-0!">
              {menuItems.find(item => item.key === activeCategory)?.label}
            </Title>
          </div>
        </div>
      </div>

      {/* Desktop Back to Home Button */}
      <Button
        onClick={() => navigate("/MainFeed")}
        type="text"
        size="large"
        className="hidden! lg:flex! items-center! gap-2! bg-white! border border-gray-300! fixed! top-16! left-4! z-50! hover:shadow-md! hover:border-sky-500! rounded-lg! px-3! py-2! transition-all! duration-200! cursor-pointer! group"
        title="Back to Home"
      >
        <FaArrowLeftLong className="text-xl! text-gray-600! group-hover:text-sky-500! transition-colors!" />
        <IoHomeOutline className="text-2xl! text-gray-600! group-hover:text-sky-500! transition-colors!" />
      </Button>

      {/* Mobile Drawer */}
      <Drawer
        title="Settings Menu"
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={280}
        styles={{
          body: { padding: "16px" },
        }}
      >
        {renderMenuItems()}
      </Drawer>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Desktop Sidebar */}

          <div className="hidden lg:block lg:col-span-1">
            <Card className="sticky! top-6!">{renderMenuItems()}</Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card className="min-h-[400px]! sm:min-h-[600px]!">{renderContent()}</Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
