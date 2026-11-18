import { useQuery } from "@tanstack/react-query";
import { Card, Row, Col, Statistic, Typography, Space, Tag, Progress, Table, List, Divider } from "antd";
import {
  FileTextOutlined,
  BookOutlined,
  UserOutlined,
  LikeOutlined,
  CommentOutlined,
  TeamOutlined,
  TagOutlined,
  ReadOutlined,
  UnlockOutlined,
  ExperimentOutlined,
  ClockCircleOutlined,
  FireOutlined,
  FolderOutlined,
  RiseOutlined,
  MailOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  StarOutlined,
} from "@ant-design/icons";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ColumnsType } from "antd/es/table";
import axiosInstance from "../lib/axios";
import Loading from "../components/misc/Loading";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";

const { Title, Text } = Typography;

interface DatabaseStats {
  articles: {
    total: number;
    last_30_days: number;
    last_90_days: number;
    last_year: number;
    open_access: number;
    open_access_percentage: number;
    with_graphical_abstract: number;
    publication_types: { [key: string]: number };
    last_update: string | null;
  };
  journals: {
    total: number;
    active: number;
    average_impact_factor: number;
    high_impact: number;
    mid_impact: number;
    top_journals: Array<{ journal: string; article_count: number }>;
  };
  topics: {
    total_subtopics: number;
    total_broad_topics: number;
  };
  users: {
    total: number;
    active: number;
    engagement_rate: number;
  };
  engagement: {
    total_upvotes: number;
    total_comments: number;
    total_reads: number;
    total_bookmarks: number;
    total_custom_feeds: number;
    top_upvoted_articles: Array<{ id: number; title: string; journal: string; upvotes: number }>;
    top_commented_articles: Array<{ id: number; title: string; journal: string; comments: number }>;
    daily_activity_last_30_days: { [date: string]: number };
  };
}

interface ReturnVisitsStats {
  distribution: Array<{ label: string; users: number }>;
  summary: {
    total_users: number;
    never_returned: number;
    returned_at_least_once: number;
    retention_rate: number;
    avg_return_visits: number;
  };
}

interface FeatureAdoptionStats {
  total_users: number;
  total_users_with_feeds: number;
  feature_adoption: {
    main_feed: { users: number; percentage: number };
    custom_feeds: { users: number; percentage: number; avg_per_user: number; distribution: Record<string, number> };
    journal_follows: { users: number; percentage: number; avg_per_user: number };
    bookmarks: { users: number; percentage: number; avg_folders: number; avg_bookmarks: number };
    upvote_recommendations: { enabled: number; disabled: number; percentage_enabled: number };
    interest_prompts: { users: number; percentage: number };
    email_digest: { subscribers: number; percentage: number };
    bioarchive: { users: number; percentage: number };
  };
  user_growth_last_12_weeks: Array<{ week: string; count: number }>;
  top_clicked_articles_last_30_days: Array<{ id: number; title: string; journal: string; clicks: number }>;
  bioarchive: { unique_users: number; total_clicks: number; upvotes: number; percentage_of_users: number };
  groups: { total: number; total_shared_articles: number };
  popular_routes_last_30_days: Array<{ route: string; requests: number; unique_users: number }>;
}

function adoptionColor(pct: number) {
  if (pct >= 50) return "#52c41a";
  if (pct >= 25) return "#faad14";
  return "#ff4d4f";
}

function adoptionTagColor(pct: number) {
  if (pct >= 50) return "green";
  if (pct >= 25) return "orange";
  return "red";
}

