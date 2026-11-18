import { useState, useEffect } from "react";
import { Modal, Input, Button, message, Tag, Switch } from "antd";
import { TeamOutlined, PlusOutlined, LockOutlined, GlobalOutlined } from "@ant-design/icons";
import axiosInstance from "../../lib/axios";
import type { Group } from "../../types/api";

interface NewGroupModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: (groupKey?: string) => void;
  editingGroup?: Group | null;
}

const GROUP_ICONS = [
  "👥",
  "🔬",
  "🧬",
  "🧪",
  "🩺",
  "🫀",
  "🧠",
  "💊",
  "🦷",
  "👁️",
  "🦴",
  "🩸",
  "📚",
  "📖",
  "🎓",
  "🏆",
  "🎯",
  "💡",
  "🔭",
  "🌐",
  "⚗️",
  "🧫",
  "🔩",
  "📊",
  "🗂️",
  "📝",
  "✏️",
  "🖊️",
  "🔖",
  "📌",
];

const NewGroupModal: React.FC<NewGroupModalProps> = ({ open, onCancel, onOk, editingGroup }) => {
  const [groupName, setGroupName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("👥");
  const [isPublic, setIsPublic] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingGroup) {
        setGroupName(editingGroup.name);
        setSelectedIcon(editingGroup.icon);
        setIsPublic(editingGroup.is_public ?? false);
        setTags(editingGroup.tags ?? []);
        setTagInput("");
        setEmails([]);
        setEmailInput("");
      } else {
        setGroupName("");
        setSelectedIcon("👥");
        setIsPublic(false);
        setTags([]);
        setTagInput("");
        setEmails([]);
        setEmailInput("");
      }
    }
  }, [open, editingGroup?.key]);

  const MAX_TAGS = 10;

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      message.warning("Tag already added");
      return;
    }
    if (tags.length >= MAX_TAGS) {
      message.warning(`Maximum of ${MAX_TAGS} tags allowed`);
      return;
    }
    setTags(prev => [...prev, trimmed]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const addEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      message.warning("Please enter a valid email address");
      return;
    }
    if (emails.includes(trimmed)) {
      message.warning("Email already added");
      return;
    }
    setEmails(prev => [...prev, trimmed]);
    setEmailInput("");
  };

  const removeEmail = (email: string) => {
    setEmails(prev => prev.filter(e => e !== email));
  };

  const handleOk = async () => {
    if (!groupName.trim()) {
      message.warning("Please enter a group name");
      return;
    }

    setLoading(true);
    try {
      if (editingGroup) {
        // Update name/icon
        await axiosInstance.post("/groups/update_group", {
          key: editingGroup.key,
          name: groupName.trim(),
          icon: selectedIcon,
          is_public: isPublic,
          tags,
        });

        // Invite new members if any
        if (emails.length > 0) {
          const response = await axiosInstance.post("/groups/invite_members", {
            group_key: editingGroup.key,
            emails,
          });
          const { not_found } = response.data;
          if (not_found?.length > 0) {
            message.warning(`Not found on the platform: ${not_found.join(", ")}`);
          } else {
            message.success("Invites sent successfully");
          }
        } else {
          message.success("Group updated successfully");
        }

        onOk(editingGroup.key);
      } else {
        const response = await axiosInstance.post("/groups/create_group", {
          name: groupName.trim(),
          icon: selectedIcon,
          invite_emails: emails,
          is_public: isPublic,
          tags,
        });

        const { not_found } = response.data;
        if (not_found?.length > 0) {
          message.warning(`Group created. Not found on the platform: ${not_found.join(", ")}`);
        } else {
          message.success("Group created successfully");
        }

        onOk(response.data.group.key);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Failed to save group. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-lg font-semibold">
          <TeamOutlined /> {editingGroup ? "Edit group" : "New group"}
        </div>
      }
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      width={560}
      style={{ top: 40 }}
      confirmLoading={loading}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" loading={loading} onClick={handleOk}>
          {editingGroup ? "Save changes" : "Create group"}
        </Button>,
      ]}
    >
      <div className="flex flex-col gap-5 mt-4">
        {/* Icon picker */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Icon</p>
          <div className="flex flex-wrap gap-2">
            {GROUP_ICONS.map(icon => (
              <button
                key={icon}
                onClick={() => setSelectedIcon(icon)}
                className={`text-xl w-9 h-9 flex items-center justify-center rounded-lg border transition-all cursor-pointer
                  ${
                    selectedIcon === icon ? "border-sky-500 bg-sky-50 scale-110 shadow-sm" : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                  }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Group name */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">Group name</p>
          <Input
            prefix={<span className="mr-1">{selectedIcon}</span>}
            placeholder="e.g. Cardiology Journal Club"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            maxLength={60}
            showCount
            onPressEnter={handleOk}
            autoFocus
          />
        </div>

        {/* Visibility */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Visibility</p>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
            {isPublic ? <GlobalOutlined className="text-sky-500 text-base" /> : <LockOutlined className="text-gray-500 text-base" />}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">{isPublic ? "Public" : "Private"}</p>
              <p className="text-xs text-gray-400">
                {isPublic
                  ? "Anyone on the platform can discover and request to join this group."
                  : "Only invited members can see and join this group."}
              </p>
            </div>
            <Switch checked={isPublic} onChange={setIsPublic} checkedChildren={<GlobalOutlined />} unCheckedChildren={<LockOutlined />} />
          </div>
        </div>

        {/* Tags */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            Tags
            <span className="text-gray-400 font-normal ml-1">(optional, max {MAX_TAGS})</span>
          </p>
          <p className="text-xs text-gray-400 mb-2">Keywords that describe your group's research focus. Press Enter or comma to add.</p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <Tag key={tag} closable onClose={() => removeTag(tag)} className="rounded-full! px-2! text-sm!" color="orange">
                  #{tag}
                </Tag>
              ))}
            </div>
          )}
          <Input.Search
            placeholder="e.g. cardiology, machine learning, genomics"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            enterButton={
              <Button icon={<PlusOutlined />} disabled={tags.length >= MAX_TAGS}>
                Add
              </Button>
            }
            onSearch={addTag}
            disabled={tags.length >= MAX_TAGS}
          />
          {tags.length >= MAX_TAGS && <p className="text-xs text-orange-400 mt-1">Maximum of {MAX_TAGS} tags reached.</p>}
        </div>

        {/* Invite by email */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            Invite members by email
            <span className="text-gray-400 font-normal ml-1">(optional)</span>
          </p>
          <p className="text-xs text-gray-400 mb-2">Only users already registered on the platform can be invited. Press Enter or comma to add.</p>

          {/* Email tags */}
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {emails.map(email => (
                <Tag key={email} closable onClose={() => removeEmail(email)} className="rounded-full! px-2! text-sm!" color="blue">
                  {email}
                </Tag>
              ))}
            </div>
          )}

          <Input.Search
            placeholder="colleague@university.edu"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === ",") {
                e.preventDefault();
                addEmail();
              }
            }}
            enterButton={<Button icon={<PlusOutlined />}>Add</Button>}
            onSearch={addEmail}
          />
        </div>
      </div>
    </Modal>
  );
};

export default NewGroupModal;
