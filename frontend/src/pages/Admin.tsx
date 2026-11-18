import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import { Card, Typography, Tag, Table, Badge, Rate, Empty, Input, Button, Switch, Popconfirm, message } from "antd";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  ClockCircleOutlined,
  BookOutlined,
  StarOutlined,
  MailOutlined,
  UserOutlined,
  SettingOutlined,
  LoginOutlined,
  BulbOutlined,
  PlusOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import axiosInstance from "../lib/axios";
import Loading from "../components/misc/Loading";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useState, useEffect } from "react";

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

const ADMIN_CLERK_USER_ID = import.meta.env.VITE_ADMIN_CLERK_USER_ID;

interface JournalSuggestion {
  id: number;
  clerk_user_id: string;
  user_email: string;
  first_name: string | null;
  last_name: string | null;
  journal_name_or_issn: string;
  created_at: string | null;
}

interface TestimonialItem {
  id: number;
  clerk_user_id: string;
  user_email: string;
  user_name: string;
  rating: number;
  testimonial_text: string;
  created_at: string | null;
}

interface RecentLogin {
  email: string;
  first_name: string | null;
  last_name: string | null;
  last_seen: string | null;
  request_count: number;
  period: "24h" | "48h";
}

interface DailyActiveUsers {
  date: string;
  active_users: number;
}

interface AdminDashboard {
  journal_suggestions: JournalSuggestion[];
  testimonials: TestimonialItem[];
  last_update: string | null;
  recent_logins: RecentLogin[];
}

interface FeatureAnnouncementAdmin {
  id: number;
  title: string;
  bullets: string[];
  is_active: boolean;
  created_at: string | null;
}

