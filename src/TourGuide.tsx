import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Cable,
  CheckCircle2,
  ClipboardList,
  Droplets,
  FlaskConical,
  Gauge,
  GitBranch,
  GraduationCap,
  Magnet,
  SlidersHorizontal,
  Waves,
  Wind,
} from "lucide-react";

export interface TourGuideProps {
  nodes: {
    id: string;
    kind: string;
    symbolType?: string;
    tag: string;
    x: number;
    y: number;
    fluid?: string;
    pressure?: number;
    tankRole?: string;
    boundary?: string;
    ventsToAmbient?: boolean;
  }[];
  edges: { id: string; from?: string; to?: string }[];
  view: string;
  onExit: () => void;
  onOpenTutorial: () => void;
  onKeepBuilding: () => void;
}

const STEPS = [
  {
    title: "Your practice space",
    body: "This is your private practice canvas \u2014 nothing you build here touches team projects. Follow along and we\u2019ll build a small pressurized feed line together.",
    where: "The Training Lab button up top restarts this tour anytime.",
    icon: FlaskConical,
  },
  {
    title: "Start with a storage tank",
    body: "Drag a Storage tank onto the canvas \u2014 every system starts at its pressure source.",
    where: "Component library \u2192 Storage tank (highlighted)",
    icon: Waves,
  },
  {
    title: "Make it a filled source",
    body: "Click the tank to select it, then use the Inspector on the right: name it in the Tag field (try \u201cLOX Run Tank\u201d), set Tank role to \u201cFilled / source tank\u201d, and enter a Pressure \u2014 3000 psi works.",
    where: "Canvas \u2192 click the tank \u2192 Inspector",
    icon: Droplets,
  },
  {
    title: "Add a manual ball valve",
    body: "Drag in a Manual ball valve to the right of your tank. This is your shutoff.",
    where: "Component library \u2192 Manual ball valve (highlighted)",
    icon: SlidersHorizontal,
  },
  {
    title: "Connect tank to valve",
    body: "Drag from the blue port dot on the tank to a port on the valve. PropFlow figures out the exact ports from the geometry.",
    where: "Blue port dots on each component",
    icon: Cable,
  },
  {
    title: "Snap the valve level",
    body: "Hold Shift and drag the valve \u2014 it snaps into alignment with the tank\u2019s port, so the run between them comes out perfectly straight.",
    where: "Hold Shift while dragging the valve",
    icon: Magnet,
  },
  {
    title: "Park a transducer under the line",
    body: "Drag in a Pressure transducer and place it underneath the tank-to-valve line. You\u2019ll tap it straight into the run \u2014 no tee fitting needed.",
    where: "Component library \u2192 Pressure transducer (highlighted)",
    icon: Gauge,
  },
  {
    title: "Branch onto the line",
    body: "Drag from a port on the transducer up to the pipe itself. The connector snaps onto the run \u2014 let go and PropFlow plants a branch point on the line. You can slide that point along the pipe anytime.",
    where: "Drag a port onto the pipe run",
    icon: GitBranch,
  },
  {
    title: "Add a vent valve",
    body: "Add a second Manual ball valve downstream of the first one and connect them. Then click the new valve and tick \u201cVents to ambient\u201d in the Inspector \u2014 that\u2019s your vent path.",
    where: "Component library \u2192 Manual ball valve \u00b7 Inspector \u2192 Vents to ambient",
    icon: Wind,
  },
  {
    title: "Open SOP states",
    body: "Last stop: SOP states. That\u2019s where this diagram becomes a step-by-step procedure, with valve positions checked against the drawing as you write.",
    where: "Diagram toolbar \u2192 SOP states",
    icon: ClipboardList,
  },
  {
    title: "You built a P&ID",
    body: "A filled source, a shutoff, a pressure tap branched right onto the line, and a vent \u2014 that\u2019s the core loop. Open the tutorial for the full tour of quality-of-life features, or keep experimenting on this canvas.",
    where: "Choose your next step below",
    icon: GraduationCap,
  },
] as const;

const TARGETS: Record<number, string> = {
  0: "restart-tour",
  1: "tank",
  3: "valve",
  6: "sensor",
  8: "valve",
  9: "sop-states",
};

