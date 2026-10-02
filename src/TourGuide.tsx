import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Gauge,
  GitBranch,
  GraduationCap,
  Play,
  SlidersHorizontal,
  Waves,
} from "lucide-react";

export interface TourGuideProps {
  nodes: {
    id: string;
    kind: string;
    symbolType?: string;
    tag: string;
  }[];
  edges: { id: string }[];
  view: string;
  onExit: () => void;
  onOpenTutorial: () => void;
  onKeepBuilding: () => void;
}

const STEPS = [
  {
    title: "Your practice space",
    body: "This is your private practice canvas. Build a simple pressure system and try the tools at your own pace.",
    where: "Where: Training Lab canvas",
    icon: FlaskConical,
  },
  {
    title: "Start with a storage tank",
    body: "Drag a Storage tank onto the canvas. It will be the starting point for your system.",
    where: "Where: Component library → Storage tank",
    icon: Waves,
  },
  {
    title: "Add a manual ball valve",
    body: "Drag a manual ball valve onto the canvas beside your tank. You’ll use it to control the flow.",
    where: "Where: Component library → Manual ball valve",
    icon: SlidersHorizontal,
  },
  {
    title: "Add a pressure transducer",
    body: "Place a pressure transducer beside the valve. It gives you a point to read the system’s pressure.",
    where: "Where: Component library → Pressure transducer",
    icon: Gauge,
  },
  {
    title: "Connect your components",
    body: "Use the connect tool to link the tank to the valve, then the valve to the transducer. PropFlow infers the ports for you.",
    where: "Where: Canvas toolbar → Connect tool",
    icon: GitBranch,
  },
  {
    title: "See the pressure ladder",
    body: "Press “Run simulation” to see your system’s pressure ladder. Follow the pressure through the components you connected.",
    where: "Where: Header → Run simulation",
    icon: Play,
  },
  {
    title: "You’re ready to explore",
    body: "Nice work—you’ve reached the end of the tour. Open the tutorial for more practice, keep building here, or head back home.",
    where: "Where: Choose your next step below",
    icon: GraduationCap,
  },
] as const;

export default function TourGuide({
  nodes,
  edges,
  view,
  onExit,
  onOpenTutorial,
  onKeepBuilding,
}: TourGuideProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step] ?? STEPS[0];
  const Icon = current.icon;
  const isLastStep = step === STEPS.length - 1;

  const detected =
    step === 1
      ? nodes.some((node) => node.kind === "tank")
      : step === 2
        ? nodes.some((node) => node.kind === "valve")
        : step === 3
          ? nodes.some((node) => node.kind === "sensor")
          : step === 4
            ? edges.length >= 2
            : step === 5
              ? view === "ladder"
              : false;

  useEffect(() => {
    if (!detected) return;

    const timer = window.setTimeout(() => {
      setStep((previous) =>
        previous === step
          ? Math.min(previous + 1, STEPS.length - 1)
          : previous,
      );
    }, 600);

    return () => window.clearTimeout(timer);
  }, [step, detected]);

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

        .tour-badge {
          position: absolute;
          top: 70px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border: 1px solid rgba(82, 212, 255, .35);
          border-radius: 999px;
          background: var(--tour-panel);
          color: var(--tour-accent);
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 4px 20px rgba(0, 0, 0, .2);
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
        }
      `}</style>

      <div className="tour-badge">
        <FlaskConical size={16} aria-hidden="true" />
        Training Lab
      </div>

      <section className="tour-card" aria-label="Training Lab guided tour">
        <div className="tour-meta">
          <span>Step {step + 1} of 7</span>
          <button className="tour-skip" type="button" onClick={onExit}>
            Skip tour
          </button>
        </div>

        <div
          className="tour-progress"
          role="progressbar"
          aria-label="Tour progress"
          aria-valuemin={1}
          aria-valuemax={7}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of 7`}
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
              Step complete—moving on…
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
