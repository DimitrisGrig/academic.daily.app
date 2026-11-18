import { useState } from "react";
import { Modal, List, Avatar, Button, Empty, Spin, message, Tag } from "antd";
import { TeamOutlined, CheckOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import axiosInstance from "../../lib/axios";
import { type Group, type GroupsResponse } from "../../types/api";

interface AddToGroupModalProps {
  articleId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

function AddToGroupModal({ articleId, isOpen, onClose }: AddToGroupModalProps) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await axiosInstance.get("/groups/get_groups");
      return res.data as GroupsResponse;
    },
    enabled: isOpen,
  });

  const groups: Group[] = groupsData?.groups ?? [];

  const handleShare = async () => {
    if (!selectedGroupKey || !articleId) return;
    setIsSharing(true);
    const sharedByName =
      user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.primaryEmailAddress?.emailAddress || "";
    try {
      await axiosInstance.post("/groups/share_article", {
        group_key: selectedGroupKey,
        article_id: articleId,
        shared_by_name: sharedByName,
      });
      queryClient.invalidateQueries({ queryKey: ["groupSharedArticles"] });
      const groupName = groups.find(g => g.key === selectedGroupKey)?.name ?? "the group";
      message.success(`Article shared to "${groupName}"!`);
      handleClose();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "Failed to share article");
    } finally {
      setIsSharing(false);
    }
  };

  const handleClose = () => {
    setSelectedGroupKey(null);
    onClose();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <TeamOutlined className="text-sky-500!" />
          <span>Share to Group</span>
        </div>
      }
      open={isOpen}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          Cancel
        </Button>,
        <Button
          key="share"
          type="primary"
          disabled={!selectedGroupKey}
          loading={isSharing}
          onClick={handleShare}
          className="bg-sky-600! border-sky-600!"
        >
          Share
        </Button>,
      ]}
      width={420}
    >
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : groups.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="You don't have any groups yet. Create one from the sidebar." className="py-6!" />
      ) : (
        <div>
          <p className="text-gray-500 text-sm mb-3">Select a group to share this article with:</p>
          <List
            split={false}
            dataSource={groups}
            renderItem={group => {
              const isSelected = selectedGroupKey === group.key;
              return (
                <List.Item
                  key={group.key}
                  onClick={() => setSelectedGroupKey(group.key)}
                  className={`cursor-pointer mb-3! rounded-lg! px-3! transition-colors ${
                    isSelected ? "bg-sky-50! border border-sky-500!" : "hover:bg-sky-100!"
                  }`}
                >
                  <List.Item.Meta
                    avatar={<Avatar className="bg-sky-100! text-sky-600! text-lg!">{group.icon || "👥"}</Avatar>}
                    title={<span className={`font-medium ${isSelected ? "text-sky-600" : ""}`}>{group.name}</span>}
                    description={
                      <span className="text-xs text-gray-400">
                        {group.members?.length ?? 0} member{(group.members?.length ?? 0) !== 1 ? "s" : ""}
                      </span>
                    }
                  />
                  {isSelected && (
                    <Tag color="blue" icon={<CheckOutlined />}>
                      Selected
                    </Tag>
                  )}
                </List.Item>
              );
            }}
          />
        </div>
      )}
    </Modal>
  );
}

export default AddToGroupModal;
