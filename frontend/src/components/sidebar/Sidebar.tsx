import React, { useState } from "react";
import {
  FireOutlined,
  HistoryOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  StarOutlined,
  InfoCircleOutlined,
  DownOutlined,
  RightOutlined,
  SettingOutlined,
  TeamOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Menu, Button, Modal, Tooltip } from "antd";
import { useUser } from "@clerk/clerk-react";
import { BsLayoutSidebar, BsReverseLayoutSidebarReverse } from "react-icons/bs";
import { IoBookmarkOutline, IoChatbubbleEllipsesOutline, IoStatsChart } from "react-icons/io5";
import { BsFillJournalBookmarkFill } from "react-icons/bs";
import { MdOutlineRssFeed } from "react-icons/md";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import type {
  Feed,
  FeedsResponse,
  JournalFollow,
  JournalFollowsResponse,
  BookmarkFolder,
  BookmarkFoldersResponse,
  Group,
  GroupsResponse,
} from "../../types/api";
import NewFeedModal from "./NewFeedModal";
import NewJournalFollowModal from "./NewJournalFollowModal";
import NewBookmarkFolderModal from "./NewBookmarkFolderModal";
import NewGroupModal from "./NewGroupModal";
import TestimonialModal from "./TestimonialModal";
import { TbFolderStar } from "react-icons/tb";
import { AiOutlineDelete } from "react-icons/ai";
import { CiEdit } from "react-icons/ci";
import { useNavigate } from "react-router-dom";
import { FiExternalLink } from "react-icons/fi";
import { PiFileArchiveThin } from "react-icons/pi";

