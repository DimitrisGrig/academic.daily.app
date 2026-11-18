import { useState } from "react";
import { Modal, Input, message } from "antd";
import { FolderAddOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";

interface Props {
  isBookmarkModalOpen: boolean;
  handleSaveBookmark: () => void;
  setIsBookmarkModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setArticleToBookmark: (article: null) => void;
  setSelectedFolder: React.Dispatch<React.SetStateAction<string | null>>;
  availableFolders: { key: string; name: string }[];
  selectedFolder: string | null;
  articleToBookmark: { id: number } | null;
}

function SelectBookmarkFolderModal({
  isBookmarkModalOpen,
  handleSaveBookmark,
  setIsBookmarkModalOpen,
  setArticleToBookmark,
  setSelectedFolder,
  availableFolders,
  selectedFolder,
  articleToBookmark,
}: Props) {
  const queryClient = useQueryClient();
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const closeModal = () => {
    setIsBookmarkModalOpen(false);
    setArticleToBookmark(null);
    setSelectedFolder(null);
    setNewFolderName("");
  };

  const handleCreateAndSave = async () => {
    if (!articleToBookmark) return;
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      message.warning("Please enter a folder name");
      return;
    }

    setIsCreating(true);
    try {
      const createRes = await axiosInstance.post("/bookmarks/create_folder", {
        name: trimmed,
        icon: "📁",
      });
      const folderKey = createRes.data?.key ?? createRes.data?.folder?.key ?? trimmed.toLowerCase().replace(/\s+/g, "_");

      await axiosInstance.post("/bookmarks/save_bookmark", {
        article_id: articleToBookmark.id,
        folder_name: trimmed,
        folder_key: folderKey,
      });

      queryClient.invalidateQueries({ queryKey: ["bookmarkFolders"] });
      message.success(`Article saved to "${trimmed}"!`);
      closeModal();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "Failed to create folder and save bookmark.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Modal
        title="Save to Bookmark Folder"
        open={isBookmarkModalOpen}
        onOk={handleSaveBookmark}
        onCancel={closeModal}
        okText="Save"
        cancelText="Cancel"
        zIndex={1100}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Select a folder to save this article:</p>
          <div className="space-y-2">
            {availableFolders.map((folder: { key: string; name: string }) => (
              <div
                key={folder.key}
                onClick={() => setSelectedFolder(folder.key)}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedFolder === folder.key ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="folder"
                    value={folder.key}
                    checked={selectedFolder === folder.key}
                    onChange={() => setSelectedFolder(folder.key)}
                    className="cursor-pointer"
                  />
                  <span className="font-medium text-gray-900">{folder.name}</span>
                </div>
              </div>
            ))}
          </div>

          <hr className="border-gray-200" />

          <div>
            <p className="text-sm text-gray-600 mb-2">Or create a new folder and save:</p>
            <div className="flex gap-2">
              <Input
                prefix={<FolderAddOutlined className="text-gray-400" />}
                placeholder="New folder name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onPressEnter={handleCreateAndSave}
                maxLength={18}
                className="rounded-lg!"
              />
              <button
                onClick={handleCreateAndSave}
                disabled={isCreating || !newFolderName.trim()}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isCreating || !newFolderName.trim()
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                }`}
              >
                {isCreating ? "Saving…" : "Create & Save"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default SelectBookmarkFolderModal;
