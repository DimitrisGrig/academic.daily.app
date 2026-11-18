import { useState, useEffect, useRef } from "react";
import { Input, Button, Avatar, Popconfirm, message, Spin, Tooltip } from "antd";
import { UserOutlined, SendOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined, CommentOutlined } from "@ant-design/icons";
import { useUser } from "@clerk/clerk-react";
import axiosInstance from "../../lib/axios";

const { TextArea } = Input;

interface GroupComment {
  id: number;
  group_key: string;
  user_id: string;
  first_name: string;
  last_name: string;
  comment_text: string;
  created_at: string;
  updated_at?: string | null;
}

interface GroupCommentsPanelProps {
  groupKey: string;
  isAdmin: boolean;
  /** When true, hides the header and outer border (for use inside a Drawer). */
  embedded?: boolean;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function GroupCommentsPanel({ groupKey, isAdmin, embedded = false }: GroupCommentsPanelProps) {
  const { user } = useUser();
  const currentUserId = user?.id || "";

  const [comments, setComments] = useState<GroupComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch comments when group changes
  useEffect(() => {
    if (!groupKey) return;
    let cancelled = false;
    setIsLoading(true);
    axiosInstance
      .get(`/groups/get_group_comments?group_key=${encodeURIComponent(groupKey)}`)
      .then(r => {
        if (!cancelled) setComments(r.data.comments || []);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupKey]);

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const handleSend = async () => {
    const text = newComment.trim();
    if (!text) return;
    setIsSending(true);
    try {
      const r = await axiosInstance.post("/groups/add_group_comment", {
        group_key: groupKey,
        comment_text: text,
      });
      if (r.data.success) {
        setComments(prev => [r.data.comment, ...prev]);
        setNewComment("");
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "Failed to post comment");
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    const prev = [...comments];
    setComments(c => c.filter(x => x.id !== commentId));
    try {
      await axiosInstance.post("/groups/delete_group_comment", {
        comment_id: commentId,
        group_key: groupKey,
      });
      message.success("Comment deleted");
    } catch {
      setComments(prev);
      message.error("Failed to delete comment");
    }
  };

  const handleEditSave = async (commentId: number) => {
    const text = editText.trim();
    if (!text) return;
    const prev = [...comments];
    setComments(c => c.map(x => (x.id === commentId ? { ...x, comment_text: text } : x)));
    setEditingId(null);
    try {
      const r = await axiosInstance.post("/groups/update_group_comment", {
        comment_id: commentId,
        comment_text: text,
      });
      if (r.data.success) {
        setComments(c => c.map(x => (x.id === commentId ? r.data.comment : x)));
        message.success("Comment updated");
      }
    } catch {
      setComments(prev);
      message.error("Failed to update comment");
    }
  };

  const startEdit = (comment: GroupComment) => {
    setEditingId(comment.id);
    setEditText(comment.comment_text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  // Reversed so newest at bottom (chat-style)
  const displayComments = [...comments].reverse();

  return (
    <div className={`flex flex-col h-full ${embedded ? "bg-white" : "border border-gray-200 rounded-xl bg-white shadow-sm"}`}>
      {/* Header — hidden when embedded in a Drawer */}
      {!embedded && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 m-0">
            <CommentOutlined className="text-sky-500!" />
            Group Discussion
            {comments.length > 0 && <span className="text-xs font-normal text-gray-400">({comments.length})</span>}
          </h3>
        </div>
      )}

      {/* Comments list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
        style={embedded ? undefined : { maxHeight: "calc(100vh - 320px)" }}
      >
        {isLoading && (
          <div className="flex justify-center py-8">
            <Spin size="small" />
          </div>
        )}

        {!isLoading && displayComments.length === 0 && (
          <div className="text-center py-8">
            <CommentOutlined className="text-3xl! text-gray-300! mb-2!" />
            <p className="text-sm text-gray-400 m-0">No comments yet</p>
            <p className="text-xs text-gray-300 m-0">Start the discussion!</p>
          </div>
        )}

        {!isLoading &&
          displayComments.map(comment => {
            const isOwn = comment.user_id === currentUserId;
            const canDelete = isOwn || isAdmin;
            const displayName = [comment.first_name, comment.last_name].filter(Boolean).join(" ") || "Member";

            return (
              <div key={comment.id} className={`group flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
                <Avatar size={28} icon={<UserOutlined />} className={`shrink-0 ${isOwn ? "bg-sky-500!" : "bg-purple-400!"}`} />
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${isOwn ? "bg-sky-50 border border-sky-100" : "bg-gray-50 border border-gray-100"}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-700">{isOwn ? "You" : displayName}</span>
                    <span className="text-[10px] text-gray-400">{formatTimeAgo(comment.created_at)}</span>
                    {comment.updated_at && comment.updated_at !== comment.created_at && (
                      <span className="text-[10px] text-gray-300 italic">(edited)</span>
                    )}
                  </div>

                  {editingId === comment.id ? (
                    <div className="mt-1">
                      <TextArea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        className="text-sm! mb-1"
                        onPressEnter={e => {
                          if (!e.shiftKey) {
                            e.preventDefault();
                            handleEditSave(comment.id);
                          }
                        }}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="small"
                          type="primary"
                          icon={<CheckOutlined />}
                          onClick={() => handleEditSave(comment.id)}
                          className="bg-sky-500! border-sky-500!"
                        />
                        <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 m-0 whitespace-pre-wrap break-words">{comment.comment_text}</p>
                  )}

                  {/* Action buttons (visible on hover, always visible on touch) */}
                  {editingId !== comment.id && (isOwn || canDelete) && (
                    <div className="flex gap-1 mt-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {isOwn && (
                        <Tooltip title="Edit">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined className="text-xs!" />}
                            onClick={() => startEdit(comment)}
                            className="text-gray-400! hover:text-sky-500! px-1! h-5!"
                          />
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Popconfirm
                          title="Delete comment?"
                          okText="Delete"
                          okButtonProps={{ danger: true }}
                          cancelText="Cancel"
                          onConfirm={() => handleDelete(comment.id)}
                        >
                          <Tooltip title="Delete">
                            <Button
                              type="text"
                              size="small"
                              icon={<DeleteOutlined className="text-xs!" />}
                              className="text-gray-400! hover:text-red-500! px-1! h-5!"
                            />
                          </Tooltip>
                        </Popconfirm>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Input area */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex gap-2 items-end">
          <TextArea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Write a comment…"
            autoSize={{ minRows: 1, maxRows: 4 }}
            className="flex-1 rounded-lg! text-sm!"
            onPressEnter={e => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isSending}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={isSending}
            disabled={!newComment.trim()}
            className="bg-sky-500! border-sky-500! hover:bg-sky-600! rounded-lg! shrink-0"
          />
        </div>
        <p className="text-[10px] text-gray-300 mt-1 mb-0">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
}
