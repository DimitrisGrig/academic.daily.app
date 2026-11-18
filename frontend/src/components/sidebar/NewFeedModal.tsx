import { useState, useEffect } from "react";
import { Modal, Input, Tabs, Button, message, Select, Radio, Checkbox } from "antd";
import { EditOutlined, SettingOutlined } from "@ant-design/icons";
import { BsFillJournalBookmarkFill } from "react-icons/bs";
import { IoCalendarNumberOutline, IoStatsChart } from "react-icons/io5";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { SlLike } from "react-icons/sl";
import { PiCursorClick } from "react-icons/pi";
import { FaHatWizard } from "react-icons/fa6";
import { TbArrowBigDownLinesFilled } from "react-icons/tb";

interface NewFeedModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: (feedKey?: string) => void;
  editingFeed?: {
    key: string;
    name: string;
    icon: string;
    tags: string[];
    journals?: string[];
    include_all_journals?: boolean;
    publishers?: string[];
    default_sorting?: string;
    time_range?: string;
    publication_types?: string[];
    graphical_abstract_only?: boolean;
    open_access_only?: boolean;
  } | null;
}

const NewFeedModal: React.FC<NewFeedModalProps> = ({ open, onCancel, onOk, editingFeed }) => {
  const [feedName, setFeedName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("⚙️");
  const [activeTab, setActiveTab] = useState("general");
  const [feedPrompt, setFeedPrompt] = useState("");
  const [selectedJournals, setSelectedJournals] = useState<string[]>([]);
  const [journalSearchTerm, setJournalSearchTerm] = useState("");
  const [journalViewTab, setJournalViewTab] = useState<"suggested" | "selected">("suggested");
  const [includeAllJournals, setIncludeAllJournals] = useState(true);
  const [selectedPublishers, setSelectedPublishers] = useState<string[]>([]);
  const [defaultSorting, setDefaultSorting] = useState("recommended");
  const [timeRange, setTimeRange] = useState("all_time");
  const [selectedPublicationTypes, setSelectedPublicationTypes] = useState<string[]>([]);
  const [graphicalAbstractOnly, setGraphicalAbstractOnly] = useState(false);
  const [openAccessOnly, setOpenAccessOnly] = useState(false);

  // prettier-ignore
  const {data: journals, isLoading: isLoadingJournals, error: journalsError} = useQuery({
    queryKey: ["journals", journalSearchTerm],
    queryFn: async () => {
      const params = journalSearchTerm ? { search: journalSearchTerm } : {};
      const response = await axiosInstance.get("/customFeeds/get_journals", { params });
      return response.data;
    },
    enabled: open && activeTab === "SourceJournals", // Only fetch when modal is open and on journals tab
  });

  // prettier-ignore
  const {data: publicationTypes, isLoading: isLoadingPublicationTypes, error: publicationTypesError} = useQuery({
    queryKey: ["publicationTypes"],
    queryFn: async () => {
      const response = await axiosInstance.get("/customFeeds/get_publication_types");
      return response.data;
    },
    enabled: open && activeTab === "contentPreferences", // Only fetch when modal is open and on content preferences tab
  });

  // prettier-ignore
  const {} = useQuery({
    queryKey: ["publishers"],
    queryFn: async () => {
      const response = await axiosInstance.get("/customFeeds/get_publishers");
      return response.data;
    },
    enabled: open && activeTab === "SourceJournals", // Only fetch when modal is open and on journal sources tab
  });

  // Initialize form when modal opens
  useEffect(() => {
    if (open) {
      if (editingFeed) {
        // Editing mode - load existing feed data
        setFeedName(editingFeed.name);
        setSelectedIcon(editingFeed.icon);
        setFeedPrompt(editingFeed.tags?.join(", ") || "");
        setSelectedJournals(editingFeed.journals || []);
        setIncludeAllJournals(editingFeed.include_all_journals !== undefined ? editingFeed.include_all_journals : true);
        setSelectedPublishers(editingFeed.publishers || []);
        setDefaultSorting(editingFeed.default_sorting || "recommended");
        setTimeRange(editingFeed.time_range || "all_time");
        setSelectedPublicationTypes(editingFeed.publication_types || []);
        setGraphicalAbstractOnly(editingFeed.graphical_abstract_only || false);
        setOpenAccessOnly(editingFeed.open_access_only || false);
      } else {
        // Create mode - reset to defaults
        setFeedName("");
        setSelectedIcon("⚙️");
        setFeedPrompt("");
        setSelectedJournals([]);
        setIncludeAllJournals(true);
        setSelectedPublishers([]);
        setDefaultSorting("recommended");
        setTimeRange("all_time");
        setSelectedPublicationTypes([]);
        setGraphicalAbstractOnly(false);
        setOpenAccessOnly(false);
      }
      setActiveTab("general");
      setJournalSearchTerm("");
    }
  }, [open, editingFeed?.key]); // Only re-run when modal opens or editing different feed

  const toggleJournal = (journalTitle: string) => {
    setSelectedJournals(prev => {
      const newJournals = prev.includes(journalTitle) ? prev.filter(j => j !== journalTitle) : [...prev, journalTitle];
      return newJournals;
    });
  };

  const handleOk = async () => {
    if (!feedName.trim()) {
      message.warning("Please enter a feed name");
      return;
    }

    if (!feedPrompt.trim()) {
      Modal.confirm({
        title: "No interests added",
        content: `Are you sure you want to ${editingFeed ? "update" : "create"} this feed without adding any interests? Without interests, recommendations may be less relevant.`,
        okText: "Yes, continue",
        cancelText: "Go back",
        onOk: () => submitFeed(),
      });
      return;
    }

    await submitFeed();
  };

  const submitFeed = async () => {
    try {
      if (editingFeed) {
        // Update existing feed
        const updateData = {
          key: editingFeed.key,
          name: feedName.trim(),
          icon: selectedIcon,
          tags: feedPrompt.trim() ? [feedPrompt.trim()] : [],
          journals: selectedJournals,
          include_all_journals: includeAllJournals,
          publishers: selectedPublishers,
          default_sorting: defaultSorting,
          time_range: timeRange,
          publication_types: selectedPublicationTypes,
          graphical_abstract_only: graphicalAbstractOnly,
          open_access_only: openAccessOnly,
        };

        await axiosInstance.post("/customFeeds/update_feed", updateData);
        message.success("Feed updated successfully");
        // Call parent onOk callback (this will close the modal and refresh)
        onOk();
      } else {
        // Create new feed
        const feedData = {
          name: feedName.trim(),
          icon: selectedIcon,
          tags: feedPrompt.trim() ? [feedPrompt.trim()] : [],
          journals: selectedJournals,
          include_all_journals: includeAllJournals,
          publishers: selectedPublishers,
          default_sorting: defaultSorting,
          time_range: timeRange,
          publication_types: selectedPublicationTypes,
          graphical_abstract_only: graphicalAbstractOnly,
          open_access_only: openAccessOnly,
        };

        const response = await axiosInstance.post("/customFeeds/create_new_feed", feedData);
        message.success("Feed created successfully");
        // Call parent onOk callback with the new feed key (this will close the modal, refresh, and navigate)
        onOk(response.data.feed.key);
      }
    } catch (error: any) {
      console.error(`Error ${editingFeed ? "updating" : "creating"} feed:`, error);
      message.error(error?.response?.data?.detail || `Failed to ${editingFeed ? "update" : "create"} feed. Please try again.`);
    }
  };

  const handleDelete = async () => {
    if (!editingFeed) return;

    try {
      await axiosInstance.post("/customFeeds/delete_feed", { key: editingFeed.key });
      message.success("Feed deleted successfully");

      // Call parent onOk callback to refresh the list (this will close modal)
      onOk();
    } catch (error: any) {
      console.error("Error deleting feed:", error);
      message.error(error?.response?.data?.detail || "Failed to delete feed. Please try again.");
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-lg font-semibold">
          <SettingOutlined /> {editingFeed ? "Edit feed" : "My new feed"}
        </div>
      }
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      width={900}
      style={{ top: 20 }}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button key="create" type="primary" className="bg-gray-800" onClick={handleOk}>
          {editingFeed ? "Update feed" : "Create feed"}
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
                {/* Feed Name */}
                <div className="mb-6">
                  <h3 className="text-base font-semibold mb-1">Feed name</h3>
                  <p className="text-sm text-gray-500 mb-3">Choose a name for the feed.</p>
                  <Input
                    placeholder="Enter feed name"
                    value={feedName}
                    onChange={e => setFeedName(e.target.value)}
                    maxLength={18}
                    suffix={<span className="text-gray-400 text-xs">{feedName.length}/18</span>}
                    className="rounded-lg"
                  />
                </div>

                {/* Choose Icon */}
                <div className="mb-6">
                  <h3 className="text-base font-semibold mb-3">Choose an icon</h3>
                  <div className="flex gap-2 flex-wrap">
                    {[
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
                      "🧴",
                      "🧯",
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
                <hr className="text-gray-200 mb-2" />
                {/* Delete Feed - Only show when editing */}
                {editingFeed && (
                  <div>
                    <h3 className="text-base font-semibold mb-1">Delete feed</h3>
                    <p className="text-sm text-gray-500 mb-3">Permanently remove this feed and all its settings. This action cannot be undone.</p>
                    <Button
                      danger
                      icon={<span>🗑️</span>}
                      className="rounded-lg"
                      onClick={() => {
                        Modal.confirm({
                          title: "Delete Feed",
                          content: `Are you sure you want to delete "${feedName}"? This action cannot be undone.`,
                          okText: "Delete",
                          okType: "danger",
                          cancelText: "Cancel",
                          onOk: handleDelete,
                        });
                      }}
                    >
                      Delete feed
                    </Button>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "meshTerms",
            label: (
              <span className="flex items-center gap-2">
                <EditOutlined /> Interests
              </span>
            ),
            children: (
              <div className="py-4">
                <h3 className="text-base font-semibold mb-1">Describe this feed's focus</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Describe the topics, methods, or research questions this feed should cover. The more detail you provide, the better the
                  recommendations.
                </p>

                <Input.TextArea
                  value={feedPrompt}
                  onChange={e => setFeedPrompt(e.target.value)}
                  placeholder="e.g., I'm interested in CRISPR gene editing applications in oncology, particularly CAR-T cell therapy and tumor immunology..."
                  autoSize={{ minRows: 5, maxRows: 12 }}
                  maxLength={2000}
                  showCount
                  className="text-base! rounded-xl! mb-3!"
                />

                {/* Inline feedback */}
                <div className="text-sm">
                  {feedPrompt.trim().length === 0 ? (
                    <span className="text-gray-400">Write a few sentences about this feed's focus</span>
                  ) : feedPrompt.trim().length < 20 ? (
                    <span className="text-amber-500">Keep going — a bit more detail helps</span>
                  ) : (
                    <span className="text-green-600">Looks good!</span>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: "SourceJournals",
            label: (
              <span className="flex items-center gap-2">
                <BsFillJournalBookmarkFill /> Journal Sources
              </span>
            ),
            children: (
              <div className="py-4">
                {/* <h3 className="text-base font-semibold mb-1">Journal Sources</h3> */}
                <p className="text-sm text-gray-500 mb-2 -mt-2!">Journals to include content from in your feed.</p>

                <hr className="text-gray-300 mb-6" />

                {/* Journal Selection Mode - Radio Buttons */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-3">Journal Selection Mode</h3>
                  <Radio.Group
                    value={includeAllJournals ? "all" : "custom"}
                    onChange={e => {
                      const isAll = e.target.value === "all";
                      setIncludeAllJournals(isAll);
                      if (isAll) {
                        setSelectedJournals([]);
                        setSelectedPublishers([]);
                      }
                    }}
                    className="flex flex-col gap-3"
                  >
                    <Radio value="all" className="font-medium">
                      <div>
                        <div className="font-medium">Include all available journals</div>
                        <p className="text-sm text-gray-500 font-normal">Content from all journals will be included in your feed</p>
                      </div>
                    </Radio>
                    <Radio value="custom" className="font-medium">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium">Select specific journals or publishers</div>
                          <p className="text-sm text-gray-500 font-normal">Choose specific journals or filter by publishers</p>
                        </div>
                      </div>
                    </Radio>
                  </Radio.Group>
                </div>

                {/* Arrow down indicator */}
                <div className="flex justify-center">
                  {!includeAllJournals && <TbArrowBigDownLinesFilled className="text-gray-600! text-2xl! m-4" />}
                </div>

                {/* Show selection options only when "custom" mode is selected */}
                {!includeAllJournals && (
                  <>
                    <hr className="text-gray-300 mb-6" />

                    {/* Publishers Filter */}
                    {/* <div className="mb-6">
                      <h3 className="text-sm font-semibold mb-1">Select Publishers</h3>
                      <p className="text-sm text-gray-500 ml-6 mb-1">Include all journals from selected publishers in your feed.</p>

                      {isLoadingPublishers ? (
                        <div className="text-center py-2 text-gray-500 text-sm">Loading publishers...</div>
                      ) : publishersError ? (
                        <div className="text-center py-2 text-red-500 text-sm">Error loading publishers.</div>
                      ) : (
                        <Select
                          mode="multiple"
                          value={selectedPublishers}
                          onChange={value => {
                            setSelectedPublishers(value);
                          }}
                          placeholder="Select publishers (e.g., Nature, Elsevier)"
                          className="w-full"
                          options={
                            publishers?.publishers?.map((pub: string) => ({
                              value: pub,
                              label: pub,
                            })) || []
                          }
                          maxTagCount="responsive"
                        />
                      )}
                    </div> */}

                    <h3 className="text-sm font-semibold mb-1">Select Journals</h3>
                    <p className="text-sm text-gray-500 ml-6 mb-4">Journals to include articles from in your feed.</p>

                    {/* Tabs for Suggested/Selected journals */}
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

                    {/* Suggested Tab Content */}
                    {journalViewTab === "suggested" && (
                      <>
                        {/* Search Bar */}
                        <Input.Search
                          placeholder="Search journals..."
                          allowClear
                          className="mb-4 rounded-lg"
                          value={journalSearchTerm}
                          onChange={e => setJournalSearchTerm(e.target.value)}
                          prefix={<span className="text-gray-400">🔍</span>}
                          disabled={includeAllJournals}
                        />

                        {/* Loading State */}
                        {isLoadingJournals && <div className="text-center py-8 text-gray-500">Loading journals...</div>}

                        {/* Error State */}
                        {journalsError && <div className="text-center py-8 text-red-500">Error loading journals. Please try again.</div>}

                        {/* Journals List */}
                        {!isLoadingJournals && !journalsError && journals && (
                          <div className="flex flex-col gap-2 max-h-70 overflow-y-auto p-2">
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

                    {/* Selected Tab Content */}
                    {journalViewTab === "selected" && (
                      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto p-2">
                        {selectedJournals.length === 0 ? (
                          <div className="text-gray-500 text-sm w-full text-center py-8">
                            No journals selected yet. Switch to "Top 20 Journals" tab to select journals.
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
                  </>
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
                {/* <h3 className="text-base font-semibold mb-1">Content Preferences</h3> */}
                <p className="text-sm text-gray-500 mb-2 -mt-2!">Customize what type of content appears in your feed.</p>

                <hr className="text-gray-300 mb-6" />

                {/* Default Sorting */}
                <div className="mb-6">
                  <h3 className="text-base font-semibold mb-1">Set default sorting</h3>
                  <p className="text-sm text-gray-500 mb-3">Choose how articles are ordered in your feed.</p>
                  <Select
                    value={defaultSorting}
                    onChange={setDefaultSorting}
                    className="w-full"
                    options={[
                      {
                        value: "recommended",
                        label: (
                          <div className="flex items-center gap-4">
                            <FaHatWizard className="text-md!" />
                            Recommended
                          </div>
                        ),
                      },
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

                {/* Filter by Time Range */}
                <div className="mb-6">
                  <h3 className="text-base font-semibold mb-1">Filter by time range</h3>
                  <p className="text-sm text-gray-500 mb-3">Include only articles published within a specific time range.</p>
                  <Radio.Group value={timeRange} onChange={e => setTimeRange(e.target.value)} className="flex flex-col gap-2">
                    <Radio value="all_time">All time</Radio>
                    <Radio value="past_24_hours">Past 24 hours</Radio>
                    <Radio value="past_week">Past week</Radio>
                    <Radio value="past_month">Past month</Radio>
                  </Radio.Group>
                </div>

                {/* Publication Types Filter */}
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

                {/* Graphical Abstract Only */}
                <div className="mb-6">
                  <Checkbox checked={graphicalAbstractOnly} onChange={e => setGraphicalAbstractOnly(e.target.checked)}>
                    <span className="font-medium">Include papers with graphical abstract only</span>
                  </Checkbox>
                  <p className="text-sm text-gray-500 ml-6 mt-1">Only show articles that have a graphical abstract available.</p>
                </div>

                {/* Open Access Only */}
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

export default NewFeedModal;
