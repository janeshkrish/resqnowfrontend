import type { OptionSet, Question, QuestionOption, ServiceSpec } from "@/config/requestQuestions";
import { isTwoWheeler, type VehicleFamily } from "@/lib/vehicleClasses";

export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

export type Attachment = { type: "photo" | "voice"; url: string; name?: string };

export type FormContext = { family: VehicleFamily; classId?: string | null };

/** Which tyres the "Which tyre is flat?" picture offers. */
export const TYRES: Record<"car" | "bike", QuestionOption[]> = {
  car: [
    { v: "fl", label: "Front left", chip: "Front left tyre" },
    { v: "fr", label: "Front right", chip: "Front right tyre" },
    { v: "rl", label: "Back left", chip: "Back left tyre" },
    { v: "rr", label: "Back right", chip: "Back right tyre" },
  ],
  bike: [
    { v: "rear", label: "Back tyre" },
    { v: "front", label: "Front tyre" },
  ],
};

export function optionSetFor({ family, classId }: FormContext): OptionSet {
  if (isTwoWheeler(family, classId)) return "bike";
  return family === "commercial" ? "commercial" : "car";
}

export function optionsFor(question: Question, context: FormContext): QuestionOption[] {
  const set = optionSetFor(context);
  if (question.kind === "tyres") return TYRES[set === "bike" ? "bike" : "car"];
  if (question.byType) return question.byType[set] ?? question.byType.car ?? [];
  return question.options ?? [];
}

export function hasAnswer(answers: Answers, id: string) {
  const value = answers[id];
  return Array.isArray(value) ? value.length > 0 : value != null && value !== "";
}

export function isPicked(answers: Answers, id: string, value: string) {
  const current = answers[id];
  return Array.isArray(current) ? current.includes(value) : current === value;
}

/** Tapping an option: multi-choice questions toggle, the rest replace. */
export function toggleAnswer(answers: Answers, question: Question, value: string): Answers {
  if (!question.multi) return { ...answers, [question.id]: value };
  const current = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]) : [];
  const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
  return { ...answers, [question.id]: next };
}

export function isQuestionShown(question: Question, answers: Answers, context: FormContext) {
  if (question.only) {
    const twoWheeler = isTwoWheeler(context.family, context.classId);
    if (question.only === "four-wheeler" && twoWheeler) return false;
    if (question.only === "two-wheeler" && !twoWheeler) return false;
  }
  if (question.hideIf && answers[question.hideIf.q] === question.hideIf.is) return false;
  return true;
}

/** Questions that take an answer (the fuel cost card only shows one). */
const ANSWERED_KINDS = new Set(["seg", "cards", "visual", "list", "chips", "tyres"]);

export const shownQuestions = (spec: ServiceSpec, answers: Answers, context: FormContext) =>
  spec.questions.filter((question) => ANSWERED_KINDS.has(question.kind) && isQuestionShown(question, answers, context));

/** The first required question still unanswered, as its "need" ("the tyre type"), or null. */
export function firstMissingAnswer(spec: ServiceSpec, answers: Answers, context: FormContext, { firstOnly = false } = {}): string | null {
  for (const question of shownQuestions(spec, answers, context)) {
    if (firstOnly && !question.first) continue;
    if (!question.optional && !hasAnswer(answers, question.id)) return question.need ?? question.label.toLowerCase();
  }
  return null;
}

function labelsFor(question: Question, answers: Answers, context: FormContext) {
  const options = optionsFor(question, context);
  const value = answers[question.id];
  const values = Array.isArray(value) ? value : value != null && value !== "" ? [value] : [];
  return values
    .map((entry) => {
      const option = options.find((candidate) => candidate.v === entry) ?? (question.extra?.v === entry ? question.extra : null);
      if (!option) return null;
      if (option === question.extra) return option.chip ?? `${question.label}: not sure`;
      return option.chip ?? option.label;
    })
    .filter((entry): entry is string => Boolean(entry));
}

/** Short chips for the summary and the technician ("Tubeless", "Back left tyre", "Fit stepney"). */
export function answerChips(spec: ServiceSpec, answers: Answers, context: FormContext): string[] {
  return shownQuestions(spec, answers, context).flatMap((question) => labelsFor(question, answers, context));
}

export const isUrgent = (answers: Answers) => answers.inside === "yes" || answers.hurt === "yes";

/** `details` for POST /api/service-requests (read by resqnowbackend/services/requestDetails.js). */
export function buildRequestDetails({
  spec, answers, context, landmark, plate, note, attachments,
}: {
  spec: ServiceSpec;
  answers: Answers;
  context: FormContext;
  landmark?: string;
  plate?: string;
  note?: string;
  attachments?: Attachment[];
}) {
  const shown = shownQuestions(spec, answers, context).filter((question) => hasAnswer(answers, question.id));
  return {
    answers: shown.map((question) => ({
      id: question.id,
      question: question.label,
      value: answers[question.id],
      label: labelsFor(question, answers, context).join(", "),
    })),
    landmark: String(landmark || "").trim(),
    plate: String(plate || "").trim(),
    note: String(note || "").trim(),
    urgent: isUrgent(answers),
    attachments: (attachments ?? []).map(({ type, url }) => ({ type, url })),
  };
}
