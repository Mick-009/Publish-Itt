// Hand-authored tour. Eight steps, in Thad's voice. No LLM — this is a fixed
// sequence of fixed features, so the copy is written once and reviewed like
// the onboarding samples. The component reads from here.
//
// Voice rules in force (same as the rest of the app):
//   - sentence case, no exclamation marks, no emoji
//   - editorial vocabulary: reader (not user), note (not comment),
//     send to a reader (not share), push back (not argue)
//   - warm without being cheerful; Thad has taste and says what he thinks
//   - short declarative sentences; an editor talking, not a product tour
//
// Personalization is deliberately light (the "touch of B"): only the welcome
// and the send-off use the writer's name, and only the welcome nods to the
// book title when there is one. Everything else is fixed — a tour doesn't
// need to pretend it knows you to be good.
//
// Each step carries its own `icon` key (matched against STEP_ICONS in the
// component) so there's no fragile string-matching on the title. `is_final`
// flips the last step to the three-action chooser.

const TOTAL_STEPS = 8;

// A small helper so missing/blank names don't leave "Welcome back, ."
const nameOr = (userName) => {
  const trimmed = (userName || "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

// buildTourSteps returns the full array, with the welcome and send-off
// personalized from the passed context. Keep the signature loose — any of
// these can be null and the copy still reads cleanly.
export function buildTourSteps({ userName = null, bookTitle = null } = {}) {
  const name = nameOr(userName);
  const title = (bookTitle || "").trim();

  // Step 1 — Welcome. Name if we have it, book title if there is one.
  // Sets the editor-in-chief framing in the first breath. When we know the
  // book, it becomes the object of the work ("keep <title> on track")
  // rather than a tacked-on second sentence.
  const welcomeMessage = (() => {
    const greeting = name ? `Good to meet you, ${name}.` : "Good to meet you.";
    // The thing I help keep on track — the named book if we have it.
    const object = title ? title : "it";
    const closer = title
      ? " Let's get into it."
      : " Let's find your way around before you start.";
    return (
      `${greeting} I'm Thad. I'm not here to write your book for you — ` +
      `I'm here to read it, push back where it matters, and help you keep ` +
      `${object} on track.${closer}`
    );
  })();

  return [
    {
      step_number: 1,
      total_steps: TOTAL_STEPS,
      icon: "welcome",
      area: "Welcome",
      message: welcomeMessage,
      is_final: false,
    },
    {
      step_number: 2,
      total_steps: TOTAL_STEPS,
      icon: "dashboard",
      area: "Your shelf",
      message:
        "This is where your books live. Every project you start has a home " +
        "here — open one to pick up where you left off, or start something " +
        "new when the idea won't leave you alone.",
      is_final: false,
    },
    {
      step_number: 3,
      total_steps: TOTAL_STEPS,
      icon: "manuscript",
      area: "The page",
      message:
        "This is where the writing happens. Chapters down one side, the " +
        "page in the middle. No clutter, no settings to fuss with — just " +
        "you and the words. Write the way you'd write anywhere.",
      is_final: false,
    },
    {
      step_number: 4,
      total_steps: TOTAL_STEPS,
      icon: "pushback",
      area: "I push back",
      message:
        "Here's what makes me different from the rest. Ask me to read a " +
        "chapter and I'll tell you what's working and what isn't — and when " +
        "you disagree, push back. I'll hear you out, and I won't pretend to " +
        "agree just to keep the peace. That's the job.",
      is_final: false,
    },
    {
      step_number: 5,
      total_steps: TOTAL_STEPS,
      icon: "arc",
      area: "The arc",
      message:
        "Every book moves through stages — concept, draft, revisions, all " +
        "the way to published. You set where you are; I'll keep an eye on " +
        "the work and let you know if it reads like you've moved on. You " +
        "stay in charge of your own process. I just notice.",
      is_final: false,
    },
    {
      step_number: 6,
      total_steps: TOTAL_STEPS,
      icon: "sharing",
      area: "Send it to a reader",
      message:
        "When a chapter's ready for another pair of eyes, send it to a " +
        "reader with a link — no account needed on their end. What they " +
        "leave comes back to you as notes, right alongside mine. A first " +
        "reader is worth a lot. This is how you get one.",
      is_final: false,
    },
    {
      step_number: 7,
      total_steps: TOTAL_STEPS,
      icon: "momentum",
      area: "Keep the streak",
      message:
        "Set a daily word goal and I'll track it quietly — a streak, a few " +
        "days at a glance, nothing that nags. The point isn't the number. " +
        "It's showing up tomorrow, and the day after.",
      is_final: false,
    },
    {
      step_number: 8,
      total_steps: TOTAL_STEPS,
      icon: "welcome",
      area: "That's the tour",
      message: name
        ? `That's the shape of it, ${name}. The rest you'll find as you go. ` +
          `Where do you want to start?`
        : "That's the shape of it. The rest you'll find as you go. Where do " +
          "you want to start?",
      is_final: true,
    },
  ];
}

export const TOUR_TOTAL_STEPS = TOTAL_STEPS;
