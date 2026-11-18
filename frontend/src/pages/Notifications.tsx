import { useState } from "react";
import { Card, List, Button, Empty, Typography, Tag, Spin, message, Popconfirm } from "antd";
import { BellOutlined, CheckOutlined, DeleteOutlined, ArrowLeftOutlined, CheckCircleOutlined, TeamOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

interface NotificationMetadata {
  group_key?: string;
  group_name?: string;
  group_icon?: string;
  inviter_name?: string;
  [key: string]: unknown;
}

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  notification_type: string | null;
  notification_metadata: NotificationMetadata | null;
  created_at: string;
}

function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", filter],
    queryFn: async () => {
      const response = await axiosInstance.get("/notifications/", {
        params: { unread_only: filter === "unread" },
      });
      return response.data as Notification[];
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationIds: number[]) => {
      await axiosInstance.post("/notifications/mark-as-read", {
        notification_ids: notificationIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      message.success("Notification marked as read");
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await axiosInstance.post("/notifications/mark-all-as-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      message.success("All notifications marked as read");
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await axiosInstance.delete(`/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      message.success("Notification deleted");
    },
  });

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate([notificationId]);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (notificationId: number) => {
    deleteNotificationMutation.mutate(notificationId);
  };

  // ─── Group invite handlers ────────────────────────────────────────────────
  const [processingInvite, setProcessingInvite] = useState<number | null>(null);

  const handleAcceptGroupInvite = async (notification: Notification) => {
    const groupKey = notification.notification_metadata?.group_key;
    if (!groupKey) return;
    setProcessingInvite(notification.id);
    try {
      await axiosInstance.post("/groups/accept_invite", { group_key: groupKey });
      await axiosInstance.delete(`/notifications/${notification.id}`);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["groupPendingInvites"] });
      message.success(`You joined "${notification.notification_metadata?.group_name || "the group"}"!`);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Failed to accept invite");
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleDeclineGroupInvite = async (notification: Notification) => {
    const groupKey = notification.notification_metadata?.group_key;
    if (!groupKey) return;
    setProcessingInvite(notification.id);
    try {
      await axiosInstance.post("/groups/decline_invite", { group_key: groupKey });
      await axiosInstance.delete(`/notifications/${notification.id}`);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["groupPendingInvites"] });
      message.info("Invite declined");
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Failed to decline invite");
    } finally {
      setProcessingInvite(null);
    }
  };

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  // Format relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/MainFeed")} type="text" size="large" />
              <div>
                <Title level={3} className="mb-0!">
                  Notifications
                </Title>
                {unreadCount > 0 && (
                  <Text type="secondary" className="text-sm!">
                    {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
                  </Text>
                )}
              </div>
            </div>

            {unreadCount > 0 && (
              <Button icon={<CheckCircleOutlined />} onClick={handleMarkAllAsRead} loading={markAllAsReadMutation.isPending}>
                Mark all as read
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Filter Tabs */}
        <div className="mb-4 flex gap-2">
          <Button type={filter === "all" ? "primary" : "default"} onClick={() => setFilter("all")}>
            All
          </Button>
          <Button type={filter === "unread" ? "primary" : "default"} onClick={() => setFilter("unread")}>
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </Button>
        </div>

        {/* Notifications List */}
        <Card>
          {isLoading ? (
            <div className="text-center py-12">
              <Spin size="large" />
            </div>
          ) : notifications && notifications.length > 0 ? (
            <List
              dataSource={notifications}
              renderItem={notification => {
                const isGroupInvite = notification.notification_type === "group_invite";
                const meta = notification.notification_metadata;
                const isProcessing = processingInvite === notification.id;

                return (
                  <List.Item
                    key={notification.id}
                    className={`${!notification.is_read ? (isGroupInvite ? "bg-orange-50!" : "bg-blue-50!") : ""} hover:bg-gray-50! transition-colors`}
                    actions={
                      isGroupInvite
                        ? [] // no standard actions for group invites — inline buttons handle it
                        : [
                            !notification.is_read && (
                              <Button
                                type="text"
                                icon={<CheckOutlined />}
                                onClick={() => handleMarkAsRead(notification.id)}
                                loading={markAsReadMutation.isPending}
                                title="Mark as read"
                              />
                            ),
                            <Popconfirm
                              title="Delete notification"
                              description="Are you sure you want to delete this notification?"
                              onConfirm={() => handleDelete(notification.id)}
                              okText="Yes"
                              cancelText="No"
                            >
                              <Button type="text" danger icon={<DeleteOutlined />} loading={deleteNotificationMutation.isPending} title="Delete" />
                            </Popconfirm>,
                          ]
                    }
                  >
                    <List.Item.Meta
                      avatar={
                        isGroupInvite ? (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-100 text-orange-600 text-xl">
                            {meta?.group_icon || "👥"}
                          </div>
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              !notification.is_read ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-600"
                            }`}
                          >
                            <BellOutlined className="text-lg!" />
                          </div>
                        )
                      }
                      title={
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isGroupInvite && (
                              <Tag icon={<TeamOutlined />} color="orange" className="mr-0!">
                                Group invite
                              </Tag>
                            )}
                            <Text className={!notification.is_read ? "font-semibold!" : ""}>{notification.message}</Text>
                            {!notification.is_read && !isGroupInvite && (
                              <Tag color="blue" className="ml-1!">
                                New
                              </Tag>
                            )}
                          </div>

                          {/* Accept / Decline buttons for group invites */}
                          {isGroupInvite && (
                            <div className="flex gap-2 mt-1">
                              <Button
                                type="primary"
                                size="small"
                                className="bg-sky-600! border-sky-600! hover:bg-sky-700!"
                                loading={isProcessing}
                                onClick={() => handleAcceptGroupInvite(notification)}
                              >
                                Accept
                              </Button>
                              <Button size="small" danger loading={isProcessing} onClick={() => handleDeclineGroupInvite(notification)}>
                                Decline
                              </Button>
                            </div>
                          )}
                        </div>
                      }
                      description={
                        <Text type="secondary" className="text-xs!">
                          {getRelativeTime(notification.created_at)}
                        </Text>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text className="text-gray-500!">{filter === "unread" ? "No unread notifications" : "No notifications yet"}</Text>
                </div>
              }
              className="py-12!"
            />
          )}
        </Card>
      </div>
    </div>
  );
}

export default Notifications;
