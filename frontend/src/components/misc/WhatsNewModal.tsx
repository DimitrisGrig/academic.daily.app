import { useEffect, useState } from "react";
import { Modal, Typography } from "antd";
import { BulbOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import axiosInstance from "../../lib/axios";

const { Title, Text } = Typography;

interface Announcement {
  id: number;
  title: string;
  bullets: string[];
  created_at: string | null;
}

/**
 * Shows the latest unseen feature announcement to logged-in users.
 * Automatically fetches on mount; dismisses and marks as seen on close.
 */
const WhatsNewModal = () => {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: announcement } = useQuery<Announcement | null>({
    queryKey: ["unseenAnnouncement"],
    queryFn: async () => {
      const res = await axiosInstance.get("/admin/announcements/unseen");
      return res.data || null;
    },
    enabled: !!isSignedIn,
    staleTime: 10 * 60 * 1000, // don't re-fetch for 10 min
    refetchOnWindowFocus: false,
  });

  const markSeenMutation = useMutation({
    mutationFn: async (id: number) => {
      await axiosInstance.post(`/admin/announcements/${id}/seen`);
    },
    onSuccess: () => {
      queryClient.setQueryData(["unseenAnnouncement"], null);
    },
  });

  // Open the modal when a new unseen announcement arrives
  useEffect(() => {
    if (announcement?.id) {
      setOpen(true);
    }
  }, [announcement?.id]);

  const handleClose = () => {
    setOpen(false);
    if (announcement?.id) {
      markSeenMutation.mutate(announcement.id);
    }
  };

  if (!announcement) return null;

  return (
    <Modal open={open} onCancel={handleClose} footer={null} centered width={480} styles={{ body: { padding: "8px 4px 16px" } }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
          <BulbOutlined className="text-violet-600 text-lg" />
        </div>
        <div>
          <Title level={4} className="m-0!">
            {announcement.title}
          </Title>
          {announcement.created_at && (
            <Text className="text-xs text-gray-400">
              {new Date(announcement.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
          )}
        </div>
      </div>

      <ul className="space-y-2 pl-1 mb-0">
        {announcement.bullets.map((bullet, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
            <Text className="text-sm text-gray-700">{bullet}</Text>
          </li>
        ))}
      </ul>
    </Modal>
  );
};

export default WhatsNewModal;
