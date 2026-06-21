"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface UserProfile {
  id: number;
  email: string;
  firebaseUid: string;
  createdAt: string;
  totalActivitiesCount: number;
  totalCo2Kg: number;
  name?: string;
  username?: string;
  phone?: string;
  age?: number;
  region?: string;
  country?: string;
  avatar?: string;
}

interface PublicProfile {
  id: number;
  cleanName: string;
  maskedEmail: string;
  isSelf: boolean;
  totalActivities: number;
  totalCo2Kg: number;
  createdAt: string;
  region?: string;
  country?: string;
  avatar?: string;
}

const AVATARS = ["🌱", "🌿", "🏆", "⚡", "🚲", "☀️", "🐼", "💧"];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [community, setCommunity] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    phone: "",
    age: "",
    region: "",
    country: "",
    avatar: "",
  });

  const fetchProfileData = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("carbonnudge_token") : null;
      if (!token) {
        // Redirect to login if not logged in
        router.push("/login?redirect=/profile");
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Get current profile
      const profileRes = await fetch(`${API_BASE}/api/users/me`, { headers });
      if (!profileRes.ok) throw new Error("Failed to fetch profile");
      const profileJson = await profileRes.json();
      setProfile(profileJson);
      setFormData({
        name: profileJson.name || "",
        username: profileJson.username || "",
        phone: profileJson.phone || "",
        age: profileJson.age?.toString() || "",
        region: profileJson.region || "",
        country: profileJson.country || "",
        avatar: profileJson.avatar || "🌱",
      });

      // Get other members
      const communityRes = await fetch(`${API_BASE}/api/users`, { headers });
      if (communityRes.ok) {
        const communityJson = await communityRes.json();
        setCommunity(communityJson);
      }
    } catch (err: any) {
      console.error(err);
      setError("Unable to load profile data.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarSelect = (emoji: string) => {
    setFormData((prev) => ({ ...prev, avatar: emoji }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 1.5MB to keep database payload lightweight)
    if (file.size > 1.5 * 1024 * 1024) {
      alert("Image is too large. Please select an image smaller than 1.5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setFormData((prev) => ({ ...prev, avatar: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      const token = localStorage.getItem("carbonnudge_token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          age: formData.age ? parseInt(formData.age) : null,
        }),
      });

      if (res.ok) {
        setSuccessMsg("Profile updated successfully!");
        setIsEditing(false);
        fetchProfileData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update profile details.");
      }
    } catch (err) {
      console.error("Save profile error:", err);
      setError("Error saving profile details.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("carbonnudge_token");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#A2D149] border-t-transparent animate-spin" />
        <p className="font-label-sm text-on-surface-variant">Loading your profile...</p>
      </div>
    );
  }

  // Determine displayName to show
  const displayName = profile?.name || profile?.email.split("@")[0] || "Eco Warrior";
  const userInitials = profile?.name
    ? profile.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : profile?.email.substring(0, 2).toUpperCase() || "EW";

  // Reusable avatar rendering helper
  const renderAvatar = (avatarValue: string | undefined, initials: string, sizeClass: string = "w-16 h-16 text-3xl") => {
    if (avatarValue && avatarValue.startsWith("data:image")) {
      return (
        <img
          src={avatarValue}
          alt="Profile Photo"
          className={`${sizeClass.split(" ")[0]} ${sizeClass.split(" ")[1]} rounded-full object-cover shadow-sm border border-outline/10`}
        />
      );
    }
    return (
      <div className={`${sizeClass} rounded-full bg-[#154212] text-[#A2D149] flex items-center justify-center font-bold shadow-sm border border-outline/5`}>
        {avatarValue || initials}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-headline-lg text-headline-lg text-text-heading mb-2">My Profile</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Manage your account and see your community impact.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-error-container text-on-error-container rounded-xl font-body-md text-body-md animate-fade-in">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-[#154212]/10 text-primary rounded-xl font-body-md text-body-md border border-[#154212]/20 animate-fade-in">
          {successMsg}
        </div>
      )}

      {profile && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User profile detail card */}
          <div className="bento-card p-6 md:p-8 col-span-1 md:col-span-1 shadow-ambient bg-surface-white flex flex-col justify-between">
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <h3 className="font-headline-md text-headline-md text-text-heading mb-2">Edit Profile</h3>
                
                {/* Choose Avatar or Custom Upload */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-2">Profile Photo / Icon</label>
                  
                  {/* Selected Preview & Upload Trigger */}
                  <div className="flex items-center gap-4 mb-4">
                    {renderAvatar(formData.avatar, userInitials)}
                    <div>
                      <p className="text-xs text-text-heading font-bold">Avatar Preview</p>
                      <button
                        type="button"
                        onClick={() => {
                          const fileInput = document.getElementById("avatar-file-input");
                          if (fileInput) fileInput.click();
                        }}
                        className="text-xs text-primary font-bold hover:underline mt-1 block"
                      >
                        Upload photo from device
                      </button>
                      <input
                        id="avatar-file-input"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Preset Emojis */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {AVATARS.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => handleAvatarSelect(emoji)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-lg border transition-all ${
                          formData.avatar === emoji
                            ? "bg-primary border-primary text-white scale-110 shadow-sm"
                            : "bg-surface-container border-outline/20 hover:scale-105"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Alex Kumar"
                    className="w-full p-2.5 rounded-xl border border-outline/20 bg-background-subtle text-text-heading text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="e.g. alex_kumar"
                    className="w-full p-2.5 rounded-xl border border-outline/20 bg-background-subtle text-text-heading text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    placeholder="e.g. 28"
                    className="w-full p-2.5 rounded-xl border border-outline/20 bg-background-subtle text-text-heading text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Contact Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full p-2.5 rounded-xl border border-outline/20 bg-background-subtle text-text-heading text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Region / State</label>
                  <input
                    type="text"
                    name="region"
                    value={formData.region}
                    onChange={handleInputChange}
                    placeholder="e.g. Maharashtra"
                    className="w-full p-2.5 rounded-xl border border-outline/20 bg-background-subtle text-text-heading text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Country</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="e.g. India"
                    className="w-full p-2.5 rounded-xl border border-outline/20 bg-background-subtle text-text-heading text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-primary text-on-primary py-2.5 rounded-xl font-label-sm text-xs hover:opacity-90 transition-opacity font-bold"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        name: profile.name || "",
                        username: profile.username || "",
                        phone: profile.phone || "",
                        age: profile.age?.toString() || "",
                        region: profile.region || "",
                        country: profile.country || "",
                        avatar: profile.avatar || "🌱",
                      });
                    }}
                    className="flex-1 border border-outline/20 text-on-surface-variant py-2.5 rounded-xl font-label-sm text-xs hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  {renderAvatar(profile.avatar, userInitials)}
                  <div className="min-w-0">
                    <h2 className="font-headline-md text-headline-md text-text-heading truncate">
                      {displayName}
                    </h2>
                    <p className="font-body-md text-body-md text-on-surface-variant truncate">
                      {profile.username ? `@${profile.username}` : profile.email}
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5 border-t border-outline/10 pt-4">
                  <div className="flex justify-between">
                    <span className="font-body-md text-on-surface-variant text-sm">Email</span>
                    <span className="font-label-sm text-text-heading text-sm truncate max-w-[180px]">{profile.email}</span>
                  </div>
                  {profile.age && (
                    <div className="flex justify-between">
                      <span className="font-body-md text-on-surface-variant text-sm">Age</span>
                      <span className="font-label-sm text-text-heading text-sm">{profile.age} yrs</span>
                    </div>
                  )}
                  {profile.phone && (
                    <div className="flex justify-between">
                      <span className="font-body-md text-on-surface-variant text-sm">Contact</span>
                      <span className="font-label-sm text-text-heading text-sm">{profile.phone}</span>
                    </div>
                  )}
                  {profile.region && (
                    <div className="flex justify-between">
                      <span className="font-body-md text-on-surface-variant text-sm">Region</span>
                      <span className="font-label-sm text-text-heading text-sm">{profile.region}</span>
                    </div>
                  )}
                  {profile.country && (
                    <div className="flex justify-between">
                      <span className="font-body-md text-on-surface-variant text-sm">Country</span>
                      <span className="font-label-sm text-text-heading text-sm">{profile.country}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-body-md text-on-surface-variant text-sm">Member ID</span>
                    <span className="font-label-sm text-text-heading text-sm">#{profile.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-body-md text-on-surface-variant text-sm">Joined</span>
                    <span className="font-label-sm text-text-heading text-sm">
                      {new Date(profile.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 bg-primary-container text-on-primary py-2.5 rounded-xl font-label-sm text-label-sm hover:opacity-90 transition-opacity font-bold"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 border border-red-500/30 text-red-500 hover:bg-red-500/10 py-2.5 rounded-xl font-label-sm text-label-sm transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats breakdown */}
          <div className="bento-card p-6 md:p-8 col-span-1 md:col-span-2 shadow-ambient bg-surface-white flex flex-col justify-between">
            <div>
              <h3 className="font-headline-md text-headline-md text-text-heading mb-6">Emissions Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 bg-background-subtle rounded-2xl border border-outline/10">
                  <span className="font-label-sm text-on-surface-variant uppercase text-xs">Total Footprint Logged</span>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-display-lg text-3xl font-bold text-text-heading">
                      {Math.round(profile.totalCo2Kg * 10) / 10}
                    </span>
                    <span className="font-body-md text-on-surface-variant">kg CO₂e</span>
                  </div>
                </div>
                <div className="p-5 bg-background-subtle rounded-2xl border border-outline/10">
                  <span className="font-label-sm text-on-surface-variant uppercase text-xs">Activities Tracked</span>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-display-lg text-3xl font-bold text-text-heading">
                      {profile.totalActivitiesCount}
                    </span>
                    <span className="font-body-md text-on-surface-variant">actions</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-[#154212]/5 text-[#154212] dark:text-[#A2D149] rounded-xl flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5" style={{ fontSize: 20 }}>security</span>
              <div>
                <h4 className="font-label-sm text-sm font-bold mb-1">Privacy & Security</h4>
                <p className="font-body-md text-xs leading-relaxed opacity-90">
                  Your raw email address and activities are strictly confidential. In accordance with our GDPR and CCPA compliant Privacy Policy and Terms of Service, other community members can only view your stats via a randomized alias and masked identifiers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Community Members List Section */}
      <div className="bento-card p-6 md:p-8 shadow-ambient bg-surface-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-headline-md text-headline-md text-text-heading">Community Members</h3>
            <p className="font-body-md text-sm text-on-surface-variant mt-1">
              Active users participating in the CarboNudge challenge.
            </p>
          </div>
          <span className="font-label-xs text-xs px-3 py-1 bg-surface-container text-[#154212] dark:text-[#A2D149] rounded-full font-bold">
            🛡️ Privacy Protected
          </span>
        </div>

        {/* Member cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {community.map((member) => (
            <div
              key={member.id}
              className={`p-5 rounded-2xl border transition-all ${
                member.isSelf
                  ? "bg-[#154212]/5 border-[#154212]/30"
                  : "bg-background-subtle border-outline/10"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                {renderAvatar(member.avatar, member.cleanName.startsWith("@") ? member.cleanName.substring(1, 3).toUpperCase() : member.cleanName.substring(11), "w-10 h-10 text-lg")}
                <div className="min-w-0">
                  <span className="font-label-sm text-text-heading block font-bold truncate">
                    {member.cleanName} {member.isSelf && "(You)"}
                  </span>
                  <span className="font-body-md text-xs text-on-surface-variant block truncate">
                    {member.maskedEmail}
                  </span>
                  {member.region && member.country && (
                    <span className="font-body-md text-[10px] text-primary block truncate">
                      📍 {member.region}, {member.country}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center border-t border-outline/5 pt-3">
                <div>
                  <span className="font-label-xs text-[10px] text-on-surface-variant block uppercase">
                    Score / CO₂
                  </span>
                  <span className="font-label-sm font-bold text-text-heading">
                    {member.totalCo2Kg} kg
                  </span>
                </div>
                <div>
                  <span className="font-label-xs text-[10px] text-on-surface-variant block uppercase">
                    Activities
                  </span>
                  <span className="font-label-sm font-bold text-text-heading">
                    {member.totalActivities}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-outline/10 pt-6">
          <p className="font-body-md text-xs text-on-surface-variant text-center leading-relaxed">
            By using CarboNudge, you agree to our <strong>Terms and Conditions</strong> and <strong>Privacy Policy</strong>. 
            All data transmitted is encrypted in transit and at rest. Under no circumstances is user PII sold or shared with third parties.
          </p>
        </div>
      </div>
    </div>
  );
}