export default function TourGuide({
  nodes,
  edges,
  view,
  onExit,
  onOpenTutorial,
  onKeepBuilding,
}: TourGuideProps) {
  const [step, setStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<ReadonlySet<number>>(new Set());
  const current = STEPS[step] ?? STEPS[0];
  const Icon = current.icon;
  const isLastStep = step === STEPS.length - 1;

  const tank = nodes.find((node) => node.kind === "tank");
  const valves = nodes.filter((node) => node.kind === "valve");
  const sensor = nodes.find((node) => node.kind === "sensor");
  const linked = (a?: string, b?: string) =>
    !!a &&
    !!b &&
    edges.some(
      (edge) =>
        (edge.from === a && edge.to === b) ||
        (edge.from === b && edge.to === a),
    );
  const neighbors = (id: string) => {
    const found = new Set<string>();
    edges.forEach((edge) => {
      if (edge.from === id && edge.to) found.add(edge.to);
      if (edge.to === id && edge.from) found.add(edge.from);
    });
    return found;
  };
  const reachableFrom = (startId: string) => {
    const seen = new Set<string>([startId]);
    const queue = [startId];
    while (queue.length) {
      const currentId = queue.pop()!;
      neighbors(currentId).forEach((id) => {
        if (!seen.has(id)) {
          seen.add(id);
          queue.push(id);
        }
      });
    }
    return seen;
  };
  const firstValve = tank
    ? valves.find((valve) => linked(tank.id, valve.id))
    : undefined;
  const secondValve = firstValve
    ? valves.find(
        (valve) => valve.id !== firstValve.id && linked(firstValve.id, valve.id),
      )
    : undefined;

  const checks: Record<number, boolean> = {
    1: !!tank,
    2:
      !!tank &&
      tank.tag.trim() !== "" &&
      !/^TK-\d+$/i.test(tank.tag.trim()) &&
      (tank.tankRole === "source" || tank.boundary === "supply") &&
      (tank.pressure ?? 0) > 0,
    3: valves.length >= 1,
    4: !!firstValve,
    5: !!tank && !!firstValve && Math.abs(firstValve.y - tank.y) <= 3,
    6: !!sensor && sensor.y > (firstValve?.y ?? tank?.y ?? 0) + 15,
    7: !!tank && !!sensor && reachableFrom(tank.id).has(sensor.id),
    8: !!secondValve && secondValve.ventsToAmbient === true,
    9: view === "sop",
  };
  const detected = checks[step] ?? false;
  const stepDone = doneSteps.has(step);

  useEffect(() => {
    if (!detected || stepDone) return;
    const timer = window.setTimeout(() => {
      setDoneSteps((previous) => {
        const updated = new Set(previous);
        updated.add(step);
        return updated;
      });
      setStep((previous) =>
        previous === step
          ? Math.min(previous + 1, STEPS.length - 1)
          : previous,
      );
    }, 600);
    return () => window.clearTimeout(timer);
  }, [step, detected, stepDone]);

  const [ring, setRing] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    const key = TARGETS[step];
    if (!key) {
      setRing(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(`[data-tour="${key}"]`);
      if (!el) {
        setRing(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRing({ x: r.left - 5, y: r.top - 5, w: r.width + 10, h: r.height + 10 });
    };
    update();
    const id = window.setInterval(update, 350);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [step]);

  const next = () =>
    setStep((previous) => Math.min(previous + 1, STEPS.length - 1));
  const back = () => setStep((previous) => Math.max(previous - 1, 0));

  return (
    <div className="tour-overlay">
      <style>{`
        .tour-overlay {
          --tour-panel: rgba(13, 23, 34, .95);
          --tour-accent: #52d4ff;
          --tour-text: #dbe7f1;
          --tour-dim: #8fa3b3;
          position: fixed;
          inset: 0;
          z-index: 1000;
          pointer-events: none;
          color: var(--tour-text);
          font-family: inherit;
        }
        .tour-overlay,
        .tour-overlay * {
          box-sizing: border-box;
        }
        .tour-ring {
          position: fixed;
          z-index: 1001;
          border: 2px solid var(--tour-accent);
          border-radius: 12px;
          pointer-events: none;
          box-shadow: 0 0 0 4px rgba(82, 212, 255, .18), 0 0 24px rgba(82, 212, 255, .35);
          animation: tour-ring-pulse 1.6s ease-in-out infinite;
        }
        @keyframes tour-ring-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(82, 212, 255, .14), 0 0 18px rgba(82, 212, 255, .28); }
          50% { box-shadow: 0 0 0 7px rgba(82, 212, 255, .22), 0 0 30px rgba(82, 212, 255, .45); }
        }
        .tour-card {
          position: absolute;
          bottom: max(20px, env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          width: min(540px, calc(100% - 32px));
          max-height: calc(100dvh - 88px);
          overflow-y: auto;
          padding: 22px;
          border: 1px solid rgba(143, 163, 179, .25);
          border-radius: 18px;
          background: var(--tour-panel);
          box-shadow: 0 16px 50px rgba(0, 0, 0, .4);
          pointer-events: auto;
        }
        .tour-meta,
        .tour-footer,
        .tour-navigation,
        .tour-heading {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tour-meta,
        .tour-footer {
          justify-content: space-between;
        }
        .tour-meta {
          margin-bottom: 10px;
          color: var(--tour-dim);
          font-size: 12px;
        }
        .tour-progress {
          height: 3px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(143, 163, 179, .2);
          margin-bottom: 20px;
        }
        .tour-progress-fill {
          height: 100%;
          background: var(--tour-accent);
          transition: width .25s ease;
        }
        .tour-heading {
          margin-bottom: 10px;
        }
        .tour-icon {
          flex-shrink: 0;
          color: var(--tour-accent);
        }
        .tour-title {
          margin: 0;
          color: var(--tour-text);
          font-size: 20px;
          line-height: 1.3;
          font-weight: 700;
        }
        .tour-body {
          margin: 0 0 12px;
          color: var(--tour-text);
          font-size: 14px;
          line-height: 1.6;
        }
        .tour-where {
          margin: 0;
          color: var(--tour-dim);
          font-size: 12px;
          line-height: 1.5;
        }
        .tour-detected {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 12px 0 0;
          color: var(--tour-accent);
          font-size: 12px;
        }
        .tour-footer {
          margin-top: 20px;
          flex-wrap: wrap;
        }
        .tour-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 20px;
        }
        .tour-button,
        .tour-skip {
          font: inherit;
          cursor: pointer;
        }
        .tour-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 40px;
          padding: 9px 13px;
          border: 1px solid rgba(143, 163, 179, .3);
          border-radius: 9px;
          background: transparent;
          color: var(--tour-text);
          font-size: 13px;
          font-weight: 600;
        }
        .tour-button:hover {
          background: rgba(143, 163, 179, .12);
        }
        .tour-button-primary {
          background: var(--tour-accent);
          border-color: var(--tour-accent);
          color: #0d1722;
        }
        .tour-button-primary:hover {
          background: #85e1ff;
          border-color: #85e1ff;
        }
        .tour-skip {
          padding: 6px 0;
          border: 0;
          background: transparent;
          color: var(--tour-dim);
          font-size: 12px;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .tour-skip:hover {
          color: var(--tour-text);
        }
        .tour-button:focus-visible,
        .tour-skip:focus-visible {
          outline: 2px solid var(--tour-accent);
          outline-offset: 4px;
        }
        @media (max-width: 420px) {
          .tour-card {
            padding: 18px;
          }
          .tour-title {
            font-size: 18px;
          }
          .tour-actions .tour-button {
            flex: 1 1 auto;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .tour-progress-fill {
            transition: none;
          }
          .tour-ring {
            animation: none;
          }
        }
      `}</style>

      {ring && (
        <div
          className="tour-ring"
          style={{ left: ring.x, top: ring.y, width: ring.w, height: ring.h }}
        />
      )}

      <section className="tour-card" aria-label="Training Lab guided tour">
        <div className="tour-meta">
          <span>Step {step + 1} of {STEPS.length}</span>
          <button className="tour-skip" type="button" onClick={onExit}>
            Skip tour
          </button>
        </div>

        <div
          className="tour-progress"
          role="progressbar"
          aria-label="Tour progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of ${STEPS.length}`}
        >
          <div
            className="tour-progress-fill"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="tour-content" aria-live="polite" aria-atomic="true">
          <div className="tour-heading">
            <Icon className="tour-icon" size={24} aria-hidden="true" />
            <h2 className="tour-title">{current.title}</h2>
          </div>
          <p className="tour-body">{current.body}</p>
          <p className="tour-where">{current.where}</p>
          {detected && (
            <p className="tour-detected">
              <CheckCircle2 size={14} aria-hidden="true" />
              {stepDone ? "Step complete" : "Step complete \u2014 moving on"}
            </p>
          )}
        </div>

        {isLastStep && (
          <div className="tour-actions">
            <button
              className="tour-button tour-button-primary"
              type="button"
              onClick={onOpenTutorial}
            >
              Open tutorial
            </button>
            <button
              className="tour-button"
              type="button"
              onClick={onKeepBuilding}
            >
              Keep building
            </button>
            <button className="tour-button" type="button" onClick={onExit}>
              Back to home
            </button>
          </div>
        )}

        <div className="tour-footer">
          <div className="tour-navigation">
            {step > 0 && (
              <button className="tour-button" type="button" onClick={back}>
                <ArrowLeft size={15} aria-hidden="true" />
                Back
              </button>
            )}
          </div>
          {!isLastStep && (
            <button
              className="tour-button tour-button-primary"
              type="button"
              onClick={next}
            >
              {step === 0 ? "Start building" : "Next"}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
