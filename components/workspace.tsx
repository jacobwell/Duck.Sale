"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Anchor,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  ExternalLink,
  History,
  LayoutGrid,
  LifeBuoy,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  Settings2,
  Ship,
  SlidersHorizontal,
  Sparkles,
  Waves,
  X,
  LogOut,
  Mail,
  Columns3,
  Info,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { Duck } from "./duck";
import { FleetMap } from "./fleet-map";
import { DuckDesk } from "./duck-desk";
import { personality, surpriseMissions } from "@/lib/personality";
import { browserDb } from "@/lib/supabase";
import { demoFrame, demoTotal } from "@/lib/demo";
import { categories, type CategoryId } from "@/lib/categories";
import {
  priceLabel,
  type AppConfig,
  type Listing,
  type SearchEvent,
  type SearchRun,
} from "@/lib/types";

type View = "discover" | "saved" | "history";
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function ListingImage({ listing }: { listing: Listing }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return listing.imageUrl && listing.imageUrl !== failedUrl ? (
    <Image
      src={listing.imageUrl}
      alt={
        listing.imageKind === "generated"
          ? "AI illustration — not a photo of this item"
          : listing.sample && !listing.recorded
            ? "Illustrative sample photograph"
            : listing.title
      }
      fill
      sizes="(max-width:700px) 100vw, (max-width:1100px) 50vw, 30vw"
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(listing.imageUrl)}
    />
  ) : (
    <div className="image-placeholder">
      <Ship size={42} strokeWidth={1} />
      <span>No source photo</span>
    </div>
  );
}
export function Workspace({
  initialId,
  initialSearch,
  superMode = false,
}: {
  initialId?: string;
  superMode?: boolean;
  initialSearch?: { query: string; location: string; budget: string };
}) {
  const [view, setView] = useState<View>("discover"),
    [run, setRun] = useState<SearchRun | null>(null),
    [query, setQuery] = useState<string>(
      initialSearch?.query || categories[0].options[0].query,
    ),
    [location, setLocation] = useState(
      initialSearch?.location || "San Francisco Bay",
    ),
    [budget, setBudget] = useState(initialSearch?.budget ?? "30000"),
    [intent, setIntent] = useState("buy");
  const [boatCount, setBoatCount] = useState(3);
  const [busy, setBusy] = useState(false),
    [config, setConfig] = useState<AppConfig | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [saved, setSaved] = useState<Listing[]>([]),
    [history, setHistory] = useState<SearchRun[]>([]);
  const [modal, setModal] = useState<
      "setup" | "auth" | "compare" | "how" | null
    >(null),
    [detail, setDetail] = useState<Listing | null>(null),
    [email, setEmail] = useState(""),
    [authMessage, setAuthMessage] = useState(""),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([]),
    [sort, setSort] = useState("relevance"),
    [priceFilter, setPriceFilter] = useState(false),
    [sourceFilter, setSourceFilter] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all"),
    [showFilters, setShowFilters] = useState(false);
  const [sampleSaved, setSampleSaved] = useState<Listing[]>([]),
    [authBusy, setAuthBusy] = useState(false);
  const [demoStep, setDemoStep] = useState<number | null>(null);
  const [demoPaused, setDemoPaused] = useState(false);
  useEffect(() => {
    if (demoStep === null || demoStep >= demoTotal || demoPaused) return;
    const timer = window.setTimeout(() => {
      setRun(demoFrame(demoStep + 1));
      setDemoStep(demoStep + 1);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [demoStep, demoPaused]);
  const [generating, setGenerating] = useState<string[]>([]);
  const [feedbackTarget, setFeedbackTarget] = useState<Listing | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [hiddenListings, setHiddenListings] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<CategoryId>(
    initialSearch ? "compute" : "boats",
  );
  const [categoryOption, setCategoryOption] = useState(initialSearch ? -1 : 0);
  const [condition, setCondition] = useState("Any condition");
  const category = categories.find((c) => c.id === categoryId)!;
  const categoryCopy = personality[categoryId];
  const [lastSurprise, setLastSurprise] = useState(-1);
  function feelingDucky() {
    const next =
      (lastSurprise +
        1 +
        Math.floor(Math.random() * (surpriseMissions.length - 1))) %
      surpriseMissions.length;
    const mission = surpriseMissions[next];
    setLastSurprise(next);
    setBudget("");
    chooseCategory(mission.category, mission.option);
    setNotice(
      "Duck-selected mission: " +
        mission.name +
        " Hit Send the ducks when you’re ready.",
    );
  }
  function chooseCategory(
    id: CategoryId,
    index = 0,
    requestedCondition?: string,
  ) {
    const next = categories.find((c) => c.id === id)!;
    const nextCondition = requestedCondition || next.conditions[0];
    setCategoryId(id);
    setCategoryOption(index);
    setCondition(nextCondition);
    setQuery(
      (nextCondition === "Any packaging"
        ? next.options[index].query.replace("Factory sealed ", "")
        : next.options[index].query) +
        (nextCondition !== "Any condition" &&
        nextCondition !== "Sealed only" &&
        nextCondition !== "Any packaging"
          ? `. Condition: ${nextCondition}.`
          : ""),
    );
    setIntent(id === "boats" && index === 5 ? "rent" : "buy");
    if (id !== categoryId) {
      setLocation(id === "boats" ? "San Francisco Bay" : "Anywhere");
      setBudget("");
    }
  }
  const requestRef = useRef<AbortController | null>(null);
  const fleetRef = useRef<HTMLDivElement | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!notice || busy) return;
    noticeRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [notice, busy]);
  useEffect(() => {
    if (!busy) return;
    const frame = requestAnimationFrame(() => {
      fleetRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      fleetRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [busy]);
  const requestedRunId = useRef(initialId);
  const loadedFormId = useRef<string | undefined>(undefined);
  useEffect(() => {
    requestedRunId.current = initialId;
  }, [initialId]);
  const hydrate = useCallback(async (s: Session) => {
    const db = browserDb();
    if (!db) return;
    const [bookmarks, recent] = await Promise.all([
      fetch("/api/saved", {
        headers: { Authorization: `Bearer ${s.access_token}` },
      }).then((r) => r.json()),
      fetch("/api/searches", {
        headers: { Authorization: `Bearer ${s.access_token}` },
      }).then((r) => r.json()),
    ]);
    if (bookmarks.listings) setSaved(bookmarks.listings);
    if (recent.runs) setHistory(recent.runs);
  }, []);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setNotice("Could not check service connections."));
    const db = browserDb();
    if (db) {
      db.auth.getSession().then(({ data }) => {
        setSession(data.session);
        if (data.session) void hydrate(data.session);
      });
      const { data } = db.auth.onAuthStateChange((_e, s) => {
        setSession(s);
        if (s) setTimeout(() => void hydrate(s), 0);
        else {
          requestRef.current?.abort();
          requestRef.current = null;
          requestedRunId.current = undefined;
          loadedFormId.current = undefined;
          setBusy(false);
          setRun(null);
          setSaved([]);
          setHistory([]);
          setDetail(null);
          setSelected([]);
          setHiddenListings([]);
          setFeedbackTarget(null);
          setNotice("");
          setQuery("");
          setLocation("Anywhere");
          setBudget("");
          setIntent("buy");
          setView("discover");
          setDemoStep(null);
          window.history.replaceState(null, "", "/");
        }
      });
      return () => data.subscription.unsubscribe();
    }
  }, [hydrate]);
  useEffect(() => {
    if (!initialId || !session || requestedRunId.current !== initialId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const load = async () => {
      if (!active || requestedRunId.current !== initialId) return;
      try {
        const response = await fetch(
          `/api/searches?id=${encodeURIComponent(initialId)}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
            signal: controller.signal,
          },
        );
        const data = await response.json();
        if (!active || requestedRunId.current !== initialId) return;
        const restored = data.runs?.[0] as SearchRun | undefined;
        if (!response.ok || !restored) {
          setNotice(data.error || "Search not found in your account.");
          return;
        }
        setDemoStep(null);
        setRun(restored);
        if (loadedFormId.current !== initialId) {
          loadedFormId.current = initialId;
          setQuery(restored.query);
          setLocation(restored.location);
          setBudget(restored.budget == null ? "" : String(restored.budget));
          setIntent(restored.intent);
        }
        if (restored.status === "running")
          timer = setTimeout(() => void load(), 8000);
      } catch {
        if (
          active &&
          !controller.signal.aborted &&
          requestedRunId.current === initialId
        )
          setNotice("Could not refresh this search. Reload to try again.");
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [initialId, session]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const allSaved = [...saved, ...sampleSaved];
  const activeListings = view === "saved" ? allSaved : run?.listings || [];
  let listings = activeListings.filter(
    (l) =>
      !hiddenListings.includes(l.id) &&
      (sourceFilter === "all" || l.source === sourceFilter) &&
      (statusFilter === "all" || l.status === statusFilter) &&
      (!priceFilter || l.price !== null),
  );
  if (sort === "price")
    listings = [...listings].sort(
      (a, b) =>
        `${a.currency || "ZZZ"}-${a.priceUnit}`.localeCompare(
          `${b.currency || "ZZZ"}-${b.priceUnit}`,
        ) || (a.price ?? Infinity) - (b.price ?? Infinity),
    );
  const sources = Array.from(new Set(activeListings.map((l) => l.source)));
  const comparison = [...activeListings, ...allSaved].filter(
    (l, i, arr) =>
      selected.includes(l.id) && arr.findIndex((x) => x.id === l.id) === i,
  );
  const comparisonAttributes = Array.from(
    new Set(comparison.flatMap((l) => l.attributes?.map((a) => a.name) || [])),
  );
  const historyGroups = history.reduce((groups, item) => {
    const root = item.root_run_id || item.id;
    const group = groups.get(root) || [];
    group.push(item);
    groups.set(root, group);
    return groups;
  }, new Map<string, SearchRun[]>());
  async function generateIllustration(listing: Listing) {
    if (!session) {
      setModal("auth");
      return;
    }
    if (!run || run.sample) return;
    setGenerating((prev) => [...prev, listing.id]);
    try {
      const response = await fetch("/api/illustrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ runId: run.id, listingId: listing.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const updated = data.listing as Listing;
      setRun((prev) =>
        prev
          ? {
              ...prev,
              listings: prev.listings.map((l) =>
                l.id === updated.id ? updated : l,
              ),
            }
          : prev,
      );
      setSaved((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setDetail((prev) => (prev?.id === updated.id ? updated : prev));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Illustration failed.",
      );
    } finally {
      setGenerating((prev) => prev.filter((id) => id !== listing.id));
    }
  }
  async function save(listing: Listing) {
    if (listing.sample) {
      setSampleSaved((prev) =>
        prev.some((l) => l.id === listing.id)
          ? prev.filter((l) => l.id !== listing.id)
          : [...prev, listing],
      );
      return;
    }
    if (!session) {
      setModal("auth");
      return;
    }
    const db = browserDb()!;
    const has = saved.some((l) => l.id === listing.id);
    const result = has
      ? await db
          .from("saved_listings")
          .delete()
          .eq("user_id", session.user.id)
          .eq("listing_id", listing.id)
      : await db.from("saved_listings").upsert({
          user_id: session.user.id,
          listing_id: listing.id,
          listing,
        });
    if (result.error) {
      setNotice("Could not update your shortlist. Please try again.");
      return;
    }
    setSaved((prev) =>
      has ? prev.filter((l) => l.id !== listing.id) : [...prev, listing],
    );
  }
  function select(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev,
    );
  }
  function reset() {
    if (busy) return;
    requestedRunId.current = undefined;
    setView("discover");
    setDemoStep(null);
    setRun(null);
    setQuery("");
    setHiddenListings([]);
    setFeedbackTarget(null);
    setSelected([]);
    setNotice("");
    setSourceFilter("all");
    setStatusFilter("all");
    window.history.replaceState(null, "", "/");
  }
  function sample() {
    if (busy) return;
    requestedRunId.current = undefined;
    setDemoStep(0);
    setDemoPaused(false);
    setRun(demoFrame(0));
    setCategoryId("boats");
    setCategoryOption(0);
    setIntent("buy");
    setCondition("Any condition");
    setQuery("Find boats across the US coasts and inland lakes");
    setLocation("United States");
    setBudget("");
    setPriceFilter(false);
    setSort("relevance");
    window.history.replaceState(null, "", "/");
    setView("discover");
    setSelected([]);
    setSourceFilter("all");
    setStatusFilter("all");
    setNotice(
      "Recorded demo · 20 real source listings. Boat movement is simulated; no new searches or API calls. Check the original listings for current prices and availability.",
    );
  }
  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!config?.ready) {
      setModal("setup");
      return;
    }
    if (!session) {
      setModal("auth");
      return;
    }
    if (query.trim().length < 5) {
      setNotice("Tell the ducks a little more — at least 5 characters.");
      return;
    }
    requestedRunId.current = undefined;
    setBusy(true);
    setDemoStep(null);
    setRun(null);
    setView("discover");
    setSelected([]);
    setNotice("");
    setSourceFilter("all");
    setStatusFilter("all");
    const controller = new AbortController();
    requestRef.current = controller;
    let current: SearchRun = {
      id: "pending",
      query,
      location,
      budget: budget ? Number(budget) : null,
      intent,
      status: "running",
      listings: [],
      workers: [],
      created_at: new Date().toISOString(),
    };
    let finished = false;
    const apply = (event: SearchEvent) => {
      if (event.type === "run") {
        current = { ...current, id: event.id };
        requestedRunId.current = event.id;
        window.history.replaceState(
          null,
          "",
          `/search/${event.id}${superMode ? "?super=true" : ""}`,
        );
      }
      if (event.type === "worker") {
        current = {
          ...current,
          workers: [
            ...current.workers.filter((w) => w.id !== event.worker.id),
            event.worker,
          ].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
        };
      }
      if (event.type === "results")
        current = {
          ...current,
          listings: [...current.listings, ...event.listings],
        };
      if (event.type === "complete") {
        current = event.run;
        finished = true;
        if (event.run.warning) setNotice(event.run.warning);
      }
      if (event.type === "error") {
        finished = true;
        current = {
          ...current,
          status: current.listings.length ? "partial" : "failed",
        };
        setNotice(event.message);
      }
      setRun({ ...current });
    };
    try {
      const fresh = await browserDb()!.auth.getSession();
      const token = fresh.data.session?.access_token;
      const response = await fetch(
        superMode ? "/api/search?super=true" : "/api/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query,
            location,
            budget: budget ? Number(budget) : null,
            intent,
            boatCount,
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Search failed.");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No search stream received.");
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) if (line.trim()) apply(JSON.parse(line));
      }
      buffer += decoder.decode();
      if (buffer.trim()) apply(JSON.parse(buffer));
      if (!finished)
        throw new Error(
          "Connection interrupted. Open this search from history to recover saved progress.",
        );
      await hydrate(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Search interrupted.");
    } finally {
      setBusy(false);
      requestRef.current = null;
    }
  }
  async function continueVoyage(note = "") {
    if (!run || busy || !session || run.sample || run.status === "running")
      return;
    const parent = run;
    setBusy(true);
    setNotice(
      "The ducks are heading back out, keeping the finds already aboard.",
    );
    const controller = new AbortController();
    requestRef.current = controller;
    let current: SearchRun = {
      ...parent,
      id: "pending",
      parent_run_id: parent.id,
      status: "running",
      workers: [],
      listings: parent.listings,
    };
    let finished = false;
    const apply = (event: SearchEvent) => {
      if (event.type === "run") {
        current = { ...current, id: event.id };
        requestedRunId.current = event.id;
        window.history.replaceState(
          null,
          "",
          `/search/${event.id}${superMode ? "?super=true" : ""}`,
        );
      }
      if (event.type === "worker")
        current = {
          ...current,
          workers: [
            ...current.workers.filter((w) => w.id !== event.worker.id),
            event.worker,
          ],
        };
      if (event.type === "results")
        current = {
          ...current,
          listings: [
            ...current.listings,
            ...event.listings.filter(
              (l) => !current.listings.some((x) => x.sourceUrl === l.sourceUrl),
            ),
          ],
        };
      if (event.type === "complete") {
        current = {
          ...event.run,
          listings: [
            ...parent.listings,
            ...event.run.listings.filter(
              (l) => !parent.listings.some((x) => x.sourceUrl === l.sourceUrl),
            ),
          ],
        };
        finished = true;
      }
      if (event.type === "error") {
        finished = true;
        current = { ...current, status: "partial" };
        setNotice(event.message);
      }
      setRun({ ...current });
    };
    try {
      const token = (await browserDb()!.auth.getSession()).data.session
        ?.access_token;
      const response = await fetch("/api/search/continue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ parentId: parent.id, note }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not continue this voyage.",
        );
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No voyage stream received.");
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) if (line.trim()) apply(JSON.parse(line));
      }
      if (buffer.trim()) apply(JSON.parse(buffer));
      if (!finished)
        throw new Error(
          "Connection interrupted. This voyage is saved in search history.",
        );
      if (session) await hydrate(session);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Continuation failed.",
      );
    } finally {
      setBusy(false);
      requestRef.current = null;
    }
  }
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const db = browserDb();
    if (!db) {
      setAuthMessage("Connect Supabase first in Service setup.");
      return;
    }
    setAuthBusy(true);
    setAuthMessage("");
    const { error } = await db.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    setAuthMessage(
      error
        ? error.message
        : "Check your email for a sign-in link. Open it in this browser to return to your search.",
    );
    setAuthBusy(false);
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Duck.Sale home">
          <span className="brand-mark">
            <Duck size={33} />
          </span>
          Duck.Sale<span className="brand-dot">®</span>
        </Link>
        <button className="new-search" onClick={reset} disabled={busy}>
          <Plus size={18} /> New search <span>↗</span>
        </button>
        <div className="nav-label">YOUR LOOKOUT</div>
        <nav aria-label="Main navigation">
          <Link
            href="/private"
            style={{ padding: "12px 16px", display: "block" }}
          >
            🕵️ Private Mode
          </Link>
          <Link href="/pc" style={{ padding: "12px 16px", display: "block" }}>
            🖥️ Build a PC
          </Link>
          <Link href="/food" style={{ padding: "12px 16px", display: "block" }}>
            🍕 Feed the crew
          </Link>
          <button
            className={view === "discover" ? "active" : ""}
            onClick={() => setView("discover")}
          >
            <Compass size={19} /> Discover
          </button>
          <button
            className={view === "saved" ? "active" : ""}
            onClick={() => {
              setView("saved");
              setSourceFilter("all");
            }}
          >
            <Bookmark size={18} /> Shortlist{" "}
            <span className="count">{allSaved.length}</span>
          </button>
          <button
            className={view === "history" ? "active" : ""}
            onClick={() => {
              setView("history");
              if (session) void hydrate(session);
            }}
          >
            <History size={18} /> Search history
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="little-waves">≈ ≈ ≈</span>
          <h3>
            Big world.
            <br />
            Little search party.
          </h3>
          <p>
            Tell us what you’re after.
            <br />
            We’ll send the ducks.
          </p>
          <button onClick={() => setModal("how")}>
            How it works <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <Link href="/hackathon">
            <Anchor size={17} /> Built aboard a big idea
          </Link>
          <button onClick={() => setModal("setup")}>
            <Settings2 size={17} /> Service setup{" "}
            <span className={`service-dot ${config?.ready ? "ready" : ""}`} />
          </button>
          <button
            onClick={() =>
              session ? browserDb()?.auth.signOut() : setModal("auth")
            }
          >
            {session ? <LogOut size={17} /> : <LifeBuoy size={17} />}{" "}
            {session ? "Sign out" : "Sign in to save your finds"}
          </button>
          <div className="sidebar-footer">
            MADE FOR THE CURIOUS <span>✳</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Your corner of the internet <span>/</span>
            <strong>
              {view === "saved"
                ? "Shortlist"
                : view === "history"
                  ? "Search history"
                  : "Discover"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="beta">EARLY VOYAGE</span>
            <button
              className="avatar"
              onClick={() => setModal(session ? "setup" : "auth")}
              aria-label={session ? "Open service setup" : "Sign in"}
            >
              {session?.user.email?.slice(0, 1).toUpperCase() || (
                <Duck size={21} />
              )}
            </button>
          </div>
        </header>
        <main>
          {view === "discover" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span /> SERIOUS SEARCH. QUESTIONABLE TASTE.
                  </div>
                  <h1>
                    {categoryCopy.headline}
                    <br />
                    <span>{categoryCopy.punchline}</span>
                    <svg viewBox="0 0 245 15" aria-hidden="true">
                      <path
                        d="M3 10c62-9 158-8 239-4"
                        stroke="currentColor"
                        strokeWidth="5"
                        fill="none"
                        strokeLinecap="round"
                      />
                    </svg>
                  </h1>
                  <p>{categoryCopy.description}</p>
                  <button
                    className="feeling-ducky"
                    type="button"
                    disabled={busy}
                    onClick={feelingDucky}
                  >
                    <span>⚄</span> Feeling ducky <ArrowUpRight size={15} />
                  </button>
                </div>
                <DuckDesk key={categoryId} category={categoryId} busy={busy} />
              </section>
              <div
                className="category-tabs"
                role="group"
                aria-label="What would you like to find?"
              >
                {categories.map((c) => (
                  <button
                    type="button"
                    disabled={busy}
                    className={categoryId === c.id ? "selected" : ""}
                    aria-pressed={categoryId === c.id}
                    key={c.id}
                    onClick={() => chooseCategory(c.id)}
                  >
                    <span>{c.icon}</span>
                    {c.label}
                  </button>
                ))}
              </div>
              {categoryOption === -1 ? (
                <p className="muted">
                  Custom PC part · edit the description below or choose a
                  category preset.
                </p>
              ) : (
                <div className="category-options">
                  <label>
                    {category.optionLabel}
                    <select
                      aria-label={category.optionLabel}
                      value={categoryOption}
                      disabled={busy}
                      onChange={(e) =>
                        chooseCategory(
                          categoryId,
                          Number(e.target.value),
                          condition,
                        )
                      }
                    >
                      {category.options.map((o, i) => (
                        <option value={i} key={o.label}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Condition
                    <select
                      aria-label="Item condition"
                      value={condition}
                      disabled={busy}
                      onChange={(e) =>
                        chooseCategory(
                          categoryId,
                          categoryOption,
                          e.target.value,
                        )
                      }
                    >
                      {category.conditions.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <span>{category.hint}</span>
                </div>
              )}
              <form className="search-box" onSubmit={search}>
                <div className="search-prompt">
                  <Sparkles size={24} />
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find me a sailboat under $30k near San Francisco..."
                    aria-label="What are you looking for?"
                    maxLength={1000}
                    rows={2}
                    disabled={busy}
                  />
                </div>
                <div className="fleet-size-control">
                  <label htmlFor="fleet-size">Search boats</label>
                  <select
                    id="fleet-size"
                    value={boatCount}
                    disabled={busy}
                    onChange={(e) => setBoatCount(Number(e.target.value))}
                  >
                    {[3, 5, 10, 25, 50].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "boat" : "boats"}
                      </option>
                    ))}
                    {superMode && (
                      <option value={100}>100 boats · Super fleet</option>
                    )}
                  </select>
                  <small>
                    {boatCount > 3
                      ? "Staggered launch · larger fleets take longer and use more credits."
                      : "Complementary search angles."}{" "}
                    A retail scout may also join.
                  </small>
                </div>
                <div className="search-controls">
                  <label className="location-control">
                    <MapPin size={16} />
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      aria-label="Search location"
                      placeholder="Anywhere"
                      maxLength={120}
                      disabled={busy}
                    />
                  </label>
                  <span className="control-divider" />
                  <label className="budget-control">
                    <span>$</span>
                    <input
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      type="number"
                      min="0"
                      max="1000000000"
                      aria-label="Maximum budget in US dollars"
                      placeholder="Any budget"
                      disabled={busy}
                    />
                    <span>max</span>
                  </label>
                  <label className="intent-control">
                    <select
                      value={intent}
                      onChange={(e) => setIntent(e.target.value)}
                      aria-label="Buy or rent"
                      disabled={busy}
                    >
                      <option value="buy">To buy</option>
                      <option value="rent">To rent</option>
                      <option value="any">Either</option>
                    </select>
                    <ChevronDown size={14} />
                  </label>
                  <button
                    className="primary launch"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="spin" size={17} /> Ducks at
                        work
                      </>
                    ) : (
                      <>
                        Send the ducks <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </form>
              <div className="category-note">
                <Info size={13} />
                <span>{category.note}</span>
                <button
                  onClick={() => {
                    setQuery("");
                  }}
                  disabled={busy}
                >
                  Or search for anything <ArrowUpRight size={12} />
                </button>
              </div>
            </>
          )}
          {notice && (
            <div
              className={`notice ${run?.sample ? "sample-notice" : ""}`}
              ref={noticeRef}
              role="status"
            >
              <Info size={17} />
              <span>{notice}</span>
              <button
                className="icon-button"
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {initialId && !session && (
            <div className="notice">
              <Info size={18} />
              <span>
                This is a private saved search. Sign in with the account that
                created it.
              </span>
              <button onClick={() => setModal("auth")}>Sign in</button>
            </div>
          )}
          {view === "discover" && (
            <div
              ref={fleetRef}
              tabIndex={-1}
              aria-label="Live search progress"
              style={{ scrollMarginTop: "24px" }}
            >
              <FleetMap
                key={run?.id || "new-search"}
                run={run}
                busy={busy}
                onSelect={setDetail}
                onSample={sample}
                demoPaused={demoPaused}
                onToggleDemo={() => setDemoPaused((p) => !p)}
                onShowAll={() => {
                  setDemoStep(demoTotal);
                  setRun(demoFrame(demoTotal));
                }}
              />
            </div>
          )}
          {view === "discover" && !run?.recorded && run?.workers.length ? (
            <section className="fleet">
              <div className="fleet-title">
                <Waves size={19} />
                <strong>The quack squad</strong>
                <span>
                  {busy
                    ? "Three ducks. One highly specific obsession."
                    : "Voyage report"}
                </span>
              </div>
              <div className="workers">
                {run.workers.map((w) => (
                  <div className={`worker ${w.status}`} key={w.id}>
                    <span className="worker-icon">
                      {w.status === "complete" ? (
                        <Check size={16} />
                      ) : w.status === "failed" ? (
                        <X size={16} />
                      ) : (
                        <LoaderCircle className="spin" size={16} />
                      )}
                    </span>
                    <div>
                      <strong>
                        <span className="worker-callsign">
                          {w.name.startsWith("DoorDash ")
                            ? "Dash Duck"
                            : run.workers.length > 4
                              ? `Seeker ${w.id}`
                              : [
                                  "Captain Quack",
                                  "Duck Norris",
                                  "The Quackup Plan",
                                  "Dash Duck",
                                ][Number(w.id) - 1] || "Field duck"}
                        </span>{" "}
                        {w.name}
                      </strong>
                      <p>
                        {w.status === "complete"
                          ? `${w.count || 0} finds · ${w.message || "complete"}`
                          : w.status === "failed"
                            ? w.message
                            : w.status === "starting"
                              ? "Launching a Boat sandbox…"
                              : w.status === "searching"
                                ? w.message || "Searching and reading sources…"
                                : w.status === "extracting"
                                  ? "Making sense of the evidence…"
                                  : "Waiting to launch"}
                      </p>
                      {w.sandboxId && (
                        <small>
                          Boat {w.sandboxId.slice(0, 12)} ·{" "}
                          {w.cleanup === "stopped"
                            ? "stopped"
                            : w.cleanup === "ttl-fallback"
                              ? "auto-stop fallback"
                              : "running"}
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {view === "history" ? (
            <section className="history-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">PREVIOUS EXPEDITIONS</div>
                  <h2>Your search history</h2>
                </div>
                <History size={25} />
              </div>
              {!session ? (
                <div className="empty">
                  <History size={32} />
                  <h3>A place for every search.</h3>
                  <p>Sign in to revisit your discoveries.</p>
                  <button className="primary" onClick={() => setModal("auth")}>
                    Sign in
                  </button>
                </div>
              ) : history.length ? (
                Array.from(historyGroups.entries()).map(([rootId, voyages]) => (
                  <div className="voyage-history-group" key={rootId}>
                    {voyages.length > 1 && (
                      <div className="eyebrow">
                        LINKED VOYAGE · {voyages.length} SEARCHES
                      </div>
                    )}
                    {[...voyages]
                      .sort(
                        (a, b) =>
                          (a.voyage_number || 1) - (b.voyage_number || 1),
                      )
                      .map((h) => (
                        <Link
                          className="history-row"
                          href={
                            h.pcBuild ? `/pc?id=${h.id}` : `/search/${h.id}`
                          }
                          key={h.id}
                        >
                          <span className="history-icon">
                            <Compass size={20} />
                          </span>
                          <div>
                            <strong>{h.query}</strong>
                            <p>
                              {h.voyage_number && h.voyage_number > 1
                                ? `Voyage ${h.voyage_number} · `
                                : ""}
                              {h.location} · {h.listings.length} finds ·{" "}
                              {new Date(h.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="pill">{h.status}</span>
                          <ArrowUpRight size={18} />
                        </Link>
                      ))}
                  </div>
                ))
              ) : (
                <div className="empty">
                  <Waves size={32} />
                  <h3>Your first adventure awaits.</h3>
                  <p>Launch a search and it will appear here.</p>
                  <button onClick={reset} className="primary">
                    Start exploring
                  </button>
                </div>
              )}
            </section>
          ) : run || view === "saved" ? (
            <section className="results">
              {run &&
                view === "discover" &&
                run.status !== "running" &&
                !run.sample && (
                  <div className="notice">
                    <span>
                      Keep these {run.listings.length} finds aboard and send
                      another duck for fresh leads.
                    </span>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void continueVoyage()}
                    >
                      Send another duck ↗
                    </button>
                  </div>
                )}
              <div className="section-heading">
                <div>
                  <div className="eyebrow">
                    {view === "saved"
                      ? "THE ONES WORTH KEEPING"
                      : run?.sample
                        ? "COAST TO COAST. LAKE TO LAKE."
                        : "BROUGHT BACK BY YOUR DUCKS"}
                  </div>
                  <h2>
                    {view === "saved"
                      ? "Your shortlist"
                      : run?.sample
                        ? "The duck’s floating finds"
                        : "Look what turned up"}{" "}
                    <span className="result-count">{listings.length}</span>
                  </h2>
                </div>
                <div className="result-actions">
                  <button
                    className={showFilters ? "active-filter" : ""}
                    onClick={() => setShowFilters((v) => !v)}
                  >
                    <SlidersHorizontal size={16} /> Filters
                  </button>
                  <label>
                    <ArrowDownUp size={15} />
                    <select
                      aria-label="Sort results"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="relevance">Discovery order</option>
                      <option value="price">Price · grouped by unit</option>
                    </select>
                  </label>
                  <span className="grid-icon">
                    <LayoutGrid size={16} />
                  </span>
                </div>
              </div>
              {showFilters && (
                <div className="filters">
                  <label>
                    <input
                      type="checkbox"
                      checked={priceFilter}
                      onChange={(e) => setPriceFilter(e.target.checked)}
                    />{" "}
                    Has a price
                  </label>
                  <label>
                    Source
                    <select
                      aria-label="Filter by source"
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                    >
                      <option value="all">All sources</option>
                      {sources.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      aria-label="Filter by listing status"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      <option value="listed">Listed</option>
                      <option value="unknown">Unknown</option>
                      <option value="sold">Sold</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                  </label>
                  <span>Rental and purchase prices use different units.</span>
                </div>
              )}
              <div className="listing-grid">
                {listings.map((l) => (
                  <article className="listing-card" key={l.id}>
                    <div className="listing-image">
                      <button
                        className="image-open"
                        onClick={() => setDetail(l)}
                        aria-label={`View details for ${l.title}`}
                      >
                        <ListingImage listing={l} />
                      </button>
                      <span className="source-badge">
                        {l.recorded
                          ? "RECORDED FIND"
                          : l.sample
                            ? "EXAMPLE"
                            : l.source}
                      </span>
                      <button
                        className={`save-button ${allSaved.some((x) => x.id === l.id) ? "saved" : ""}`}
                        onClick={() => void save(l)}
                        aria-label={`${allSaved.some((x) => x.id === l.id) ? "Unsave" : "Save"} ${l.title}`}
                        aria-pressed={allSaved.some((x) => x.id === l.id)}
                      >
                        <Bookmark
                          size={17}
                          fill={
                            allSaved.some((x) => x.id === l.id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                      {l.sample && (
                        <span className="photo-label">
                          {l.recorded
                            ? "Source photo · recorded"
                            : "Illustrative photo"}
                        </span>
                      )}
                      {l.imageKind === "generated" && (
                        <span className="ai-image-label">
                          AI illustration · not the actual item
                        </span>
                      )}
                    </div>
                    <div className="listing-body">
                      <div className="listing-place">
                        <MapPin size={13} />
                        {l.location || "Location not provided"}
                        <span className={`status ${l.status}`}>
                          {l.status === "listed"
                            ? "Listed"
                            : l.status === "unknown"
                              ? "Check availability"
                              : l.status}
                        </span>
                      </div>
                      <button
                        className="listing-title"
                        onClick={() => setDetail(l)}
                      >
                        {l.title}
                      </button>
                      <div className="listing-tags">
                        {l.highlights.slice(0, 3).map((h) => (
                          <span key={h}>{h}</span>
                        ))}
                      </div>
                      {!l.imageUrl &&
                        !l.sample &&
                        run?.listings.some((item) => item.id === l.id) && (
                          <button
                            className="generate-image"
                            disabled={generating.includes(l.id) || busy}
                            onClick={() => void generateIllustration(l)}
                          >
                            {generating.includes(l.id) ? (
                              <LoaderCircle className="spin" size={13} />
                            ) : (
                              <Sparkles size={13} />
                            )}{" "}
                            {generating.includes(l.id)
                              ? "Making an illustration…"
                              : "Generate an illustration"}
                          </button>
                        )}
                      <div className="listing-footer">
                        <div>
                          <strong>{priceLabel(l)}</strong>
                          <small>
                            {l.recorded
                              ? "Price at capture"
                              : l.sample
                                ? "Example price"
                                : `via ${l.source}`}
                          </small>
                        </div>
                        <button
                          className={`compare-toggle ${selected.includes(l.id) ? "checked" : ""}`}
                          aria-label={`Compare ${l.title}`}
                          aria-pressed={selected.includes(l.id)}
                          onClick={() => select(l.id)}
                          disabled={
                            selected.length >= 3 && !selected.includes(l.id)
                          }
                        >
                          {selected.includes(l.id) ? (
                            <Check size={15} />
                          ) : (
                            <Plus size={15} />
                          )}
                        </button>
                      </div>
                      {!l.sample && view === "discover" && (
                        <div className="listing-feedback">
                          <button
                            onClick={() => {
                              setHiddenListings((items) => [...items, l.id]);
                              setNotice(
                                `Hidden ${l.title}. You can restore hidden finds below.`,
                              );
                            }}
                          >
                            Hide this
                          </button>
                          <button
                            onClick={() => {
                              setFeedbackTarget(l);
                              setFeedbackNote(
                                `Find more like ${l.title}${l.location ? ` near ${l.location}` : ""}.`,
                              );
                            }}
                          >
                            More like this
                          </button>
                          <button
                            onClick={() => {
                              setHiddenListings((items) => [...items, l.id]);
                              setFeedbackTarget(l);
                              setFeedbackNote(
                                `Wrong category: exclude results like ${l.title}.`,
                              );
                            }}
                          >
                            Wrong category
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {hiddenListings.length > 0 && (
                <button
                  className="secondary"
                  onClick={() => setHiddenListings([])}
                >
                  Show {hiddenListings.length} hidden finds
                </button>
              )}
              {feedbackTarget && (
                <div className="notice">
                  <label>
                    Steer the next voyage{" "}
                    <input
                      value={feedbackNote}
                      onChange={(event) => setFeedbackNote(event.target.value)}
                      maxLength={500}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => {
                      void continueVoyage(feedbackNote);
                      setFeedbackTarget(null);
                    }}
                  >
                    Send ducks with notes
                  </button>
                  <button onClick={() => setFeedbackTarget(null)}>
                    Cancel
                  </button>
                </div>
              )}
              {!listings.length && (
                <div className="empty">
                  <Search size={34} />
                  <h3>
                    {run?.recorded &&
                    run.status === "running" &&
                    view === "discover"
                      ? "The fleet is leaving Duck Harbor."
                      : busy ||
                          (run?.status === "running" && view === "discover")
                        ? "The ducks are out looking."
                        : view === "saved"
                          ? "Keep the good ones close."
                          : "The ducks came back empty-beaked."}
                  </h3>
                  <p>
                    {run?.recorded &&
                    run.status === "running" &&
                    view === "discover"
                      ? "Recorded finds will appear as the voyage unfolds."
                      : busy ||
                          (run?.status === "running" && view === "discover")
                        ? "Results will appear as each worker returns."
                        : view === "saved"
                          ? "Tap the bookmark on a find to add it to your shortlist."
                          : "Try a broader search, or adjust your filters."}
                  </p>
                </div>
              )}
              {run?.sample && view === "discover" && (
                <div className="sample-caption">
                  <Info size={14} /> Recorded source listings, captured November
                  18, 2026 (UTC). Prices and availability may change. City pins
                  are approximate; animated routes are for demonstration.
                </div>
              )}
            </section>
          ) : (
            <section className="onboarding">
              <div className="onboarding-top">
                <div>
                  <div className="eyebrow">LESS SCROLLING. MORE FINDING.</div>
                  <h2>We support your oddly specific era.</h2>
                  <p>
                    A normal search engine gives you tabs. We give you a search
                    party.
                  </p>
                </div>
                <button className="text-button" onClick={sample}>
                  Watch the 20-boat voyage <ArrowUpRight size={17} />
                </button>
              </div>
              <div className="steps">
                <div>
                  <span className="step-number">01</span>
                  <Search size={24} />
                  <h3>Describe the obsession</h3>
                  <p>
                    No request too niche. No duck too busy.
                    <br />
                    Boats, chips, cardboard. We get it.
                  </p>
                </div>
                <div>
                  <span className="step-number">02</span>
                  <Waves size={25} />
                  <h3>Release the quacken</h3>
                  <p>
                    A small fleet explores marketplaces,
                    <br />
                    specialists, and local corners of the web.
                  </p>
                </div>
                <div>
                  <span className="step-number">03</span>
                  <Bookmark size={23} />
                  <h3>Keep the receipts</h3>
                  <p>
                    Real sources, actual prices, saved favorites,
                    <br />
                    and plausible deniability for the duck.
                  </p>
                </div>
              </div>
            </section>
          )}
          <footer className="main-footer">
            <span>
              <Duck size={17} /> No judgment. Just ducks.
            </span>
            <nav className="demo-links" aria-label="Duck.Sale demo downloads">
              <a
                href="/demo/duck-sale-demo.mp4"
                target="_blank"
                rel="noreferrer"
              >
                Watch demo · 3 min
              </a>
              <a href="/demo/duck-sale-25-boats.mp4" target="_blank" rel="noreferrer">
                25-boat voyage · 90 sec
              </a>
              <a
                href="https://www.youtube.com/watch?v=XXRGiBiYMJ0"
                target="_blank"
                rel="noreferrer"
              >
                YouTube · earlier demo
              </a>
              <a href="/demo/duck-sale-deck.pptx" download>
                Download deck
              </a>
              <a
                href="/demo/duck-sale-voyage.gif"
                target="_blank"
                rel="noreferrer"
              >
                View GIF · 30 sec
              </a>
            </nav>
            <span>
              POWERED BY{" "}
              <a href="https://boat.dev" target="_blank" rel="noreferrer">
                boat
              </a>
              <span>×</span>
              <a href="https://context.dev" target="_blank" rel="noreferrer">
                context.dev
              </a>
              <span>×</span>
              <a
                href="https://thetokenexchange.com"
                target="_blank"
                rel="noreferrer"
              >
                NY Token Exchange
              </a>
            </span>
          </footer>
        </main>
      </div>
      {selected.length > 0 && (
        <div className="compare-bar">
          <div>
            <Columns3 size={18} />
            <strong>
              {selected.length} {selected.length === 1 ? "find" : "finds"} on
              deck
            </strong>
            <span>Pick up to 3 to compare</span>
          </div>
          <button
            className="primary"
            onClick={() => setModal("compare")}
            disabled={comparison.length < 2}
          >
            Compare finds <ArrowRight size={16} />
          </button>
          <button
            className="icon-button"
            onClick={() => setSelected([])}
            aria-label="Clear comparison"
          >
            <X size={18} />
          </button>
        </div>
      )}
      {modal === "setup" && (
        <Modal title="Get your ducks in a row" onClose={() => setModal(null)}>
          <p className="modal-intro">
            Your fleet uses these services to find, understand, and save real
            listings. Credentials stay on the server.
          </p>
          <div className="service-list">
            {config?.services.map((s) => (
              <div key={s.name}>
                <strong>{s.name}</strong>
                <span className={s.configured ? "connected" : "missing"}>
                  {s.configured ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Info size={16} />
                  )}{" "}
                  {s.configured ? "Configured" : "Needs connection"}
                </span>
              </div>
            ))}
          </div>
          <p className="muted">
            Configured means credentials are present; live searches verify
            access. Source image analysis is{" "}
            {config?.vision ? "enabled" : "off"}. Setup instructions are in the
            project README.
          </p>
          <button
            className="primary"
            onClick={() => {
              setModal(null);
              sample();
            }}
          >
            Watch the 20-boat voyage <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {modal === "auth" && (
        <Modal
          title="A home for your discoveries"
          onClose={() => setModal(null)}
        >
          <div className="auth-icon">
            <Duck size={45} />
          </div>
          <p className="modal-intro">
            Sign in with an email link to launch your fleet, keep a shortlist,
            and revisit every search.
          </p>
          <form onSubmit={signIn} className="auth-form">
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>
            <button className="primary" disabled={authBusy}>
              {authBusy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Mail size={17} />
              )}{" "}
              Send sign-in link
            </button>
          </form>
          {authMessage && (
            <p role="status" className="auth-message">
              {authMessage}
            </p>
          )}
          <p className="muted">
            Private by default. Only your account can access your searches.
          </p>
        </Modal>
      )}
      {modal === "how" && (
        <Modal
          title="Meet your little search party"
          onClose={() => setModal(null)}
        >
          <div className="how-list">
            <p>
              <strong>01 · A plan, made for you</strong>AI turns your request
              into your chosen number of web search angles, plus a DoorDash
              retail scout when a nearby item, alternative or accessory is
              plausible.
            </p>
            <p>
              <strong>02 · Three ducks, out exploring</strong>Each duck gets a
              Boat.dev sandbox. Context.dev finds and reads pages, including
              source images. Dash Duck is a separate server-side scout: it
              checks DoorDash catalogs through a shared FIFO queue.
            </p>
            <p>
              <strong>03 · Evidence, brought together</strong>AI Gateway
              extracts the details into comparable cards. Missing facts stay
              unknown, and each find links to its source.
            </p>
            <p>
              <strong>04 · Keep what catches your eye</strong>Supabase saves
              your searches and shortlist privately. Always confirm price,
              condition, and availability with the seller.
            </p>
          </div>
        </Modal>
      )}
      {modal === "compare" && (
        <Modal
          title="A few good possibilities"
          onClose={() => setModal(null)}
          wide
        >
          <p className="modal-intro">
            Different price units aren’t directly comparable. Confirm the
            details with each source.
          </p>
          <div className="comparison-wrap">
            <table className="comparison">
              <thead>
                <tr>
                  <th>THE DETAILS</th>
                  {comparison.map((l) => (
                    <th key={l.id}>{l.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  "Price",
                  "Location",
                  "Status",
                  "Why it fits",
                  "Watch-outs",
                  ...comparisonAttributes.map((name) => `Item detail: ${name}`),
                  "Source",
                ].map((field) => (
                  <tr key={field}>
                    <th>{field}</th>
                    {comparison.map((l) => (
                      <td key={l.id}>
                        {field === "Price" ? (
                          priceLabel(l)
                        ) : field === "Location" ? (
                          l.location || "Unknown"
                        ) : field === "Status" ? (
                          l.status
                        ) : field === "Why it fits" ? (
                          l.matchReason
                        ) : field === "Watch-outs" ? (
                          l.caveats.join(" ") || "No additional notes"
                        ) : field.startsWith("Item detail: ") ? (
                          (() => {
                            const attribute = l.attributes?.find(
                              (item) => item.name === field.slice(13),
                            );
                            return attribute ? (
                              <details>
                                <summary>{attribute.value}</summary>
                                <blockquote>{attribute.evidence}</blockquote>
                              </details>
                            ) : (
                              "Not stated"
                            );
                          })()
                        ) : (
                          <a
                            href={l.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {l.source} ↗
                          </a>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)}>
          <div className="detail-image">
            <ListingImage listing={detail} />
            {detail.locationPoint && (
              <a
                className="location-map-link"
                href={`https://www.google.com/maps/search/?api=1&query=${detail.locationPoint.latitude},${detail.locationPoint.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={14} /> Approximate city:{" "}
                {detail.locationPoint.label} ·{" "}
                {detail.locationPoint.latitude.toFixed(4)},{" "}
                {detail.locationPoint.longitude.toFixed(4)}{" "}
                <ExternalLink size={13} />
              </a>
            )}
            {detail.imageKind === "generated" && (
              <span className="ai-image-label">
                AI illustration · not the actual item
              </span>
            )}
          </div>
          <div className="detail-price">
            <strong>{priceLabel(detail)}</strong>
            <span>
              <MapPin size={14} />
              {detail.location || "Location unknown"}
            </span>
          </div>
          <p>{detail.description}</p>
          <div className="evidence">
            <strong>
              <Sparkles size={16} /> Why this find
            </strong>
            <p>{detail.matchReason}</p>
            <strong>Source evidence</strong>
            <p>
              <a href={detail.sourceUrl} target="_blank" rel="noreferrer">
                {new URL(detail.sourceUrl).hostname} ↗
              </a>
            </p>
            <blockquote>
              {detail.evidence || "No exact excerpt available."}
            </blockquote>
            <small>
              {detail.recorded
                ? `Recorded source snapshot · ${new Date(detail.retrievedAt).toLocaleDateString()} · availability unverified`
                : detail.sample
                  ? "Fictional sample · not verified"
                  : `Retrieved ${new Date(detail.retrievedAt).toLocaleString()} · ${detail.confidence} extraction confidence`}
            </small>
            {detail.priceEvidence && (
              <>
                <strong>Price evidence</strong>
                <blockquote>{detail.priceEvidence}</blockquote>
              </>
            )}
            {detail.statusEvidence && (
              <>
                <strong>Availability evidence</strong>
                <blockquote>{detail.statusEvidence}</blockquote>
              </>
            )}
            {detail.attributes?.length ? (
              <>
                <strong>Item details from the source</strong>
                <ul className="caveats">
                  {detail.attributes.map((attribute, index) => (
                    <li key={`${attribute.name}-${index}`}>
                      <b>{attribute.name}:</b> {attribute.value}
                      <blockquote>{attribute.evidence}</blockquote>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
          {detail.caveats.length > 0 && (
            <ul className="caveats">
              {detail.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
          <div className="detail-actions">
            <a
              className="primary"
              href={detail.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {detail.sample && !detail.recorded
                ? "Explore marketplace"
                : "Open original listing"}
              <ExternalLink size={16} />
            </a>
            <button className="secondary" onClick={() => void save(detail)}>
              <Bookmark size={16} />
              {allSaved.some((l) => l.id === detail.id) ? "Saved" : "Save find"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
