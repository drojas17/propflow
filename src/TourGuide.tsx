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
  Layers,
  Magnet,
  MousePointerClick,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
  Zap,
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
    state?: string;
  }[];
  edges: { id: string; from?: string; to?: string }[];
  view: string;
  phase: "build" | "sop";
  sop: { steps: number; titled: number; actions: number; initialAllClosed: boolean; played: boolean };
  onStartSop: () => void;
  onSkipToSop: () => void;
  onExit: () => void;
  onOpenTutorial: () => void;
  onKeepBuilding: () => void;
}

const STEPS_BUILD = [
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
    body: "Click the tank to select it, then use the Inspector on the right: name it in the Tag field (try \u201cGN2 T-Bottle\u201d), set Tank role to \u201cFilled / source tank\u201d, and enter a Pressure \u2014 3000 psi works.",
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
    title: "Add a relief valve on the same tap",
    body: "Drag in a Relief valve and connect its port to the same branch point as the transducer \u2014 it\u2019ll share the tap. If pressure ever spikes, this is what saves the hardware.",
    where: "Component library \u2192 Relief valve (highlighted)",
    icon: ShieldCheck,
  },
  {
    title: "Add a solenoid vent valve",
    body: "Add a Solenoid valve downstream of the manual valve and connect them. Then click it: tick \u201cVents to ambient\u201d and set Default state to OPEN \u2014 a vent is normally open, so on a power loss it opens on its own and safes the system.",
    where: "Component library \u2192 Solenoid valve (highlighted) \u00b7 Inspector \u2192 Vents to ambient",
    icon: Zap,
  },
  {
    title: "Second transducer, between the valves",
    body: "Park another Pressure transducer between the two valves and branch it onto the line the same way. Now you can read pressure on both sides of the shutoff.",
    where: "Component library \u2192 Pressure transducer (highlighted)",
    icon: Gauge,
  },
  {
    title: "Your P&ID is complete",
    body: "Filled source, shutoff, a relief-protected tap, a solenoid vent, and a transducer on each side. From here: keep building your own P&ID on this canvas, or take the SOP states tutorial and turn this system into a procedure you can run.",
    where: "Choose below",
    icon: GraduationCap,
  },
] as const;

const STEPS_SOP = [
  {
    title: "Welcome to SOP states",
    body: "An SOP turns your diagram into a procedure: a list of steps, each built from actions \u2014 open this valve, verify that reading. PropFlow checks every action against the real components in your drawing.",
    where: "SOP workspace \u00b7 Procedure builder",
    icon: ClipboardList,
  },
  {
    title: "Start from a known state",
    body: "First, the initial state: it defines where every valve sits before the procedure runs. Select Initial state at the top of the step list, then hit Close all valves on the right \u2014 everything shut is a known starting point.",
    where: "Step list \u2192 Initial state \u00b7 right rail \u2192 Close all valves",
    icon: ShieldCheck,
  },
  {
    title: "Add your first step",
    body: "Add a step from the step list. Each step is one thing the operator does, in order.",
    where: "Step list \u2192 Add step",
    icon: Plus,
  },
  {
    title: "Name it: Open tank valve",
    body: "Title this step \u201cOpen tank valve\u201d \u2014 the name should say exactly what happens \u2014 and choose the operator role responsible for it.",
    where: "Step editor \u2192 title + Operator role",
    icon: Pencil,
  },
  {
    title: "Add an action",
    body: "Now the action: open the tank valve. Two ways \u2014 click the valve right on the diagram and hit Open, or add an action here and pick the valve from the dropdown. Actions always target real components, so there\u2019s no valve name to typo.",
    where: "Step editor \u2192 Add action",
    icon: MousePointerClick,
  },
  {
    title: "Build the sequence",
    body: "Add a second step: Confirm the vent valve is closed (it starts closed), then Verify the transducer reads about 3000 psi \u2014 the pressure your source tank is supplying.",
    where: "Step list \u2192 Add step \u00b7 step editor",
    icon: Layers,
  },
  {
    title: "Run your SOP",
    body: "Hit Play sequence in the bar above the diagram and watch the procedure run: valves change state, the right rail tracks every position, and a Safe system / power loss button appears next to Pause while it runs.",
    where: "Diagram bar \u2192 Play sequence",
    icon: Play,
  },
  {
    title: "Procedure complete",
    body: "Diagram \u2192 procedure \u2192 simulated run: the full PropFlow loop. Hit Export SOP PDF in the left rail to generate the finished SOP document, then keep building on your own P&ID or head back home.",
    where: "Choose below",
    icon: GraduationCap,
  },
] as const;

