import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input, Card, Tag, Tooltip, Spin, Empty } from "antd";
import { TeamOutlined, FileTextOutlined, SearchOutlined, GlobalOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { HiOutlineHashtag } from "react-icons/hi";
import axiosInstance from "../lib/axios";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PublicGroup {
  key: string;
  name: string;
  icon: string;
  tags: string[];
  member_count: number;
  article_count: number;
  is_member: boolean;
  created_at: string | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

function FindGroups() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ groups: PublicGroup[] }>({
    queryKey: ["publicGroups"],
    queryFn: async () => (await axiosInstance.get("/groups/get_public_groups")).data,
  });

  const allGroups = data?.groups ?? [];

  // Collect all unique tags across all groups
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allGroups.forEach(g => g.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [allGroups]);

  // Filter groups by search query and selected tag
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allGroups.filter(g => {
      const matchesSearch = !q || g.name.toLowerCase().includes(q) || g.tags?.some(t => t.toLowerCase().includes(q));
      const matchesTag = !activeTag || g.tags?.includes(activeTag);
      return matchesSearch && matchesTag;
    });
  }, [allGroups, searchQuery, activeTag]);

  const handleGroupClick = (group: PublicGroup) => {
    if (group.is_member) {
      navigate(`/Groups?group=${group.key}`);
    }
  };

  return (
    <div className="max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-sky-500 transition-colors cursor-pointer border-none bg-transparent p-0"
          >
            <ArrowLeftOutlined />
            <span>Back</span>
          </button>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <GlobalOutlined className="text-sky-500! text-xl!" />
          <h1 className="text-2xl! font-semibold! text-gray-700! m-0!">Find Groups</h1>
        </div>
        <p className="text-sm text-gray-400 mt-1">Discover public groups and connect with researchers who share your interests.</p>
      </div>

      {/* Search & tag filters */}
      <div className="mb-5 space-y-3">
        <Input
          prefix={<SearchOutlined className="text-gray-400!" />}
          placeholder="Search by group name or tag…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
          className="max-w-md!"
        />

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-400 mr-1 flex items-center gap-1">
              <HiOutlineHashtag className="text-sm!" /> Filter by tag:
            </span>
            <button
              onClick={() => setActiveTag(null)}
              className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                activeTag === null
                  ? "bg-sky-500 border-sky-500 text-white"
                  : "bg-white border-gray-200 text-gray-500 hover:border-sky-300 hover:text-sky-500"
              }`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                  activeTag === tag
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-orange-50 border-orange-200 text-orange-600 hover:border-orange-400"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400">
          {isLoading ? "Loading…" : `${filteredGroups.length} group${filteredGroups.length !== 1 ? "s" : ""} found`}
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <Empty
          description={<span className="text-gray-400!">{allGroups.length === 0 ? "No public groups yet." : "No groups match your search."}</span>}
          className="py-16!"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredGroups.map(group => (
            <Tooltip key={group.key} title={group.is_member ? "Click to open group" : "You are not a member of this group"} placement="top">
              <Card
                hoverable={group.is_member}
                onClick={() => handleGroupClick(group)}
                className={`rounded-xl! shadow-sm! transition-shadow! ${
                  group.is_member ? "hover:shadow-md! cursor-pointer!" : "opacity-80! cursor-default!"
                }`}
                styles={{ body: { padding: "14px" } }}
              >
                {/* Icon + name */}
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-2xl leading-none mt-0.5">{group.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm! font-semibold! text-gray-800! leading-tight! truncate! m-0!">{group.name}</h3>
                    {group.is_member && (
                      <span className="inline-flex items-center text-[10px]! px-1.5! py-0.5! rounded-full! bg-sky-50! border! border-sky-200! text-sky-600! mt-0.5!">
                        Member
                      </span>
                    )}
                  </div>
                  <GlobalOutlined className="text-gray-300! text-sm! shrink-0! mt-0.5!" />
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <TeamOutlined />
                    {group.member_count} member{group.member_count !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileTextOutlined />
                    {group.article_count} article{group.article_count !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Tags */}
                {group.tags && group.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {group.tags.slice(0, 5).map(tag => (
                      <span
                        key={tag}
                        className={`inline-flex items-center text-[11px]! px-2! py-0.5! rounded-full! border! transition-colors! ${
                          activeTag === tag
                            ? "bg-orange-100! border-orange-400! text-orange-700!"
                            : "bg-orange-50! border-orange-200! text-orange-600!"
                        }`}
                      >
                        #{tag}
                      </span>
                    ))}
                    {group.tags.length > 5 && <Tag className="text-[11px]! m-0! border-gray-200! text-gray-400!">+{group.tags.length - 5}</Tag>}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-300! italic! m-0!">No tags</p>
                )}
              </Card>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}

export default FindGroups;
