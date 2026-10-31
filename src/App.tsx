import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Counter } from "./components/Counter";
import { CandyProgress } from "./components/CandyProgress";
import { StatsDisplay } from "./components/StatsDisplay";
import { LightningCanvas } from "./components/LightningCanvas";
import { DroolingRain } from "./components/DroolingRain";
import { ViewerControls } from "./components/ViewerControls";
import { StatsPage } from "./components/StatsPage";
import { PageShell } from "./components/PageShell";
import { useCounter } from "./hooks/useCounter";
import { useStats } from "./hooks/useStats";
import { useSSE } from "./hooks/useSSE";
import { useProjectionMode } from "./hooks/useProjectionMode";
import { useGameFeed } from "./hooks/useGameFeed";
import { LiveBanner } from "./components/LiveBanner";
import type { AimedStrike } from "./components/LightningCanvas";
import "./App.css";

// three.js only loads on the game page: the counter page and the stats
// page never pay for it
const Game = lazy(() =>
  import("./components/Game").then((m) => ({ default: m.Game })),
);
const loadBroadcast = () => import("./components/GameBroadcast");
const GameBroadcast = lazy(() =>
  loadBroadcast().then((m) => ({ default: m.GameBroadcast })),
);

// Cheap router for /game route
function usePath() {
  return window.location.pathname;
}

function App() {
  const path = usePath();

  // Phone controller route
  if (path === "/game") {
    return (
      <Suspense
        fallback={
          <PageShell active="game" title="🪦 Graveyard Bonk">
            {null}
          </PageShell>
        }
      >
        <Game />
      </Suspense>
    );
  }

  if (path === "/stats") {
    return <StatsPage />;
  }

  return <CounterPage />;
}

// Projection/viewer page. Own component so its hooks run unconditionally
// (App returns early for /game and /stats)
function CounterPage() {
  const isProjection = useProjectionMode();
  const counter = useCounter();
  const stats = useStats(
    counter.currentCount,
    counter.candyRemaining,
    counter.initialCandyCount,
  );

  // Graveyard Bonk as the door and viewers see it
  const feed = useGameFeed();
  const gamePhase = feed.broadcast.phase;
  const gameLive = gamePhase === "countdown" || gamePhase === "live";
  const showBroadcast = isProjection && gamePhase !== "idle";

  // Fetch the 3D chunk while the door idles, so the first game starts
  // instantly instead of waiting on a download
  useEffect(() => {
    if (!isProjection) return;
    void loadBroadcast();
    void import("./game/models").then((m) => m.preloadScenery());
  }, [isProjection]);

  // The EventSource is shared with useCounter - this hook instance just
  // subscribes to it for effect events
  const { lastMessage } = useSSE("/api/events");

  // Effect triggers: bump counters when SSE effect events arrive
  const [lightningTrigger, setLightningTrigger] = useState(0);
  const [rainTrigger, setRainTrigger] = useState(0);

  // Game effects: a bolt on the bonked grave, candy when Grandma gets it
  const [strike, setStrike] = useState<AimedStrike | undefined>();
  const [burst, setBurst] = useState(0);
  const onStrike = useCallback(
    (x: number) => setStrike((prev) => ({ id: (prev?.id ?? 0) + 1, x })),
    [],
  );
  const onCandyBurst = useCallback(() => setBurst((b) => b + 1), []);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "effect_lightning") {
      setLightningTrigger((t: number) => t + 1);
    }
    if (lastMessage.type === "effect_candy_rain") {
      setRainTrigger((t: number) => t + 1);
    }
  }, [lastMessage]);

  // Log connection status to console
  useEffect(() => {
    if (counter.isConnected) {
      console.log("✅ Connected to counter server");
    } else if (counter.connectionError) {
      console.log("❌ Server connection error:", counter.connectionError);
    } else {
      console.log("⏳ Connecting to server...");
    }
  }, [counter.isConnected, counter.connectionError]);

  useEffect(() => {
    // Projector-only shortcuts: a viewer's spacebar must not fire
    // increments, and Ctrl+R / Ctrl+F should keep their browser meanings
    if (!isProjection) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "r" && e.ctrlKey) {
        e.preventDefault();
        counter.reset();
      }
      if (e.key === "f" && e.ctrlKey) {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        counter.increment();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keypress", handleKeyPress);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keypress", handleKeyPress);
    };
  }, [counter, isProjection]);

  const page = (
    <div className={`app ${isProjection ? "projection" : ""}`}>
      {/* Random lightning and rain are the door's; phones only show what someone fired */}
      <LightningCanvas
        triggerOnIncrement={counter.isAnimating}
        externalTrigger={lightningTrigger}
        aimedStrike={strike}
        weather={isProjection && gamePhase === "idle" ? "stormy" : "calm"}
      />

      {/* Outside .main-content so it falls behind the page's UI, like the lightning */}
      {!showBroadcast && (
        <DroolingRain
          isActive={isProjection && counter.candyRemaining > 0}
          externalTrigger={rainTrigger}
          count={counter.currentCount}
        />
      )}

      {showBroadcast ? (
        <Suspense fallback={null}>
          <GameBroadcast
            feed={feed}
            count={counter.currentCount}
            isAnimating={counter.isAnimating}
            isOutOfCandy={counter.candyRemaining === 0}
            onStrike={onStrike}
            onCandyBurst={onCandyBurst}
          />
          <DroolingRain isActive={false} burstTrigger={burst} />
        </Suspense>
      ) : (
        <div className="main-content">
          <Counter
            count={counter.currentCount}
            isAnimating={counter.isAnimating}
            isOutOfCandy={counter.candyRemaining === 0}
          />

          <CandyProgress
            candyRemaining={counter.candyRemaining}
            initialCandyCount={counter.initialCandyCount}
          />

          <StatsDisplay stats={stats} />

          {/* Visitors scan from the driveway; hidden when out of candy because the widened empty bar runs under it */}
          {isProjection && counter.candyRemaining > 0 && (
            <div className="door-qr">
              <span className="door-qr-caption">Scan →</span>
              <img
                src="/qr/game-qr.svg"
                alt="QR code linking to Graveyard Bonk"
              />
              <span className="door-qr-caption">← to play</span>
            </div>
          )}

          {!isProjection && gameLive && (
            <LiveBanner
              initials={feed.broadcast.initials}
              score={feed.broadcast.score}
            />
          )}
          {!isProjection && (
            <ViewerControls effects={gameLive ? "paused" : "on"} />
          )}
        </div>
      )}
    </div>
  );

  // The projector gets the bare page - no title, no tabs, nothing to read
  // from across a driveway. Everyone else gets the shared shell.
  if (isProjection) return page;

  return (
    <PageShell active="counter" title="🎃 Candy Counter">
      {page}
    </PageShell>
  );
}

export default App;