function Metrics() {
  const { user } = useUser();
  const isAdmin = user?.id === import.meta.env.VITE_ADMIN_CLERK_USER_ID;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSmallMobile, setIsSmallMobile] = useState(window.innerWidth < 400);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsSmallMobile(window.innerWidth < 400);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { data: stats, isLoading } = useQuery<DatabaseStats>({
    queryKey: ["databaseStats"],
    queryFn: async () => {
      const response = await axiosInstance.get("/metrics/database-stats");
      return response.data;
    },
  });

  const { data: adoptionStats, isLoading: adoptionLoading } = useQuery<FeatureAdoptionStats>({
    queryKey: ["featureAdoptionStats"],
    queryFn: async () => {
      const response = await axiosInstance.get("/metrics/feature-adoption");
      return response.data;
    },
    enabled: isAdmin,
  });

  const { data: returnVisitsStats } = useQuery<ReturnVisitsStats>({
    queryKey: ["userReturnVisits"],
    queryFn: async () => {
      const response = await axiosInstance.get("/metrics/user-return-visits");
      return response.data;
    },
    enabled: isAdmin,
  });

  if (isLoading) {
    return <Loading />;
  }

  // ── Table columns ──────────────────────────────────────────────────────────

  const journalColumns: ColumnsType<{ journal: string; article_count: number }> = [
    {
      title: "Journal",
      dataIndex: "journal",
      key: "journal",
      ellipsis: true,
      render: (text: string) => <Text className="text-xs sm:text-sm">{text}</Text>,
    },
    {
      title: "Articles",
      dataIndex: "article_count",
      key: "article_count",
      width: 80,
      render: (count: number) => <Tag color="blue" className="text-xs">{count}</Tag>,
    },
  ];

  const upvotedColumns: ColumnsType<{ id: number; title: string; journal: string; upvotes: number }> = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (title: string) => (
        <Text className="text-xs sm:text-sm">{title.length > 60 ? `${title.substring(0, 60)}...` : title}</Text>
      ),
    },
    {
      title: "Journal",
      dataIndex: "journal",
      key: "journal",
      width: 150,
      ellipsis: true,
      responsive: ["md" as const],
      render: (text: string) => <Text className="text-xs sm:text-sm">{text}</Text>,
    },
    {
      title: "Upvotes",
      dataIndex: "upvotes",
      key: "upvotes",
      width: 80,
      render: (count: number) => <Tag color="red" className="text-xs">{count}</Tag>,
    },
  ];

  const commentedColumns: ColumnsType<{ id: number; title: string; journal: string; comments: number }> = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (title: string) => (
        <Text className="text-xs sm:text-sm">{title.length > 60 ? `${title.substring(0, 60)}...` : title}</Text>
      ),
    },
    {
      title: "Journal",
      dataIndex: "journal",
      key: "journal",
      width: 150,
      ellipsis: true,
      responsive: ["md" as const],
      render: (text: string) => <Text className="text-xs sm:text-sm">{text}</Text>,
    },
    {
      title: "Comments",
      dataIndex: "comments",
      key: "comments",
      width: 85,
      render: (count: number) => <Tag color="green" className="text-xs">{count}</Tag>,
    },
  ];

  const clickedColumns: ColumnsType<{ id: number; title: string; journal: string; clicks: number }> = [
    {
      title: "#",
      key: "rank",
      width: 36,
      render: (_: unknown, __: unknown, i: number) => (
        <Text className="text-xs text-gray-400">{i + 1}</Text>
      ),
    },
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (title: string) => (
        <Text className="text-xs sm:text-sm">{title.length > 70 ? `${title.substring(0, 70)}...` : title}</Text>
      ),
    },
    {
      title: "Journal",
      dataIndex: "journal",
      key: "journal",
      width: 150,
      ellipsis: true,
      responsive: ["md" as const],
      render: (text: string) => <Text className="text-xs">{text}</Text>,
    },
    {
      title: "Clicks",
      dataIndex: "clicks",
      key: "clicks",
      width: 70,
      render: (count: number) => <Tag color="blue" className="text-xs">{count}</Tag>,
    },
  ];

  const routeColumns: ColumnsType<{ route: string; requests: number; unique_users: number }> = [
    {
      title: "Route",
      dataIndex: "route",
      key: "route",
      ellipsis: true,
      render: (route: string) => (
        <Text code className="text-xs" style={{ fontSize: isSmallMobile ? "10px" : undefined }}>
          {route}
        </Text>
      ),
    },
    {
      title: "Requests",
      dataIndex: "requests",
      key: "requests",
      width: 85,
      render: (n: number) => <Tag color="blue" className="text-xs">{n}</Tag>,
    },
    {
      title: "Users",
      dataIndex: "unique_users",
      key: "unique_users",
      width: 65,
      render: (n: number) => <Tag color="purple" className="text-xs">{n}</Tag>,
    },
  ];

  // ── Feature adoption rows config ───────────────────────────────────────────
  const featureRows = adoptionStats
    ? [
        {
          label: "Main Feed Setup",
          icon: <FireOutlined style={{ color: "#ff4d4f" }} />,
          users: adoptionStats.feature_adoption.main_feed.users,
          pct: adoptionStats.feature_adoption.main_feed.percentage,
          note: null,
        },
        {
          label: "Journal Follows",
          icon: <BookOutlined style={{ color: "#13c2c2" }} />,
          users: adoptionStats.feature_adoption.journal_follows.users,
          pct: adoptionStats.feature_adoption.journal_follows.percentage,
          note: `avg ${adoptionStats.feature_adoption.journal_follows.avg_per_user} follows/user`,
        },
        {
          label: "Custom Feeds",
          icon: <FolderOutlined style={{ color: "#faad14" }} />,
          users: adoptionStats.feature_adoption.custom_feeds.users,
          pct: adoptionStats.feature_adoption.custom_feeds.percentage,
          note: `avg ${adoptionStats.feature_adoption.custom_feeds.avg_per_user} feeds/user`,
        },
        {
          label: "Bookmarks",
          icon: <StarOutlined style={{ color: "#722ed1" }} />,
          users: adoptionStats.feature_adoption.bookmarks.users,
          pct: adoptionStats.feature_adoption.bookmarks.percentage,
          note: `avg ${adoptionStats.feature_adoption.bookmarks.avg_bookmarks} bookmarks/user`,
        },
        {
          label: "Interest Prompts",
          icon: <TagOutlined style={{ color: "#eb2f96" }} />,
          users: adoptionStats.feature_adoption.interest_prompts.users,
          pct: adoptionStats.feature_adoption.interest_prompts.percentage,
          note: null,
        },
        {
          label: "Email Digest",
          icon: <MailOutlined style={{ color: "#1890ff" }} />,
          users: adoptionStats.feature_adoption.email_digest.subscribers,
          pct: adoptionStats.feature_adoption.email_digest.percentage,
          note: null,
        },
        {
          label: "BioArchive Used",
          icon: <ThunderboltOutlined style={{ color: "#52c41a" }} />,
          users: adoptionStats.feature_adoption.bioarchive.users,
          pct: adoptionStats.feature_adoption.bioarchive.percentage,
          note: null,
        },
      ]
    : [];

  return (
    <div className="p-2 sm:p-3 md:p-6 bg-gray-100 min-h-screen max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-3 sm:mb-4 md:mb-6 px-1">
        <Title level={2} className="m-0! flex! items-center! gap-2" style={{ fontSize: isSmallMobile ? "16px" : undefined }}>
          <FireOutlined className="text-red-500!" style={{ fontSize: isSmallMobile ? "16px" : undefined }} />
          {isSmallMobile ? "DB Metrics" : "Database Metrics"}
        </Title>
        <Text type="secondary" className="text-xs sm:text-sm! block mt-1">
          Comprehensive overview of content and activity in the platform
        </Text>
        {stats?.articles.last_update && (
          <div className="mt-2">
            <Tag
              icon={<ClockCircleOutlined />}
              className="rounded-md! py-1! bg-slate-500! text-white! text-xs sm:text-sm!"
              style={{ padding: isSmallMobile ? "2px 8px" : "4px 12px" }}
            >
              Last update: {dayjs(stats.articles.last_update).format("DD MMM YYYY")}
            </Tag>
          </div>
        )}
      </div>

      {/* Articles Overview */}
      <Title level={4} className="mt-3 sm:mt-4 md:mt-6 mb-2 sm:mb-3 md:mb-4 text-sm sm:text-base md:text-lg! px-1">
        <FileTextOutlined className="mr-2 text-blue-600!" style={{ fontSize: isSmallMobile ? "14px" : undefined }} />
        Articles Database
      </Title>
      <Row gutter={[8, 8]} className="mb-3 sm:mb-4 md:mb-6">
        <Col xs={12} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Total Articles</span>}
              value={stats?.articles.total || 0}
              prefix={<FileTextOutlined style={{ color: "#1890ff", fontSize: isSmallMobile ? "14px" : undefined }} />}
              valueStyle={{ color: "#1890ff", fontSize: isSmallMobile ? "1.1rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Last 30 Days</span>}
              value={stats?.articles.last_30_days || 0}
              prefix={<ClockCircleOutlined style={{ color: "#52c41a", fontSize: isSmallMobile ? "14px" : undefined }} />}
              valueStyle={{ color: "#52c41a", fontSize: isSmallMobile ? "1.1rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Open Access</span>}
              value={`${stats?.articles.open_access_percentage || 0}%`}
              prefix={<UnlockOutlined style={{ color: "#faad14", fontSize: isSmallMobile ? "14px" : undefined }} />}
              valueStyle={{ color: "#faad14", fontSize: isSmallMobile ? "1.1rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>With Graphics</span>}
              value={stats?.articles.with_graphical_abstract || 0}
              prefix={<FileTextOutlined style={{ color: "#722ed1", fontSize: isSmallMobile ? "14px" : undefined }} />}
              valueStyle={{ color: "#722ed1", fontSize: isSmallMobile ? "1.1rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Journals Overview */}
      <Title level={4} className="mt-3 sm:mt-4 md:mt-6 mb-2 sm:mb-3 md:mb-4 text-sm sm:text-base md:text-lg! px-1">
        <BookOutlined className="mr-2 text-cyan-600!" style={{ fontSize: isSmallMobile ? "14px" : undefined }} />
        Journals Database
      </Title>
      <Row gutter={[8, 8]} className="mb-3 sm:mb-4 md:mb-6">
        <Col xs={12} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Total Journals</span>}
              value={stats?.journals.total || 0}
              prefix={<BookOutlined style={{ color: "#13c2c2", fontSize: isSmallMobile ? "14px" : undefined }} />}
              valueStyle={{ color: "#13c2c2", fontSize: isSmallMobile ? "1.1rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Active Journals</span>}
              value={stats?.journals.active || 0}
              prefix={<RiseOutlined style={{ color: "#52c41a", fontSize: isSmallMobile ? "14px" : undefined }} />}
              valueStyle={{ color: "#52c41a", fontSize: isSmallMobile ? "1.1rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>{isSmallMobile ? "Avg Impact" : "Avg Impact Factor"}</span>}
              value={stats?.journals.average_impact_factor || 0}
              precision={2}
              prefix={<ExperimentOutlined style={{ color: "#1890ff", fontSize: isSmallMobile ? "14px" : undefined }} />}
              valueStyle={{ color: "#1890ff", fontSize: isSmallMobile ? "1.1rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>{isSmallMobile ? "High Impact" : "High Impact (≥10)"}</span>}
              value={stats?.journals.high_impact || 0}
              prefix={<FireOutlined style={{ color: "#ff4d4f", fontSize: isSmallMobile ? "14px" : undefined }} />}
              valueStyle={{ color: "#ff4d4f", fontSize: isSmallMobile ? "1.1rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Topics */}
      <Row gutter={[8, 8]} className="mb-3 sm:mb-4 md:mb-6">
        <Col xs={24} lg={12}>
          <Title level={4} className="mb-2 sm:mb-3 md:mb-4 text-sm sm:text-base md:text-lg! px-1">
            <TagOutlined className="mr-2 text-purple-600!" style={{ fontSize: isSmallMobile ? "14px" : undefined }} />
            Research Topics
          </Title>
          <Row gutter={[8, 8]}>
            <Col xs={12} sm={12}>
              <Card className="h-full">
                <Statistic
                  title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Total Subtopics</span>}
                  value={stats?.topics.total_subtopics || 0}
                  prefix={<TagOutlined style={{ color: "#722ed1", fontSize: isSmallMobile ? "14px" : undefined }} />}
                  valueStyle={{ color: "#722ed1", fontSize: isSmallMobile ? "1.1rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12}>
              <Card className="h-full">
                <Statistic
                  title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>{isSmallMobile ? "Categories" : "Broad Categories"}</span>}
                  value={stats?.topics.total_broad_topics || 0}
                  prefix={<FolderOutlined style={{ color: "#eb2f96", fontSize: isSmallMobile ? "14px" : undefined }} />}
                  valueStyle={{ color: "#eb2f96", fontSize: isSmallMobile ? "1.1rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
                />
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* ── Platform Engagement (admin) ─────────────────────────────────────── */}
      {isAdmin && (
        <>
          <Title level={4} className="mt-3 sm:mt-4 md:mt-6 mb-2 sm:mb-3 md:mb-4 text-sm sm:text-base md:text-lg! px-1" style={{ whiteSpace: "nowrap" }}>
            <LikeOutlined className="mr-2 text-red-500!" style={{ fontSize: isSmallMobile ? "14px" : undefined }} />
            Platform Engagement
          </Title>
          <Row gutter={[8, 8]} className="mb-3 sm:mb-4 md:mb-6">
            <Col xs={12} sm={8} lg={4}>
              <Card className="h-full">
                <Statistic
                  title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Total Reads</span>}
                  value={stats?.engagement.total_reads || 0}
                  prefix={<ReadOutlined style={{ color: "#1890ff", fontSize: isSmallMobile ? "12px" : undefined }} />}
                  valueStyle={{ color: "#1890ff", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card className="h-full">
                <Statistic
                  title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Total Upvotes</span>}
                  value={stats?.engagement.total_upvotes || 0}
                  prefix={<LikeOutlined style={{ color: "#ff4d4f", fontSize: isSmallMobile ? "12px" : undefined }} />}
                  valueStyle={{ color: "#ff4d4f", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card className="h-full">
                <Statistic
                  title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>{isSmallMobile ? "Comments" : "Total Comments"}</span>}
                  value={stats?.engagement.total_comments || 0}
                  prefix={<CommentOutlined style={{ color: "#52c41a", fontSize: isSmallMobile ? "12px" : undefined }} />}
                  valueStyle={{ color: "#52c41a", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card className="h-full">
                <Statistic
                  title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Bookmarks</span>}
                  value={stats?.engagement.total_bookmarks || 0}
                  prefix={<BookOutlined style={{ color: "#722ed1", fontSize: isSmallMobile ? "12px" : undefined }} />}
                  valueStyle={{ color: "#722ed1", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card className="h-full">
                <Statistic
                  title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>{isSmallMobile ? "Feeds" : "Custom Feeds"}</span>}
                  value={stats?.engagement.total_custom_feeds || 0}
                  prefix={<FolderOutlined style={{ color: "#faad14", fontSize: isSmallMobile ? "12px" : undefined }} />}
                  valueStyle={{ color: "#faad14", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                />
              </Card>
            </Col>
          </Row>

          {/* ── User Insights ─────────────────────────────────────────────────── */}
          <Divider className="my-3 sm:my-4 md:my-6" />
          <Title level={4} className="mb-2 sm:mb-3 md:mb-4 text-sm sm:text-base md:text-lg! px-1">
            <UserOutlined className="mr-2 text-blue-600!" style={{ fontSize: isSmallMobile ? "14px" : undefined }} />
            User Insights
          </Title>

          {/* Overview stats */}
          {adoptionStats && (
            <Row gutter={[8, 8]} className="mb-3 sm:mb-4 md:mb-6">
              <Col xs={12} sm={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Total Users</span>}
                    value={adoptionStats.total_users}
                    prefix={<UserOutlined style={{ color: "#1890ff", fontSize: isSmallMobile ? "12px" : undefined }} />}
                    valueStyle={{ color: "#1890ff", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Feed Setup</span>}
                    value={adoptionStats.total_users_with_feeds}
                    prefix={<FireOutlined style={{ color: "#ff4d4f", fontSize: isSmallMobile ? "12px" : undefined }} />}
                    valueStyle={{ color: "#ff4d4f", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Email Digest</span>}
                    value={adoptionStats.feature_adoption.email_digest.subscribers}
                    prefix={<MailOutlined style={{ color: "#1890ff", fontSize: isSmallMobile ? "12px" : undefined }} />}
                    valueStyle={{ color: "#1890ff", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>BioArchive Users</span>}
                    value={adoptionStats.bioarchive.unique_users}
                    prefix={<ThunderboltOutlined style={{ color: "#52c41a", fontSize: isSmallMobile ? "12px" : undefined }} />}
                    valueStyle={{ color: "#52c41a", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Groups</span>}
                    value={adoptionStats.groups.total}
                    prefix={<TeamOutlined style={{ color: "#722ed1", fontSize: isSmallMobile ? "12px" : undefined }} />}
                    valueStyle={{ color: "#722ed1", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "10px" : undefined, display: "block", lineHeight: "1.2" }}>Shared in Groups</span>}
                    value={adoptionStats.groups.total_shared_articles}
                    prefix={<ApiOutlined style={{ color: "#faad14", fontSize: isSmallMobile ? "12px" : undefined }} />}
                    valueStyle={{ color: "#faad14", fontSize: isSmallMobile ? "0.95rem" : "clamp(1rem, 3.5vw, 1.25rem)" }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* ── Return Visits Distribution ───────────────────────────────── */}
          {returnVisitsStats && (() => {
            const barColors: Record<string, string> = {
              "0": "#ff4d4f",
              "1": "#fa8c16",
              "2": "#faad14",
              "3": "#faad14",
              "4": "#1890ff",
              "5": "#1890ff",
              "6-10": "#13c2c2",
              "11-20": "#52c41a",
              "21-50": "#389e0d",
              "50+": "#135200",
            };
            const { summary, distribution } = returnVisitsStats;
            return (
              <Card
                className="mb-3 sm:mb-4 md:mb-6"
                title={
                  <Space>
                    <RiseOutlined style={{ color: "#1890ff" }} />
                    <span className="text-xs sm:text-sm">User Return Visits — how many days users came back after sign-up</span>
                  </Space>
                }
              >
                {/* Summary row */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Tag color="blue" className="text-xs py-1 px-2">
                    {summary.total_users} total users
                  </Tag>
                  <Tag color={summary.retention_rate >= 50 ? "green" : summary.retention_rate >= 25 ? "orange" : "red"} className="text-xs py-1 px-2">
                    {summary.retention_rate}% retention rate
                  </Tag>
                  <Tag color="red" className="text-xs py-1 px-2">
                    {summary.never_returned} ({Math.round(summary.never_returned / summary.total_users * 100)}%) never returned
                  </Tag>
                  <Tag color="green" className="text-xs py-1 px-2">
                    {summary.returned_at_least_once} returned ≥ once
                  </Tag>
                  <Tag color="purple" className="text-xs py-1 px-2">
                    avg {summary.avg_return_visits} return days/user
                  </Tag>
                </div>

                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={distribution}
                    margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => [v ?? 0, "Users"]}
                      labelFormatter={(l) =>
                        l === "0"
                          ? "Never returned after sign-up"
                          : `Returned on ${l} day${l === "1" ? "" : "s"} after sign-up`
                      }
                    />
                    <Bar dataKey="users" radius={[4, 4, 0, 0]}>
                      {distribution.map((entry) => (
                        <Cell key={entry.label} fill={barColors[entry.label] ?? "#1890ff"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {[
                    { color: "#ff4d4f", label: "Never returned" },
                    { color: "#fa8c16", label: "1 day" },
                    { color: "#faad14", label: "2–3 days" },
                    { color: "#1890ff", label: "4–5 days" },
                    { color: "#13c2c2", label: "6–10 days" },
                    { color: "#52c41a", label: "11–20 days" },
                    { color: "#389e0d", label: "21–50 days" },
                    { color: "#135200", label: "50+ days" },
                  ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1 text-xs text-gray-500">
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: color }} />
                      {label}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })()}

          {/* Feature Adoption + User Growth */}
          {adoptionLoading ? (
            <Card className="mb-3 sm:mb-4 md:mb-6">
              <Text type="secondary">Loading user insights…</Text>
            </Card>
          ) : adoptionStats ? (
            <>
              <Row gutter={[8, 8]} className="mb-3 sm:mb-4 md:mb-6">
                {/* Feature adoption progress bars */}
                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <Space>
                        <RiseOutlined style={{ color: "#1890ff" }} />
                        <span className="text-xs sm:text-sm">Feature Adoption (% of all users)</span>
                      </Space>
                    }
                    className="h-full"
                  >
                    {featureRows.map((row) => (
                      <div key={row.label} className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <Space size={6}>
                            {row.icon}
                            <Text strong className="text-xs sm:text-sm">
                              {row.label}
                            </Text>
                            {row.note && (
                              <Text type="secondary" className="text-xs hidden sm:inline">
                                ({row.note})
                              </Text>
                            )}
                          </Space>
                          <Space size={4}>
                            <Text className="text-xs text-gray-500">{row.users} users</Text>
                            <Tag color={adoptionTagColor(row.pct)} className="text-xs m-0">
                              {row.pct}%
                            </Tag>
                          </Space>
                        </div>
                        <Progress
                          percent={row.pct}
                          showInfo={false}
                          strokeColor={adoptionColor(row.pct)}
                          size="small"
                        />
                      </div>
                    ))}
                  </Card>
                </Col>

                {/* User growth chart */}
                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <Space>
                        <UserOutlined style={{ color: "#1890ff" }} />
                        <span className="text-xs sm:text-sm">New User Registrations (last 12 weeks)</span>
                      </Space>
                    }
                    className="h-full"
                  >
                    {adoptionStats.user_growth_last_12_weeks.length === 0 ? (
                      <Text type="secondary" className="text-xs">No registration data available.</Text>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={adoptionStats.user_growth_last_12_weeks} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="week"
                            tickFormatter={(v) => dayjs(v).format("MMM D")}
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                          <Tooltip
                            labelFormatter={(l) => `Week of ${dayjs(l).format("MMM D, YYYY")}`}
                            formatter={(v) => [v ?? 0, "New Users"]}
                          />
                          <Bar dataKey="count" fill="#1890ff" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}

                    {/* Custom feed distribution */}
                    <Divider className="my-3" />
                    <Text strong className="text-xs sm:text-sm block mb-2">
                      <FolderOutlined className="mr-1 text-yellow-500!" />
                      Custom Feeds per User
                    </Text>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(adoptionStats.feature_adoption.custom_feeds.distribution).map(([label, count]) => (
                        <div key={label} className="text-center">
                          <Tag color="gold" className="text-xs mb-1">{label}</Tag>
                          <div className="text-xs text-gray-500">{count} users</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Top clicked + popular routes */}
              <Row gutter={[8, 8]} className="mb-3 sm:mb-4 md:mb-6">
                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <Space>
                        <ReadOutlined style={{ color: "#1890ff" }} />
                        <span className="text-xs sm:text-sm">Top Clicked Articles (last 30 days)</span>
                      </Space>
                    }
                  >
                    {isMobile ? (
                      <List
                        dataSource={adoptionStats.top_clicked_articles_last_30_days}
                        size="small"
                        style={{ maxHeight: isSmallMobile ? "250px" : "300px", overflowY: "auto" }}
                        renderItem={(article, idx) => (
                          <List.Item className="px-0! py-1.5 sm:py-2!">
                            <div className="w-full flex items-start gap-2">
                              <Text className="text-xs text-gray-400 shrink-0 w-4">{idx + 1}.</Text>
                              <div className="flex-1 flex justify-between items-start gap-2">
                                <Text className="text-xs flex-1" ellipsis={{ tooltip: article.title }}>
                                  {article.title}
                                </Text>
                                <Tag color="blue" className="text-xs m-0 shrink-0">{article.clicks}</Tag>
                              </div>
                            </div>
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Table
                        dataSource={adoptionStats.top_clicked_articles_last_30_days}
                        columns={clickedColumns}
                        pagination={false}
                        size="small"
                        rowKey="id"
                        scroll={{ y: 300 }}
                      />
                    )}
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <Space>
                        <ApiOutlined style={{ color: "#722ed1" }} />
                        <span className="text-xs sm:text-sm">Popular Routes (last 30 days)</span>
                      </Space>
                    }
                  >
                    {isMobile ? (
                      <List
                        dataSource={adoptionStats.popular_routes_last_30_days}
                        size="small"
                        style={{ maxHeight: isSmallMobile ? "250px" : "300px", overflowY: "auto" }}
                        renderItem={(row) => (
                          <List.Item className="px-0! py-1.5 sm:py-2!">
                            <div className="w-full flex justify-between items-center gap-2">
                              <Text code className="text-xs flex-1" ellipsis>
                                {row.route}
                              </Text>
                              <Space size={4}>
                                <Tag color="blue" className="text-xs m-0">{row.requests}</Tag>
                                <Tag color="purple" className="text-xs m-0">{row.unique_users}u</Tag>
                              </Space>
                            </div>
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Table
                        dataSource={adoptionStats.popular_routes_last_30_days}
                        columns={routeColumns}
                        pagination={false}
                        size="small"
                        rowKey="route"
                        scroll={{ y: 300 }}
                      />
                    )}
                  </Card>
                </Col>
              </Row>

              {/* BioArchive deep stats */}
              <Row gutter={[8, 8]} className="mb-3 sm:mb-4 md:mb-6">
                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <Space>
                        <ThunderboltOutlined style={{ color: "#52c41a" }} />
                        <span className="text-xs sm:text-sm">BioArchive Engagement</span>
                      </Space>
                    }
                  >
                    <Row gutter={[8, 8]}>
                      <Col xs={8}>
                        <Statistic
                          title={<span className="text-xs">Unique Users</span>}
                          value={adoptionStats.bioarchive.unique_users}
                          valueStyle={{ color: "#52c41a", fontSize: "1.1rem" }}
                        />
                      </Col>
                      <Col xs={8}>
                        <Statistic
                          title={<span className="text-xs">Total Clicks</span>}
                          value={adoptionStats.bioarchive.total_clicks}
                          valueStyle={{ color: "#1890ff", fontSize: "1.1rem" }}
                        />
                      </Col>
                      <Col xs={8}>
                        <Statistic
                          title={<span className="text-xs">Upvotes</span>}
                          value={adoptionStats.bioarchive.upvotes}
                          valueStyle={{ color: "#ff4d4f", fontSize: "1.1rem" }}
                        />
                      </Col>
                    </Row>
                    <div className="mt-3">
                      <div className="flex justify-between mb-1">
                        <Text className="text-xs">Users who tried BioArchive</Text>
                        <Tag color={adoptionTagColor(adoptionStats.bioarchive.percentage_of_users)}>
                          {adoptionStats.bioarchive.percentage_of_users}%
                        </Tag>
                      </div>
                      <Progress
                        percent={adoptionStats.bioarchive.percentage_of_users}
                        showInfo={false}
                        strokeColor={adoptionColor(adoptionStats.bioarchive.percentage_of_users)}
                        size="small"
                      />
                    </div>
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <Space>
                        <TeamOutlined style={{ color: "#722ed1" }} />
                        <span className="text-xs sm:text-sm">Upvote Recommendations Setting</span>
                      </Space>
                    }
                  >
                    <Row gutter={[8, 8]}>
                      <Col xs={12}>
                        <Statistic
                          title={<span className="text-xs">Enabled</span>}
                          value={adoptionStats.feature_adoption.upvote_recommendations.enabled}
                          valueStyle={{ color: "#52c41a", fontSize: "1.1rem" }}
                        />
                      </Col>
                      <Col xs={12}>
                        <Statistic
                          title={<span className="text-xs">Disabled</span>}
                          value={adoptionStats.feature_adoption.upvote_recommendations.disabled}
                          valueStyle={{ color: "#ff4d4f", fontSize: "1.1rem" }}
                        />
                      </Col>
                    </Row>
                    <div className="mt-3">
                      <div className="flex justify-between mb-1">
                        <Text className="text-xs">Users with upvote recs enabled</Text>
                        <Tag color="green">
                          {adoptionStats.feature_adoption.upvote_recommendations.percentage_enabled}%
                        </Tag>
                      </div>
                      <Progress
                        percent={adoptionStats.feature_adoption.upvote_recommendations.percentage_enabled}
                        showInfo={false}
                        strokeColor="#52c41a"
                        size="small"
                      />
                    </div>
                    <Divider className="my-3" />
                    <Row gutter={[8, 8]}>
                      <Col xs={12}>
                        <Statistic
                          title={<span className="text-xs">Journal Follow Avg</span>}
                          value={adoptionStats.feature_adoption.journal_follows.avg_per_user}
                          suffix="per user"
                          valueStyle={{ fontSize: "1rem" }}
                        />
                      </Col>
                      <Col xs={12}>
                        <Statistic
                          title={<span className="text-xs">Bookmark Folders Avg</span>}
                          value={adoptionStats.feature_adoption.bookmarks.avg_folders}
                          suffix="per user"
                          valueStyle={{ fontSize: "1rem" }}
                        />
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            </>
          ) : null}
        </>
      )}

      {/* ── Top Content Tables ──────────────────────────────────────────────── */}
      <Row gutter={[8, 8]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space className="text-xs sm:text-sm">
                <BookOutlined style={{ color: "#13c2c2", fontSize: isSmallMobile ? "14px" : undefined }} />
                <span>Top Journals by Articles</span>
              </Space>
            }
          >
            {isMobile ? (
              <List
                dataSource={stats?.journals.top_journals || []}
                size="small"
                style={{ maxHeight: isSmallMobile ? "250px" : "300px", overflowY: "auto" }}
                renderItem={(journal: { journal: string; article_count: number }) => (
                  <List.Item className="px-0! py-1.5 sm:py-2!">
                    <div className="w-full flex justify-between items-center gap-2">
                      <Text className="text-xs flex-1" ellipsis={{ tooltip: journal.journal }}>
                        {journal.journal}
                      </Text>
                      <Tag color="blue" className="text-xs m-0" style={{ fontSize: isSmallMobile ? "10px" : undefined, padding: isSmallMobile ? "0 4px" : undefined }}>
                        {journal.article_count}
                      </Tag>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Table
                dataSource={stats?.journals.top_journals || []}
                columns={journalColumns}
                pagination={false}
                size="small"
                rowKey="journal"
                scroll={{ y: 300 }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space className="text-xs sm:text-sm">
                <LikeOutlined style={{ color: "#ff4d4f", fontSize: isSmallMobile ? "14px" : undefined }} />
                <span>Most Upvoted Articles</span>
              </Space>
            }
          >
            {isMobile ? (
              <List
                dataSource={stats?.engagement.top_upvoted_articles || []}
                size="small"
                style={{ maxHeight: isSmallMobile ? "250px" : "300px", overflowY: "auto" }}
                renderItem={(article: { id: number; title: string; journal: string; upvotes: number }) => (
                  <List.Item className="px-0! py-1.5 sm:py-2!">
                    <div className="w-full">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <Text className="text-xs flex-1" ellipsis={{ tooltip: article.title }} style={{ fontSize: isSmallMobile ? "11px" : undefined }}>
                          {article.title}
                        </Text>
                        <Tag color="red" className="text-xs m-0 shrink-0" style={{ fontSize: isSmallMobile ? "10px" : undefined, padding: isSmallMobile ? "0 4px" : undefined }}>
                          {article.upvotes}
                        </Tag>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Table
                dataSource={stats?.engagement.top_upvoted_articles || []}
                columns={upvotedColumns}
                pagination={false}
                size="small"
                rowKey="id"
                scroll={{ y: 300 }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[8, 8]} className="mt-2 sm:mt-3 md:mt-4">
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space className="text-xs sm:text-sm">
                <CommentOutlined style={{ color: "#52c41a", fontSize: isSmallMobile ? "14px" : undefined }} />
                <span>Most Discussed Articles</span>
              </Space>
            }
          >
            {isMobile ? (
              <List
                dataSource={stats?.engagement.top_commented_articles || []}
                size="small"
                style={{ maxHeight: isSmallMobile ? "250px" : "300px", overflowY: "auto" }}
                renderItem={(article: { id: number; title: string; journal: string; comments: number }) => (
                  <List.Item className="px-0! py-1.5 sm:py-2!">
                    <div className="w-full">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <Text className="text-xs flex-1" ellipsis={{ tooltip: article.title }} style={{ fontSize: isSmallMobile ? "11px" : undefined }}>
                          {article.title}
                        </Text>
                        <Tag color="green" className="text-xs m-0 shrink-0" style={{ fontSize: isSmallMobile ? "10px" : undefined, padding: isSmallMobile ? "0 4px" : undefined }}>
                          {article.comments}
                        </Tag>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Table
                dataSource={stats?.engagement.top_commented_articles || []}
                columns={commentedColumns}
                pagination={false}
                size="small"
                rowKey="id"
                scroll={{ y: 300 }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space className="text-xs sm:text-sm">
                <FileTextOutlined style={{ color: "#1890ff", fontSize: isSmallMobile ? "14px" : undefined }} />
                <span>Publication Type Distribution</span>
              </Space>
            }
          >
            <div style={{ maxHeight: isSmallMobile ? "250px" : "300px", overflowY: "auto" }}>
              {stats?.articles.publication_types &&
                Object.entries(stats.articles.publication_types)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const total = stats.articles.total;
                    const percentage = Math.round((count / total) * 100);
                    return (
                      <div key={type} className="mb-2 sm:mb-3 md:mb-4">
                        <div className="flex justify-between mb-1">
                          <Text strong className="text-xs sm:text-sm" style={{ fontSize: isSmallMobile ? "11px" : undefined }}>
                            {type || "Unspecified"}
                          </Text>
                          <Tag color="blue" className="text-xs" style={{ fontSize: isSmallMobile ? "10px" : undefined, padding: isSmallMobile ? "0 4px" : undefined }}>
                            {count} ({percentage}%)
                          </Tag>
                        </div>
                        <Progress percent={percentage} showInfo={false} strokeColor="#1890ff" size={isSmallMobile ? "small" : "default"} />
                      </div>
                    );
                  })}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Metrics;