function Admin() {
  const { user, isLoaded } = useUser();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auth guard: only allow the admin user
  if (!isLoaded) return <Loading />;
  if (user?.id !== ADMIN_CLERK_USER_ID) return <Navigate to="/MainFeed" replace />;

  // Fetch admin dashboard data
  const { data, isLoading } = useQuery<AdminDashboard>({
    queryKey: ["adminDashboard"],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/dashboard");
      return response.data;
    },
    enabled: user?.id === ADMIN_CLERK_USER_ID,
  });

  const { data: monthlyActiveUsers = [] } = useQuery<DailyActiveUsers[]>({
    queryKey: ["adminMonthlyActiveUsers"],
    queryFn: async () => (await axiosInstance.get("/admin/monthly-active-users")).data,
    enabled: user?.id === ADMIN_CLERK_USER_ID,
  });

  // ── Feature Announcements CRUD ──
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newBullets, setNewBullets] = useState<string[]>([""]);

  const { data: announcements = [] } = useQuery<FeatureAnnouncementAdmin[]>({
    queryKey: ["adminAnnouncements"],
    queryFn: async () => (await axiosInstance.get("/admin/announcements")).data,
    enabled: user?.id === ADMIN_CLERK_USER_ID,
  });

  const createMutation = useMutation({
    mutationFn: async (body: { title: string; bullets: string[] }) => {
      return (await axiosInstance.post("/admin/announcements", body)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      setNewTitle("");
      setNewBullets([""]);
      message.success("Announcement created");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await axiosInstance.delete(`/admin/announcements/${id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      message.success("Announcement deleted");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await axiosInstance.patch(`/admin/announcements/${id}/toggle`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
    },
  });

  const handleAddBullet = () => setNewBullets([...newBullets, ""]);
  const handleRemoveBullet = (idx: number) => setNewBullets(newBullets.filter((_, i) => i !== idx));
  const handleBulletChange = (idx: number, value: string) => setNewBullets(newBullets.map((b, i) => (i === idx ? value : b)));

  const handleCreateAnnouncement = () => {
    const bullets = newBullets.map(b => b.trim()).filter(Boolean);
    if (!newTitle.trim() || bullets.length === 0) {
      message.warning("Please enter a title and at least one bullet point");
      return;
    }
    createMutation.mutate({ title: newTitle.trim(), bullets });
  };

  if (isLoading) return <Loading />;

  const suggestionColumns: ColumnsType<JournalSuggestion> = [
    {
      title: "#",
      key: "index",
      width: 50,
      render: (_: unknown, __: JournalSuggestion, index: number) => <Text className="text-xs text-gray-400">{index + 1}</Text>,
    },
    {
      title: "Journal",
      dataIndex: "journal_name_or_issn",
      key: "journal_name_or_issn",
      ellipsis: true,
      render: (text: string) => (
        <Text strong className="text-sm">
          {text}
        </Text>
      ),
    },
    {
      title: "User",
      key: "user",
      ellipsis: true,
      responsive: ["md" as const],
      render: (_: unknown, record: JournalSuggestion) => {
        const name = [record.first_name, record.last_name].filter(Boolean).join(" ");
        return (
          <div>
            {name && (
              <Text strong className="text-sm block">
                {name}
              </Text>
            )}
            <span className="flex items-center gap-1">
              <MailOutlined className="text-gray-400 text-xs" />
              <Text className="text-xs">{record.user_email}</Text>
            </span>
          </div>
        );
      },
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: isMobile ? 80 : 160,
      render: (date: string | null) =>
        date ? <span className="text-xs text-gray-500">{isMobile ? dayjs(date).fromNow() : dayjs(date).format("DD MMM YYYY, HH:mm")}</span> : "—",
    },
  ];

  const testimonialColumns: ColumnsType<TestimonialItem> = [
    {
      title: "#",
      key: "index",
      width: 50,
      render: (_: unknown, __: TestimonialItem, index: number) => <Text className="text-xs text-gray-400">{index + 1}</Text>,
    },
    {
      title: "User",
      key: "user",
      width: 180,
      render: (_: unknown, record: TestimonialItem) => (
        <div>
          <div className="flex items-center gap-1">
            <UserOutlined className="text-gray-400 text-xs" />
            <Text strong className="text-sm">
              {record.user_name || "Anonymous"}
            </Text>
          </div>
          <Text className="text-xs text-gray-400">{record.user_email}</Text>
        </div>
      ),
    },
    {
      title: "Rating",
      dataIndex: "rating",
      key: "rating",
      width: 140,
      render: (rating: number) => <Rate disabled defaultValue={rating} className="text-sm!" />,
    },
    {
      title: "Testimonial",
      dataIndex: "testimonial_text",
      key: "testimonial_text",
      ellipsis: true,
      render: (text: string) => (
        <Paragraph className="m-0! text-sm" ellipsis={{ rows: 2, expandable: true, symbol: "more" }}>
          {text}
        </Paragraph>
      ),
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: isMobile ? 80 : 160,
      render: (date: string | null) =>
        date ? <span className="text-xs text-gray-500">{isMobile ? dayjs(date).fromNow() : dayjs(date).format("DD MMM YYYY, HH:mm")}</span> : "—",
    },
  ];

  const newSuggestionsCount = data?.journal_suggestions.filter(s => s.created_at && dayjs().diff(dayjs(s.created_at), "day") <= 7).length || 0;

  const newTestimonialsCount = data?.testimonials.filter(t => t.created_at && dayjs().diff(dayjs(t.created_at), "day") <= 7).length || 0;

  const logins24h = data?.recent_logins.filter(l => l.period === "24h") || [];
  const logins48h = data?.recent_logins.filter(l => l.period === "48h") || [];

  const recentLoginColumns: ColumnsType<RecentLogin> = [
    {
      title: "#",
      key: "index",
      width: 50,
      render: (_: unknown, __: RecentLogin, index: number) => <Text className="text-xs text-gray-400">{index + 1}</Text>,
    },
    {
      title: "User",
      key: "user",
      ellipsis: true,
      render: (_: unknown, record: RecentLogin) => {
        const name = [record.first_name, record.last_name].filter(Boolean).join(" ");
        return (
          <div>
            {name && (
              <Text strong className="text-sm block">
                {name}
              </Text>
            )}
            <span className="flex items-center gap-1">
              <MailOutlined className="text-gray-400 text-xs" />
              <Text className="text-xs text-gray-500">{record.email}</Text>
            </span>
          </div>
        );
      },
    },
    {
      title: "Activity",
      key: "period",
      width: 100,
      render: (_: unknown, record: RecentLogin) => (
        <Tag color={record.period === "24h" ? "green" : "orange"} className="text-xs">
          {record.period === "24h" ? "Last 24h" : "24–48h"}
        </Tag>
      ),
    },
    {
      title: "Requests",
      dataIndex: "request_count",
      key: "request_count",
      width: 90,
      render: (count: number) => <Tag className="text-xs">{count}</Tag>,
    },
    {
      title: "Last seen",
      dataIndex: "last_seen",
      key: "last_seen",
      width: isMobile ? 80 : 160,
      render: (date: string | null) =>
        date ? <span className="text-xs text-gray-500">{isMobile ? dayjs(date).fromNow() : dayjs(date).format("DD MMM YYYY, HH:mm")}</span> : "—",
    },
  ];

  return (
    <div className="p-2 sm:p-3 md:p-6 bg-gray-100 min-h-screen max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6 px-1">
        <Title level={2} className="m-0! flex! items-center! gap-2">
          <SettingOutlined className="text-violet-600!" />
          Admin Dashboard
        </Title>
        <Text type="secondary" className="text-xs sm:text-sm! block mt-1">
          Platform administration and notifications
        </Text>

        {/* Last Update Time */}
        {data?.last_update && (
          <div className="mt-3">
            <Tag
              icon={<ClockCircleOutlined />}
              className="rounded-md! py-1! bg-slate-500! text-white! text-xs sm:text-sm!"
              style={{ padding: "4px 12px" }}
            >
              Last DB update: {dayjs(data.last_update).format("DD MMM YYYY, HH:mm")}
            </Tag>
            <Text className="ml-2 text-xs text-gray-400">({dayjs(data.last_update).fromNow()})</Text>
          </div>
        )}
      </div>

      {/* Notification Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Card className="border-l-4 border-l-emerald-500!">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LoginOutlined className="text-2xl text-emerald-500" />
              <div>
                <Text className="text-sm text-gray-500 block">Recent Logins</Text>
                <Title level={3} className="m-0!">
                  {data?.recent_logins.length || 0}
                </Title>
              </div>
            </div>
            {logins24h.length > 0 && <Badge count={`${logins24h.length} today`} style={{ backgroundColor: "#10b981" }} />}
          </div>
        </Card>

        <Card className="border-l-4 border-l-blue-500!">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOutlined className="text-2xl text-blue-500" />
              <div>
                <Text className="text-sm text-gray-500 block">Journal Suggestions</Text>
                <Title level={3} className="m-0!">
                  {data?.journal_suggestions.length || 0}
                </Title>
              </div>
            </div>
            {newSuggestionsCount > 0 && <Badge count={`${newSuggestionsCount} new`} style={{ backgroundColor: "#1890ff" }} />}
          </div>
        </Card>

        <Card className="border-l-4 border-l-amber-500!">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StarOutlined className="text-2xl text-amber-500" />
              <div>
                <Text className="text-sm text-gray-500 block">Testimonials</Text>
                <Title level={3} className="m-0!">
                  {data?.testimonials.length || 0}
                </Title>
              </div>
            </div>
            {newTestimonialsCount > 0 && <Badge count={`${newTestimonialsCount} new`} style={{ backgroundColor: "#f59e0b" }} />}
          </div>
        </Card>
      </div>

      {/* Monthly Active Users Chart */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <LoginOutlined className="text-violet-500" />
            Daily Active Users — Last 60 Days
            <Tag color="purple" className="text-xs">
              {monthlyActiveUsers.reduce((s, d) => Math.max(s, d.active_users), 0)} peak
            </Tag>
          </span>
        }
        className="mb-6"
      >
        {monthlyActiveUsers.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyActiveUsers} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={d => {
                  const dt = new Date(d);
                  return `${dt.getMonth() + 1}/${dt.getDate()}`;
                }}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [value ?? 0, "Active users"]}
                labelFormatter={label => {
                  const dt = new Date(label);
                  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                }}
              />
              <Bar dataKey="active_users" fill="#7c3aed" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty description="No activity data for the past 30 days" />
        )}
      </Card>

      {/* Recent Logins Table */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <LoginOutlined className="text-emerald-500" />
            Recent Logins (48h)
            <Tag color="green" className="text-xs ml-1">
              {logins24h.length} in 24h
            </Tag>
            <Tag color="orange" className="text-xs">
              {logins48h.length} in 24–48h
            </Tag>
          </span>
        }
        className="mb-6"
      >
        {data?.recent_logins.length ? (
          <Table
            dataSource={data.recent_logins}
            columns={recentLoginColumns}
            rowKey="email"
            pagination={{ pageSize: 15 }}
            size="small"
            scroll={{ x: 400 }}
            rowClassName={record => (record.period === "24h" ? "bg-emerald-50!" : "")}
          />
        ) : (
          <Empty description="No logins in the past 48 hours" />
        )}
      </Card>

      {/* Journal Suggestions Table */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <BookOutlined className="text-blue-500" />
            Journal Suggestions
            {newSuggestionsCount > 0 && <Badge count={newSuggestionsCount} size="small" style={{ backgroundColor: "#1890ff" }} />}
          </span>
        }
        className="mb-6"
      >
        {data?.journal_suggestions.length ? (
          <Table
            dataSource={data.journal_suggestions}
            columns={suggestionColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
            scroll={{ x: 400 }}
            rowClassName={record => (record.created_at && dayjs().diff(dayjs(record.created_at), "day") <= 7 ? "bg-blue-50!" : "")}
          />
        ) : (
          <Empty description="No journal suggestions yet" />
        )}
      </Card>

      {/* Testimonials Table */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <StarOutlined className="text-amber-500" />
            Testimonials
            {newTestimonialsCount > 0 && <Badge count={newTestimonialsCount} size="small" style={{ backgroundColor: "#f59e0b" }} />}
          </span>
        }
      >
        {data?.testimonials.length ? (
          <Table
            dataSource={data.testimonials}
            columns={testimonialColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
            scroll={{ x: 500 }}
            rowClassName={record => (record.created_at && dayjs().diff(dayjs(record.created_at), "day") <= 7 ? "bg-amber-50!" : "")}
          />
        ) : (
          <Empty description="No testimonials yet" />
        )}
      </Card>

      {/* Feature Announcements Management */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <BulbOutlined className="text-violet-500" />
            Feature Announcements
            <Tag color="purple" className="text-xs">
              {announcements.filter(a => a.is_active).length} active
            </Tag>
          </span>
        }
        className="mt-6"
      >
        {/* Create new announcement */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Text strong className="block mb-3 text-sm">
            New Announcement
          </Text>
          <Input placeholder="Title (e.g. What's New — March 2026)" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="mb-3" />
          {newBullets.map((bullet, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <span className="text-gray-400 text-xs w-4 shrink-0">•</span>
              <Input
                placeholder={`Bullet point ${idx + 1}`}
                value={bullet}
                onChange={e => handleBulletChange(idx, e.target.value)}
                onPressEnter={() => {
                  if (idx === newBullets.length - 1) handleAddBullet();
                }}
              />
              {newBullets.length > 1 && (
                <MinusCircleOutlined className="text-gray-400 hover:text-red-500 cursor-pointer" onClick={() => handleRemoveBullet(idx)} />
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 mt-3">
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAddBullet}>
              Add bullet
            </Button>
            <Button type="primary" size="small" onClick={handleCreateAnnouncement} loading={createMutation.isPending} className="bg-violet-600!">
              Publish
            </Button>
          </div>
        </div>

        {/* Existing announcements */}
        {announcements.length ? (
          <div className="space-y-3">
            {announcements.map(a => (
              <div
                key={a.id}
                className={`p-4 rounded-lg border ${a.is_active ? "bg-white border-violet-200" : "bg-gray-50 border-gray-200 opacity-60"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Text strong className="text-sm">
                      {a.title}
                    </Text>
                    <Tag color={a.is_active ? "green" : "default"} className="text-xs">
                      {a.is_active ? "Active" : "Inactive"}
                    </Tag>
                    {a.created_at && <Text className="text-xs text-gray-400">{dayjs(a.created_at).format("DD MMM YYYY, HH:mm")}</Text>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch size="small" checked={a.is_active} onChange={() => toggleMutation.mutate(a.id)} />
                    <Popconfirm title="Delete this announcement?" onConfirm={() => deleteMutation.mutate(a.id)} okText="Delete" cancelText="Cancel">
                      <DeleteOutlined className="text-gray-400 hover:text-red-500 cursor-pointer" />
                    </Popconfirm>
                  </div>
                </div>
                <ul className="list-disc pl-5 m-0">
                  {a.bullets.map((b, i) => (
                    <li key={i} className="text-sm text-gray-600">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="No announcements yet" />
        )}
      </Card>
    </div>
  );
}

export default Admin;
