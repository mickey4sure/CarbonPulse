"use client";

import { useEffect, useState, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface PublicProfile {
  id: number;
  cleanName: string;
  maskedEmail: string;
  isSelf: boolean;
  totalActivities: number;
  totalCo2Kg: number;
  createdAt: string;
  avatar?: string;
  region?: string;
  country?: string;
}

interface Channel {
  id: string;
  name: string;
  description: string;
}

interface Comment {
  id: number;
  channelId: string;
  content: string;
  createdAt: string;
  user: {
    id: number;
    cleanName: string;
    maskedEmail: string;
    avatar?: string;
    isSelf: boolean;
  };
}

const CHALLENGES = [
  {
    id: "c1",
    title: "30-Day Zero Waste",
    daysLeft: 12,
    participants: 2847,
    description: "Eliminate single-use plastics from your daily routine for 30 days.",
    icon: "recycling",
    color: "border-chart-growth",
    iconColor: "text-chart-growth",
  },
  {
    id: "c2",
    title: "Car-Free Week",
    daysLeft: 3,
    participants: 1203,
    description: "Use only public transport, cycling, or walking for 7 consecutive days.",
    icon: "directions_bike",
    color: "border-chart-atmospheric",
    iconColor: "text-chart-atmospheric",
  },
  {
    id: "c3",
    title: "Plant-Based Month",
    daysLeft: 19,
    participants: 4112,
    description: "Eat plant-based meals every day for 30 days and track your food footprint.",
    icon: "spa",
    color: "border-primary-container",
    iconColor: "text-primary",
  },
];

export default function CommunityPage() {
  const [leaderboard, setLeaderboard] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<PublicProfile | null>(null);

  // Challenge Joining State
  const [joinedChallengeIds, setJoinedChallengeIds] = useState<string[]>([]);
  const [challengeStats, setChallengeStats] = useState<Record<string, number>>({});

  // Discussion Channels State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const renderAvatar = (avatarValue: string | undefined, sizeClass: string = "w-8 h-8 text-base") => {
    if (avatarValue && avatarValue.startsWith("data:image")) {
      return (
        <img
          src={avatarValue}
          alt="Avatar"
          className={`${sizeClass.split(" ")[0]} ${sizeClass.split(" ")[1]} rounded-full object-cover shadow-sm border border-outline/10`}
        />
      );
    }
    return (
      <span className="flex items-center justify-center rounded-full bg-[#154212]/10 dark:bg-[#A2D149]/10 text-lg w-8 h-8 font-bold">
        {avatarValue || "🌿"}
      </span>
    );
  };

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const token = localStorage.getItem("carbonnudge_token");
        if (!token) return;

        const res = await fetch(`${API_BASE}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const json: PublicProfile[] = await res.json();
          // Sort by activities count descending
          const sorted = json.sort((a, b) => b.totalActivities - a.totalActivities);
          setLeaderboard(sorted);
        }
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchChallengeData = async () => {
      try {
        const token = localStorage.getItem("carbonnudge_token");
        if (!token) return;

        // Fetch Joined challenges
        const joinedRes = await fetch(`${API_BASE}/api/challenges/joined`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (joinedRes.ok) {
          const data = await joinedRes.json();
          setJoinedChallengeIds(data);
        }

        // Fetch stats
        const statsRes = await fetch(`${API_BASE}/api/challenges/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statsRes.ok) {
          const data = await statsRes.json();
          setChallengeStats(data);
        }
      } catch (err) {
        console.error("Error fetching challenge data:", err);
      }
    };

    const fetchChannels = async () => {
      try {
        const token = localStorage.getItem("carbonnudge_token");
        if (!token) return;

        const res = await fetch(`${API_BASE}/api/discussion/channels`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setChannels(data);
          if (data.length > 0) {
            setActiveChannelId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching channels:", err);
      }
    };

    fetchLeaderboard();
    fetchChallengeData();
    fetchChannels();
  }, []);

  // Fetch comments when active channel changes
  useEffect(() => {
    if (!activeChannelId) return;

    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const token = localStorage.getItem("carbonnudge_token");
        if (!token) return;

        const res = await fetch(`${API_BASE}/api/discussion/channels/${activeChannelId}/comments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setComments(data);
        }
      } catch (err) {
        console.error("Error fetching comments:", err);
      } finally {
        setLoadingComments(false);
      }
    };

    fetchComments();
  }, [activeChannelId]);

  // Scroll to bottom on new comments
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [comments]);

  // Toggle Challenge Joined Status
  const handleToggleChallenge = async (challengeId: string) => {
    const isJoined = joinedChallengeIds.includes(challengeId);
    const action = isJoined ? "leave" : "join";
    try {
      const token = localStorage.getItem("carbonnudge_token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/challenges/${challengeId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        if (isJoined) {
          setJoinedChallengeIds((prev) => prev.filter((id) => id !== challengeId));
          setChallengeStats((prev) => ({
            ...prev,
            [challengeId]: Math.max(0, (prev[challengeId] || 1) - 1),
          }));
        } else {
          setJoinedChallengeIds((prev) => [...prev, challengeId]);
          setChallengeStats((prev) => ({
            ...prev,
            [challengeId] : (prev[challengeId] || 0) + 1,
          }));
        }
      }
    } catch (err) {
      console.error(`Error toggling challenge ${challengeId}:`, err);
    }
  };

  // Submit new comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || sendingComment || !activeChannelId) return;

    setSendingComment(true);
    try {
      const token = localStorage.getItem("carbonnudge_token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/discussion/channels/${activeChannelId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newCommentText }),
      });

      if (res.ok) {
        const addedComment = await res.json();
        setComments((prev) => [...prev, addedComment]);
        setNewCommentText("");
      }
    } catch (err) {
      console.error("Error posting comment:", err);
    } finally {
      setSendingComment(false);
    }
  };

  // Compute stats dynamically
  const activeCount = leaderboard.length || 0;
  const totalCo2Saved = Math.round(leaderboard.reduce((acc, u) => acc + u.totalCo2Kg, 0) * 10) / 10;
  const totalCompleted = leaderboard.reduce((acc, u) => acc + u.totalActivities, 0);

  const IMPACT = [
    { icon: "co2", label: "Total CO₂ Logged (kg)", value: totalCo2Saved },
    { icon: "group", label: "Active Members", value: activeCount },
    { icon: "flag", label: "Total Activities Logged", value: totalCompleted },
  ];

  // Helper to get level details
  const getLevelDetails = (count: number, co2: number) => {
    let level = 1;
    let levelName = "Eco Recruit";
    let levelColor = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    let levelDesc = "Just started their green journey.";
    let icon = "eco";

    if (count > 15) {
      level = 4;
      levelName = "Eco Champion";
      levelColor = "bg-primary-container text-on-primary";
      levelDesc = "A leading force in community carbon reduction.";
      icon = "workspace_premium";
    } else if (count > 5) {
      level = 3;
      levelName = "Eco Defender";
      levelColor = "bg-[#A2D149]/20 text-[#154212] dark:text-[#A2D149]";
      levelDesc = "Actively protecting the planet step-by-step.";
      icon = "shield";
    } else if (count > 0) {
      level = 2;
      levelName = "Eco Enthusiast";
      levelColor = "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300";
      levelDesc = "Regularly logging and improving habits.";
      icon = "psychology_alt";
    }

    const achievements = [
      { title: "First Nudge", unlocked: count >= 1, icon: "energy_savings_leaf", desc: "Logged at least 1 eco activity." },
      { title: "Habit Builder", unlocked: count >= 6, icon: "auto_stories", desc: "Logged over 5 actions." },
      { title: "Eco Master", unlocked: count >= 16, icon: "stars", desc: "Achieved Level 4 Status." },
      { title: "Carbon Crusader", unlocked: co2 >= 50, icon: "volunteer_activism", desc: "Logged 50kg+ of CO₂ reduction." },
    ];

    return { level, levelName, levelColor, levelDesc, icon, achievements };
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="font-headline-lg text-headline-lg text-text-heading mb-2">Community Hub</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Track less. Live greener — together.</p>
      </div>

      {/* Global impact banner */}
      <div className="rounded-2xl bg-primary-container p-6 md:p-8 mb-8 text-on-primary">
        <p className="font-label-sm text-label-sm text-on-primary-container uppercase mb-4">Global Impact</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {IMPACT.map(({ icon, label, value }) => (
            <div key={label} className="text-center">
              <span className="material-symbols-outlined text-on-primary-container mb-2" style={{ fontSize: 28, fontVariationSettings: "'FILL' 1" }}>
                {icon}
              </span>
              <p className="font-display-lg text-display-lg text-on-primary" style={{ fontSize: 32 }}>{value}</p>
              <p className="font-label-sm text-label-sm text-on-primary-container">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        {/* Active challenges */}
        <div className="col-span-1 md:col-span-7">
          <h2 className="font-headline-md text-headline-md text-text-heading mb-4">Active Challenges</h2>
          <div className="space-y-4">
            {CHALLENGES.map((ch) => {
              const isJoined = joinedChallengeIds.includes(ch.id);
              const dynamicParticipants = ch.participants + (challengeStats[ch.id] || 0);

              return (
                <div key={ch.id} className={`bento-card p-6 shadow-ambient bg-surface-white border-l-4 ${ch.color}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined ${ch.iconColor}`} style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>
                        {ch.icon}
                      </span>
                      <h3 className="font-headline-md text-headline-md text-text-heading">{ch.title}</h3>
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full whitespace-nowrap">
                      {ch.daysLeft}d left
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-4">{ch.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group</span>
                      {dynamicParticipants.toLocaleString()} joined
                    </span>
                    <button
                      onClick={() => handleToggleChallenge(ch.id)}
                      className={`px-4 py-2 rounded-full font-label-sm text-label-sm transition-all flex items-center gap-1 ${
                        isJoined
                          ? "bg-surface-container-high text-on-surface-variant hover:bg-red-100 hover:text-red-700 hover:border-red-300 border border-outline/10"
                          : "bg-primary-container text-on-primary hover:opacity-90"
                      }`}
                    >
                      {isJoined ? (
                        <>
                          <span className="material-symbols-outlined text-sm">check</span>
                          Joined
                        </>
                      ) : (
                        "Join Challenge"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="col-span-1 md:col-span-5">
          <h2 className="font-headline-md text-headline-md text-text-heading mb-4">Leaderboard</h2>
          <div className="bento-card shadow-ambient bg-surface-white overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-on-surface-variant font-body-md">
                Loading community standings...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant font-body-md">
                No active leaderboard participants yet.
              </div>
            ) : (
              leaderboard.map((entry, i) => {
                const rank = i + 1;
                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedUser(entry)}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors cursor-pointer ${
                      entry.isSelf
                        ? "bg-[#154212]/5 dark:bg-[#A2D149]/10 border-l-4 border-l-chart-growth"
                        : "hover:bg-surface-container-low"
                    } ${i < leaderboard.length - 1 ? "border-b border-outline/10" : ""}`}
                  >
                    <span className="font-label-sm text-label-sm text-on-surface-variant w-6 text-center">
                      {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
                    </span>
                    {renderAvatar(entry.avatar, "w-8 h-8")}
                    <div className="flex-1 min-w-0">
                      <p className={`font-body-md text-body-md font-medium truncate ${entry.isSelf ? "text-primary font-bold" : "text-text-heading"}`}>
                        {entry.cleanName} {entry.isSelf && "(You)"}
                      </p>
                      <p className="font-label-xs text-label-xs text-on-surface-variant">{entry.maskedEmail}</p>
                    </div>
                    <span className="font-label-sm text-label-sm text-text-heading whitespace-nowrap">
                      {entry.totalActivities} actions
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Discussion Area */}
      <div className="mb-8">
        <h2 className="font-headline-md text-headline-md text-text-heading mb-4">Discussion Area</h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bento-card shadow-ambient bg-surface-white overflow-hidden min-h-[480px]">
          
          {/* Channels list sidebar */}
          <div className="col-span-1 md:col-span-4 border-r border-outline/10 bg-slate-50/50 dark:bg-slate-900/10 p-4">
            <h3 className="font-label-sm text-xs font-bold text-on-surface-variant uppercase mb-4 tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">forum</span>
              Channels
            </h3>
            <div className="space-y-2">
              {channels.map((chan) => {
                const isActive = chan.id === activeChannelId;
                return (
                  <button
                    key={chan.id}
                    onClick={() => setActiveChannelId(chan.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-primary-container text-on-primary shadow-sm font-semibold"
                        : "hover:bg-surface-container-low text-text-heading"
                    }`}
                  >
                    <div className="font-body-md text-sm truncate">{chan.name}</div>
                    <p className={`text-[11px] truncate mt-0.5 ${
                      isActive ? "text-on-primary-container/85" : "text-on-surface-variant"
                    }`}>
                      {chan.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat main viewport */}
          <div className="col-span-1 md:col-span-8 flex flex-col justify-between h-[480px] bg-white dark:bg-transparent">
            {/* Header info */}
            {activeChannelId && (() => {
              const activeChan = channels.find((c) => c.id === activeChannelId);
              return (
                <div className="px-6 py-4 border-b border-outline/10 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/10">
                  <div>
                    <h3 className="font-headline-md text-base font-bold text-text-heading flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">chat_bubble</span>
                      {activeChan?.name}
                    </h3>
                    <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                      {activeChan?.description}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Comments Scrollable area */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {loadingComments ? (
                <div className="h-full flex items-center justify-center text-on-surface-variant font-body-md text-sm">
                  Loading discussions...
                </div>
              ) : comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <span className="material-symbols-outlined text-outline/40 text-4xl mb-2">forum</span>
                  <p className="font-body-md text-sm text-on-surface-variant">No comments yet in this channel.</p>
                  <p className="font-body-sm text-xs text-on-surface-variant/80 mt-1">Be the first to share your thoughts!</p>
                </div>
              ) : (
                comments.map((comm) => (
                  <div
                    key={comm.id}
                    className={`flex gap-3 max-w-[85%] ${
                      comm.user.isSelf ? "ml-auto flex-row-reverse" : ""
                    }`}
                  >
                    {renderAvatar(comm.user.avatar, "w-8 h-8 mt-1")}
                    <div>
                      <div className={`flex items-baseline gap-2 mb-1 ${
                        comm.user.isSelf ? "justify-end" : ""
                      }`}>
                        <span className={`font-label-sm text-xs font-semibold ${
                          comm.user.isSelf ? "text-primary" : "text-text-heading"
                        }`}>
                          {comm.user.cleanName} {comm.user.isSelf && "(You)"}
                        </span>
                        <span className="text-[9px] text-on-surface-variant">
                          {new Date(comm.createdAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className={`px-4 py-2.5 rounded-2xl font-body-md text-sm shadow-sm ${
                        comm.user.isSelf
                          ? "bg-primary-container text-on-primary rounded-tr-none"
                          : "bg-surface-container-low text-text-heading rounded-tl-none border border-outline/5"
                      }`}>
                        {comm.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Post comment input */}
            <form onSubmit={handleSubmitComment} className="p-4 border-t border-outline/10 flex gap-2 items-center bg-slate-50/20 dark:bg-slate-800/5">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={`Message ${channels.find((c) => c.id === activeChannelId)?.name || "channel"}...`}
                disabled={sendingComment}
                className="flex-1 px-4 py-2.5 rounded-xl border border-outline/10 bg-surface-white dark:bg-slate-900/40 text-text-heading font-body-md text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-65"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim() || sendingComment}
                className="bg-primary text-on-primary p-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md"
              >
                {sendingComment ? (
                  <span className="material-symbols-outlined animate-spin text-lg">autorenew</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">send</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Profile Card Modal */}
      {selectedUser && (() => {
        const { level, levelName, levelColor, levelDesc, icon, achievements } = getLevelDetails(
          selectedUser.totalActivities,
          selectedUser.totalCo2Kg
        );
        const joinDate = selectedUser.createdAt
          ? new Date(selectedUser.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "Recently";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-surface-white border border-outline/10 rounded-2xl shadow-xl overflow-hidden relative transition-all">
              
              {/* Header block with gradient banner */}
              <div className="h-28 bg-gradient-to-r from-[#154212] to-[#A2D149] relative">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="absolute top-4 right-4 bg-slate-900/30 hover:bg-slate-900/50 text-white rounded-full p-2 flex items-center justify-center transition-colors"
                  aria-label="Close Profile"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>

              {/* User Identity Section */}
              <div className="px-6 pb-6 pt-0 relative flex flex-col items-center">
                {/* Floating Avatar */}
                <div className="w-20 h-20 rounded-full border-4 border-surface-white bg-primary-container flex items-center justify-center -mt-10 mb-3 shadow-md overflow-hidden">
                  {selectedUser.avatar && selectedUser.avatar.startsWith("data:image") ? (
                    <img
                      src={selectedUser.avatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">{selectedUser.avatar || "🌿"}</span>
                  )}
                </div>

                <h3 className="font-headline-md text-xl font-bold text-text-heading mb-1 text-center">
                  {selectedUser.cleanName} {selectedUser.isSelf && "(You)"}
                </h3>
                <p className="font-label-sm text-sm text-on-surface-variant mb-1 text-center">
                  {selectedUser.maskedEmail}
                </p>
                {selectedUser.region && selectedUser.country && (
                  <p className="font-body-md text-xs text-primary mb-4 text-center">
                    📍 {selectedUser.region}, {selectedUser.country}
                  </p>
                )}

                {/* Level Tag */}
                <div className={`px-4 py-1.5 rounded-full font-label-sm text-xs font-bold mb-1 flex items-center gap-1.5 ${levelColor}`}>
                  <span className="material-symbols-outlined text-sm">{icon}</span>
                  Level {level}: {levelName}
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant text-center max-w-[80%] mb-6">
                  {levelDesc}
                </p>

                {/* Grid Stats */}
                <div className="grid grid-cols-2 gap-4 w-full bg-background-subtle p-4 rounded-xl border border-outline/10 mb-6">
                  <div className="text-center border-r border-outline/10">
                    <p className="font-label-xs text-xs text-on-surface-variant uppercase mb-1">Actions Logged</p>
                    <p className="font-headline-sm text-lg font-bold text-text-heading">{selectedUser.totalActivities}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-label-xs text-xs text-on-surface-variant uppercase mb-1">CO₂ Logged</p>
                    <p className="font-headline-sm text-lg font-bold text-text-heading">{selectedUser.totalCo2Kg} kg</p>
                  </div>
                </div>

                {/* Achievements Checklist */}
                <div className="w-full">
                  <h4 className="font-label-sm text-xs uppercase font-bold text-text-heading mb-3 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">emoji_events</span>
                    Achievements
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {achievements.map((ach) => (
                      <div
                        key={ach.title}
                        className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                          ach.unlocked
                            ? "bg-[#154212]/5 dark:bg-[#A2D149]/10 border-chart-growth/20"
                            : "bg-surface-container-low border-outline/10 opacity-55"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-lg mt-0.5 ${
                            ach.unlocked ? "text-primary" : "text-on-surface-variant"
                          }`}
                          style={ach.unlocked ? { fontVariationSettings: "'FILL' 1" } : {}}
                        >
                          {ach.icon}
                        </span>
                        <div>
                          <p className={`font-label-sm text-xs font-semibold ${ach.unlocked ? "text-text-heading" : "text-on-surface-variant"}`}>
                            {ach.title}
                          </p>
                          <p className="text-[10px] text-on-surface-variant leading-tight mt-0.5">
                            {ach.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer details */}
                <div className="mt-6 pt-4 border-t border-outline/10 w-full text-center">
                  <p className="font-label-xs text-[10px] text-on-surface-variant">
                    Member since {joinDate}
                  </p>
                </div>

              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
