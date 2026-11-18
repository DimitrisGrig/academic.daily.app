import { useState, useEffect } from "react";
import { Modal, Input, Tabs, Button, message, Select, Radio, Checkbox } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { BsFillJournalBookmarkFill } from "react-icons/bs";
import { IoCalendarNumberOutline, IoStatsChart } from "react-icons/io5";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { SlLike } from "react-icons/sl";
import { PiCursorClick } from "react-icons/pi";

interface NewJournalFollowModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: (followKey?: string) => void;
  editingFollow?: {
    key: string;
    name: string;
    icon: string;
    journals?: string[];
    default_sorting?: string;
    time_range?: string;
    publication_types?: string[];
    graphical_abstract_only?: boolean;
    open_access_only?: boolean;
  } | null;
}

const NewJournalFollowModal: React.FC<NewJournalFollowModalProps> = ({ open, onCancel, onOk, editingFollow }) => {
  const [followName, setFollowName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("📰");
  const [activeTab, setActiveTab] = useState("general");
  const [selectedJournals, setSelectedJournals] = useState<string[]>([]);
  const [journalSearchTerm, setJournalSearchTerm] = useState("");
  const [journalViewTab, setJournalViewTab] = useState<"suggested" | "selected">("suggested");
  const [defaultSorting, setDefaultSorting] = useState("date");
  const [timeRange, setTimeRange] = useState("all_time");
  const [selectedPublicationTypes, setSelectedPublicationTypes] = useState<string[]>([]);
  const [graphicalAbstractOnly, setGraphicalAbstractOnly] = useState(false);
  const [openAccessOnly, setOpenAccessOnly] = useState(false);

  const {
    data: journals,
    isLoading: isLoadingJournals,
    error: journalsError,
  } = useQuery({
    queryKey: ["journals", journalSearchTerm],
    queryFn: async () => {
      const params = journalSearchTerm ? { search: journalSearchTerm } : {};
      const response = await axiosInstance.get("/customFeeds/get_journals", { params });
      return response.data;
    },
    enabled: open && activeTab === "journalSources",
  });

  const {
    data: publicationTypes,
    isLoading: isLoadingPublicationTypes,
    error: publicationTypesError,
  } = useQuery({
    queryKey: ["publicationTypes"],
    queryFn: async () => {
      const response = await axiosInstance.get("/customFeeds/get_publication_types");
      return response.data;
    },
    enabled: open && activeTab === "contentPreferences",
  });

  useEffect(() => {
    if (open) {
      if (editingFollow) {
        setFollowName(editingFollow.name);
        setSelectedIcon(editingFollow.icon);
        setSelectedJournals(editingFollow.journals || []);
        setDefaultSorting(editingFollow.default_sorting || "date");
        setTimeRange(editingFollow.time_range || "all_time");
        setSelectedPublicationTypes(editingFollow.publication_types || []);
        setGraphicalAbstractOnly(editingFollow.graphical_abstract_only || false);
        setOpenAccessOnly(editingFollow.open_access_only || false);
      } else {
        setFollowName("");
        setSelectedIcon("📰");
        setSelectedJournals([]);
        setDefaultSorting("date");
        setTimeRange("all_time");
        setSelectedPublicationTypes([]);
        setGraphicalAbstractOnly(false);
        setOpenAccessOnly(false);
      }
      setActiveTab("general");
      setJournalSearchTerm("");
      setJournalViewTab("suggested");
    }
  }, [open, editingFollow?.key]);

  const toggleJournal = (journalTitle: string) => {
    setSelectedJournals(prev => (prev.includes(journalTitle) ? prev.filter(j => j !== journalTitle) : [...prev, journalTitle]));
  };

  const handleOk = async () => {
    if (!followName.trim()) {
      message.warning("Please enter a name");
      return;
    }
    if (selectedJournals.length === 0) {
      message.warning("Please select at least one journal");
      return;
    }
    await submitFollow();
  };

  const submitFollow = async () => {
    try {
      const payload = {
        name: followName.trim(),
        icon: selectedIcon,
        feed_type: "journal_follow",
        tags: [],
        journals: selectedJournals,
        include_all_journals: false,
        publishers: [],
        default_sorting: defaultSorting,
        time_range: timeRange,
        publication_types: selectedPublicationTypes,
        graphical_abstract_only: graphicalAbstractOnly,
        open_access_only: openAccessOnly,
      };

      if (editingFollow) {
        await axiosInstance.post("/customFeeds/update_feed", { key: editingFollow.key, ...payload });
        message.success("Journal follow updated successfully");
        onOk();
      } else {
        const response = await axiosInstance.post("/customFeeds/create_new_feed", payload);
        message.success("Journal follow created successfully");
        onOk(response.data.feed.key);
      }
    } catch (error: any) {
      console.error(`Error ${editingFollow ? "updating" : "creating"} journal follow:`, error);
      message.error(error?.response?.data?.detail || `Failed to ${editingFollow ? "update" : "create"} journal follow. Please try again.`);
    }
  };

  const handleDelete = async () => {
    if (!editingFollow) return;
    try {
      await axiosInstance.post("/customFeeds/delete_feed", { key: editingFollow.key });
      message.success("Journal follow deleted successfully");
      onOk();
    } catch (error: any) {
      console.error("Error deleting journal follow:", error);
      message.error(error?.response?.data?.detail || "Failed to delete. Please try again.");
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-lg font-semibold">
          <BsFillJournalBookmarkFill /> {editingFollow ? "Edit journal follow" : "Follow journals"}
        </div>
      }
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      width={900}
      style={{ top: 20 }}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button key="save" type="primary" className="bg-gray-800" onClick={handleOk}>
          {editingFollow ? "Update" : "Create"}
        </Button>,
      ]}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "general",
            label: (
              <span className="flex items-center gap-2">
                <SettingOutlined /> General
              </span>
            ),
            children: (
              <div className="py-4">
                <div className="mb-6">
                  <h3 className="text-base font-semibold mb-1">Name</h3>
                  <p className="text-sm text-gray-500 mb-3">Choose a name for this journal follow.</p>
                  <Input
                    placeholder="Enter name (e.g. Cardiology Journals)"
                    value={followName}
                    onChange={e => setFollowName(e.target.value)}
                    maxLength={18}
                    suffix={<span className="text-gray-400 text-xs">{followName.length}/18</span>}
                    className="rounded-lg"
                  />
                </div>

                <div className="mb-6">
                  <h3 className="text-base font-semibold mb-3">Choose an icon</h3>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      "📰",
                      "🔬",
                      "🧪",
                      "🌱",
                      "🦠",
                      "🧬",
                      "🐁",
                      "🌿",
                      "🐟",
                      "🩺",
                      "🫀",
                      "🩻",
                      "🧫",
                      "🎗️",
                      "👶",
                      "🧓",
                      "🩸",
                      "🦴",
                      "🩹",
                      "📊",
                      "🎛️",
                      "📡",
                      "🤖",
                      "🧠",
                      "🌐",
                      "🔢",
                      "⚗️",
                      "🧊",
                      "🧲",
                      "💥",
                      "🌍",
                      "🌋",
                      "🌌",
                      "🛰️",
                      "🌡️",
                      "🔭",
                      "🧭",
                      "📚",
                      "📝",
                      "📂",
                      "📌",
                      "🔎",
                    ].map(icon => (
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

                {editingFollow && (
                  <>
                    <hr className="text-gray-200 mb-4" />
                    <div>
                      <h3 className="text-base font-semibold mb-1">Delete</h3>
                      <p className="text-sm text-gray-500 mb-3">Permanently remove this journal follow. This action cannot be undone.</p>
                      <Button
                        danger
                        icon={<span>🗑️</span>}
                        className="rounded-lg"
                        onClick={() => {
                          Modal.confirm({
                            title: "Delete Journal Follow",
                            content: `Are you sure you want to delete "${followName}"? This action cannot be undone.`,
                            okText: "Delete",
                            okType: "danger",
                            cancelText: "Cancel",
                            onOk: handleDelete,
                          });
                        }}
                      >
                        Delete journal follow
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ),
          },
          {
            key: "journalSources",
            label: (
              <span className="flex items-center gap-2">
                <BsFillJournalBookmarkFill /> Journal Sources
              </span>
            ),
            children: (
              <div className="py-4">
                <p className="text-sm text-gray-500 mb-4">Search and select journals to include articles from:</p>

                <div className="flex gap-2 mb-4 border-b border-gray-200">
                  <button
                    className={`px-4 py-2 font-medium text-sm ${
                      journalViewTab === "suggested" ? "border-b-2 border-gray-800" : "text-gray-500 hover:text-gray-800"
                    }`}
                    onClick={() => setJournalViewTab("suggested")}
                  >
                    {journalSearchTerm ? "Search Results" : "Top 20 Journals"}
                  </button>
                  <button
                    className={`px-4 py-2 font-medium text-sm ${
                      journalViewTab === "selected" ? "border-b-2 border-gray-800" : "text-gray-500 hover:text-gray-800"
                    }`}
                    onClick={() => setJournalViewTab("selected")}
                  >
                    Selected {selectedJournals.length > 0 && `(${selectedJournals.length})`}
                  </button>
                </div>

                {journalViewTab === "suggested" && (
                  <>
                    <Input.Search
                      placeholder="Search journals..."
                      allowClear
                      className="mb-4 rounded-lg"
                      value={journalSearchTerm}
                      onChange={e => setJournalSearchTerm(e.target.value)}
                      prefix={<span className="text-gray-400">🔍</span>}
                    />

                    {isLoadingJournals && <div className="text-center py-8 text-gray-500">Loading journals...</div>}
                    {journalsError && <div className="text-center py-8 text-red-500">Error loading journals. Please try again.</div>}

                    {!isLoadingJournals && !journalsError && journals && (
                      <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto p-2">
                        {journals.journals && journals.journals.length === 0 ? (
                          <div className="text-gray-500 text-sm w-full text-center py-4">No journals found matching "{journalSearchTerm}"</div>
                        ) : (
                          journals.journals &&
                          journals.journals.map((journal: any) => {
                            const isSelected = selectedJournals.includes(journal.journal_title);
                            return (
                              <button
                                key={journal.id}
                                onClick={() => toggleJournal(journal.journal_title)}
                                className={`px-4 py-3 rounded-lg text-left transition-all flex items-center justify-between ${
                                  isSelected ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                }`}
                              >
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{journal.journal_title}</div>
                                  {journal.wos_impact_factor && (
                                    <div className={`text-xs mt-1 ${isSelected ? "text-gray-300" : "text-gray-500"}`}>
                                      Impact Factor: {journal.wos_impact_factor.toFixed(1)}
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm ml-2">{isSelected ? "✕" : "+"}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </>
                )}

                {journalViewTab === "selected" && (
                  <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto p-2">
                    {selectedJournals.length === 0 ? (
                      <div className="text-gray-500 text-sm w-full text-center py-8">
                        No journals selected yet. Switch to "Top 20 Journals" to select journals.
                      </div>
                    ) : (
                      selectedJournals.map((journalTitle, index) => (
                        <button
                          key={`selected-${index}`}
                          onClick={() => toggleJournal(journalTitle)}
                          className="px-4 py-3 rounded-lg text-left transition-all flex items-center justify-between bg-gray-900 text-white hover:bg-gray-800"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">{journalTitle}</div>
                          </div>
                          <span className="text-sm ml-2">✕</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "contentPreferences",
            label: (
              <span className="flex items-center gap-2">
                <IoStatsChart /> Content Preferences
              </span>
            ),
            children: (
              <div className="py-4">
                <p className="text-sm text-gray-500 mb-2 -mt-2!">Customize what type of content appears in this feed.</p>
                <hr className="text-gray-300 mb-6" />

                <div className="mb-6">
                  <h3 className="text-base font-semibold mb-1">Set default sorting</h3>
                  <p className="text-sm text-gray-500 mb-3">Choose how articles are ordered.</p>
                  <Select
                    value={defaultSorting}
                    onChange={setDefaultSorting}
                    className="w-full"
                    options={[
                      {
                        value: "date",
                        label: (
                          <div className="flex items-center gap-4">
                            <IoCalendarNumberOutline className="text-md!" />
                            Date Published
                          </div>
                        ),
                      },
                      {
                        value: "upvotes",
                        label: (
                          <div className="flex items-center gap-4">
                            <SlLike className="text-md!" />
                            Up Votes
                          </div>
                        ),
                      },
                      {
                        value: "clicks",
                        label: (
                          <div className="flex items-center gap-4">
                            <PiCursorClick className="text-md!" />
                            Clicks
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>

                <div className="mb-6">
                  <h3 className="text-base font-semibold mb-1">Filter by time range</h3>
                  <p className="text-sm text-gray-500 mb-3">Include only articles published within a specific time range.</p>
                  <Radio.Group value={timeRange} onChange={e => setTimeRange(e.target.value)} className="flex flex-col gap-2">
                    <Radio value="all_time">All time</Radio>
                    {/* <Radio value="past_24_hours">Past 24 hours</Radio> */}
                    <Radio value="past_week">Past week</Radio>
                    <Radio value="past_month">Past month</Radio>
                  </Radio.Group>
                </div>

                <div className="mb-6">
                  <h3 className="text-base font-semibold mb-1">Publication types</h3>
                  <p className="text-sm text-gray-500 mb-3">Filter by specific publication types.</p>
                  {isLoadingPublicationTypes ? (
                    <div className="text-center py-4 text-gray-500">Loading publication types...</div>
                  ) : publicationTypesError ? (
                    <div className="text-center py-4 text-red-500">Error loading publication types.</div>
                  ) : (
                    <Select
                      mode="multiple"
                      allowClear
                      value={selectedPublicationTypes}
                      onChange={setSelectedPublicationTypes}
                      placeholder="Select publication types"
                      className="w-full"
                      options={
                        publicationTypes?.publication_types?.map((type: string) => ({
                          value: type,
                          label: type,
                        })) || []
                      }
                      maxTagCount="responsive"
                    />
                  )}
                </div>

                <div className="mb-6">
                  <Checkbox checked={graphicalAbstractOnly} onChange={e => setGraphicalAbstractOnly(e.target.checked)}>
                    <span className="font-medium">Include papers with graphical abstract only</span>
                  </Checkbox>
                  <p className="text-sm text-gray-500 ml-6 mt-1">Only show articles that have a graphical abstract available.</p>
                </div>

                <div className="mb-6">
                  <Checkbox checked={openAccessOnly} onChange={e => setOpenAccessOnly(e.target.checked)}>
                    <span className="font-medium">Open access papers only</span>
                  </Checkbox>
                  <p className="text-sm text-gray-500 ml-6 mt-1">Only show articles that are open access.</p>
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default NewJournalFollowModal;
