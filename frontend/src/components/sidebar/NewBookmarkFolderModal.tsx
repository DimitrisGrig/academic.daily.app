import { useState, useEffect } from "react";
import { Modal, Input, Button, message } from "antd";
import { FolderOutlined } from "@ant-design/icons";
import axiosInstance from "../../lib/axios";

interface BookmarkFolder {
  key: string;
  name: string;
  icon: string;
}

interface NewBookmarkFolderModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: () => void;
  editingFolder?: BookmarkFolder | null;
}

const NewBookmarkFolderModal: React.FC<NewBookmarkFolderModalProps> = ({ open, onCancel, onOk, editingFolder }) => {
  const [folderName, setFolderName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("📁");

  // Initialize form when modal opens
  useEffect(() => {
    if (open) {
      if (editingFolder) {
        // Editing mode - load existing folder data
        setFolderName(editingFolder.name);
        setSelectedIcon(editingFolder.icon);
      } else {
        // Create mode - reset to defaults
        setFolderName("");
        setSelectedIcon("📁");
      }
    }
  }, [open, editingFolder?.key]);

  const handleOk = async () => {
    try {
      // Validate folder name
      if (!folderName.trim()) {
        message.warning("Please enter a folder name");
        return;
      }

      if (editingFolder) {
        // Update existing folder
        const updateData = {
          key: editingFolder.key,
          name: folderName.trim(),
          icon: selectedIcon,
        };

        await axiosInstance.post("/bookmarks/update_folder", updateData);
        message.success("Folder updated successfully");
      } else {
        // Create new folder
        const folderData = {
          name: folderName.trim(),
          icon: selectedIcon,
        };

        await axiosInstance.post("/bookmarks/create_folder", folderData);
        message.success("Folder created successfully");
      }

      // Call parent onOk callback (this will close the modal and refresh)
      onOk();
    } catch (error: any) {
      console.error(`Error ${editingFolder ? "updating" : "creating"} folder:`, error);
      message.error(error?.response?.data?.detail || `Failed to ${editingFolder ? "update" : "create"} folder. Please try again.`);
    }
  };

  const handleDelete = async () => {
    if (!editingFolder) return;

    try {
      await axiosInstance.post("/bookmarks/delete_folder", { key: editingFolder.key });
      message.success("Folder deleted successfully");

      // Call parent onOk callback to refresh the list (this will close modal)
      onOk();
    } catch (error: any) {
      console.error("Error deleting folder:", error);
      message.error(error?.response?.data?.detail || "Failed to delete folder. Please try again.");
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  // Bookmark folder icon options
  const bookmarkIcons = [
    "📁",
    "📚",
    "📖",
    "📝",
    "📄",
    "📌",
    "📍",
    "🔖",
    "⭐",
    "❤️",
    "🖤",
    "🤍",
    "🔥",
    "✨",
    "💡",
    "🎯",
    "🏆",
    "🎓",
    "📊",
    "💼",
    "🔬",
    "🧪",
    "🧬",
    "🩺",
    "🫀",
    "🧠",
    "🦷",
    "👁️",
    "🦴",
    "💊",
    "🩹",
    "🩸",
    "🌟",
    "⚡",
    "🔔",
    "🎨",
    "🖊️",
    "✏️",
  ];

  return (
    <Modal
      title={
        <div className="flex! items-center! gap-2! text-lg! font-semibold!">
          <FolderOutlined /> {editingFolder ? "Edit folder" : "New bookmark folder"}
        </div>
      }
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      width={600}
      style={{ top: 40 }}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button key="create" type="primary" className="bg-gray-800" onClick={handleOk}>
          {editingFolder ? "Update folder" : "Create folder"}
        </Button>,
      ]}
    >
      <div className="py-4">
        {/* Folder Name */}
        <div className="mb-6">
          <h3 className="text-base font-semibold mb-1">Folder name</h3>
          <p className="text-sm text-gray-500 mb-3">Choose a name that helps you organize your bookmarks.</p>
          <Input
            placeholder="Enter folder name"
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            maxLength={18}
            suffix={<span className="text-gray-400 text-xs">{folderName.length}/18</span>}
            className="rounded-lg!"
          />
        </div>

        {/* Choose Icon */}
        <div className="mb-6">
          <h3 className="text-base font-semibold mb-3">Choose an icon</h3>
          <div className="flex gap-2 flex-wrap max-h-60 overflow-y-auto p-2 border border-gray-200 rounded-lg">
            {bookmarkIcons.map(icon => (
              <button
                key={icon}
                onClick={() => setSelectedIcon(icon)}
                className={`w-12 h-12 rounded-lg text-2xl flex items-center justify-center transition-all ${
                  selectedIcon === icon ? "bg-sky-100 ring-2 ring-sky-500" : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Delete Folder - Only show when editing */}
        {editingFolder && (
          <>
            <hr className="text-gray-200 mb-4" />
            <div>
              <h3 className="text-base font-semibold mb-1">Delete folder</h3>
              <p className="text-sm text-gray-500 mb-3">Permanently remove this folder. Bookmarks in this folder will be moved to "Quick saves".</p>
              <Button
                danger
                icon={<span>🗑️</span>}
                className="rounded-lg!"
                onClick={() => {
                  Modal.confirm({
                    title: "Delete Folder",
                    content: `Are you sure you want to delete "${folderName}"? Bookmarks will be moved to "Quick saves".`,
                    okText: "Delete",
                    okType: "danger",
                    cancelText: "Cancel",
                    onOk: handleDelete,
                  });
                }}
              >
                Delete folder
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default NewBookmarkFolderModal;
