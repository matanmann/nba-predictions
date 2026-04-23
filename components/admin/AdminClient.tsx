"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SnackQuestion {
  id: number;
  question: string;
  result: boolean | null;
  order: number;
}

interface AdminParticipant {
  userId: string;
  displayName: string;
  email: string;
}

interface GeneralQuestion {
  key: string;
  label: string;
}

interface PlayoffLeaderInput {
  category: string;
  playerName: string;
}

const LEADER_CATEGORY_LABELS: Record<string, string> = {
  Points: "Points leader",
  Assists: "Assists leader",
  Rebounds: "Rebounds leader",
  Blocks: "Blocks leader",
  Steals: "Steals leader",
  __mvp_east: "East MVP",
  __mvp_west: "West MVP",
  __mvp_finals: "Finals MVP",
};

const DEFAULT_LEADER_CATEGORIES = [
  "Points",
  "Assists",
  "Rebounds",
  "Blocks",
  "Steals",
  "__mvp_east",
  "__mvp_west",
  "__mvp_finals",
] as const;

export default function AdminClient({ year }: { year: number }) {
  const [snacks, setSnacks] = useState<SnackQuestion[]>([]);
  const [generalQuestions, setGeneralQuestions] = useState<GeneralQuestion[]>([]);
  const [generalAnswers, setGeneralAnswers] = useState<Record<string, string>>({});
  const [leaders, setLeaders] = useState<PlayoffLeaderInput[]>([]);
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [deniPpg, setDeniPpg] = useState("");
  const [deniRpg, setDeniRpg] = useState("");
  const [deniApg, setDeniApg] = useState("");
  const [deniGamesPlayed, setDeniGamesPlayed] = useState("");
  const [deniGamesLog, setDeniGamesLog] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [initRunning, setInitRunning] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/data?year=${year}`);
      if (res.status === 403) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setSnacks(data.snackQuestions ?? []);
      setGeneralQuestions(data.generalQuestions ?? []);
      const loadedGeneralAnswers = Object.fromEntries(
        ((data.generalQuestions ?? []) as GeneralQuestion[]).map((q) => {
          const raw = data.generalResults?.[q.key];
          return [q.key, raw === null || raw === undefined ? "" : String(raw)];
        })
      ) as Record<string, string>;
      setGeneralAnswers(loadedGeneralAnswers);
      const loadedLeaders = (data.playoffLeaders ?? []) as PlayoffLeaderInput[];
      const leaderMap = new Map(loadedLeaders.map((item) => [item.category, item.playerName]));
      const normalizedLeaders = DEFAULT_LEADER_CATEGORIES.map((category) => ({
        category,
        playerName: leaderMap.get(category) ?? "",
      }));
      setLeaders(normalizedLeaders);
      setParticipants(data.participants ?? []);
      if (data.participants?.length) {
        setSelectedUserId(data.participants[0].userId);
      }
      const deniTracker = data.generalResults?.deniTracker;
      setDeniPpg(deniTracker?.totals?.ppg != null ? String(deniTracker.totals.ppg) : "");
      setDeniRpg(deniTracker?.totals?.rpg != null ? String(deniTracker.totals.rpg) : "");
      setDeniApg(deniTracker?.totals?.apg != null ? String(deniTracker.totals.apg) : "");
      setDeniGamesPlayed(
        deniTracker?.totals?.gamesPlayed != null ? String(deniTracker.totals.gamesPlayed) : ""
      );
      setDeniGamesLog(
        Array.isArray(deniTracker?.games)
          ? deniTracker.games
              .map(
                (g: { date: string; min: string; pts: number; reb: number; ast: number }) =>
                  `${g.date},${g.min},${g.pts},${g.reb},${g.ast}`
              )
              .join("\n")
          : ""
      );
      setLoading(false);
    }
    load();
  }, [year, router]);

  const notify = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  async function handleSave() {
    const hasAnyDeniValue =
      deniPpg.trim() !== "" ||
      deniRpg.trim() !== "" ||
      deniApg.trim() !== "" ||
      deniGamesPlayed.trim() !== "" ||
      deniGamesLog.trim() !== "";

    let deniTrackerPayload: {
      totals: { ppg: number; rpg: number; apg: number; gamesPlayed: number };
      games: { date: string; min: string; pts: number; reb: number; ast: number }[];
    } | null | undefined = undefined;

    if (hasAnyDeniValue) {
      const ppg = Number(deniPpg);
      const rpg = Number(deniRpg);
      const apg = Number(deniApg);
      const gamesPlayed = Number(deniGamesPlayed);

      if (![ppg, rpg, apg].every(Number.isFinite) || !Number.isInteger(gamesPlayed)) {
        notify("Deni totals are invalid. Please use numbers (games must be an integer).", "error");
        return;
      }

      const games = deniGamesLog
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [date, min, pts, reb, ast] = line.split(",").map((part) => part.trim());
          return {
            date,
            min,
            pts: Number(pts),
            reb: Number(reb),
            ast: Number(ast),
          };
        });

      const gamesValid = games.every(
        (game) =>
          game.date &&
          game.min &&
          [game.pts, game.reb, game.ast].every((value) => Number.isFinite(value))
      );

      if (!gamesValid) {
        notify("Deni game log format is invalid. Use: YYYY-MM-DD,MIN,PTS,REB,AST", "error");
        return;
      }

      deniTrackerPayload = {
        totals: { ppg, rpg, apg, gamesPlayed },
        games,
      };
    } else {
      deniTrackerPayload = null;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          snackAnswers: snacks.map((q) => ({ id: q.id, result: q.result })),
          generalResults: Object.fromEntries(
            generalQuestions.map((q) => {
              const value = generalAnswers[q.key]?.trim() ?? "";
              return [q.key, value === "" ? null : Number(value)];
            })
          ),
          deniTracker: deniTrackerPayload,
          playoffLeaders: leaders.map((item) => ({
            category: item.category,
            playerName: item.playerName.trim(),
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      notify("Saved and scores recalculated");
    } catch {
      notify("Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      // Uses the admin-authenticated endpoint, NOT the cron endpoint
      const res = await fetch("/api/admin/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      notify(
        `Synced: ${data.seriesUpdated} series, ${data.leadersUpdated} leaders`
      );
    } catch {
      notify("Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  }

  async function handleInitSeason() {
    setInitRunning(true);
    try {
      const res = await fetch("/api/admin/init-season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      if (!res.ok) throw new Error("Init failed");
      const data = await res.json();
      notify(`Bracket initialized: ${data.teams} teams, ${data.series} series`);
    } catch {
      notify("Init failed", "error");
    } finally {
      setInitRunning(false);
    }
  }

  function handleEditUserPredictions() {
    if (!selectedUserId) return;
    router.push(`/predict/${year}?adminUserId=${encodeURIComponent(selectedUserId)}`);
  }

  if (loading) return <div className="p-6 text-gray-500">Loading admin panel...</div>;

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs font-medium text-red-700 tracking-wide">
            ADMIN · {year} PLAYOFFS
          </span>
        </div>
        <h1 className="text-xl font-medium text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Everything else is automated. Only fill in what&apos;s below.
        </p>
      </div>

      {/* Toast */}
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Automation Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-900 mb-1">Automated data</p>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          These update every 5 minutes via cron. Use these buttons to trigger
          manually.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleInitSeason}
            disabled={initRunning}
            className="text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {initRunning ? "Building bracket..." : "Init bracket from standings"}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Force sync now"}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            "Series results",
            "Stat leaders",
            "OT games count",
            "Game 7 count",
            "Series scorers",
            "Bracket advancement",
          ].map((label) => (
            <div key={label} className="p-2 rounded-lg bg-gray-50">
              <p className="text-[11px] text-gray-500">{label}</p>
              <p className="text-xs font-medium text-green-600">Auto</p>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Prediction Editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">
              Edit user predictions
            </p>
            <p className="text-xs text-gray-500">
              Open the prediction form for any user and edit it as admin.
            </p>
          </div>
          <span className="text-[11px] bg-red-50 text-red-700 px-2 py-0.5 rounded-md font-medium">
            Admin only
          </span>
        </div>

        {participants.length === 0 ? (
          <p className="text-xs text-gray-500">No users found for this season yet.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            >
              {participants.map((participant) => (
                <option key={participant.userId} value={participant.userId}>
                  {participant.displayName} ({participant.email})
                </option>
              ))}
            </select>
            <button
              onClick={handleEditUserPredictions}
              disabled={!selectedUserId}
              className="px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
            >
              Edit predictions
            </button>
          </div>
        )}
      </div>

      {/* General Questions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">General questions results</p>
            <p className="text-xs text-gray-500">Set all numeric results manually when needed.</p>
          </div>
          <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-medium">
            Manual
          </span>
        </div>
        {generalQuestions.length === 0 ? (
          <p className="text-xs text-gray-500">No configured general questions for this season.</p>
        ) : (
          <div className="space-y-2">
            {generalQuestions.map((q) => (
              <div key={q.key} className="flex items-center gap-3">
                <label className="text-sm text-gray-700 flex-1">{q.label}</label>
                <input
                  type="number"
                  value={generalAnswers[q.key] ?? ""}
                  onChange={(e) =>
                    setGeneralAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))
                  }
                  placeholder="pending"
                  className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-right"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stat Leaders and MVPs */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Stat leaders and MVPs</p>
            <p className="text-xs text-gray-500">Set winners manually (leave empty for pending).</p>
          </div>
          <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-medium">
            Manual
          </span>
        </div>
        <div className="space-y-2">
          {leaders.map((item, index) => (
            <div key={item.category} className="flex items-center gap-3">
              <label className="text-sm text-gray-700 w-40 sm:w-52">
                {LEADER_CATEGORY_LABELS[item.category] ?? item.category}
              </label>
              <input
                type="text"
                value={item.playerName}
                onChange={(e) => {
                  const value = e.target.value;
                  setLeaders((prev) =>
                    prev.map((row, i) => (i === index ? { ...row, playerName: value } : row))
                  );
                }}
                placeholder="Player name"
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Deni Manual Tracker */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Deni tracker (manual fallback)</p>
            <p className="text-xs text-gray-500">
              Fill this only if BallDontLie player stats are unavailable. Leave all fields empty to clear manual fallback.
            </p>
          </div>
          <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-medium">
            Manual
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <input
            type="number"
            step="0.1"
            value={deniPpg}
            onChange={(e) => setDeniPpg(e.target.value)}
            placeholder="PPG"
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.1"
            value={deniRpg}
            onChange={(e) => setDeniRpg(e.target.value)}
            placeholder="RPG"
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.1"
            value={deniApg}
            onChange={(e) => setDeniApg(e.target.value)}
            placeholder="APG"
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            value={deniGamesPlayed}
            onChange={(e) => setDeniGamesPlayed(e.target.value)}
            placeholder="Games"
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          />
        </div>

        <label className="block text-xs text-gray-500 mb-1">Game log (one line per game)</label>
        <textarea
          value={deniGamesLog}
          onChange={(e) => setDeniGamesLog(e.target.value)}
          rows={4}
          placeholder={"YYYY-MM-DD,34:12,27,8,5\nYYYY-MM-DD,36:01,31,7,4"}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono"
        />
      </div>

      {/* Yes/No Snack Questions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">
              Yes/No predictions
            </p>
            <p className="text-xs text-gray-500">
              Set the answer once the outcome is known. Leave pending until
              decided.
            </p>
          </div>
          <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-medium">
            Manual
          </span>
        </div>
        {snacks.map((q, i) => (
          <div
            key={q.id}
            className={`${i > 0 ? "pt-4 mt-4 border-t border-gray-100" : ""}`}
          >
            <p className="text-sm text-gray-900 mb-3">
              <span className="text-xs text-gray-400 mr-1.5">{i + 1}.</span>
              {q.question}
            </p>
            <div className="flex gap-2">
              {([true, false, null] as (boolean | null)[]).map((val) => {
                const label = val === null ? "Pending" : val ? "Yes" : "No";
                const active = q.result === val;
                let classes =
                  "px-4 py-1.5 rounded-lg text-sm cursor-pointer border transition-all ";
                if (active && val === true)
                  classes += "bg-green-50 text-green-700 border-green-200 font-medium";
                else if (active && val === false)
                  classes += "bg-red-50 text-red-700 border-red-200 font-medium";
                else if (active && val === null)
                  classes += "bg-gray-100 text-gray-600 border-gray-200 font-medium";
                else classes += "bg-transparent text-gray-500 border-gray-200";
                return (
                  <button
                    key={String(val)}
                    onClick={() =>
                      setSnacks((prev) =>
                        prev.map((sq, si) =>
                          si === i ? { ...sq, result: val } : sq
                        )
                      )
                    }
                    className={classes}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
      >
        {saving
          ? "Saving and recalculating scores..."
          : "Save and recalculate scores"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Saving triggers a full score recalculation for all participants.
      </p>
    </div>
  );
}