const TARGETS_BUILD: Record<number, string> = {
  0: "restart-tour",
  1: "tank",
  3: "valve",
  6: "sensor",
  8: "relief",
  9: "solenoid",
  10: "sensor",
};

const TARGETS_SOP: Record<number, string> = { 1: "sop-initial" };

export default function TourGuide({
  nodes,
  edges,
  view,
  phase,
  sop,
  onStartSop,
  onSkipToSop,
  onExit,
  onOpenTutorial,
  onKeepBuilding,
}: TourGuideProps) {
  const [step, setStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<ReadonlySet<number>>(new Set());
  const [editorH, setEditorH] = useState(0);
  const STEPS = phase === "sop" ? STEPS_SOP : STEPS_BUILD;
  const TARGETS = phase === "sop" ? TARGETS_SOP : TARGETS_BUILD;
  const current = STEPS[step] ?? STEPS[0];
  const Icon = current.icon;
  const isLastStep = step === STEPS.length - 1;

  const tank = nodes.find((node) => node.kind === "tank");
  const valves = nodes.filter((node) => node.kind === "valve");
  const sensors = nodes.filter((node) => node.kind === "sensor");
  const sensor = sensors[0];
  const relief = nodes.find((node) => node.symbolType === "relief-valve");
  const solenoid = valves.find((valve) => valve.symbolType === "solenoid");
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
  const sharedTap = (a?: string, b?: string) => {
    if (!a || !b) return false;
    const aNeighbors = neighbors(a);
    return [...neighbors(b)].some(
      (id) =>
        aNeighbors.has(id) &&
        nodes.find((n) => n.id === id)?.kind === "junction",
    );
  };

  const buildChecks: Record<number, boolean> = {
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
    8:
      !!relief &&
      !!tank &&
      (sharedTap(sensor?.id, relief.id) ||
        reachableFrom(tank.id).has(relief.id)),
    9:
      !!solenoid &&
      !!firstValve &&
      linked(firstValve.id, solenoid.id) &&
      solenoid.ventsToAmbient === true &&
      solenoid.state === "open",
    10:
      !!tank &&
      sensors.length >= 2 &&
      sensors.some(
        (other) =>
          other.id !== sensor?.id && reachableFrom(tank.id).has(other.id),
      ),
  };
  const sopChecks: Record<number, boolean> = {
    1: sop.initialAllClosed,
    2: sop.steps >= 1,
    3: sop.titled >= 1,
    4: sop.actions >= 1,
    5: sop.steps >= 2 && sop.actions >= 2,
    6: sop.played,
  };
  const detected =
    (phase === "sop" ? sopChecks : buildChecks)[step] ?? false;
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

  useEffect(() => {
    if (phase !== "sop") {
      setEditorH(0);
      return;
    }
    const update = () => {
      const el = document.querySelector(".sop-editor");
      setEditorH(el ? el.getBoundingClientRect().height : 0);
    };
    update();
    const id = window.setInterval(update, 500);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [phase]);

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

      <section className="tour-card" aria-label="Training Lab guided tour" style={phase === "sop" ? { left: "auto", right: 14, transform: "none", bottom: editorH + 14, width: "min(430px, calc(100% - 28px))", maxHeight: `calc(100dvh - ${editorH + 104}px)` } : undefined}>
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

        {isLastStep && phase === "build" && (
          <div className="tour-actions">
            <button
              className="tour-button tour-button-primary"
              type="button"
              onClick={onStartSop}
            >
              Do the SOP states tutorial
            </button>
            <button
              className="tour-button"
              type="button"
              onClick={onKeepBuilding}
            >
              Build your own P&ID
            </button>
            <button className="tour-button" type="button" onClick={onExit}>
              Back to home
            </button>
          </div>
        )}

        {isLastStep && phase === "sop" && (
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
            {phase === "build" && (
              <button className="tour-button" type="button" onClick={onSkipToSop}>
                Skip to SOP building
              </button>
            )}
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