type MenuItem = Required<MenuProps>["items"][number];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const isAdmin = user?.id === import.meta.env.VITE_ADMIN_CLERK_USER_ID;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<BookmarkFolder | null>(null);
  const [isTestimonialModalOpen, setIsTestimonialModalOpen] = useState(false);
  const [feedsExpanded, setFeedsExpanded] = useState(true);
  const [journalFollowsExpanded, setJournalFollowsExpanded] = useState(true);
  const [bookmarksExpanded, setBookmarksExpanded] = useState(true);
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isJournalFollowModalOpen, setIsJournalFollowModalOpen] = useState(false);
  const [editingJournalFollow, setEditingJournalFollow] = useState<JournalFollow | null>(null);
  const queryClient = useQueryClient();

  // Fetch custom feeds
  const { data: feedsData } = useQuery<FeedsResponse>({
    queryKey: ["customFeeds"],
    queryFn: async () => {
      const response = await axiosInstance.get("/customFeeds/get_custom_feeds");
      return response.data;
    },
  });

  // Fetch journal follows
  const { data: journalFollowsData } = useQuery<JournalFollowsResponse>({
    queryKey: ["journalFollows"],
    queryFn: async () => {
      const response = await axiosInstance.get("/customFeeds/get_journal_follows");
      return response.data;
    },
  });

  // Fetch bookmark folders
  const { data: foldersData } = useQuery<BookmarkFoldersResponse>({
    queryKey: ["bookmarkFolders"],
    queryFn: async () => {
      const response = await axiosInstance.get("/bookmarks/get_folders");
      return response.data;
    },
  });

  // Fetch groups
  const { data: groupsData } = useQuery<GroupsResponse>({
    queryKey: ["groups"],
    queryFn: async () => {
      const response = await axiosInstance.get("/groups/get_groups");
      return response.data;
    },
  });

  // Fetch pending group invites
  const { data: pendingInvitesData } = useQuery<{
    invites: { key: string; name: string; icon: string; admin_user_id: string }[];
  }>({
    queryKey: ["groupPendingInvites"],
    queryFn: async () => {
      const response = await axiosInstance.get("/groups/get_pending_invites");
      return response.data;
    },
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (groupKey: string) => {
      await axiosInstance.post("/groups/accept_invite", { group_key: groupKey });
      // Delete the matching group_invite notification
      const notifs = await axiosInstance.get("/notifications/");
      const matching = notifs.data.find((n: any) => n.notification_type === "group_invite" && n.notification_metadata?.group_key === groupKey);
      if (matching) {
        await axiosInstance.delete(`/notifications/${matching.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["groupPendingInvites"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  const declineInviteMutation = useMutation({
    mutationFn: async (groupKey: string) => {
      await axiosInstance.post("/groups/decline_invite", { group_key: groupKey });
      // Delete the matching group_invite notification
      const notifs = await axiosInstance.get("/notifications/");
      const matching = notifs.data.find((n: any) => n.notification_type === "group_invite" && n.notification_metadata?.group_key === groupKey);
      if (matching) {
        await axiosInstance.delete(`/notifications/${matching.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupPendingInvites"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  // Delete feed mutation
  const deleteFeedMutation = useMutation({
    mutationFn: async (feedKey: string) => {
      await axiosInstance.post("/customFeeds/delete_feed", { key: feedKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFeeds"] });
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderKey: string) => {
      await axiosInstance.post("/bookmarks/delete_folder", { key: folderKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarkFolders"] });
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupKey: string) => {
      await axiosInstance.post("/groups/delete_group", { key: groupKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const onClick: MenuProps["onClick"] = e => {
    // Open testimonial modal
    if (e.key === "testimonial") {
      setIsTestimonialModalOpen(true);
      return;
    }

    if (e.key === "mainFeed") {
      navigate("/MainFeed?loc=MainFeed");
    }

    if (e.key === "bioarchive") {
      navigate("/BioArchive?loc=BioArchive");
    }

    if (e.key === "explore") {
      navigate("/Explore?loc=Explore");
    }

    if (e.key === "history") {
      navigate("/History?loc=History");
    }

    if (e.key === "tags") {
      navigate("/Tags?loc=Tags");
    }

    if (e.key === "journals") {
      navigate("/SourceJournals?loc=SourceJournals");
    }

    if (e.key === "metrics") {
      navigate("/Metrics?loc=Metrics");
    }

    if (e.key === "docs") {
      navigate("/Documentation");
    }

    if (e.key === "admin") {
      navigate("/Admin?loc=Admin");
    }

    if (e.key === "support") {
      navigate("/Settings?tab=support");
    }

    // Close drawer on mobile after navigation
    if (window.innerWidth < 1024) {
      onToggleCollapse(); // This will close the drawer
    }
  };

  const handleNavigateToFeed = (feedKey: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    navigate(`/CustomFeeds?feed=${feedKey}`);
    // Close drawer on mobile
    if (window.innerWidth < 1024) {
      onToggleCollapse(); // This will close the drawer
    }
  };

  const handleNavigateToBookmark = (folderKey: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    navigate(`/Bookmarks?folder=${folderKey}`);
    // Close drawer on mobile
    if (window.innerWidth < 1024) {
      onToggleCollapse(); // This will close the drawer
    }
  };

  const handleNavigateToGroup = (groupKey: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    navigate(`/Groups?group=${groupKey}`);
    if (window.innerWidth < 1024) {
      onToggleCollapse();
    }
  };

  const handleNewFeedClick = () => {
    setEditingFeed(null);
    setIsModalOpen(true);
  };

  const handleEditFeedClick = (feed: Feed, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFeed(feed);
    setIsModalOpen(true);
  };

  const handleDeleteFeedClick = (feedKey: string, feedName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: "Delete Feed",
      content: `Are you sure you want to delete "${feedName}"? This action cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        deleteFeedMutation.mutate(feedKey);
      },
    });
  };

  const handleModalOk = (feedKey?: string) => {
    setIsModalOpen(false);
    setEditingFeed(null);
    queryClient.invalidateQueries({ queryKey: ["customFeeds"] });
    queryClient.invalidateQueries({ queryKey: ["customFeedArticles"] });
    if (feedKey) {
      navigate(`/CustomFeeds?feed=${feedKey}`);
    }
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
    setEditingFeed(null);
  };

  // Journal follow handlers
  const handleNavigateToJournalFollow = (followKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigate(`/JournalFollows?follow=${followKey}`);
    if (window.innerWidth < 1024) onToggleCollapse();
  };

  const handleNewJournalFollowClick = () => {
    setEditingJournalFollow(null);
    setIsJournalFollowModalOpen(true);
  };

  const handleEditJournalFollowClick = (follow: JournalFollow, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingJournalFollow(follow);
    setIsJournalFollowModalOpen(true);
  };

  const handleDeleteJournalFollowClick = (followKey: string, followName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: "Delete Journal Follow",
      content: `Are you sure you want to delete "${followName}"? This action cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        axiosInstance.post("/customFeeds/delete_feed", { key: followKey }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["journalFollows"] });
        });
      },
    });
  };

  const handleJournalFollowModalOk = (followKey?: string) => {
    setIsJournalFollowModalOpen(false);
    setEditingJournalFollow(null);
    queryClient.invalidateQueries({ queryKey: ["journalFollows"] });
    queryClient.invalidateQueries({ queryKey: ["journalFollowArticles"] });
    if (followKey) {
      navigate(`/JournalFollows?follow=${followKey}`);
    }
  };

  const handleJournalFollowModalCancel = () => {
    setIsJournalFollowModalOpen(false);
    setEditingJournalFollow(null);
  };

  // Bookmark folder handlers
  const handleNewFolderClick = () => {
    setEditingFolder(null);
    setIsFolderModalOpen(true);
  };

  const handleEditFolderClick = (folder: BookmarkFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setIsFolderModalOpen(true);
  };

  const handleDeleteFolderClick = (folderKey: string, folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: "Delete Folder",
      content: `Are you sure you want to delete "${folderName}"? Bookmarks will be moved to "Quick saves".`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        deleteFolderMutation.mutate(folderKey);
      },
    });
  };

  const handleFolderModalOk = () => {
    setIsFolderModalOpen(false);
    setEditingFolder(null);
    queryClient.invalidateQueries({ queryKey: ["bookmarkFolders"] });
  };

  const handleFolderModalCancel = () => {
    setIsFolderModalOpen(false);
    setEditingFolder(null);
  };

  // Group handlers
  const handleNewGroupClick = () => {
    setEditingGroup(null);
    setIsGroupModalOpen(true);
  };

  const handleEditGroupClick = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroup(group);
    setIsGroupModalOpen(true);
  };

  const handleDeleteGroupClick = (groupKey: string, groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: "Delete Group",
      content: `Are you sure you want to delete "${groupName}"? This action cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        deleteGroupMutation.mutate(groupKey);
      },
    });
  };

  const handleGroupModalOk = (groupKey?: string) => {
    setIsGroupModalOpen(false);
    setEditingGroup(null);
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    if (groupKey) {
      navigate(`/Groups?group=${groupKey}`);
    }
  };

  const handleGroupModalCancel = () => {
    setIsGroupModalOpen(false);
    setEditingGroup(null);
  };

  // Build custom feeds menu items
  const feedCount = feedsData?.feeds?.length || 0;
  const hasReachedFeedLimit = feedCount >= 20;

  // Build journal follows menu items
  const journalFollowCount = journalFollowsData?.journal_follows?.length || 0;
  const hasReachedJournalFollowLimit = journalFollowCount >= 20;

  // Build bookmark folders menu items
  const folderCount = foldersData?.folders?.length || 0;
  const hasReachedFolderLimit = folderCount >= 20;

  // Build groups menu items
  const groupCount = groupsData?.groups?.filter(g => g.admin_user_id === user?.id).length || 0;
  const hasReachedGroupLimit = groupCount >= 10;

  const items: MenuItem[] = [
    {
      key: "mainFeed",
      label: "Main feed",
      icon: <MdOutlineRssFeed className=" text-yellow-600!" />,
    },
    {
      key: "bioarchive",
      label: (
        <span>
          Bio<span className="text-rose-600">R</span>xiv Preprints
        </span>
      ),
      icon: <PiFileArchiveThin className="text-lg! text-slate-700!" />,
    },
    {
      key: "explore",
      label: "Explore",
      icon: <FireOutlined className=" text-pink-700!" />,
    },
    {
      key: "history",
      label: "History",
      icon: <HistoryOutlined />,
    },
    {
      type: "divider",
      className: "border-gray-400!",
    },
    // Custom Feeds Section
    ...(collapsed
      ? [
          {
            key: "custom-feeds-collapsed",
            label: "Custom feeds",
            icon: <UnorderedListOutlined className="text-gray-500!" />,
            onClick: () => {
              onToggleCollapse();
              setFeedsExpanded(true);
            },
          } as MenuItem,
        ]
      : [
          {
            key: "custom-feeds-label",
            label: (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="text"
                    size="small"
                    icon={feedsExpanded ? <DownOutlined className="text-xs!" /> : <RightOutlined className="text-xs!" />}
                    onClick={e => {
                      e.stopPropagation();
                      setFeedsExpanded(!feedsExpanded);
                    }}
                    className="p-0! h-auto! min-w-0! hover:text-sky-500!"
                  />
                  <span className="text-gray-400 font-semibold">Custom feeds</span>
                  <Tooltip
                    title="Create personalized feeds by filtering papers based on topics, journals, or keywords. You can create up to 20 custom feeds."
                    placement="right"
                  >
                    <InfoCircleOutlined className="text-gray-400! text-xs! cursor-help! hover:text-gray-600! transition-colors!" />
                  </Tooltip>
                </div>
                <span className={`text-xs ${hasReachedFeedLimit ? "text-red-500" : "text-gray-400"}`}>{feedCount}/20</span>
              </div>
            ),
            disabled: true,
            className: "!cursor-default hover:!bg-transparent",
          } as MenuItem,
        ]),
    ...(feedsExpanded && !collapsed
      ? (feedsData?.feeds || []).map(feed => ({
          key: feed.key,
          label: (
            <div className="flex items-center justify-between group w-full" onClick={(e: React.MouseEvent) => handleNavigateToFeed(feed.key, e)}>
              <span className="flex items-center gap-1">
                <span>{feed.icon}</span>
                <span>{feed.name}</span>
              </span>
              <div className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="text"
                  size="small"
                  icon={<CiEdit className="text-lg!" />}
                  className="text-gray-500 hover:text-sky-500!"
                  onClick={(e: React.MouseEvent) => handleEditFeedClick(feed, e)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<AiOutlineDelete className="text-lg!" />}
                  className="text-gray-500 hover:text-red-500!"
                  onClick={(e: React.MouseEvent) => handleDeleteFeedClick(feed.key, feed.name, e)}
                />
              </div>
            </div>
          ),
          icon: <UnorderedListOutlined className="text-gray-500!" />,
        }))
      : []),
    ...(feedsExpanded && !collapsed
      ? [
          {
            key: "newFeed",
            label: (
              <div className="flex items-center ">
                <Button
                  type="primary"
                  disabled={hasReachedFeedLimit}
                  className="rounded-md h-7! px-1.5! bg-gray-400! border-gray-400! hover:bg-gray-500! hover:border-gray-500!"
                  onClick={handleNewFeedClick}
                >
                  <PlusOutlined className="-mr-2" /> New feed
                </Button>
              </div>
            ),
          } as MenuItem,
        ]
      : []),
    {
      type: "divider",
      className: "border-gray-400!",
    },
    // Follow Journals Section
    ...(collapsed
      ? [
          {
            key: "journal-follows-collapsed",
            label: "Follow Journals",
            icon: <BsFillJournalBookmarkFill className="text-gray-500!" />,
            onClick: () => {
              onToggleCollapse();
              setJournalFollowsExpanded(true);
            },
          } as MenuItem,
        ]
      : [
          {
            key: "journal-follows-label",
            label: (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="text"
                    size="small"
                    icon={journalFollowsExpanded ? <DownOutlined className="text-xs!" /> : <RightOutlined className="text-xs!" />}
                    onClick={e => {
                      e.stopPropagation();
                      setJournalFollowsExpanded(!journalFollowsExpanded);
                    }}
                    className="p-0! h-auto! min-w-0! hover:text-sky-500!"
                  />
                  <span className="text-gray-400 font-semibold">Follow Journals</span>
                  <Tooltip
                    title="Follow specific journals to see articles from those journals directly. You can follow up to 20 journal groups."
                    placement="right"
                  >
                    <InfoCircleOutlined className="text-gray-400! text-xs! cursor-help! hover:text-gray-600! transition-colors!" />
                  </Tooltip>
                </div>
                <span className={`text-xs ${hasReachedJournalFollowLimit ? "text-red-500" : "text-gray-400"}`}>{journalFollowCount}/20</span>
              </div>
            ),
            disabled: true,
            className: "!cursor-default hover:!bg-transparent",
          } as MenuItem,
        ]),
    ...(journalFollowsExpanded && !collapsed
      ? (journalFollowsData?.journal_follows || []).map(follow => ({
          key: follow.key,
          label: (
            <div
              className="flex items-center justify-between group w-full"
              onClick={(e: React.MouseEvent) => handleNavigateToJournalFollow(follow.key, e)}
            >
              <span className="flex items-center gap-1">
                <span>{follow.icon}</span>
                <span>{follow.name}</span>
              </span>
              <div className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="text"
                  size="small"
                  icon={<CiEdit className="text-lg!" />}
                  className="text-gray-500 hover:text-sky-500!"
                  onClick={(e: React.MouseEvent) => handleEditJournalFollowClick(follow, e)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<AiOutlineDelete className="text-lg!" />}
                  className="text-gray-500 hover:text-red-500!"
                  onClick={(e: React.MouseEvent) => handleDeleteJournalFollowClick(follow.key, follow.name, e)}
                />
              </div>
            </div>
          ),
          icon: <BsFillJournalBookmarkFill className="text-gray-500!" />,
        }))
      : []),
    ...(journalFollowsExpanded && !collapsed
      ? [
          {
            key: "newJournalFollow",
            label: (
              <div className="flex items-center">
                <Button
                  type="primary"
                  disabled={hasReachedJournalFollowLimit}
                  className="rounded-md h-7! px-1.5! bg-gray-400! border-gray-400! hover:bg-gray-500! hover:border-gray-500!"
                  onClick={handleNewJournalFollowClick}
                >
                  <PlusOutlined className="-mr-2" />
                  Follow journals
                </Button>
              </div>
            ),
          } as MenuItem,
        ]
      : []),
    {
      type: "divider",
      className: "border-gray-400!",
    },
    // Bookmarks Section
    ...(collapsed
      ? [
          {
            key: "bookmarks-collapsed",
            label: "Bookmarks",
            icon: <IoBookmarkOutline className="text-lg!" />,
            onClick: () => {
              onToggleCollapse();
              setBookmarksExpanded(true);
            },
          } as MenuItem,
        ]
      : [
          {
            key: "bookmarks-label",
            label: (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="text"
                    size="small"
                    icon={bookmarksExpanded ? <DownOutlined className="text-xs!" /> : <RightOutlined className="text-xs!" />}
                    onClick={e => {
                      e.stopPropagation();
                      setBookmarksExpanded(!bookmarksExpanded);
                    }}
                    className="p-0! h-auto! min-w-0! hover:text-sky-500!"
                  />
                  <span className="text-gray-400 font-semibold">Bookmarks</span>
                  <Tooltip
                    title="Organize your saved papers into folders for easy access. Quick saves is your default folder, and you can create up to 20 custom folders."
                    placement="right"
                  >
                    <InfoCircleOutlined className="text-gray-400! text-xs! cursor-help! hover:text-gray-600! transition-colors!" />
                  </Tooltip>
                </div>
                <span className={`text-xs ${hasReachedFolderLimit ? "text-red-500" : "text-gray-400"}`}>{folderCount}/20</span>
              </div>
            ),
            disabled: true,
            className: "!cursor-default hover:!bg-transparent",
          } as MenuItem,
        ]),
    ...(bookmarksExpanded && !collapsed
      ? [
          {
            key: "quickSaves",
            label: (
              <div className="flex items-center gap-2" onClick={(e: React.MouseEvent) => handleNavigateToBookmark("quick_saves", e)}>
                <IoBookmarkOutline className="text-lg!" />
                Quick saves
              </div>
            ),
          } as MenuItem,
        ]
      : []),
    ...(bookmarksExpanded && !collapsed
      ? (foldersData?.folders || []).map(folder => ({
          key: folder.key,
          label: (
            <div
              className="flex items-center justify-between group w-full"
              onClick={(e: React.MouseEvent) => handleNavigateToBookmark(folder.key, e)}
            >
              <span className="flex items-center gap-1 cursor-pointer hover:text-sky-600">
                <span>{folder.icon}</span>
                <span>{folder.name}</span>
              </span>
              <div className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="text"
                  size="small"
                  icon={<CiEdit className="text-lg!" />}
                  className="text-gray-500 hover:text-sky-500!"
                  onClick={(e: React.MouseEvent) => handleEditFolderClick(folder, e)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<AiOutlineDelete className="text-lg!" />}
                  className="text-gray-500 hover:text-red-500!"
                  onClick={(e: React.MouseEvent) => handleDeleteFolderClick(folder.key, folder.name, e)}
                />
              </div>
            </div>
          ),
          icon: <TbFolderStar className="text-lg! text-gray-500!" />,
        }))
      : []),
    ...(bookmarksExpanded && !collapsed
      ? [
          {
            key: "newFolder",
            label: (
              <div className="flex items-center">
                <Button
                  type="primary"
                  disabled={hasReachedFolderLimit}
                  className="rounded-md h-7! px-1.5! bg-gray-400! border-gray-400! hover:bg-gray-500! hover:border-gray-500!"
                  onClick={handleNewFolderClick}
                >
                  <PlusOutlined className="-mr-2" /> New folder
                </Button>
              </div>
            ),
          } as MenuItem,
        ]
      : []),
    {
      type: "divider",
      className: "border-gray-400!",
    },
    ...(!collapsed
      ? [
          {
            key: "groups-label",
            label: (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="text"
                    size="small"
                    icon={groupsExpanded ? <DownOutlined className="text-xs!" /> : <RightOutlined className="text-xs!" />}
                    onClick={e => {
                      e.stopPropagation();
                      setGroupsExpanded(!groupsExpanded);
                    }}
                    className="p-0! h-auto! min-w-0! hover:text-sky-500!"
                  />
                  <span className="text-gray-400 font-semibold">Groups</span>
                  <Tooltip title="Create groups to share papers with colleagues. You can create up to 10 groups." placement="right">
                    <InfoCircleOutlined className="text-gray-400! text-xs! cursor-help! hover:text-gray-600! transition-colors!" />
                  </Tooltip>
                </div>
                <span className={`text-xs ${hasReachedGroupLimit ? "text-red-500" : "text-gray-400"}`}>{groupCount}/20</span>
                {(pendingInvitesData?.invites?.length ?? 0) > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center text-xs font-bold text-white bg-orange-400 rounded-full w-4 h-4">
                    {pendingInvitesData!.invites.length}
                  </span>
                )}
              </div>
            ),
            disabled: true,
            className: "!cursor-default hover:!bg-transparent",
          } as MenuItem,
        ]
      : [
          {
            key: "groups-collapsed",
            label: "Groups",
            icon: <TeamOutlined className="text-gray-500!" />,
            onClick: () => {
              onToggleCollapse();
              setGroupsExpanded(true);
            },
          } as MenuItem,
        ]),
    ...(groupsExpanded && !collapsed
      ? (groupsData?.groups || []).map(group => ({
          key: group.key,
          label: (
            <div className="flex items-center justify-between group w-full" onClick={(e: React.MouseEvent) => handleNavigateToGroup(group.key, e)}>
              <span className="flex items-center gap-1">
                <span>{group.icon}</span>
                <span>{group.name}</span>
                <span className="text-xs text-gray-400 ml-1">({group.member_count})</span>
              </span>
              <div className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {group.is_admin && (
                  <>
                    <Button
                      type="text"
                      size="small"
                      icon={<CiEdit className="text-lg!" />}
                      className="text-gray-500 hover:text-sky-500!"
                      onClick={(e: React.MouseEvent) => handleEditGroupClick(group, e)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<AiOutlineDelete className="text-lg!" />}
                      className="text-gray-500 hover:text-red-500!"
                      onClick={(e: React.MouseEvent) => handleDeleteGroupClick(group.key, group.name, e)}
                    />
                  </>
                )}
              </div>
            </div>
          ),
          icon: <TeamOutlined className="text-gray-500!" />,
        }))
      : []),
    ...(groupsExpanded && !collapsed
      ? [
          {
            key: "newGroup",
            disabled: true,
            className: "!cursor-default hover:!bg-transparent",
            label: (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Button
                  type="primary"
                  disabled={hasReachedGroupLimit}
                  style={{ backgroundColor: "#9ca3af", borderColor: "#9ca3af" }}
                  className="rounded-md h-7! px-1.5! hover:!bg-gray-500 hover:!border-gray-500"
                  onClick={handleNewGroupClick}
                >
                  <PlusOutlined className="-mr-2" /> New group
                </Button>
                <Button
                  size="small"
                  className="text-sky-600! border-sky-600! h-7! rounded-md! text-xs! hover:!bg-sky-100 hover:!text-sky-800"
                  onClick={() => navigate("/FindGroups")}
                >
                  <GlobalOutlined className="-mr-2" /> Find groups
                </Button>
              </div>
            ),
          } as MenuItem,
        ]
      : []),
    // Pending invites (shown below groups list when expanded)
    ...(groupsExpanded && !collapsed && (pendingInvitesData?.invites?.length ?? 0) > 0
      ? [
          {
            key: "pending-invites-label",
            label: <span className="text-orange-400 font-semibold text-xs">Pending invites</span>,
            disabled: true,
            className: "!cursor-default hover:!bg-transparent",
          } as MenuItem,
          ...(pendingInvitesData?.invites || []).map(invite => ({
            key: `invite_${invite.key}`,
            label: (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-gray-700 truncate">
                  {invite.icon} {invite.name}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="small"
                    type="primary"
                    className="h-5! text-xs! px-1.5! bg-sky-600! border-sky-600!"
                    onClick={e => {
                      e.stopPropagation();
                      acceptInviteMutation.mutate(invite.key);
                    }}
                    loading={acceptInviteMutation.isPending}
                  >
                    Accept
                  </Button>
                  <Button
                    size="small"
                    danger
                    className="h-5! text-xs! px-1.5!"
                    onClick={e => {
                      e.stopPropagation();
                      declineInviteMutation.mutate(invite.key);
                    }}
                    loading={declineInviteMutation.isPending}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ),
            icon: <TeamOutlined className="text-orange-400!" />,
          })),
        ]
      : []),
    {
      type: "divider",
      className: "border-gray-400!",
    },
    ...(!collapsed
      ? [
          {
            key: "discover-label",
            label: <span className="text-gray-400 font-semibold">Discover</span>,
            disabled: true,
            className: "!cursor-default hover:!bg-transparent",
          } as MenuItem,
        ]
      : []),

    // {
    //   key: "tags",
    //   label: "Tags",
    //   icon: <RiHashtag className="text-lg!" />,
    // },
    {
      key: "journals",
      label: "Source journals",
      icon: <BsFillJournalBookmarkFill className="text-lg!" />,
    },
    {
      key: "metrics",
      label: "Metrics",
      icon: <IoStatsChart className="text-lg!" />,
    },
    {
      type: "divider",
      className: "border-gray-400!",
    },
    ...(!collapsed
      ? [
          {
            key: "community-label",
            label: <span className="text-gray-400 font-semibold">Community</span>,
            disabled: true,
            className: "!cursor-default hover:!bg-transparent",
          } as MenuItem,
        ]
      : []),

    {
      key: "testimonial",
      label: "Leave a testimonial",
      icon: <StarOutlined className="text-lg!" />,
    },
    {
      key: "docs",
      label: (
        <div className="flex items-center justify-between w-full">
          <span>Documentation</span>
          <FiExternalLink className="text-md!" />
        </div>
      ),
      icon: <FileTextOutlined className="text-lg!" />,
    },
    {
      key: "support",
      label: (
        <div className="flex items-center justify-between w-full">
          <span>Support</span>
          <FiExternalLink className="text-md!" />
        </div>
      ),

      icon: <IoChatbubbleEllipsesOutline className="text-lg!" />,
    },
    // Admin link - only visible for admin user
    ...(isAdmin
      ? [
          {
            type: "divider" as const,
            className: "border-gray-400!",
          } as MenuItem,
          {
            key: "admin",
            label: "Admin",
            icon: <SettingOutlined className="text-lg! text-violet-600!" />,
          } as MenuItem,
        ]
      : []),
  ];

  return (
    <>
      <div className="h-full bg-white border-r border-gray-200 flex flex-col">
        {/* Toggle Button */}
        <div className="p-4 ml-2 border-b border-gray-200 flex justify-between items-center">
          {!collapsed && <span className="font-semibold text-gray-500">Menu</span>}
          <Button
            type="text"
            icon={
              collapsed ? (
                <BsReverseLayoutSidebarReverse className="text-xl  text-gray-500!" />
              ) : (
                <BsLayoutSidebar className=" text-xl text-gray-500!" />
              )
            }
            onClick={onToggleCollapse}
            className="flex items-center justify-center"
          />
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-auto">
          <Menu
            onClick={onClick}
            style={{ width: "100%", border: "none" }}
            defaultSelectedKeys={["1"]}
            mode="inline"
            inlineCollapsed={collapsed}
            items={items}
            className="custom-menu"
          />
        </div>
      </div>

      {/* New Feed Modal */}
      <NewFeedModal open={isModalOpen} onCancel={handleModalCancel} onOk={handleModalOk} editingFeed={editingFeed} />

      {/* Journal Follow Modal */}
      <NewJournalFollowModal
        open={isJournalFollowModalOpen}
        onCancel={handleJournalFollowModalCancel}
        onOk={handleJournalFollowModalOk}
        editingFollow={editingJournalFollow}
      />

      {/* New Bookmark Folder Modal */}
      <NewBookmarkFolderModal open={isFolderModalOpen} onCancel={handleFolderModalCancel} onOk={handleFolderModalOk} editingFolder={editingFolder} />

      {/* New Group Modal */}
      <NewGroupModal open={isGroupModalOpen} onCancel={handleGroupModalCancel} onOk={handleGroupModalOk} editingGroup={editingGroup} />

      {/* Testimonial Modal */}
      <TestimonialModal
        open={isTestimonialModalOpen}
        onCancel={() => setIsTestimonialModalOpen(false)}
        onSuccess={() => setIsTestimonialModalOpen(false)}
      />
    </>
  );
};

export default Sidebar;
